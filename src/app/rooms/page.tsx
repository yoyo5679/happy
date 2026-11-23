import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { RoomsBrowser } from "./RoomsBrowser";

export const metadata: Metadata = pageMeta({
  path: "/rooms",
  title: "욕실·침실·현관 장소별 복지용구 · 어르신 낙상 예방 용품",
  description: "욕실 안전손잡이·미끄럼방지매트·목욕의자, 침실 전동침대·욕창예방매트리스, 현관 경사로까지. 집 안 장소별로 어르신 낙상을 막는 복지용구와 본인부담금을 확인하세요.",
  keywords: ["낙상 예방 용품", "안전손잡이", "미끄럼방지매트", "목욕의자", "이동변기", "경사로", "어르신 욕실 안전", "전동침대"],
  ogTitle: "욕실·침실·거실·현관, 장소별로 필요한 복지용구 찾기",
});

export default function Page() {
  return <RoomsBrowser />;
}
