import { domainOrder, domains, gradeQuestions, type DomainKey } from "@/lib/grade";

const CUTOFFS = [
  ["1등급", "95점 이상", ""],
  ["2등급", "75점 이상 ~ 95점 미만", ""],
  ["3등급", "60점 이상 ~ 75점 미만", ""],
  ["4등급", "51점 이상 ~ 60점 미만", ""],
  ["5등급", "45점 이상 ~ 51점 미만", "치매 환자"],
  ["인지지원등급", "45점 미만", "치매 환자"],
];

export function GradeExplain({ score, breakdown }: { score: number; breakdown?: Record<DomainKey, number> }) {
  const count = (d: DomainKey) => gradeQuestions.filter((q) => q.domain === d).length;
  return (
    <details className="card explain">
      <summary>🔎 어떻게 계산했나요?</summary>

      <p>
        실제 장기요양등급은 국민건강보험공단 직원이 집을 방문해 <strong>52개 항목(5개 영역)</strong>을 조사하고, 이를 공단의 판정
        모형에 넣어 <strong>장기요양인정점수</strong>를 계산한 뒤 의사소견서와 함께 등급판정위원회가 결정해요.
      </p>
      <p>
        이 모의 계산은 그 조사표의 <strong>5개 영역 구성을 그대로 따르되</strong>, 질문을 {gradeQuestions.length}개로 줄이고 영역별
        비중으로 점수를 매겨 <strong>공식 등급 구간</strong>에 대어 본 결과예요.
      </p>

      {breakdown && (
        <>
          <h4>내 답변의 영역별 점수</h4>
          <table className="tbl">
            <thead>
              <tr>
                <th>영역</th>
                <th>문항</th>
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {domainOrder.map((d) => (
                <tr key={d}>
                  <td>{domains[d].label}</td>
                  <td className="muted">{count(d)}문항</td>
                  <td className="num">
                    {breakdown[d]} / {domains[d].max}
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>합계 (모의 점수)</strong>
                </td>
                <td />
                <td className="num">{score} / 100</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      <h4>공식 조사표와 비교</h4>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>영역</th>
              <th>공식 조사 항목</th>
              <th>모의 계산</th>
            </tr>
          </thead>
          <tbody>
            {domainOrder.map((d) => (
              <tr key={d}>
                <td>{domains[d].label}</td>
                <td className="small">{domains[d].official}</td>
                <td className="small">
                  {count(d)}문항 · {domains[d].max}점
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>등급 구간 (공식 기준)</h4>
      <table className="tbl">
        <tbody>
          {CUTOFFS.map(([g, range, cond]) => (
            <tr key={g}>
              <td>{g}</td>
              <td>{range}</td>
              <td className="muted small">{cond}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>꼭 알아두세요</h4>
      <ul className="facts small">
        <li>
          <strong>공식 기준을 따른 것</strong>: 5개 영역 구성, 등급 구간 점수, 5등급·인지지원등급의 치매 요건
        </li>
        <li>
          <strong>단순화한 것</strong>: 질문 수({gradeQuestions.length}개)와 문항별 배점. 공단의 실제 판정 모형은 공개된 단순 계산식이
          아니라서 그대로 재현할 수 없어요.
        </li>
        <li>그래서 실제 판정과 한 등급 정도 차이가 날 수 있어요. 결과는 신청 여부를 판단하는 참고용으로만 봐 주세요.</li>
        <li>정확한 등급은 국민건강보험공단(☎ 1577-1000)에 장기요양인정을 신청해야 알 수 있어요.</li>
      </ul>
      <p className="muted small">
        참고: 국민건강보험공단 「장기요양등급판정기준에 관한 고시」, 장기요양 인정조사표 영역 구성
      </p>
    </details>
  );
}
