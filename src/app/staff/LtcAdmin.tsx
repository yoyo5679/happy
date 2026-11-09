"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Api = <T = Record<string, unknown>>(method: string, path: string, body?: unknown) => Promise<T>;
type Status = {
  meta: { sido: string[]; count: number; version: string; facilitiesAsOf: string; evaluationAsOf: string } | null;
  count: number;
  geocoded: number;
  failed: number;
  ver: string | null;
  kakao: boolean;
  dataGoKr: boolean;
};

/** 장기요양기관 찾기 데이터: 공단 파일 → D1로 옮기고, 카카오로 좌표 붙이기 */
export function LtcAdmin({ api, onBack }: { api: Api; onBack: () => void }) {
  const [st, setSt] = useState<Status | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"" | "import" | "geo">("");
  const stop = useRef(false);

  const refresh = useCallback(() => api<Status>("GET", "ltc/status").then(setSt, (e: Error) => setMsg(e.message)), [api]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function importAll() {
    if (!st?.meta) return;
    setBusy("import");
    setMsg("");
    try {
      for (const [i, sido] of st.meta.sido.entries()) {
        setMsg(`기관 목록 넣는 중… ${i + 1}/${st.meta.sido.length}`);
        await api("POST", "ltc/import", { sido, ver: st.meta.version });
      }
      await api("POST", "ltc/prune", { ver: st.meta.version });
      setMsg("기관 목록을 넣었어요. 이어서 '좌표 붙이기'를 눌러 주세요.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
      refresh();
    }
  }

  async function geocodeAll() {
    setBusy("geo");
    stop.current = false;
    setMsg("");
    try {
      let left = Infinity;
      let fails = 0;
      while (left > 0 && !stop.current) {
        const j = await api<{ done: number; failed: number; remaining: number }>("POST", "ltc/geocode");
        left = j.remaining;
        fails += j.failed;
        setMsg(`좌표 붙이는 중… 남은 기관 ${left.toLocaleString("ko-KR")}곳 (주소를 못 찾은 곳 ${fails})`);
        if (j.done === 0 && j.failed === 0) break;
      }
      setMsg(stop.current ? "멈췄어요. 다시 누르면 이어서 해요." : "좌표를 다 붙였어요.");
    } catch (e) {
      setMsg(`${(e as Error).message} · 다시 누르면 이어서 해요.`);
    } finally {
      setBusy("");
      refresh();
    }
  }

  const pct = st && st.count ? Math.round((st.geocoded / st.count) * 100) : 0;
  return (
    <>
      <div className="staff-bar">
        <button className="link" onClick={onBack}>
          ← 목록
        </button>
      </div>
      <h1 className="page-title">🏥 장기요양기관 찾기 데이터</h1>
      <section className="card">
        {!st && <p className="muted">불러오는 중…</p>}
        {st && (
          <>
            <p style={{ margin: 0 }}>
              준비된 공단 자료: {st.meta ? `${st.meta.count.toLocaleString("ko-KR")}곳 (기관현황 ${st.meta.facilitiesAsOf} · 평가 ${st.meta.evaluationAsOf})` : "없음"}
            </p>
            <p style={{ margin: "6px 0 0" }}>
              데이터베이스: {st.count.toLocaleString("ko-KR")}곳 · 좌표 {st.geocoded.toLocaleString("ko-KR")}곳 ({pct}%)
              {st.failed > 0 && ` · 주소를 못 찾은 곳 ${st.failed}`}
            </p>
            <div className="ledger-bar" style={{ marginTop: 8 }} aria-hidden>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="ledger-note">
              카카오 키 {st.kakao ? "✅" : "❌ (KAKAO_REST_KEY 필요)"} · 공단 API 키 {st.dataGoKr ? "✅" : "❌ (DATA_GO_KR_KEY 필요, 전화번호 조회용)"}
            </p>
          </>
        )}
      </section>
      <div className="btn-row">
        <button className="btn primary" onClick={importAll} disabled={!!busy || !st?.meta}>
          1. 기관 목록 넣기
        </button>
        {busy === "geo" ? (
          <button className="btn" onClick={() => (stop.current = true)}>
            멈추기
          </button>
        ) : (
          <button className="btn primary" onClick={geocodeAll} disabled={!!busy || !st?.count || !st.kakao}>
            2. 좌표 붙이기
          </button>
        )}
      </div>
      {msg && <p className="ledger-note">{msg}</p>}
      <p className="ledger-note">
        처음 한 번 1 → 2 순서로 눌러 주세요. 좌표 붙이기는 전국 약 2만 8천 곳이라 30분~1시간쯤 걸려요. 중간에 멈추거나 창을 닫아도 다음에 이어서 해요. 새
        공단 파일로 바꾼 뒤에는 다시 1 → 2를 누르면 바뀐 주소만 새로 찾아요.
      </p>
    </>
  );
}
