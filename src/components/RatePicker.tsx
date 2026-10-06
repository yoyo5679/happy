"use client";

import { RATES } from "@/data/products";

const WHO: Record<number, string> = {
  0.15: "장기요양 등급이 있는 일반 대상자",
  0.09: "보험료 감경 대상자(보험료 순위 25% 초과 50% 이하)",
  0.06: "의료급여 수급자·차상위 감경 대상자 등",
  0: "국민기초생활수급자",
};

export function RatePicker({ rate, onChange }: { rate: number; onChange: (r: number) => void }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="rate-box">
      <div className="rates" role="radiogroup" aria-label="본인부담률">
        <span className="muted">본인부담률</span>
        {RATES.map((r) => (
          <button
            key={r.rate}
            role="radio"
            aria-checked={rate === r.rate}
            className={rate === r.rate ? "chip on" : "chip"}
            onClick={() => onChange(r.rate)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="rate-note">
        💡 <strong>본인부담({pct}%)</strong>: 실제로 내시는 금액이에요. (대상: {WHO[rate]})
        <br />
        <strong>급여가</strong>: 나라에서 정한 제품 가격이에요.{" "}
        {pct === 0 ? "전액을 국민건강보험공단이 부담해요." : `그중 ${100 - pct}%는 국민건강보험공단이 부담해요.`}
        <br />
        <span className="muted">복지용구는 연 160만원 한도 · 장기요양 등급이 없으면 급여가 전액 부담</span>
      </p>
    </div>
  );
}
