"use client";

import { useEffect } from "react";

// 예전 질문형 '우리 집 맞춤' 주소 → '우리 집에서 찾기'로 이동 (?src= 등 그대로 유지)
export default function Recommend() {
  useEffect(() => {
    window.location.replace("/rooms" + window.location.search);
  }, []);
  return (
    <p className="muted" style={{ padding: "40px 0", textAlign: "center" }}>
      <a href="/rooms">우리 집에서 찾기</a>로 이동하고 있어요…
    </p>
  );
}
