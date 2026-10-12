import Link from "next/link";
import type { CategoryKey } from "@/data/products";
import { groupOfCategory } from "@/lib/budget";

// 추천 결과의 품목을 그대로 담아 '예산으로 세트 짜기'로 이동
export function BudgetLink({ categories }: { categories: CategoryKey[] }) {
  const cs = categories.filter((c) => groupOfCategory(c));
  return (
    <Link className="btn budget-btn" href={`/budget${cs.length ? `?c=${cs.join(",")}` : ""}`}>
      💰 이 품목들로 예산 세트 짜기
    </Link>
  );
}
