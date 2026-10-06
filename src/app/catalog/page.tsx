import type { Metadata } from "next";
import { CatalogBrowser } from "./CatalogBrowser";

export const metadata: Metadata = {
  title: "복지용구 전체 모델 · 본인부담금 계산",
  description: "해피케어몰 복지용구 전 모델의 정상가와 본인부담금을 한눈에 비교하세요.",
  openGraph: { title: "복지용구 본인부담금 한눈에 보기", description: "장기요양 등급이 있으면 15% 이하로 구입·대여할 수 있어요.", type: "website", locale: "ko_KR", images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return <CatalogBrowser />;
}
