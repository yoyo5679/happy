import type { Metadata } from "next";
import { business, site } from "@/config/site";
import { consentSections, RETENTION } from "@/data/consent";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: `${site.name} 개인정보처리방침`,
};

const sec = (k: string) => consentSections.find((s) => s.key === k)!;
const row = (k: string, label: string) => sec(k).rows.find(([l]) => l === label)?.[1] ?? "";

export default function Page() {
  const blank = "(작성 필요)";
  return (
    <article className="policy">
      <h1 className="page-title">개인정보처리방침</h1>
      <p>
        {business.company}({site.name}, 이하 &lsquo;회사&rsquo;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하게
        처리하기 위해 다음과 같이 개인정보처리방침을 둡니다. 이 방침은 회사가 운영하는 웹 서비스({site.siteUrl})에 적용됩니다.
      </p>

      <h2>1. 처리하는 개인정보와 목적</h2>
      <table className="consent-table">
        <thead>
          <tr>
            <th>서비스</th>
            <th>목적</th>
            <th>항목</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>복지용구 찾기·등급 모의계산·예산 세트</td>
            <td>맞춤 복지용구 안내</td>
            <td>개인정보를 수집하지 않습니다. 선택한 답은 이용자 기기에서만 계산되며 서버에 저장하지 않습니다.</td>
          </tr>
          <tr>
            <td>복지용구 이용 현황(웹 장부)</td>
            <td>{row("collect", "목적")}</td>
            <td>
              {row("collect", "항목")}
              <br />
              민감정보: {row("sensitive", "항목")}
            </td>
          </tr>
        </tbody>
      </table>
      <p>웹 장부는 정보주체(어르신) 또는 보호자·법정대리인의 동의를 받은 경우에만 이용하며, 민감정보는 별도로 동의를 받습니다.</p>

      <h2>2. 보유 및 이용 기간</h2>
      <p>
        {RETENTION} 다만 장기요양급여 계약·청구 관련 서류는 「노인장기요양보험법」 등 관계 법령에서 정한 기간 동안 웹 장부와 별도로
        보관합니다.
      </p>

      <h2>3. 제3자 제공</h2>
      <p>
        회사는 동의받은 범위에서 보호자(가족)가 전용 링크로 이용 현황을 열람하도록 하는 경우 외에는 개인정보를 제3자에게 제공하지
        않습니다. 법령에 따른 요청이 있는 경우는 예외로 합니다.
      </p>

      <h2>4. 처리 위탁 및 국외 이전</h2>
      <table className="consent-table">
        <tbody>
          {sec("overseas").rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>국외 이전을 원하지 않으시면 동의하지 않거나 철회하실 수 있으며, 이 경우 웹 장부만 이용하실 수 없습니다.</p>

      <h2>5. 파기 절차와 방법</h2>
      <p>
        보유기간이 끝나거나 동의를 철회하시면 웹 장부의 정보를 지체 없이 데이터베이스에서 삭제합니다. 동의·철회 사실을 증명하기 위한
        기록(일시, 동의자 성함·관계)은 분쟁 대비를 위해 3년간 보관 후 삭제합니다. 종이 동의서는 분쇄하여 파기합니다.
      </p>

      <h2>6. 정보주체와 법정대리인의 권리</h2>
      <p>
        정보주체와 법정대리인은 언제든 개인정보 열람·정정·삭제·처리정지와 동의 철회를 요구할 수 있습니다. 이용 현황 화면의 &lsquo;동의
        철회&rsquo; 버튼이나 아래 연락처로 요청하시면 지체 없이 처리합니다.
      </p>

      <h2>7. 안전성 확보 조치</h2>
      <ul>
        <li>직원 화면은 비밀번호로 접근을 제한하고, 담당 직원 변경 시 비밀번호를 바꿉니다.</li>
        <li>보호자 화면은 추측할 수 없는 전용 링크로만 열리며, 어르신 성함 일부를 가려 표시합니다.</li>
        <li>모든 통신은 암호화(HTTPS)되며, 주민등록번호·장기요양인정번호·주소·질환 정보는 웹 장부에 저장하지 않습니다.</li>
      </ul>

      <h2>8. 광고성 정보 전송</h2>
      <p>광고성 정보는 별도로 수신 동의하신 분께만 보내며, 이용 현황 화면이나 연락처로 언제든 수신을 거부하실 수 있습니다.</p>

      <h2>9. 개인정보 보호책임자</h2>
      <table className="consent-table">
        <tbody>
          <tr>
            <th>책임자</th>
            <td>{business.privacyOfficer || blank}</td>
          </tr>
          <tr>
            <th>연락처</th>
            <td>{business.privacyContact}</td>
          </tr>
          <tr>
            <th>사업자</th>
            <td>
              {business.company} (대표 {business.ceo}, 사업자등록번호 {business.bizNo})
              <br />
              {business.address}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="muted">
        개인정보 침해에 대한 신고·상담: 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(kopico.go.kr,
        1833-6972)
      </p>

      <h2>10. 시행일</h2>
      <p>이 방침은 {business.policyDate.replace(/-/g, ".")}부터 적용됩니다.</p>
    </article>
  );
}
