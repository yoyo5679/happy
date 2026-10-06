import Link from "next/link";
import { tools } from "@/config/tools";
import { ProductPicks } from "@/components/ProductPicks";

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">장기요양 등급이 있다면</p>
        <h1>
          복지용구 <span className="hl">연 160만원</span>,
          <br />
          15%만 내고 쓰세요
        </h1>
        <p className="muted">우리 부모님께 필요한 용품과 예상 등급을 1분 만에 확인해 보세요. 무료 · 회원가입 없음</p>
        <Link href="/grade" className="hero-banner">
          <span>
            <strong>아직 등급이 없으신가요?</strong>
            <br />
            12개 질문으로 예상 등급부터 확인해 보세요
          </span>
          <span aria-hidden>→</span>
        </Link>
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
      <Link href="/catalog" className="btn wide">🛒 복지용구 전체 모델 · 본인부담금 보기</Link>
      <ProductPicks campaign="home" />
    </>
  );
}
