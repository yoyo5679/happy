import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { CareFinder } from "./CareFinder";

export const metadata: Metadata = pageMeta({
  path: "/care",
  title: "요양원·방문요양·주야간보호센터 찾기 (공단 평가등급)",
  description: "내 위치에서 가까운 요양원, 방문요양센터, 방문목욕, 주야간보호센터, 단기보호기관을 전국에서 찾아보세요. 국민건강보험공단 평가등급 순·가까운 순으로 비교할 수 있어요.",
  keywords: ["요양원 찾기", "근처 요양원", "방문요양센터", "주야간보호센터", "데이케어센터", "단기보호", "방문목욕", "장기요양기관 찾기", "장기요양기관 평가등급"],
  ogTitle: "우리 동네 요양원·방문요양·주야간보호, 공단 평가등급까지 한눈에",
});

export default function Page() {
  return <CareFinder />;
}
