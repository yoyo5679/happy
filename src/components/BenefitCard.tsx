import { BENEFIT_YEAR, EQUIPMENT_LIMIT, gradeBenefits, type GradeName } from "@/data/benefits";
import { copay, won } from "@/data/products";

export function BenefitCard({ grade, rate }: { grade: string; rate: number }) {
  const pct = Math.round(rate * 100);

  // 등급외: 등급을 받으면 받을 수 있는 범위만 안내
  if (!(grade in gradeBenefits)) {
    return (
      <section className="card benefit">
        <h3>🎁 등급을 받으면 이런 혜택이 있어요</h3>
        <ul className="benefit-list">
          <li>
            <span>복지용구</span>
            <strong>연 {won(EQUIPMENT_LIMIT)}</strong>
          </li>
          <li>
            <span>재가서비스 (방문요양 등)</span>
            <strong>
              월 {won(gradeBenefits["인지지원등급"].monthly)} ~ {won(gradeBenefits["1등급"].monthly)}
            </strong>
          </li>
        </ul>
        <p className="muted small">상태가 나빠지면 언제든 다시 신청할 수 있어요. {BENEFIT_YEAR}년 기준.</p>
      </section>
    );
  }

  const b = gradeBenefits[grade as GradeName];
  return (
    <section className="card benefit">
      <h3>🎁 {grade}이 나오면 받을 수 있는 혜택</h3>
      <ul className="benefit-list">
        <li>
          <span>🏠 집으로 오는 돌봄 서비스 (방문요양·방문목욕 등)</span>
          <strong>매달 {won(b.monthly)}어치까지</strong>
          <em>
            {pct === 0
              ? "비용은 나라에서 내 드려요 (본인부담 없음)"
              : `쓴 만큼의 ${pct}%만 내세요 · 예) 100만원어치 이용 → ${won(copay(1_000_000, rate))}`}
          </em>
        </li>
        <li>
          <span>🛏️ 복지용구 (침대·보행기·안전손잡이 등)</span>
          <strong>1년에 {won(EQUIPMENT_LIMIT)}어치까지</strong>
          <em>
            {pct === 0
              ? "비용은 나라에서 내 드려요 (본인부담 없음)"
              : `가격의 ${pct}%만 내세요 · 예) 20만원짜리 보행기 → ${won(copay(200_000, rate))}`}
          </em>
          <small>돌봄 서비스와 따로 쓸 수 있어요</small>
        </li>
        <li>
          <span>이용 가능한 서비스</span>
          <strong className="sm">{b.services}</strong>
        </li>
        <li>
          <span>요양원(시설)</span>
          <strong className="sm">{b.facility}</strong>
        </li>
      </ul>
      <p className="muted small">
        {BENEFIT_YEAR}년 기준 · 금액은 매년 바뀌어요. 정해진 금액보다 더 쓰면 넘은 부분은 직접 내셔야 해요. 요양원 이용 시에는 20%를
        내요. 정확한 내용은 국민건강보험공단(☎ 1577-1000)에서 확인하세요.
      </p>
    </section>
  );
}
