import type { Metadata } from "next";
import { CheckTool } from "./CheckTool";

export const metadata: Metadata = {
  title: "가정 낙상 위험 점검표",
  description: "현관·침실·욕실 13개 항목으로 우리 집 낙상 위험을 점검하고 필요한 용품을 확인하세요.",
  openGraph: {
    title: "우리 집 낙상 위험, 13개 항목으로 점검하기",
    description: "현관·침실·욕실 위험 요소를 체크하면 필요한 용품을 순서대로 알려드려요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <CheckTool />;
}
