"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { site } from "@/config/site";
import { LedgerView } from "@/components/LedgerView";
import { dot, ymd, type Item, type Recipient } from "@/lib/ledger";
import { ConsentForm } from "./ConsentForm";

type Data =
  | { needConsent: true; version: string; recipient: { name: string } }
  | { needConsent?: false; consent: { at: string; marketing: boolean }; recipient: Recipient; items: Item[] };

export function MyLedger() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<{ data?: Data; error?: string; loading: boolean; gone?: boolean }>({ loading: true });

  const load = useCallback((k: string) => {
    fetch(`/api/my?k=${encodeURIComponent(k)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof j.error === "string" && !j.error.startsWith("setup:") ? j.error : "잠시 후 다시 열어 주세요.");
        setState({ loading: false, data: j as Data });
        window.scrollTo(0, 0);
      })
      .catch((e: Error) => setState({ loading: false, error: e.message }));
  }, []);

  useEffect(() => {
    const k = new URLSearchParams(location.search).get("k") ?? "";
    setToken(k);
    if (!k) setState({ loading: false, error: "해피케어에서 보내드린 링크로 들어와 주세요." });
    else load(k);
  }, [load]);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(`/api/my/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ k: token, ...extra }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(typeof j.error === "string" ? j.error : "잠시 후 다시 시도해 주세요.");
    }
  }

  async function withdraw() {
    if (!confirm("동의를 철회하면 이 화면의 정보가 바로 지워지고 링크도 더 이상 열리지 않아요. 복지용구 이용과 공단 청구는 그대로예요. 철회할까요?")) return;
    try {
      await post("withdraw");
      setState({ loading: false, gone: true });
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function toggleMarketing(on: boolean) {
    try {
      await post("marketing", { marketing: on });
      load(token);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const d = state.data;
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
      {state.gone && (
        <section className="card">
          <p>동의가 철회되어 정보를 지웠어요.</p>
          <p className="muted">다시 이용하시려면 {site.phone}로 연락 주세요.</p>
        </section>
      )}
      {d?.needConsent && <ConsentForm token={token} version={d.version} name={d.recipient.name} onDone={() => load(token)} />}
      {d && !d.needConsent && (
        <>
          <LedgerView recipient={d.recipient} items={d.items} />
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
          <section className="consent-foot">
            <p>
              {dot(ymd(new Date(d.consent.at)))} 이용 동의 · 광고성 안내 {d.consent.marketing ? "받음" : "안 받음"}{" "}
              <button className="link" onClick={() => toggleMarketing(!d.consent.marketing)}>
                {d.consent.marketing ? "안내 그만 받기" : "안내 받기"}
              </button>
            </p>
            <p>
              <Link href="/privacy">개인정보처리방침</Link> ·{" "}
              <button className="link" onClick={withdraw}>
                동의 철회
              </button>
            </p>
          </section>
        </>
      )}
    </>
  );
}
