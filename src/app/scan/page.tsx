import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { ScanTool } from "./ScanTool";

export const metadata: Metadata = pageMeta({
  path: "/scan",
  title: "AI 사진 안전진단 · 사진 한 장으로 집 안 낙상 위험 찾기",
  description: "부모님 집 욕실·침실·현관 사진을 올리면 AI가 낙상 위험 요소를 찾아 필요한 복지용구(안전손잡이, 미끄럼방지매트, 경사로 등)와 본인부담금을 알려 드려요. 무료.",
  keywords: ["AI 안전진단", "낙상 위험 진단", "어르신 집 안전", "욕실 낙상 예방", "안전손잡이 설치", "복지용구 추천"],
  ogTitle: "사진 한 장으로 부모님 집 낙상 위험 찾기 (AI 무료 진단)",
});

export default function Page() {
  return <ScanTool />;
}
