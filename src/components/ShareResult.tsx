"use client";

import type { Answers, Question } from "@/lib/quiz";
import { resultUrl } from "@/lib/share";
import { ShareText } from "./ShareText";

type Props = {
  path: string;
  heading: string;
  lines: string[];
  questions: Question[];
  answers: Answers;
  rate: number;
};

// 질문형 결과: 답변을 링크에 담아 보냅니다
export function ShareResult({ path, heading, lines, questions, answers, rate }: Props) {
  return <ShareText heading={heading} lines={lines} url={() => resultUrl(path, questions, answers, rate)} />;
}
