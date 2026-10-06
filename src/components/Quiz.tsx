"use client";

import { useEffect, useState } from "react";
import type { Answers, Question } from "@/lib/quiz";

type Props = {
  questions: Question[];
  onComplete: (answers: Answers) => void;
  /** 결과 화면에서 휴대폰 뒤로가기로 질문에 돌아왔을 때 */
  onReturn?: () => void;
};

// 질문 한 단계마다 브라우저 기록을 남겨, 휴대폰 뒤로가기가 '이전 질문'으로 동작하게 합니다.
export function Quiz({ questions, onComplete, onReturn }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const q = questions[step];

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, hcStep: 0 }, "");
    const onPop = (e: PopStateEvent) => {
      const s = e.state?.hcStep;
      if (typeof s === "number") {
        setStep(s);
        onReturn?.();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(value: number) {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (step + 1 < questions.length) {
      window.history.pushState({ ...window.history.state, hcStep: step + 1 }, "");
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      window.history.pushState({ ...window.history.state, hcStep: "result" }, "");
      onComplete(next);
      window.scrollTo(0, 0);
    }
  }

  return (
    <section className="card quiz" aria-live="polite">
      <div className="progress" aria-hidden>
        <div style={{ width: `${(step / questions.length) * 100}%` }} />
      </div>
      <p className="step">
        {step + 1} / {questions.length}
      </p>
      <h2>{q.title}</h2>
      {q.description && <p className="muted">{q.description}</p>}
      <div className="options">
        {q.options.map((o) => (
          <button
            key={o.label}
            className={answers[q.id] === o.value ? "option selected" : "option"}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button className="link" onClick={() => window.history.back()}>
          ← 이전 질문
        </button>
      )}
    </section>
  );
}
