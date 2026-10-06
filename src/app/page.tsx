import Link from "next/link";
import { tools } from "@/config/tools";

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">무료 · 1분 · 회원가입 없음</p>
        <h1>
          우리 부모님,
          <br />
          지금 어떤 도움이 필요할까요?
        </h1>
        <p className="muted">몇 가지 질문에 클릭으로 답하면 맞춤 복지용구와 예상 등급을 알려드려요.</p>
      </section>

      <div className="tools">
        {tools.map((t, i) => (
          <Link key={t.href} href={t.href} className="tool card">
            <span className="tool-head">
              <span className="tool-num">{i + 1}</span>
              <span className="tool-emoji">{t.emoji}</span>
            </span>
            <h2>{t.title}</h2>
            <p className="muted">{t.desc}</p>
            <span className="btn primary">시작하기 →</span>
          </Link>
        ))}
      </div>
      <Link href="/catalog" className="btn wide">🛒 복지용구 전체 모델 · 본인부담금 보기</Link>
    </>
  );
}
