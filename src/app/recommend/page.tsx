import type { Metadata } from "next";
import { RecommendTool } from "./RecommendTool";

export const metadata: Metadata = {
  title: "우리 집 맞춤 복지용구 추천",
  description: "집 구조와 거동 상태를 알려주시면 꼭 필요한 복지용구를 골라 드려요.",
};

export default function Page() {
  return <RecommendTool />;
}
