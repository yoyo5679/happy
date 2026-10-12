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
  { key: "premium", label: "든든형", desc: "기능이 많은 고급 모델", pct: 0.9 },
];

export type Line = { category: CategoryKey; product: Product; rental: boolean; monthly?: number; cost: number };
export type Plan = { tier: Tier | "fit"; lines: Line[]; total: number; dropped: CategoryKey[] };

/** 품목의 비용: 구입은 정상가, 대여는 월 대여가 × 개월 수 */
function cost(p: Product, months: number) {
  if (p.buy && !p.buy.soldOut) return { rental: false, cost: p.buy.price };
  const m = p.rent!.price;
  return { rental: true, monthly: m, cost: m * months };
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

export function buildPlans(categories: CategoryKey[], months: number, budget: number) {
  const avail = categories.filter((c) => options(c, months).length > 0);
  const plans: Plan[] = tiers.map((t) => {
    const lines = avail.map((c) => pick(options(c, months), t.pct));
    return { tier: t.key, lines, total: sum(lines), dropped: [] };
  });

  // 실속형도 예산을 넘으면: 필요한 순서대로 담되, 남은 예산에 안 들어가는 품목은 건너뛴 세트를 추가
  let fit: Plan | null = null;
  if (plans[0].total > budget) {
    const lines: Line[] = [];
    const dropped: CategoryKey[] = [];
    for (const l of plans[0].lines) {
      if (sum(lines) + l.cost <= budget) lines.push(l);
      else dropped.push(l.category);
    }
    fit = { tier: "fit", lines, total: sum(lines), dropped };
  }
  return { plans, fit };
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
