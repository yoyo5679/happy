"use client";

import { useState } from "react";
import Link from "next/link";
import { Quiz } from "@/components/Quiz";
import { ProductCard } from "@/components/ProductCard";
import { ContactCta } from "@/components/ContactCta";
import { ShareButton } from "@/components/ShareButton";
import { categories, productsFor } from "@/data/products";
import { recommend, recommendQuestions, type Recommendation } from "@/lib/recommend";

export function RecommendTool() {
  const [result, setResult] = useState<Recommendation[] | null>(null);

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

      {result.map((r, i) => (
        <section key={r.category} className="card group">
          <h3>
            <span className="rank">{i + 1}</span> {categories[r.category].emoji} {categories[r.category].label}
          </h3>
          <p className="reason">{r.reason}</p>
          {productsFor(r.category).map((p) => (
            <ProductCard key={p.id} product={p} campaign="home_recommend" />
          ))}
        </section>
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
