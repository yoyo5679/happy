import { productsFor, type CategoryKey } from "@/data/products";

export type Recommendation = { category: CategoryKey; reason: string; priority: number };

/** 추천 항목을 모으고, 재고 있는 품목만 우선순위 순으로 상위 N개를 돌려줍니다. */
export function collector() {
  const out: Recommendation[] = [];
  return {
    add(category: CategoryKey, reason: string, priority: number) {
      const existing = out.find((r) => r.category === category);
      if (existing) existing.priority = Math.max(existing.priority, priority);
      else out.push({ category, reason, priority });
    },
    boost(categories: CategoryKey[], by: number) {
      for (const r of out) if (categories.includes(r.category)) r.priority += by;
    },
    has: (category: CategoryKey) => out.some((r) => r.category === category),
    finish(limit = 5): Recommendation[] {
      return out
        .filter((r) => productsFor(r.category).length > 0)
        .sort((x, y) => y.priority - x.priority)
        .slice(0, limit);
    },
  };
}
