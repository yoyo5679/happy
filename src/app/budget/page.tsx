import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { BudgetPlanner } from "./BudgetPlanner";

export const metadata: Metadata = pageMeta({
  path: "/budget",
  title: "복지용구 160만원 예산 세트 짜기 · 본인부담금 계산",
  description: "복지용구 연 160만원 한도 안에서 쓸 금액과 필요한 품목을 고르면 실속형·표준형·든든형 세트와 본인부담금을 바로 계산해 드려요. 원하는 모델로 바꿔 비교해 보세요.",
  keywords: ["복지용구 160만원", "복지용구 한도", "복지용구 한도액", "복지용구 세트", "본인부담금 계산", "복지용구 추천"],
  ogTitle: "복지용구 160만원, 예산에 맞춰 세트 짜기",
});

export default function Page() {
  return <BudgetPlanner />;
}
