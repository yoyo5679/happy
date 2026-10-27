import type { Metadata } from "next";
import { business, site } from "@/config/site";
import { ConsentTable } from "@/components/ConsentTable";
import { CONSENT_VERSION, consentNotice, consentSections } from "@/data/consent";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "개인정보 수집·이용 동의서",
  robots: { index: false, follow: false },
};

// 계약할 때 함께 받는 종이 동의서 (인쇄용)
export default function Page() {
  return (
    <article className="consent-print">
      <div className="no-print">
        <PrintButton />
      </div>
      <h1>복지용구 이용 현황 서비스 개인정보 수집·이용 동의서</h1>
      <p className="muted">
        {business.company}(대표 {business.ceo}, 이하 &lsquo;회사&rsquo;)는 어르신의 복지용구 이용 현황을 보호자께 웹으로 안내하기 위해 아래와 같이 개인정보를
        처리합니다.
      </p>
      <table className="consent-table sign">
        <tbody>
          <tr>
            <th>어르신 성함</th>
            <td></td>
            <th>장기요양 등급</th>
            <td></td>
          </tr>
          <tr>
            <th>보호자 성함</th>
            <td></td>
            <th>관계</th>
            <td></td>
          </tr>
          <tr>
            <th>보호자 연락처</th>
            <td colSpan={3}></td>
          </tr>
        </tbody>
      </table>
      {consentSections.map((s, i) => (
        <section key={s.key}>
          <h2>
            {i + 1}. {s.title} ({s.required ? "필수" : "선택"})
          </h2>
          <ConsentTable section={s} />
          <p className="check-line">
            위 내용에 동의하십니까?&emsp;□ 동의함&emsp;□ 동의하지 않음
          </p>
        </section>
      ))}
      <ul className="consent-notice">
        {consentNotice.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="sign-line">
        20&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일
      </p>
      <p className="sign-line">동의자(어르신 또는 보호자·법정대리인): ______________________ (서명 또는 인)</p>
      <p className="muted small">
        {business.company}({site.name}) · 사업자등록번호 {business.bizNo} · {business.address} · ☎ {site.phone} · 동의서 버전{" "}
        {CONSENT_VERSION}
      </p>
    </article>
  );
}
