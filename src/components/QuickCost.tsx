"use client";

import Link from "next/link";
import { won, type CategoryKey } from "@/data/products";
import { buildPlans, groupOfCategory, planCopay } from "@/lib/budget";

// 결과 맨 위 한 줄 요약: 추천 품목을 실속형으로 모두 담으면 얼마인지
export function QuickCost({ categories, rate, count }: { categories: CategoryKey[]; rate: number; count?: number }) {
  const cs = categories.filter((c) => groupOfCategory(c));
  if (cs.length === 0) return null;
  const basic = buildPlans(cs, 3).plans[0];
  if (basic.lines.length === 0) return null;
  const pay = planCopay(basic, rate, 3);
  return (
    <Link className="quick-cost" href={`/budget?c=${cs.join(",")}`}>
      <span>
        필요한 것 <strong>{count ?? cs.length}가지</strong> · 합리적인 모델로 모두 담으면{" "}
        {rate === 0 ? <strong>본인부담 없음</strong> : <>본인부담 약 <strong>{won(Math.round(pay / 1000) * 1000)}</strong></>}
        <small> (대여 3개월 기준)</small>
      </span>
      <span className="qc-go" aria-hidden>
        예산 세트 →
      </span>
    </Link>
  );
}
