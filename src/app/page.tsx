import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { tools } from "@/config/tools";
import { ProductPicks } from "@/components/ProductPicks";
import { AudienceTabs } from "@/components/AudienceTabs";
import { ContactCta } from "@/components/ContactCta";

const meta = pageMeta({
  path: "/",
  title: "해피케어복지용구 | 복지용구 연 160만원 · 장기요양등급 1분 확인",
  description: "장기요양 등급이 있으면 복지용구를 연 160만원 한도에서 본인부담금 15%(감경 9%·6%, 기초수급 0%)로 구입·대여할 수 있어요. 예상 등급, 맞춤 용품, 예산 세트, 가까운 요양기관까지 무료로 확인하세요.",
  keywords: ["복지용구 160만원", "복지용구 품목", "복지용구 신청", "장기요양등급 자가진단", "어르신 용품", "부모님 돌봄"],
  ogTitle: "복지용구 연 160만원, 15%만 내고 쓰세요",
  ogDescription: "우리 부모님께 필요한 복지용구와 예상 장기요양등급을 1분 만에 확인해 보세요. 무료 · 회원가입 없음",
});
export const metadata: Metadata = { ...meta, title: { absolute: "해피케어복지용구 | 복지용구 연 160만원 · 장기요양등급 1분 확인" } };

export default function Home() {
  return (
    <>
      <AudienceTabs current="family" />
      <section className="hero">
        <p className="eyebrow">장기요양 등급이 있다면</p>
        <h1>
          복지용구 <span className="hl">연 160만원</span>,
          <br />
          15%만 내고 쓰세요
        </h1>
        <p className="muted">우리 부모님께 필요한 용품과 예상 등급을 1분 만에 확인해 보세요. 무료 · 회원가입 없음</p>
      </section>

      <Link href="/scan" className="check-cta scan-cta">
        <span className="ico" aria-hidden>
          📸
        </span>
        <span className="txt">
          <strong>NEW · 사진 한 장 AI 안전진단</strong>
          <br />
          부모님 집 사진을 올리면 낙상 위험과 필요한 용품을 알려 드려요
        </span>
        <span className="go" aria-hidden>
          →
        </span>
      </Link>

      <div className="tools">
        {tools.map((t, i) => (
          <Link key={t.href} href={t.href} className="tool card">
            <span className="tool-icon" aria-hidden>
              {t.emoji}
              <span className="tool-num">{i + 1}</span>
            </span>
            <span className="tool-body">
              <h2>{t.title}</h2>
              <p className="muted">{t.desc}</p>
            </span>
            <span className="tool-go" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>
      <div className="home-links">
        <Link href="/catalog" className="btn">
          🛒 전체 상품 보기
        </Link>
        <Link href="/sizelist" className="btn">📏 크기·무게 비교</Link>
      </div>
      <ProductPicks campaign="home" />
      <ContactCta campaign="home" />
    </>
  );
}
