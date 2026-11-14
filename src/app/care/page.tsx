import type { Metadata } from "next";
import { CareFinder } from "./CareFinder";

export const metadata: Metadata = {
  title: "가까운 장기요양기관 찾기",
  description: "방문요양·방문목욕·주야간보호·단기보호·요양원을 내 위치에서 가까운 순, 공단 평가등급 순, 최신 순으로 찾아보세요.",
  openGraph: {
    title: "우리 동네 장기요양기관, 공단 평가등급까지 한눈에",
    description: "방문요양·주야간보호·요양원 등을 가까운 순·평가등급 순으로 찾아보세요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <CareFinder />;
}
