import Link from "next/link";
import { site } from "@/config/site";
import type { CategoryKey } from "@/data/products";
import { groupOfCategory } from "@/lib/budget";

// 결과 화면 맨 아래 고정 바: 어디까지 내려가 있든 바로 누를 수 있게
export function ResultBar({ share, budgetCategories }: { share?: React.ReactNode; budgetCategories?: CategoryKey[] }) {
  const cs = (budgetCategories ?? []).filter((c) => groupOfCategory(c));
  return (
    <div className="result-bar" role="toolbar" aria-label="결과 바로가기">
      {share}
      {budgetCategories && (
        <Link className="rb-btn rb-budget" href={`/budget${cs.length ? `?c=${cs.join(",")}` : ""}`}>
          💰 예산 세트
        </Link>
      )}
      <a className="rb-icon" href={`tel:${site.phone.replace(/-/g, "")}`} aria-label={`전화 상담 ${site.phone}`}>
        📞
      </a>
      {site.kakaoUrl && (
        <a className="rb-icon rb-kakao" href={site.kakaoUrl} target="_blank" rel="noopener" aria-label="카카오톡 상담">
          💬
        </a>
      )}
    </div>
  );
}
