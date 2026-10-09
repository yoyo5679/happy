import type { Metadata } from "next";
import { GradeTool } from "./GradeTool";

export const metadata: Metadata = {
  title: "등급·혜택 확인 (장기요양등급 모의 계산)",
  description: "18개 질문으로 우리 부모님 장기요양등급 가능성을 1분 만에 확인해 보세요.",
};

export default function Page() {
  return <GradeTool />;
}
