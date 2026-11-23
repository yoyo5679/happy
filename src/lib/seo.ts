import type { Metadata } from "next";
import { site } from "@/config/site";

/** 모든 페이지 공통으로 붙는 핵심 검색어 */
export const baseKeywords = [
  "복지용구",
  "장기요양",
  "장기요양등급",
  "복지용구 본인부담금",
  "노인장기요양보험",
  "해피케어",
  "해피케어복지용구",
];

const ogImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "해피케어복지용구 - 우리 부모님 복지용구·장기요양 도우미" };

/**
 * 페이지별 검색 노출 정보 (제목·설명·검색어·대표주소·공유 미리보기)
 * - title: 검색 결과 제목 (뒤에 " | 해피케어복지용구"가 자동으로 붙음) — 핵심 검색어를 앞에
 * - description: 검색 결과 설명 — 80~120자, 핵심 검색어 + 혜택 + 행동 유도
 */
export function pageMeta(o: {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  ogTitle?: string;
  ogDescription?: string;
}): Metadata {
  const url = o.path === "/" ? "/" : o.path;
  return {
    title: o.title,
    description: o.description,
    keywords: [...o.keywords, ...baseKeywords.filter((k) => !o.keywords.includes(k))],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: site.name,
      url,
      title: o.ogTitle ?? `${o.title} | ${site.name}`,
      description: o.ogDescription ?? o.description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: o.ogTitle ?? `${o.title} | ${site.name}`,
      description: o.ogDescription ?? o.description,
      images: [ogImage.url],
    },
  };
}
