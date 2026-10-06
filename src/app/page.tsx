import Link from "next/link";
import { tools } from "@/config/tools";
import { ProductPicks } from "@/components/ProductPicks";
import { AudienceTabs } from "@/components/AudienceTabs";

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
      <Link href="/catalog" className="btn wide">
        🛒 복지용구 전체 모델 · 본인부담금 보기
      </Link>
      <ProductPicks campaign="home" />
    </>
  );
}
