import type { Metadata } from "next";
import { RoomsBrowser } from "./RoomsBrowser";

export const metadata: Metadata = {
  title: "장소별 상품 찾기",
  description: "욕실·침실·거실·현관, 집 안 장소별로 필요한 복지용구를 찾아보세요.",
  openGraph: {
    title: "욕실·침실·거실·현관, 장소별 복지용구 찾기",
    description: "집 평면도에서 걱정되는 곳을 누르면 필요한 용품과 본인부담금을 알려드려요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <RoomsBrowser />;
}
