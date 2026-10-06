"use client";

import { RecommenderTool } from "@/components/RecommenderTool";
import { personQuestions, recommendPerson } from "@/lib/person";

export function PersonTool() {
  return (
    <RecommenderTool
      href="/person"
      title="👵 어르신 맞춤 복지용구 추천"
      subtitle="부모님의 요즘 모습을 떠올리며 9개 질문에 답해 주세요."
      resultTitle={(n) => `우리 부모님께 꼭 맞는 ${n}가지`}
      resultNote="걱정하신 부분과 지금 몸 상태를 함께 따져 필요한 순서대로 정리했어요."
      campaign="person_recommend"
      questions={personQuestions}
      recommend={recommendPerson}
    />
  );
}
