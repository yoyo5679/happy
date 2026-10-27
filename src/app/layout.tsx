import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { SourceTracker } from "@/components/SourceTracker";
import { FloatingContact } from "@/components/FloatingContact";
import { FontToggle } from "@/components/FontToggle";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: { default: `${site.name} | 우리 부모님 돌봄 자가진단`, template: `%s | ${site.name}` },
  description: "장기요양 등급이 있으면 복지용구 연 160만원 지원. 우리 부모님께 맞는 용품과 예상 등급을 1분 만에 확인하세요.",
  openGraph: {
    title: "우리 부모님 장기요양등급, 1분 만에 예상해 보기",
    description: "클릭 몇 번으로 예상 등급과 맞춤 복지용구를 확인하세요.",
    type: "website",
    locale: "ko_KR",
    siteName: site.name,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#068291", colorScheme: "only light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 큰 글씨 설정을 화면이 그려지기 전에 적용 (깜빡임 방지) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("hc_big")==="1")document.documentElement.classList.add("big")}catch(e){}`,
          }}
        />
      </head>
      <body>
        <SourceTracker />
        <header className="site-header">
          <div className="hdr">
          <Link href="/" className="logo" aria-label={`${site.name} 홈`}>
            <img src="/logo.png" alt={site.name} width={140} height={36} />
          </Link>
          <FontToggle />
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            본 서비스의 결과는 참고용이며, 실제 장기요양등급은 국민건강보험공단(☎ 1577-1000)의 방문조사와
            등급판정위원회 심의로 결정됩니다.
          </p>
          <p>
            © {site.name} · <Link href="/privacy">개인정보처리방침</Link>
          </p>
        </footer>
        <FloatingContact />
      </body>
    </html>
  );
}
