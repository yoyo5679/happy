"use client";

import { RecommenderTool } from "@/components/RecommenderTool";
import { recommend, recommendQuestions } from "@/lib/recommend";

export function RecommendTool() {
  return (
    <RecommenderTool
      href="/recommend"
      title="🏠 우리 집 맞춤 복지용구 추천"
      subtitle="8개 질문이면 충분해요."
      resultTitle={(n) => `우리 집에 꼭 필요한 ${n}가지`}
      resultNote="위험도가 높은 순서로 정리했어요. 1순위부터 준비하시길 권해요."
      campaign="home_recommend"
      questions={recommendQuestions}
      recommend={recommend}
    />
  );
}
