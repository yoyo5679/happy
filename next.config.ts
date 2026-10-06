import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // 질문형 '우리 집 맞춤'은 '우리 집에서 찾기'(장소별 + 안전 점검)로 통합. 이미 퍼진 링크(?src= 포함)는 그대로 연결.
    return [{ source: "/recommend", destination: "/rooms", permanent: true }];
  },
};

export default nextConfig;
