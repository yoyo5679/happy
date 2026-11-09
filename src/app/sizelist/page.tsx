import type { Metadata } from "next";
import { SizeList } from "./SizeList";
import "./sizelist.css";
export const metadata: Metadata = {
  title: "복지용구 제원표 · 크기와 무게 비교",
  description: "가가온 2026년 2호 카탈로그로 확인하는 복지용구 치수, 좌면, 무게와 최대하중. 제품을 선택해 나란히 비교하세요.",
};
export default function Page() { return <SizeList />; }
