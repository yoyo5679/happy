"use client";

import { useEffect, useState } from "react";

// 큰 글씨 모드: <html class="big"> + 기기에 기억
export function FontToggle() {
  const [big, setBig] = useState(false);
  useEffect(() => setBig(document.documentElement.classList.contains("big")), []);
  function toggle() {
    const next = !big;
    setBig(next);
    document.documentElement.classList.toggle("big", next);
    try {
      localStorage.setItem("hc_big", next ? "1" : "0");
    } catch {}
  }
  return (
    <button className={big ? "font-toggle on" : "font-toggle"} onClick={toggle} aria-pressed={big} aria-label="큰 글씨로 보기">
      <span className="s">가</span>
      <span className="l">가</span>
      <span className="t">{big ? "보통 글씨" : "큰 글씨"}</span>
    </button>
  );
}
