import type { NextConfig } from "next";

// Cloudflare Pages(무료)에 올리기 위해 정적 HTML로 내보냅니다 → out/ 폴더
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
