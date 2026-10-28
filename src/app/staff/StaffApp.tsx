"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { site } from "@/config/site";
import { LedgerView } from "@/components/LedgerView";
import { calcLedger, dot, today, ymd, type Item, type Recipient } from "@/lib/ledger";
import { relations } from "@/data/consent";
import { ImwebImport } from "./ImwebImport";
import { categories, products, RATES, won, type CategoryKey } from "@/data/products";

const KEY = "hc_staff";
type Api = <T = Record<string, unknown>>(method: string, path: string, body?: unknown) => Promise<T>;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function setupMessage(code: string) {
  if (code === "setup:DB") return "Cloudflare Pages에 데이터베이스(D1)가 아직 연결되지 않았어요. 설정 안내를 확인해 주세요.";
  if (code === "setup:STAFF_PASSWORD") return "직원 비밀번호(STAFF_PASSWORD)가 아직 설정되지 않았어요.";
  return code;
}

export function StaffApp() {
  const [pw, setPw] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setPw(sessionStorage.getItem(KEY));
    } catch {}
    setChecked(true);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    setPw(null);
  }, []);

  const api: Api = useCallback(
    async (method, path, body) => {
      const r = await fetch(`/api/staff/${path}`, {
        method,
        headers: { authorization: `Bearer ${pw}`, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) logout();
      if (!r.ok) throw new ApiError(r.status, setupMessage(typeof j.error === "string" ? j.error : "오류가 났어요. 다시 시도해 주세요."));
      return j;
    },
    [pw, logout],
  );

  if (!checked) return null;
  if (!pw) return <Login onLogin={(p) => setPw(p)} />;
  return <Ledger api={api} onLogout={logout} />;
}

function Login({ onLogin }: { onLogin: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/staff/ping", { headers: { authorization: `Bearer ${pw}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(setupMessage(typeof j.error === "string" ? j.error : "접속할 수 없어요"));
      try {
        sessionStorage.setItem(KEY, pw);
      } catch {}
      onLogin(pw);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">고객 장부</h1>
      <form className="card form" onSubmit={submit}>
        <p className="muted" style={{ margin: 0 }}>
          {site.name} 직원 전용 화면이에요.
        </p>
        <label>
          직원 비밀번호
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
        </label>
        {err && <p className="form-err">{err}</p>}
        <button className="btn primary" disabled={busy || !pw}>
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </>
  );
}

type Consent = { at: string; method: string; signer: string; relation: string; version: string; marketing: boolean; current: boolean };
type ListData = { recipients: Recipient[]; items: Item[]; consents: Record<string, Consent | null> };

function useSelected(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setId(new URLSearchParams(location.search).get("id"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const select = useCallback((next: string | null) => {
    const u = new URL(location.href);
    if (next) u.searchParams.set("id", next);
    else u.searchParams.delete("id");
    history.pushState(null, "", u);
    setId(next);
    window.scrollTo(0, 0);
  }, []);
  return [id, select];
}

function Ledger({ api, onLogout }: { api: Api; onLogout: () => void }) {
  const [selected, select] = useSelected();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<Recipient[] | null>(null);

  if (importing) return <ImwebImport api={api} recipients={importing} onBack={() => setImporting(null)} />;
  if (creating)
    return (
      <>
        <h1 className="page-title">어르신 등록</h1>
        <RecipientForm
          api={api}
          onDone={(id) => {
            setCreating(false);
            if (id) select(id);
          }}
        />
      </>
    );
  if (selected) return <Detail key={selected} id={selected} api={api} onBack={() => select(null)} />;
  return <List api={api} onOpen={select} onCreate={() => setCreating(true)} onImport={setImporting} onLogout={onLogout} />;
}

function List({
  api,
  onOpen,
  onCreate,
  onImport,
  onLogout,
}: {
  api: Api;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: (recipients: Recipient[]) => void;
  onLogout: () => void;
}) {
  const [data, setData] = useState<ListData | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<ListData>("GET", "recipients").then(setData, (e: Error) => setErr(e.message));
  }, [api]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.recipients
      .filter((r) => !q || r.name.includes(q.trim()))
      .map((r) => ({ r, L: calcLedger(r, data.items.filter((i) => i.recipient_id === r.id)) }));
  }, [data, q]);

  return (
    <>
      <div className="staff-bar page-title">
        <h1 style={{ margin: 0 }}>고객 장부</h1>
        <button className="link" onClick={onLogout}>
          로그아웃
        </button>
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={onCreate}>
          + 어르신 등록
        </button>
        <button className="btn" onClick={() => data && onImport(data.recipients)} disabled={!data}>
          🛒 아임웹 주문 가져오기
        </button>
      </div>
      <section className="card">
        <input className="staff-search" placeholder="이름·보호자 연락처로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
        {err && <p className="form-err">{err}</p>}
        {!data && !err && <p className="muted">불러오는 중…</p>}
        {data && rows.length === 0 && <p className="muted">{q ? "찾는 어르신이 없어요." : "아직 등록된 어르신이 없어요."}</p>}
        <ul className="staff-list">
          {rows.map(({ r, L }) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id!)}>
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {[data!.consents[r.id!]?.current ? "" : "⏳ 동의 대기", r.needs_check ? "⚠️ 확인 필요" : "", r.has_phone ? "📱 번호 등록" : "", L.alerts.length ? `🔔 ${L.alerts.length}` : ""].filter(Boolean).join(" · ")}
                  </small>
                </span>
                <b>{won(L.remaining)}</b>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function RecipientForm({ api, initial, onDone }: { api: Api; initial?: Recipient; onDone: (id?: string) => void }) {
  const [f, setF] = useState<Recipient>(
    initial ? { ...initial, guardian_phone: "", clear_phone: false } : { name: "", rate: 0.15, period_start: "", base_remaining: 1_600_000, base_date: today(), guardian_phone: "" },
  );
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Recipient>(k: K, v: Recipient[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (initial?.id) {
        await api("PUT", `recipients/${initial.id}`, f);
        onDone(initial.id);
      } else {
        const j = await api<{ id: string }>("POST", "recipients", f);
        onDone(j.id);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        어르신 성함
        <input value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={40} />
      </label>
      <div className="form-row">
        <label>
          본인부담률
          <select value={f.rate} onChange={(e) => set("rate", Number(e.target.value))}>
            {RATES.map((r) => (
              <option key={r.rate} value={r.rate}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <span />
      </div>
      <label>
        연 한도 적용기간 시작일
        <small>공단 조회 화면의 복지용구 적용기간 시작일</small>
        <input type="date" value={f.period_start} onChange={(e) => set("period_start", e.target.value)} required />
      </label>
      <div className="form-row">
        <label>
          조회한 남은 금액
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={10}
            value={f.base_remaining}
            onChange={(e) => set("base_remaining", Number(e.target.value))}
            required
          />
        </label>
        <label>
          조회일
          <input type="date" value={f.base_date} onChange={(e) => set("base_date", e.target.value)} required />
        </label>
      </div>
      <p className="ledger-note" style={{ marginTop: -4 }}>
        조회일 이후의 해피케어 구입·대여분만 자동으로 빠져요. 다시 조회하면 금액과 조회일을 고쳐 주세요.
      </p>
      <label>
        보호자 휴대폰 <small>선택 · 아임웹 주문 자동 연결용. 번호는 저장되지 않고 대조값으로만 남아 다시 볼 수 없어요</small>
        <input
          type="tel"
          inputMode="numeric"
          value={f.guardian_phone ?? ""}
          onChange={(e) => set("guardian_phone", e.target.value)}
          maxLength={20}
          placeholder={f.has_phone ? "등록됨 · 바꾸려면 새 번호 입력" : "010-0000-0000"}
        />
      </label>
      {f.has_phone && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
          <input type="checkbox" checked={!!f.clear_phone} onChange={(e) => set("clear_phone", e.target.checked)} style={{ width: 20, minHeight: 20 }} />
          등록된 번호 지우기
        </label>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
        <input type="checkbox" checked={!!f.needs_check} onChange={(e) => set("needs_check", e.target.checked)} style={{ width: 20, minHeight: 20 }} />
        ⚠️ 확인 필요 (본인부담률·공단 잔액·적용기간을 아직 확인 못 함)
      </label>
      <p className="ledger-note" style={{ margin: 0 }}>
        개인정보 최소 수집을 위해 등급·주소·연락처 원문·메모는 저장하지 않아요.
      </p>
      {err && <p className="form-err">{err}</p>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => onDone()}>
          취소
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

type DetailData = { recipient: Recipient; items: Item[]; consent: Consent | null };

function Detail({ id, api, onBack }: { id: string; api: Api; onBack: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"view" | "edit" | "add" | { item: Item }>("view");

  const load = useCallback(() => {
    api<DetailData>("GET", `recipients/${id}`).then(setData, (e: Error) => setErr(e.message));
  }, [api, id]);
  useEffect(load, [load]);

  if (err)
    return (
      <>
        <button className="link" onClick={onBack}>
          ← 목록
        </button>
        <p className="form-err">{err}</p>
      </>
    );
  if (!data) return <p className="muted">불러오는 중…</p>;
  const r = data.recipient;

  if (mode === "edit")
    return (
      <>
        <h1 className="page-title">정보 수정</h1>
        <RecipientForm
          api={api}
          initial={r}
          onDone={() => {
            setMode("view");
            load();
          }}
        />
      </>
    );
  if (mode === "add" || typeof mode === "object")
    return (
      <>
        <h1 className="page-title">{mode === "add" ? "품목 추가" : "품목 수정"}</h1>
        <ItemForm
          api={api}
          recipientId={id}
          initial={typeof mode === "object" ? mode.item : undefined}
          onDone={() => {
            setMode("view");
            load();
          }}
        />
      </>
    );

  const cancelled = data.items.filter((i) => i.status === "cancelled");

  return (
    <>
      <div className="staff-bar">
        <button className="link" onClick={onBack}>
          ← 목록
        </button>
        <button className="link" onClick={() => setMode("edit")}>
          정보·잔액 수정
        </button>
      </div>
      <LedgerView
        recipient={r}
        items={data.items}
        actions={(it) => (
          <div className="item-actions">
            <button className="btn small" onClick={() => setMode({ item: it })}>
              수정
            </button>
          </div>
        )}
      />
      <button className="btn primary wide" onClick={() => setMode("add")}>
        + 구입·대여 품목 추가
      </button>
      {cancelled.length > 0 && (
        <section className="card">
          <h2 className="ledger-h2">취소·반품</h2>
          <ul className="ledger-items">
            {cancelled.map((it) => (
              <li key={it.id}>
                <div className="ledger-item-main">
                  <span className="ledger-emoji">↩️</span>
                  <div>
                    <strong>{it.name}</strong>
                    <small>
                      {it.date} · {won(it.price * it.qty)} (차감 안 됨)
                    </small>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="btn small" onClick={() => setMode({ item: it })}>
                    수정
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.needs_check && (
        <p className="ledger-alert warn">⚠️ 본인부담률·공단 잔액·적용기간 확인이 필요한 장부예요. 확인 후 &lsquo;정보·잔액 수정&rsquo;에서 체크를 풀어 주세요.</p>
      )}
      <ConsentCard api={api} recipient={r} consent={data.consent} onChange={load} />
      <GuardianLink api={api} recipient={r} onChange={load} />
      <DeleteRecipient api={api} recipient={r} onDeleted={onBack} />
    </>
  );
}

function ConsentCard({ api, recipient: r, consent: c, onChange }: { api: Api; recipient: Recipient; consent: Consent | null; onChange: () => void }) {
  const [paper, setPaper] = useState(false);
  const [signer, setSigner] = useState("");
  const [relation, setRelation] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api("POST", `recipients/${r.id}/consent`, { signer, relation, marketing });
      setPaper(false);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <section className="card">
      <h2 className="ledger-h2">개인정보 동의</h2>
      {c?.current ? (
        <p style={{ margin: 0 }}>
          ✅ {dot(ymd(new Date(c.at)))} {c.method === "paper" ? "종이 동의서" : "웹"} 동의 · {c.signer}({c.relation}) · 광고성 안내 {c.marketing ? "동의" : "미동의"}
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          ⏳ {c ? "동의서 문구가 바뀌어 다시 동의가 필요해요." : "아직 동의 전이에요."} 아래 링크를 보내면 보호자가 휴대폰에서 동의할 수 있어요. 동의 전에는 장부 내용이 보이지 않아요.
        </p>
      )}
      {!paper ? (
        <p style={{ margin: "8px 0 0" }}>
          <button className="link" onClick={() => setPaper(true)}>
            종이 동의서로 받았어요 (기록하기)
          </button>{" "}
          · <a href="/consent" target="_blank" className="link">인쇄용 동의서</a>
        </p>
      ) : (
        <form className="form" onSubmit={save} style={{ marginTop: 12 }}>
          <div className="form-row">
            <label>
              동의하신 분
              <input value={signer} onChange={(e) => setSigner(e.target.value)} required maxLength={40} />
            </label>
            <label>
              관계
              <select value={relation} onChange={(e) => setRelation(e.target.value)} required>
                <option value="">선택</option>
                {relations.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
            광고성 안내 수신에도 동의함 (선택 항목에 체크한 경우만)
          </label>
          <p className="ledger-note" style={{ margin: 0 }}>필수 항목 4개에 모두 서명받은 동의서만 기록해 주세요. 종이 원본은 보관해 주세요.</p>
          {err && <p className="form-err">{err}</p>}
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setPaper(false)}>
              취소
            </button>
            <button className="btn primary">기록</button>
          </div>
        </form>
      )}
    </section>
  );
}

function GuardianLink({ api, recipient: r, onChange }: { api: Api; recipient: Recipient; onChange: () => void }) {
  const [msg, setMsg] = useState("");
  const link = `${location.origin}/my?k=${r.token}`;
  const text = `[${site.name}] ${r.name} 어르신 복지용구 현황\n올해 남은 금액과 이용 중인 품목을 아래 링크에서 언제든 확인하실 수 있어요. (처음 한 번 이용 동의가 필요해요)\n${link}\n\n문의 ${site.phone}`;

  async function copy(s: string, done: string) {
    try {
      await navigator.clipboard.writeText(s);
      setMsg(done);
    } catch {
      setMsg("복사가 안 되면 위 주소를 길게 눌러 복사해 주세요.");
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        return;
      }
    }
    copy(text, "안내 문구를 복사했어요. 카톡에 붙여넣어 보내 주세요.");
  }
  async function regenerate() {
    if (!confirm("새 링크를 만들면 예전에 보낸 링크는 더 이상 열리지 않아요. 계속할까요?")) return;
    try {
      await api("POST", `recipients/${r.id}/token`);
      setMsg("새 링크를 만들었어요.");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <section className="card">
      <h2 className="ledger-h2">보호자에게 보내기</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        보호자는 이 링크로 남은 금액과 품목만 볼 수 있어요. 성함은 가려서 보여요.
      </p>
      <p className="link-box">{link}</p>
      <div className="btn-row">
        <button className="btn kakao" onClick={share}>
          💬 카톡으로 보내기
        </button>
        <button className="btn" onClick={() => copy(link, "링크를 복사했어요.")}>
          링크 복사
        </button>
      </div>
      {msg && <p className="ledger-note">{msg}</p>}
      <button className="link" onClick={regenerate}>
        링크 새로 만들기 (예전 링크 막기)
      </button>
    </section>
  );
}

function DeleteRecipient({ api, recipient: r, onDeleted }: { api: Api; recipient: Recipient; onDeleted: () => void }) {
  async function del() {
    if (prompt(`${r.name} 어르신의 장부를 모두 지워요. 지우려면 성함을 입력해 주세요.`) !== r.name) return;
    try {
      await api("DELETE", `recipients/${r.id}`);
      onDeleted();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  return (
    <p style={{ textAlign: "center" }}>
      <button className="link" onClick={del}>
        장부 삭제
      </button>
    </p>
  );
}

const productOptions = products.map((p) => ({
  p,
  search: `${p.name} ${categories[p.category].label}`.toLowerCase(),
}));

function ItemForm({ api, recipientId, initial, onDone }: { api: Api; recipientId: string; initial?: Item; onDone: () => void }) {
  const [f, setF] = useState<Omit<Item, "id"> & { id?: string }>(
    initial ?? { kind: "buy", product_id: "", category: "", name: "", price: 0, qty: 1, date: today(), end_date: null, status: "active", note: "" },
  );
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setF((p) => ({ ...p, [k]: v }));
  const product = products.find((p) => p.id === f.product_id);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return productOptions.filter((o) => o.search.includes(s)).slice(0, 30);
  }, [q]);

  function pick(id: string, kind: "buy" | "rent") {
    const p = products.find((x) => x.id === id)!;
    const l = kind === "rent" ? p.rent : p.buy;
    setF((prev) => ({ ...prev, product_id: p.id, category: p.category, name: p.name, kind, price: l?.price ?? prev.price, qty: 1, end_date: null }));
    setQ("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (initial) await api("PUT", `recipients/${recipientId}/items/${initial.id}`, f);
      else await api("POST", `recipients/${recipientId}/items`, f);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (!initial || !confirm("이 품목을 장부에서 지울까요? (반품·취소는 '취소됨'으로 바꾸는 걸 권해요)")) return;
    try {
      await api("DELETE", `recipients/${recipientId}/items/${initial.id}`);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        상품 찾기 <small>모델명이나 품목(예: 전동침대)으로 검색</small>
        <input className="staff-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 안전손잡이" />
      </label>
      {matches.length > 0 && (
        <ul className="pick-list">
          {matches.map(({ p }) => (
            <li key={p.id}>
              {p.buy && (
                <button type="button" onClick={() => pick(p.id, "buy")}>
                  {categories[p.category].emoji} {p.name} <small>구입 {won(p.buy.price)}</small>
                </button>
              )}
              {p.rent && (
                <button type="button" onClick={() => pick(p.id, "rent")}>
                  {categories[p.category].emoji} {p.name} <small>대여 월 {won(p.rent.price)}</small>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="form-row">
        <label>
          구분
          <select value={f.kind} onChange={(e) => set("kind", e.target.value as Item["kind"])}>
            <option value="buy">구입</option>
            <option value="rent">대여</option>
          </select>
        </label>
        <label>
          품목
          <select value={f.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">기타</option>
            {(Object.keys(categories) as CategoryKey[]).map((c) => (
              <option key={c} value={c}>
                {categories[c].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        상품명
        <input value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={100} />
      </label>
      <div className="form-row">
        <label>
          {f.kind === "rent" ? "월 대여가 (급여가)" : "개당 급여가"}
          <input type="number" inputMode="numeric" min={10} step={10} value={f.price || ""} onChange={(e) => set("price", Number(e.target.value))} required />
        </label>
        {f.kind === "buy" ? (
          <label>
            수량
            <input type="number" inputMode="numeric" min={1} max={99} value={f.qty} onChange={(e) => set("qty", Number(e.target.value))} required />
          </label>
        ) : (
          <span />
        )}
      </div>
      {product && (
        <p className="ledger-note" style={{ marginTop: -4 }}>
          쇼핑몰 가격: {product.buy ? `구입 ${won(product.buy.price)}` : ""} {product.rent ? `대여 월 ${won(product.rent.price)}` : ""}
        </p>
      )}
      <div className="form-row">
        <label>
          {f.kind === "rent" ? "대여 시작일" : "구입일"}
          <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} required />
        </label>
        {f.kind === "rent" && (
          <label>
            대여 종료일 <small>모르면 비워두기</small>
            <input type="date" value={f.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} />
          </label>
        )}
      </div>
      <label>
        상태
        <select value={f.status} onChange={(e) => set("status", e.target.value as Item["status"])}>
          <option value="active">정상 (한도에서 차감)</option>
          <option value="cancelled">취소·반품 (차감 안 함)</option>
        </select>
      </label>

      {err && <p className="form-err">{err}</p>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>
          취소
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
      {initial && (
        <button type="button" className="link" onClick={del}>
          장부에서 지우기
        </button>
      )}
    </form>
  );
}
