import type { Metadata } from "next";
import { CatalogBrowser } from "./CatalogBrowser";

export const metadata: Metadata = {
  title: "복지용구 전체 모델 · 본인부담금 계산",
  description: "해피케어몰 복지용구 전 모델의 급여가와 본인부담금을 한눈에 비교하세요.",
};

export default function Page() {
  return <CatalogBrowser />;
}
