import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { CheckTool } from "./CheckTool";

export const metadata: Metadata = pageMeta({
  path: "/check",
  title: "어르신 낙상 위험 자가 점검표 (집 안전 체크리스트)",
  description: "현관·침실·욕실 13개 항목으로 우리 집 어르신 낙상 위험을 점검해 보세요. 위험한 곳과 먼저 갖추면 좋은 안전 용품을 순서대로 알려 드려요.",
  keywords: ["낙상 위험 평가", "낙상 예방 체크리스트", "노인 낙상 예방", "가정 안전 점검", "어르신 집 안전"],
  ogTitle: "우리 집 낙상 위험, 13개 항목으로 점검하기",
});

export default function Page() {
  return <CheckTool />;
}
