"use client";

import { useState } from "react";
import type { Answers, Question } from "@/lib/quiz";

type Props = {
  questions: Question[];
  onComplete: (answers: Answers) => void;
};

export function Quiz({ questions, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const q = questions[step];

  function choose(value: number) {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (step + 1 < questions.length) setStep(step + 1);
    else onComplete(next);
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
        <button className="link" onClick={() => setStep(step - 1)}>
          ← 이전 질문
        </button>
      )}
    </section>
  );
}
