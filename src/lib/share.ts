"use client";

import type { Answers, Question } from "./quiz";
import { source } from "./utm";

// 결과 공유 링크: 답변을 ?a=0123... (질문 순서대로 한 자리씩), 본인부담률을 ?r=15 로 담습니다.

export function encodeAnswers(questions: Question[], answers: Answers): string {
  return questions.map((q) => answers[q.id] ?? 0).join("");
}

export function decodeAnswers(questions: Question[], s: string | null): Answers | null {
  if (!s || s.length !== questions.length || !/^\d+$/.test(s)) return null;
  const answers: Answers = {};
  for (const [i, q] of questions.entries()) {
    const v = Number(s[i]);
    if (!q.options.some((o) => o.value === v)) return null;
    answers[q.id] = v;
  }
  return answers;
}

const RATE_VALUES = [15, 9, 6, 0];

/** 공유 링크로 들어왔으면 답변과 본인부담률을 돌려줍니다. */
export function readSharedResult(questions: Question[]): { answers: Answers; rate: number | null } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const answers = decodeAnswers(questions, params.get("a"));
    if (!answers) return null;
    const r = Number(params.get("r"));
    return { answers, rate: RATE_VALUES.includes(r) && params.has("r") ? r / 100 : null };
  } catch {
    return null;
  }
}

export function resultUrl(path: string, questions: Question[], answers: Answers, rate: number): string {
  const u = new URL(path, window.location.origin);
  u.searchParams.set("a", encodeAnswers(questions, answers));
  u.searchParams.set("r", String(Math.round(rate * 100)));
  const src = source();
  if (src !== "direct") u.searchParams.set("src", src);
  return u.toString();
}

/** 공유 링크로 연 결과를 지우고 질문 화면 주소로 되돌립니다. */
export function clearSharedParams() {
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete("a");
    u.searchParams.delete("r");
    window.history.replaceState(window.history.state, "", u.pathname + u.search);
  } catch {}
}
