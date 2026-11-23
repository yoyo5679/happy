import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

// 검색엔진에 알려 줄 페이지 목록 → /sitemap.xml
const pages: { path: string; priority: number; freq: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, freq: "weekly" },
  { path: "/grade", priority: 0.9, freq: "monthly" },
  { path: "/care", priority: 0.9, freq: "weekly" },
  { path: "/budget", priority: 0.8, freq: "weekly" },
  { path: "/rooms", priority: 0.8, freq: "monthly" },
  { path: "/person", priority: 0.8, freq: "monthly" },
  { path: "/check", priority: 0.7, freq: "monthly" },
  { path: "/catalog", priority: 0.7, freq: "weekly" },
  { path: "/sizelist", priority: 0.7, freq: "monthly" },
  { path: "/partner", priority: 0.6, freq: "monthly" },
  { path: "/care/happycare", priority: 0.5, freq: "monthly" },
  { path: "/privacy", priority: 0.2, freq: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return pages.map((p) => ({
    url: `${site.siteUrl}${p.path === "/" ? "" : p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
