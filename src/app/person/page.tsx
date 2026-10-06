import type { Metadata } from "next";
import { PersonTool } from "./PersonTool";

export const metadata: Metadata = {
  title: "어르신 맞춤 복지용구 추천",
  description: "걷기·일어서기·피부·소변 상태를 알려주시면 부모님께 꼭 맞는 복지용구를 골라 드려요.",
  openGraph: {
    title: "우리 부모님께 꼭 맞는 복지용구, 1분 만에 추천받기",
    description: "걷기·일어서기·피부·소변 상태에 맞춰 필요한 용품을 골라 드려요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <PersonTool />;
}
