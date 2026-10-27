import { categoryGroups, copay, isSoldOut, products, type CategoryKey, type Product } from "@/data/products";

// 예산(160만원 한도 중 쓸 금액, 정상가 기준)에 맞춰 금액대별 세트를 짭니다.

export const EQUIPMENT_LIMIT = 1_600_000;

/** 묶음별 기본으로 담는 품목(필요한 순서)과 추가로 고를 수 있는 품목 */
export const groupPlan: Record<string, { core: CategoryKey[]; extra: CategoryKey[] }> = {
  bed: { core: ["electricBed", "pressureMattress", "positioning"], extra: ["pressureCushion"] },
  move: { core: ["walker", "cane"], extra: ["wheelchair", "ramp"] },
  bath: { core: ["bathChair", "portableToilet"], extra: ["simpleToilet", "incontinence", "bathtub"] },
  safe: { core: ["safetyHandle", "antiSlipMat", "antiSlipSocks"], extra: ["wanderingSensor"] },
};

export const groupKeys = categoryGroups.map((g) => g.key);

export type Tier = "basic" | "standard" | "premium";
export const tiers: { key: Tier; label: string; desc: string }[] = [
  { key: "basic", label: "실속형", desc: "품목마다 가장 합리적인 모델" },
  { key: "standard", label: "표준형", desc: "실속형과 예산의 중간 금액에 맞춘 구성" },
  { key: "premium", label: "든든형", desc: "선택한 예산을 꽉 채운 구성" },
];

/** cost = 단가(unit) × 수량(qty). 대여는 unit = 월 대여가 × 개월, qty = 1 */
export type Line = { category: CategoryKey; product: Product; rental: boolean; monthly?: number; unit: number; qty: number; cost: number };

/** 품목별 연간(또는 내구연한 내) 급여 수량 한도 — 카탈로그 기준. 없는 품목은 1개 */
export const QTY_CAP: Partial<Record<CategoryKey, number>> = {
  safetyHandle: 10,
  antiSlipMat: 5,
  antiSlipSocks: 6,
  incontinence: 4,
  positioning: 5,
  simpleToilet: 2,
  walker: 2,
  wanderingSensor: 2,
  ramp: 6,
};
export type Plan = { tier: Tier; lines: Line[]; total: number };

/** 품목의 비용: 구입은 정상가, 대여는 월 대여가 × 개월 수 */
function cost(p: Product, months: number) {
  if (p.buy && !p.buy.soldOut) return { rental: false, unit: p.buy.price, qty: 1, cost: p.buy.price };
  const m = p.rent!.price;
  return { rental: true, monthly: m, unit: m * months, qty: 1, cost: m * months };
}

/** 고객이 직접 고른 모델 (품목 → 상품 id) */
export type Pins = Partial<Record<CategoryKey, string>>;

/** 품목의 담을 수 있는 모델 (품절 제외, 싼 순서) */
export function modelChoices(category: CategoryKey, months: number): Line[] {
  return products
    .filter((p) => p.category === category && !isSoldOut(p))
    .map((p) => ({ category, product: p, ...cost(p, months) }))
    .sort((a, b) => a.cost - b.cost);
}

/** 세트 계산에 쓸 후보: 고객이 고른 모델이 있으면 그 모델만 (품절이 되면 고른 것을 무시하고 추천으로) */
function options(category: CategoryKey, months: number, pins: Pins = {}): Line[] {
  const all = modelChoices(category, months);
  const pinned = pins[category] && all.find((l) => l.product.id === pins[category]);
  return pinned ? [pinned] : all;
}

/** 실제로 적용되는 고른 모델 (품절 등으로 못 쓰는 것은 뺌) */
export function activePins(pins: Pins, months: number): Pins {
  const out: Pins = {};
  for (const [c, id] of Object.entries(pins) as [CategoryKey, string][]) {
    if (modelChoices(c, months).some((l) => l.product.id === id)) out[c] = id;
  }
  return out;
}

const sum = (lines: Line[]) => lines.reduce((s, l) => s + l.cost, 0);

/**
 * 든든형: 고른 품목을 모두 1개씩 담되, 합계가 limit(160만원)을 넘지 않으면서 가장 가깝게 되는 모델 조합.
 * 가격이 모두 100원 단위라 100원 단위 배낭(DP)으로 정확히 계산합니다.
 * 가장 싼 조합도 한도를 넘으면(대여 12개월 + 품목이 많을 때) 가장 싼 조합 그대로 보여 줍니다.
 */
function fillToLimit(cats: CategoryKey[], months: number, limit: number, withQty: boolean, tier: Tier, pins: Pins = {}): Plan {
  // 품목별 후보: (모델 × 수량). 같은 합계 금액은 하나만 남김
  const opts = cats.map((c) => {
    const cap = withQty ? (QTY_CAP[c] ?? 1) : 1;
    const out: Line[] = [];
    const seen = new Set<number>();
    for (const l of options(c, months, pins)) {
      for (let q = 1; q <= (l.rental ? 1 : cap); q++) {
        const total = l.unit * q;
        if (total > limit || seen.has(total)) continue;
        seen.add(total);
        out.push({ ...l, qty: q, cost: total });
      }
    }
    return out.sort((a, b) => a.cost - b.cost);
  });
  const cheapest = cats.map((c) => options(c, months, pins)[0]);
  if (opts.some((o) => o.length === 0) || sum(cheapest) > limit) return { tier, lines: cheapest, total: sum(cheapest) };

  const S = Math.floor(limit / 100);
  let reach = new Uint8Array(S + 1);
  reach[0] = 1;
  const choices: Int16Array[] = [];
  for (const o of opts) {
    const next = new Uint8Array(S + 1);
    const ch = new Int16Array(S + 1).fill(-1);
    for (let t = 0; t <= S; t++) {
      if (!reach[t]) continue;
      // 비싼 후보부터: 같은 합계면 먼저 닿은 쪽(더 좋은 모델·적은 수량 쪽)이 남음
      for (let j = o.length - 1; j >= 0; j--) {
        const u = t + o[j].cost / 100;
        if (u <= S && !next[u]) {
          next[u] = 1;
          ch[u] = j;
        }
      }
    }
    choices.push(ch);
    reach = next;
  }
  let t = S;
  while (t > 0 && !reach[t]) t--;
  const picked: Line[] = [];
  for (let k = opts.length - 1; k >= 0; k--) {
    const l = opts[k][choices[k][t]];
    picked.unshift(l);
    t -= l.cost / 100;
  }
  return { tier, lines: picked, total: sum(picked) };
}

/**
 * 선택한 예산(budget)을 기준으로 세 가지 세트를 짭니다. 체크한 품목은 모든 세트에 빠짐없이 담깁니다.
 *  - 실속형: 품목마다 가장 싼 모델 1개
 *  - 표준형: 실속형 금액과 예산의 중간 금액에 가장 가깝게 (모델만, 1개씩)
 *  - 든든형: 예산에 가장 가깝게 꽉 채움 (withQty면 급여 수량 한도 안에서 수량까지)
 * 고객이 직접 고른 모델(pins)은 추천 세트를 먼저 짠 뒤 그 품목만 고른 모델로 바꿉니다.
 * 나머지 품목은 그대로 두므로, 더 비싼 모델을 고르면 합계·본인부담금도 그만큼 올라갑니다.
 * 품절 상품은 후보에서 빠지며, 품절로 담을 모델이 없는 품목은 missing으로 알려 줍니다.
 */
export function buildPlans(categories: CategoryKey[], months: number, budget: number, withQty = true, pins: Pins = {}) {
  const avail = categories.filter((c) => options(c, months).length > 0);
  const missing = categories.filter((c) => !avail.includes(c));
  const basicLines = avail.map((c) => options(c, months)[0]);
  const basic: Plan = { tier: "basic", lines: basicLines, total: sum(basicLines) };
  const cap = Math.min(budget, EQUIPMENT_LIMIT);
  const mid = basic.total + Math.max(0, cap - basic.total) / 2;
  const standard = fillToLimit(avail, months, Math.max(mid, basic.total), false, "standard", {});
  const premium = fillToLimit(avail, months, Math.max(cap, basic.total), withQty, "premium", {});
  const plans = [basic, standard, premium].map((p) => applyPins(p, months, pins));
  return { plans, missing };
}

/** 세트에서 고른 품목만 고른 모델로 교체 (수량은 원래 세트의 수량 유지, 대여는 1개) */
function applyPins(plan: Plan, months: number, pins: Pins): Plan {
  const lines = plan.lines.map((l) => {
    const pick = pins[l.category] && options(l.category, months, pins)[0];
    if (!pick || pick.product.id === l.product.id && pick.rental === l.rental) return l;
    const qty = pick.rental ? 1 : l.qty;
    return { ...pick, qty, cost: pick.unit * qty };
  });
  return { ...plan, lines, total: sum(lines) };
}

/** 묶음 선택 → 담을 품목 목록 */
export function categoriesFor(groups: string[], extras: CategoryKey[]): CategoryKey[] {
  const out: CategoryKey[] = [];
  for (const g of groupKeys) {
    if (!groups.includes(g)) continue;
    out.push(...groupPlan[g].core);
    out.push(...groupPlan[g].extra.filter((c) => extras.includes(c)));
  }
  return out;
}

export function groupOfCategory(c: CategoryKey): string | undefined {
  return groupKeys.find((g) => groupPlan[g].core.includes(c) || groupPlan[g].extra.includes(c));
}

/** 품목 본인부담: 대여는 쇼핑몰처럼 '월 본인부담(10원 미만 절사) × 개월', 구입은 '단가 본인부담 × 수량' */
export const lineCopay = (l: Line, rate: number, months: number) => (l.rental ? copay(l.monthly!, rate) * months : copay(l.unit, rate) * l.qty);
export const planCopay = (p: Plan, rate: number, months: number) => p.lines.reduce((s, l) => s + lineCopay(l, rate, months), 0);
