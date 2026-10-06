"use client";

import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { ShareButton } from "@/components/ShareButton";
import { OtherTools } from "@/components/OtherTools";
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
  const [rate, setRate] = useState(0.15);

  if (!result) {
    return (
      <>
        <div className="page-title">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <Quiz
          questions={questions}
          onComplete={(a) => {
            setResult(recommend(a));
            window.scrollTo(0, 0);
          }}
        />
      </>
    );
  }

  return (
    <>
      <section className="card result">
        <p className="eyebrow">맞춤 추천 결과</p>
        <h1>{resultTitle(result.length)}</h1>
        <p className="muted">{resultNote}</p>
      </section>

      <RatePicker rate={rate} onChange={setRate} />
      {result.map((r, i) => (
        <CategoryGroup key={r.category} category={r.category} campaign={campaign} rate={rate} rank={i + 1} reason={r.reason} />
      ))}

      <ContactCta campaign={campaign} />

      <div className="actions">
        <ShareButton title={title.replace(/^\S+\s/, "")} />
        <OtherTools current={href} />
        <button className="link" onClick={() => setResult(null)}>
          다시 해보기
        </button>
      </div>
    </>
  );
}
