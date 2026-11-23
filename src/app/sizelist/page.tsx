import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { SizeList } from "./SizeList";
import "./sizelist.css";
export const metadata: Metadata = pageMeta({
  path: "/sizelist",
  title: "복지용구 크기·무게 비교 (보행기·휠체어·침대 치수)",
  description: "성인용 보행기, 휠체어, 전동침대, 이동변기, 목욕의자의 가로·세로·높이·무게와 최대하중을 비교하세요. 우리 집 문 폭과 공간에 맞는지 미리 확인할 수 있어요.",
  keywords: ["보행기 크기", "휠체어 크기", "휠체어 무게", "전동침대 크기", "복지용구 치수", "이동변기 크기"],
});
export default function Page() { return <SizeList />; }
