import Link from "next/link";

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
        <p className="muted">몇 가지 질문에 클릭으로 답하면 예상 등급과 맞춤 복지용구를 알려드려요.</p>
      </section>

      <div className="tools">
        <Link href="/grade" className="tool card">
          <span className="tool-emoji">📋</span>
          <h2>장기요양등급 예상해보기</h2>
          <p className="muted">12개 질문으로 1~5등급·인지지원등급 가능성을 확인해요.</p>
          <span className="btn primary">시작하기 →</span>
        </Link>
        <Link href="/recommend" className="tool card">
          <span className="tool-emoji">🏠</span>
          <h2>우리 집 맞춤 복지용구 추천</h2>
          <p className="muted">집 구조와 거동 상태에 꼭 맞는 낙상 예방 용품을 골라 드려요.</p>
          <span className="btn primary">시작하기 →</span>
        </Link>
      </div>
      <Link href="/catalog" className="btn wide">🛒 복지용구 전체 모델 · 본인부담금 보기</Link>
    </>
  );
}
