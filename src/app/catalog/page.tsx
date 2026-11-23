import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { CatalogBrowser } from "./CatalogBrowser";

export const metadata: Metadata = pageMeta({
  path: "/catalog",
  title: "복지용구 품목·가격 · 본인부담금 한눈에 (구입·대여)",
  description: "전동침대, 수동휠체어, 성인용 보행기, 욕창예방매트리스, 안전손잡이 등 복지용구 전 모델의 가격과 본인부담금(15%·9%·6%)을 한눈에 비교하세요.",
  keywords: ["복지용구 품목", "복지용구 가격", "복지용구 대여", "복지용구 구입", "전동침대 대여", "수동휠체어 대여", "복지용구 본인부담금 15%"],
  ogTitle: "복지용구 본인부담금 한눈에 보기",
});

export default function Page() {
  return <CatalogBrowser />;
}
