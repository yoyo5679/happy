import type { Metadata } from "next";
import { RecommendTool } from "./RecommendTool";

export const metadata: Metadata = {
  title: "우리 집 맞춤 복지용구 추천",
  description: "집 구조와 거동 상태를 알려주시면 꼭 필요한 복지용구를 골라 드려요.",
  openGraph: { title: "우리 집에 꼭 필요한 복지용구, 1분 만에 추천받기", description: "집 구조와 거동 상태에 맞춰 낙상 예방 용품을 골라 드려요.", type: "website", locale: "ko_KR", images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <RecommendTool />;
}
