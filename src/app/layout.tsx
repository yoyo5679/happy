import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { SourceTracker } from "@/components/SourceTracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: { default: `${site.name} | 우리 부모님 돌봄 자가진단`, template: `%s | ${site.name}` },
  description: "1분 만에 장기요양등급을 예상해 보고, 집 구조에 맞는 복지용구를 추천받으세요.",
  openGraph: {
    title: "우리 부모님 장기요양등급, 1분 만에 예상해 보기",
    description: "클릭 몇 번으로 예상 등급과 맞춤 복지용구를 확인하세요.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = { themeColor: "#1f7a5a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SourceTracker />
        <header className="site-header">
          <Link href="/" className="logo">
            🌿 {site.name}
          </Link>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            본 서비스의 결과는 참고용이며, 실제 장기요양등급은 국민건강보험공단(☎ 1577-1000)의 방문조사와
            등급판정위원회 심의로 결정됩니다.
          </p>
          <p>© {site.name}</p>
        </footer>
      </body>
    </html>
  );
}
