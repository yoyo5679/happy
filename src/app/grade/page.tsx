import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { GradeTool } from "./GradeTool";

export const metadata: Metadata = pageMeta({
  path: "/grade",
  title: "장기요양등급 자가진단 · 예상 등급 모의 계산",
  description: "18개 질문으로 우리 부모님 장기요양등급(1~5등급·인지지원등급)을 1분 만에 예상해 보세요. 등급별 월 한도액과 방문요양·주야간보호·복지용구 혜택, 신청 방법까지 안내해요.",
  keywords: ["장기요양등급 자가진단", "장기요양등급 판정기준", "장기요양등급 신청", "장기요양 인정점수", "인지지원등급", "장기요양 등급별 혜택", "장기요양 월 한도액"],
  ogTitle: "우리 부모님 장기요양등급, 1분 만에 예상해 보기",
});

export default function Page() {
  return <GradeTool />;
}
