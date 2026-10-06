"use client";

import { useState } from "react";
import Link from "next/link";
import { Quiz } from "@/components/Quiz";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { ShareButton } from "@/components/ShareButton";
import { recommend, recommendQuestions, type Recommendation } from "@/lib/recommend";

export function RecommendTool() {
  const [result, setResult] = useState<Recommendation[] | null>(null);
  const [rate, setRate] = useState(0.15);

  if (!result) {
    return (
      <>
        <div className="page-title">
          <h1>🏠 우리 집 맞춤 복지용구 추천</h1>
          <p className="muted">8개 질문이면 충분해요.</p>
        </div>
        <Quiz questions={recommendQuestions} onComplete={(a) => { setResult(recommend(a)); window.scrollTo(0, 0); }} />
      </>
    );
  }

  return (
    <>
      <section className="card result">
        <p className="eyebrow">맞춤 추천 결과</p>
        <h1>우리 집에 꼭 필요한 {result.length}가지</h1>
        <p className="muted">위험도가 높은 순서로 정리했어요. 1순위부터 준비하시길 권해요.</p>
      </section>

      <RatePicker rate={rate} onChange={setRate} />
      {result.map((r, i) => (
        <CategoryGroup key={r.category} category={r.category} campaign="home_recommend" rate={rate} rank={i + 1} reason={r.reason} />
      ))}

      <ContactCta campaign="home_recommend" />

      <div className="actions">
        <ShareButton title="우리 집 맞춤 복지용구 추천" />
        <Link className="btn" href="/grade">📋 장기요양등급도 예상해보기</Link>
        <button className="link" onClick={() => setResult(null)}>다시 해보기</button>
      </div>
    </>
  );
}
