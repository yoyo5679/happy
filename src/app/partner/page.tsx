import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { categories, products, type CategoryKey } from "@/data/products";
import { limits, rateTargets } from "@/data/limits";

export const metadata: Metadata = {
  title: "방문요양기관 선생님용 복지용구 도우미",
  description: "수급자 맞춤 추천, 낙상 위험 점검표, 품목별 내구연한·급여한도를 한곳에서.",
  openGraph: {
    title: "방문요양기관 선생님용 복지용구 도우미",
    description: "수급자 맞춤 추천 · 낙상 점검표 · 품목별 내구연한·급여한도 한눈에",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
};

const staffTools = [
  { href: "/person", emoji: "👵", title: "수급자 맞춤 추천", desc: "걷기·피부·소변 상태로 필요한 용품 Top 5" },
  { href: "/check", emoji: "🔍", title: "가정 낙상 위험 점검표", desc: "첫 방문 때 13개 항목 체크" },
  { href: "/recommend", emoji: "🏠", title: "집 구조 맞춤 추천", desc: "주거 환경별 낙상 예방 용품" },
  { href: "/grade", emoji: "📋", title: "등급 모의 계산", desc: "신규·재신청 대상자 안내용" },
];

function supply(c: CategoryKey) {
  const list = products.filter((p) => p.category === c);
  const rent = list.some((p) => p.rent);
  const buy = list.some((p) => p.buy);
  return list.length === 0 ? "-" : rent && buy ? "대여·구입" : rent ? "대여" : "구입";
}

export default function Partner() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">방문요양기관 선생님을 위한</p>
        <h1>복지용구 도우미</h1>
        <p className="muted">수급자 가정에서 바로 쓰는 추천·점검 도구와, 자주 찾는 한도 정보를 모았어요. 결과는 보호자 카톡으로 바로 보낼 수 있어요.</p>
      </section>

      <div className="tools partner-tools">
        {staffTools.map((t) => (
          <Link key={t.href} href={t.href} className="tool card">
            <span className="tool-icon" aria-hidden>
              {t.emoji}
            </span>
            <span className="tool-body">
              <h2>{t.title}</h2>
              <p className="muted">{t.desc}</p>
            </span>
            <span className="tool-go" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </div>

      <section className="card">
        <h3>📌 꼭 알아두실 기본</h3>
        <ul className="facts">
          <li>
            복지용구 급여는 수급자 <strong>1인당 연 160만원</strong> 한도 (구입+대여 합산, 유효기간 개시일부터 1년)
          </li>
          <li>재가급여 수급자(1~5등급, 인지지원등급)만 이용 가능 · 시설 입소자 제외</li>
          <li>한도를 넘는 금액은 전액 본인 부담</li>
        </ul>
        <table className="tbl">
          <thead>
            <tr>
              <th>본인부담률</th>
              <th>대상</th>
            </tr>
          </thead>
          <tbody>
            {rateTargets.map((r) => (
              <tr key={r.rate}>
                <td className="num">{r.rate}</td>
                <td>{r.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>📋 품목별 내구연한 · 급여한도</h3>
        <p className="muted small">내구연한 안에는 같은 품목을 다시 받을 수 없어요. 내구연한이 '없음'인 소모성 품목은 급여한도 수량까지 받을 수 있어요.</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>품목</th>
                <th>내구연한</th>
                <th>급여한도</th>
                <th>쇼핑몰</th>
              </tr>
            </thead>
            <tbody>
              {limits.map((l) => {
                const s = supply(l.category);
                return (
                  <tr key={l.category}>
                    <td>
                      {s === "-" ? (
                        categories[l.category].label
                      ) : (
                        <Link href={`/catalog?c=${l.category}`}>{categories[l.category].label}</Link>
                      )}
                    </td>
                    <td>{l.durability}</td>
                    <td>{l.qty}</td>
                    <td className="muted">{s}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">이로움케어 복지용구 카탈로그 기준이며, 보건복지부 고시 변경에 따라 달라질 수 있어요. 수급자별 잔여 한도는 공단(☎ 1577-1000)에서 확인할 수 있어요.</p>
      </section>

      <section className="card cta">
        <h3>수급자 상담이 필요하면 연락 주세요</h3>
        <p className="muted">제품 선택부터 배송·설치까지 {site.name}가 도와드려요.</p>
        <div className="cta-buttons">
          <a className="btn primary" href={`tel:${site.phone.replace(/-/g, "")}`}>
            📞 {site.phone}
          </a>
          {site.kakaoUrl && (
            <a className="btn kakao" href={site.kakaoUrl} target="_blank" rel="noopener">
              💬 카카오톡 상담
            </a>
          )}
        </div>
      </section>
    </>
  );
}
