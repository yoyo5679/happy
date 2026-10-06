"use client";

import { useEffect, useState } from "react";
import { Quiz } from "@/components/Quiz";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { ShareResult } from "@/components/ShareResult";
import { SharedBanner } from "@/components/SharedBanner";
import { categorySummary } from "@/data/products";
import { clearSharedParams, readSharedResult } from "@/lib/share";
import { OtherTools } from "@/components/OtherTools";
import { ProductPicks } from "@/components/ProductPicks";
import type { Answers, Question } from "@/lib/quiz";
import type { Recommendation } from "@/lib/recommender";

type Props = {
  href: string;
  title: string;
  subtitle: string;
  resultTitle: (n: number) => string;
  resultNote: string;
  campaign: string;
  questions: Question[];
  recommend: (a: Answers) => Recommendation[];
};

export function RecommenderTool({ href, title, subtitle, resultTitle, resultNote, campaign, questions, recommend }: Props) {
  const [result, setResult] = useState<Recommendation[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [rate, setRate] = useState(0.15);
  const [shared, setShared] = useState(false);
  const [round, setRound] = useState(0);

  // 공유 링크(?a=…)로 들어오면 질문 없이 바로 결과를 보여줍니다
  useEffect(() => {
    const s = readSharedResult(questions);
    if (!s) return;
    setAnswers(s.answers);
    if (s.rate !== null) setRate(s.rate);
    setResult(recommend(s.answers));
    setShared(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry() {
    if (shared) {
      clearSharedParams();
      setShared(false);
      setResult(null);
      setRound(round + 1);
    } else {
      // 결과 기록에서 첫 질문 기록까지 되돌아가, 이후 뒤로가기가 자연스럽게 페이지를 벗어나도록
      window.history.go(-questions.length);
    }
    window.scrollTo(0, 0);
  }

  return (
    <>
      <div hidden={!!result}>
        <div className="page-title">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <Quiz
          key={round}
          questions={questions}
          onComplete={(a) => {
            setAnswers(a);
            setResult(recommend(a));
          }}
          onReturn={() => setResult(null)}
        />
      </div>
      {result && <>
      {shared && <SharedBanner onRetry={retry} />}
      <section className="card result">
        <p className="eyebrow">맞춤 추천 결과</p>
        <h1>{resultTitle(result.length)}</h1>
        <p className="muted">{resultNote}</p>
      </section>

      <RatePicker rate={rate} onChange={setRate} />
      {result.map((r, i) => (
        <CategoryGroup key={r.category} category={r.category} campaign={campaign} rate={rate} rank={i + 1} reason={r.reason} />
      ))}

      <ProductPicks campaign={campaign} exclude={result.map((r) => r.category)} />
      <ContactCta campaign={campaign} />

      <div className="actions">
        <ShareResult
          path={href}
          heading={resultTitle(result.length)}
          lines={result.map((r, i) => `${i + 1}. ${categorySummary(r.category, rate)}`)}
          questions={questions}
          answers={answers}
          rate={rate}
        />
        <OtherTools current={href} />
        <button className="link" onClick={retry}>
          다시 해보기
        </button>
      </div>
      </>}
    </>
  );
}
