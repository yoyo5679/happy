import { categoryGroups, isSoldOut, products, type CategoryKey, type Product } from "@/data/products";

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
export const tiers: { key: Tier; label: string; desc: string; pct: number }[] = [
  { key: "basic", label: "실속형", desc: "품목마다 가장 합리적인 모델", pct: 0 },
  { key: "standard", label: "표준형", desc: "많이 고르는 중간 가격대", pct: 0.5 },
  { key: "premium", label: "든든형", desc: "연 160만원 한도를 꽉 채운 구성", pct: 1 },
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

function options(category: CategoryKey, months: number): Line[] {
  return products
    .filter((p) => p.category === category && !isSoldOut(p))
    .map((p) => ({ category, product: p, ...cost(p, months) }))
    .sort((a, b) => a.cost - b.cost);
}

function pick(list: Line[], pct: number) {
  return list[Math.min(list.length - 1, Math.round((list.length - 1) * pct))];
}

const sum = (lines: Line[]) => lines.reduce((s, l) => s + l.cost, 0);

/**
 * 든든형: 고른 품목을 모두 1개씩 담되, 합계가 limit(160만원)을 넘지 않으면서 가장 가깝게 되는 모델 조합.
 * 가격이 모두 100원 단위라 100원 단위 배낭(DP)으로 정확히 계산합니다.
 * 가장 싼 조합도 한도를 넘으면(대여 12개월 + 품목이 많을 때) 가장 싼 조합 그대로 보여 줍니다.
 */
function fillToLimit(cats: CategoryKey[], months: number, limit: number, withQty: boolean): Plan {
  // 품목별 후보: (모델 × 수량). 같은 합계 금액은 하나만 남김
  const opts = cats.map((c) => {
    const cap = withQty ? (QTY_CAP[c] ?? 1) : 1;
    const out: Line[] = [];
    const seen = new Set<number>();
    for (const l of options(c, months)) {
      for (let q = 1; q <= (l.rental ? 1 : cap); q++) {
        const total = l.unit * q;
        if (total > limit || seen.has(total)) continue;
        seen.add(total);
        out.push({ ...l, qty: q, cost: total });
      }
    }
    return out.sort((a, b) => a.cost - b.cost);
  });
  const cheapest = cats.map((c) => options(c, months)[0]);
  if (opts.some((o) => o.length === 0) || sum(cheapest) > limit) return { tier: "premium", lines: cheapest, total: sum(cheapest) };

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
  return { tier: "premium", lines: picked, total: sum(picked) };
}

/** 체크한 품목은 모든 세트에 빠짐없이 담습니다. 품절로 담을 모델이 없는 품목은 missing으로 알려 줍니다. */
export function buildPlans(categories: CategoryKey[], months: number, withQty = true) {
  const avail = categories.filter((c) => options(c, months).length > 0);
  const missing = categories.filter((c) => !avail.includes(c));
  const plans: Plan[] = tiers.map((t) => {
    if (t.key === "premium") return fillToLimit(avail, months, EQUIPMENT_LIMIT, withQty);
    const lines = avail.map((c) => pick(options(c, months), t.pct));
    return { tier: t.key, lines, total: sum(lines) };
  });
  return { plans, missing };
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
