import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { business, site } from "@/config/site";
import { SourceTracker } from "@/components/SourceTracker";
import { ServiceWorker } from "@/components/ServiceWorker";
import { FloatingContact } from "@/components/FloatingContact";
import { FontToggle } from "@/components/FontToggle";
import { InstallApp } from "@/components/InstallApp";
import { baseKeywords } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: { default: `${site.name} | 복지용구 연 160만원 · 장기요양등급 1분 확인`, template: `%s | ${site.name}` },
  description: "장기요양 등급이 있으면 복지용구를 연 160만원 한도에서 본인부담금 15% 이하로 구입·대여할 수 있어요. 예상 등급, 맞춤 용품, 가까운 요양기관까지 무료로 확인하세요.",
  applicationName: site.name,
  keywords: baseKeywords,
  authors: [{ name: business.company, url: site.siteUrl }],
  creator: business.company,
  publisher: business.company,
  category: "health",
  formatDetection: { telephone: true, address: false, email: false },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    title: "우리 부모님 장기요양등급, 1분 만에 예상해 보기",
    description: "클릭 몇 번으로 예상 등급과 맞춤 복지용구를 확인하세요.",
    type: "website",
    locale: "ko_KR",
    siteName: site.name,
  },
  twitter: { card: "summary_large_image" },
  // 홈 화면에 추가 (PWA)
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "해피케어", statusBarStyle: "default" },
  // 구글 서치 콘솔 · 네이버 서치어드바이저 소유 확인 (site.ts에 코드 입력)
  verification: {
    ...(site.verification.google ? { google: site.verification.google } : {}),
    ...(site.verification.naver ? { other: { "naver-site-verification": site.verification.naver } } : {}),
  },
};

export const viewport: Viewport = { themeColor: "#068291", colorScheme: "only light" };

// 검색엔진용 구조화 데이터 (사업자·사이트 정보) — 구글 지식 패널·네이버 사이트 정보에 쓰임
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Store", "LocalBusiness"],
      "@id": `${site.siteUrl}/#business`,
      name: site.name,
      alternateName: ["해피케어", "해피케어몰"],
      description: "장기요양 수급자를 위한 복지용구 구입·대여 사업소 (의료기기판매(임대)업 신고 " + business.medicalNo + ")",
      url: site.siteUrl,
      logo: `${site.siteUrl}/logo.png`,
      image: `${site.siteUrl}/opengraph-image.png`,
      telephone: "+82-70-8657-2141",
      email: business.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: "통일로 83길 7, 1층",
        addressLocality: "은평구",
        addressRegion: "서울특별시",
        addressCountry: "KR",
      },
      areaServed: { "@type": "Country", name: "대한민국" },
      sameAs: [site.storeUrl.replace(/\/index$/, ""), site.kakaoUrl].filter(Boolean),
    },
    {
      "@type": "WebSite",
      "@id": `${site.siteUrl}/#website`,
      name: site.name,
      alternateName: "해피케어",
      url: site.siteUrl,
      inLanguage: "ko-KR",
      publisher: { "@id": `${site.siteUrl}/#business` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {/* 큰 글씨 설정을 화면이 그려지기 전에 적용 (깜빡임 방지) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.removeItem("hc_my_k");sessionStorage.removeItem("hc_staff");if(location.pathname==="/my"||location.pathname==="/staff")history.replaceState(null,"",location.pathname);if(localStorage.getItem("hc_big")==="1")document.documentElement.classList.add("big")}catch(e){}`,
          }}
        />
      </head>
      <body>
        <SourceTracker />
        <ServiceWorker />
        <header className="site-header">
          <div className="hdr">
            <div className="hdr-left">
              <InstallApp compact />
            </div>
            <Link href="/" className="logo" aria-label={`${site.name} 홈`}>
              <img src="/logo.png" alt={site.name} width={140} height={36} />
            </Link>
            <div className="hdr-right">
              <FontToggle />
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            본 서비스의 결과는 참고용이며, 실제 장기요양등급은 국민건강보험공단(☎ 1577-1000)의 방문조사와
            등급판정위원회 심의로 결정됩니다.
          </p>
          <p className="biz-info">
            상호 {business.company} · 대표 {business.ceo} · 사업자등록번호 {business.bizNo}
            <br />
            의료기기판매(임대)업 신고 {business.medicalNo} · 통신판매업 신고 {business.mailOrderNo}
            <br />
            {business.address} · ☎ {site.phone} · {business.email}
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
