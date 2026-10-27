"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { site } from "@/config/site";
import { LedgerView } from "@/components/LedgerView";
import type { Item, Recipient } from "@/lib/ledger";

type Data = { recipient: Recipient; items: Item[] };

export function MyLedger() {
  const [state, setState] = useState<{ data?: Data; error?: string; loading: boolean }>({ loading: true });

  useEffect(() => {
    const k = new URLSearchParams(location.search).get("k") ?? "";
    if (!k) {
      setState({ loading: false, error: "해피케어에서 보내드린 링크로 들어와 주세요." });
      return;
    }
    fetch(`/api/my?k=${encodeURIComponent(k)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof j.error === "string" && !j.error.startsWith("setup:") ? j.error : "잠시 후 다시 열어 주세요.");
        setState({ loading: false, data: j as Data });
      })
      .catch((e: Error) => setState({ loading: false, error: e.message }));
  }, []);

  return (
    <>
      <h1 className="page-title">우리 부모님 복지용구 현황</h1>
      {state.loading && <p className="muted">불러오는 중…</p>}
      {state.error && (
        <section className="card">
          <p>{state.error}</p>
          <p className="muted">링크가 열리지 않으면 {site.phone}로 연락 주세요.</p>
        </section>
      )}
      {state.data && (
        <>
          <LedgerView recipient={state.data.recipient} items={state.data.items} />
          <section className="card cta">
            <h3>더 필요한 게 있으신가요?</h3>
            <p className="muted">남은 금액으로 받을 수 있는 품목을 찾아보거나, 편하게 상담해 주세요.</p>
            <div className="cta-buttons">
              <Link className="btn primary" href="/rooms">
                🏠 장소별로 필요한 용품 찾기
              </Link>
              <a className="btn" href={`tel:${site.phone.replace(/-/g, "")}`}>
                📞 전화 상담 {site.phone}
              </a>
              {site.kakaoUrl && (
                <a className="btn kakao" href={site.kakaoUrl} target="_blank" rel="noopener">
                  💬 카카오톡 상담
                </a>
              )}
            </div>
          </section>
          <p className="ledger-note">
            📱 이 화면을 휴대폰 홈 화면에 추가해 두시면 언제든 바로 확인할 수 있어요. (공유 버튼 → &lsquo;홈 화면에 추가&rsquo;)
          </p>
        </>
      )}
    </>
  );
}
