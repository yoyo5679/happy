import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { PersonTool } from "./PersonTool";

export const metadata: Metadata = pageMeta({
  path: "/person",
  title: "어르신 상태별 복지용구 추천 (걷기·일어서기·욕창·배변)",
  description: "걷기, 일어서기, 피부(욕창), 소변·배변 상태를 고르면 우리 부모님께 꼭 맞는 복지용구 품목과 모델을 1분 만에 추천해 드려요. 성인용 보행기, 지팡이, 욕창예방방석 등.",
  keywords: ["복지용구 추천", "성인용 보행기", "노인 보행보조기", "욕창예방매트리스", "욕창예방방석", "지팡이", "요실금팬티", "노인 용품 추천"],
  ogTitle: "우리 부모님께 꼭 맞는 복지용구, 1분 만에 추천받기",
});

export default function Page() {
  return <PersonTool />;
}
