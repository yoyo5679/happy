"use client";

// 블로그/유튜브 링크에 ?src=blog 처럼 붙여 두면, 상품 링크로 넘어갈 때
// utm_source 로 전달되어 어느 채널에서 온 고객인지 스토어 통계에서 확인할 수 있어요.

const KEY = "hc_src";

export function rememberSource() {
  try {
    const src = new URLSearchParams(window.location.search).get("src");
    if (src) sessionStorage.setItem(KEY, src);
  } catch {}
}

function source(): string {
  try {
    return sessionStorage.getItem(KEY) || "direct";
  } catch {
    return "direct";
  }
}

export function withUtm(url: string, campaign: string, content?: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", source());
    u.searchParams.set("utm_medium", "care_tool");
    u.searchParams.set("utm_campaign", campaign);
    if (content) u.searchParams.set("utm_content", content);
    return u.toString();
  } catch {
    return url;
  }
}
