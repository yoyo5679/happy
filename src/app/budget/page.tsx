import type { Metadata } from "next";
import { BudgetPlanner } from "./BudgetPlanner";

export const metadata: Metadata = {
  title: "예산으로 세트 짜기",
  description: "복지용구 연 160만원 중 쓸 금액과 필요한 것을 고르면 실속형·표준형·든든형 세트를 짜 드려요.",
  openGraph: {
    title: "복지용구 160만원, 예산에 맞춰 세트 짜기",
    description: "쓸 금액과 필요한 것을 고르면 금액대별 세트와 본인부담금을 바로 보여드려요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <BudgetPlanner />;
}
