"use client";

import { useState } from "react";
import type { Answers, Question } from "@/lib/quiz";
import { resultUrl } from "@/lib/share";

type Props = {
  path: string;
  heading: string;
  lines: string[];
  questions: Question[];
  answers: Answers;
  rate: number;
};

// 휴대폰에서는 공유창(카카오톡 등)을 열고, PC에서는 결과 문구+링크를 복사합니다.
export function ShareResult({ path, heading, lines, questions, answers, rate }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = resultUrl(path, questions, answers, rate);
    const text = `[해피케어] ${heading}\n\n${lines.join("\n")}\n\n👉 결과 자세히 보기`;
    try {
      if (navigator.share) {
        await navigator.share({ title: heading, text, url });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // 사용자가 공유창을 닫음
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  return (
    <button className="btn primary" onClick={share}>
      {copied ? "✅ 복사됐어요. 카톡 대화창에 붙여넣어 주세요" : "📩 결과 보내기 (카톡·문자)"}
    </button>
  );
}
