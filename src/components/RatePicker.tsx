"use client";

import { RATES } from "@/data/products";

export function RatePicker({ rate, onChange }: { rate: number; onChange: (r: number) => void }) {
  return (
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
  );
}
