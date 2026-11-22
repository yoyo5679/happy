import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

// 검색엔진(구글·네이버 등) 수집 규칙 → /robots.txt
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/my", "/staff", "/imweb/"] }],
    sitemap: `${site.siteUrl}/sitemap.xml`,
    host: site.siteUrl,
  };
}
