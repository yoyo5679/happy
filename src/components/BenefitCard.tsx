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
          <span>재가서비스 월 한도</span>
          <strong>{won(b.monthly)}</strong>
          <em>
            다 쓰면 본인부담({pct}%) 월 {won(copay(b.monthly, rate))}
          </em>
        </li>
        <li>
          <span>복지용구 (구입·대여)</span>
          <strong>연 {won(EQUIPMENT_LIMIT)}</strong>
          <em>
            본인부담({pct}%) 최대 {won(copay(EQUIPMENT_LIMIT, rate))} · 재가서비스 한도와 별도
          </em>
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
        {BENEFIT_YEAR}년 기준 · 한도액은 매년 바뀌어요. 한도를 넘는 이용분은 전액 본인 부담이며, 시설 이용 시 본인부담은 20%예요.
        정확한 내용은 국민건강보험공단(☎ 1577-1000)에서 확인하세요.
      </p>
    </section>
  );
}
