"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { categories, products, won, type CategoryKey, type Product } from "@/data/products";
import type { Recipient } from "@/lib/ledger";

type Api = <T = Record<string, unknown>>(method: string, path: string, body?: unknown) => Promise<T>;
type ImItem = { prod_no: string; name: string; count: number; price: number; status: string };
type ImOrder = { order_no: string; date: string; name: string; phones: string[]; total: number; items: ImItem[] };
type Check = { ok: boolean; count: number | null; sample: Omit<ImOrder, "items"> | null; keys: string[] };

// 쇼핑몰 상품번호(idx) → 상품·구입/대여
const byIdx = new Map<string, { p: Product; kind: "buy" | "rent" }>();
for (const p of products) {
  for (const kind of ["buy", "rent"] as const) {
    const idx = p[kind]?.url.match(/[?&]idx=(\d+)/)?.[1];
    if (idx && !byIdx.has(idx)) byIdx.set(idx, { p, kind });
  }
}
const cancelled = (s: string) => /CANCEL|RETURN|REFUND|취소|반품|환불/i.test(s);
const mask = (ph: string) => (ph.length >= 8 ? `${ph.slice(0, 3)}-****-${ph.slice(-4)}` : ph);

export function ImwebImport({ api, recipients, onBack }: { api: Api; recipients: Recipient[]; onBack: () => void }) {
  const [check, setCheck] = useState<Check | null>(null);
  const [err, setErr] = useState("");
  const [days, setDays] = useState(30);
  const [orders, setOrders] = useState<ImOrder[] | null>(null);
  const [page, setPage] = useState({ page: 0, total: 1, partial: false });
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    api<Check>("GET", "imweb/check").then(setCheck, (e: Error) =>
      setErr(e.message === "setup:IMWEB" ? "Cloudflare에 IMWEB_API_KEY · IMWEB_SECRET_KEY가 아직 없어요. 넣은 뒤 재배포해 주세요." : e.message),
    );
  }, [api]);

  const load = useCallback(
    async (next: number, reset: boolean) => {
      setLoading(true);
      setErr("");
      try {
        const j = await api<{ orders: ImOrder[]; page: number; totalPage: number; partial?: boolean }>("GET", `imweb/orders?days=${days}&page=${next}`);
        setOrders((o) => {
          const prev = reset || !o ? [] : o;
          return [...prev, ...j.orders.filter((x) => !prev.some((y) => y.order_no === x.order_no))];
        });
        setPage({ page: j.page, total: j.totalPage, partial: !!j.partial });
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [api, days],
  );

  useEffect(() => {
    if (check?.ok) load(1, true);
  }, [check, load]);

  const phoneOf = useMemo(() => recipients.map((r) => ({ r, d: (r.guardian ?? "").replace(/\D/g, "") })), [recipients]);
  const matchRecipient = (o: ImOrder) => phoneOf.find(({ d }) => d.length >= 8 && o.phones.some((ph) => d.includes(ph.slice(-8))))?.r.id ?? "";

  return (
    <>
      <div className="staff-bar">
        <button className="link" onClick={onBack}>
          ← 목록
        </button>
      </div>
      <h1 className="page-title">아임웹 주문 가져오기</h1>

      <section className="card">
        <h2 className="ledger-h2">연결 확인</h2>
        {!check && !err && <p className="muted">아임웹에 연결하는 중…</p>}
        {err && <p className="form-err">{err}</p>}
        {check?.ok && (
          <>
            <p style={{ margin: 0 }}>✅ 아임웹 연결됨{check.count != null && ` · 최근 30일 주문 ${check.count}건`}</p>
            {check.sample && (
              <p className="ledger-note">
                가장 최근 주문: {check.sample.date} · {check.sample.name || "이름 없음"} · {won(check.sample.total)}
              </p>
            )}
            <button className="link small" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "닫기" : "응답 항목 보기 (문제 생길 때 확인용)"}
            </button>
            {showRaw && <p className="link-box">{check.keys.join(", ") || "(주문 없음)"}</p>}
          </>
        )}
      </section>

      {check?.ok && (
        <>
          <div className="bp-chips" style={{ margin: "8px 0" }}>
            {[30, 60, 90].map((d) => (
              <button key={d} className={days === d ? "chip on" : "chip"} onClick={() => setDays(d)}>
                최근 {d}일
              </button>
            ))}
          </div>
          <p className="ledger-note">이미 장부에 넣었거나 숨긴 주문은 다시 나오지 않아요. 주문자 휴대폰 번호가 어르신의 보호자 연락처와 같으면 자동으로 골라져요.</p>
          {orders?.length === 0 && !loading && <p className="card muted">새로 가져올 주문이 없어요.</p>}
          {orders?.map((o) => (
            <OrderCard
              key={o.order_no}
              api={api}
              order={o}
              recipients={recipients}
              initial={matchRecipient(o)}
              onDone={() => setOrders((list) => list!.filter((x) => x.order_no !== o.order_no))}
            />
          ))}
          {loading && <p className="muted">주문 불러오는 중…</p>}
          {!loading && page.partial && (
            <button className="btn wide" onClick={() => load(page.page, false)}>
              아임웹 호출 제한 때문에 일부만 불러왔어요 · 이어서 불러오기
            </button>
          )}
          {!loading && !page.partial && page.page < page.total && (
            <button className="btn wide" onClick={() => load(page.page + 1, false)}>
              더 불러오기 ({page.page}/{page.total})
            </button>
          )}
        </>
      )}
    </>
  );
}

function OrderCard({
  api,
  order: o,
  recipients,
  initial,
  onDone,
}: {
  api: Api;
  order: ImOrder;
  recipients: Recipient[];
  initial: string;
  onDone: () => void;
}) {
  const lines = o.items.map((it, i) => ({ i, it, m: byIdx.get(it.prod_no), off: cancelled(it.status) }));
  const [rid, setRid] = useState(initial);
  const [on, setOn] = useState<boolean[]>(lines.map((l) => !!l.m && !l.off));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function add() {
    if (!rid) return setErr("어느 어르신 장부에 넣을지 골라 주세요.");
    const picked = lines.filter((l) => on[l.i] && l.m);
    if (!picked.length) return setErr("넣을 품목을 골라 주세요.");
    setBusy(true);
    setErr("");
    try {
      for (const { it, m } of picked) {
        const { p, kind } = m!;
        await api("POST", `recipients/${rid}/items`, {
          kind,
          product_id: p.id,
          category: p.category,
          name: p.name,
          price: (kind === "rent" ? p.rent : p.buy)!.price,
          qty: kind === "rent" ? 1 : it.count,
          date: o.date,
          end_date: null,
          status: "active",
          note: `아임웹 주문 ${o.order_no}`,
        });
      }
      await api("POST", "imweb/mark", { order_no: o.order_no, action: "added", recipient_id: rid });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function hide() {
    try {
      await api("POST", "imweb/mark", { order_no: o.order_no, action: "ignored" });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <section className="card form">
      <p style={{ margin: 0 }}>
        <strong>{o.date}</strong> · {o.name || "주문자"} {o.phones[0] && <span className="muted">({mask(o.phones[0])})</span>}
        <br />
        <span className="muted small">
          주문번호 {o.order_no} · 결제 {won(o.total)}
        </span>
      </p>
      <ul className="ledger-items">
        {lines.map(({ i, it, m, off }) => (
          <li key={i}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={on[i]}
                disabled={!m}
                onChange={(e) => setOn((a) => a.map((v, j) => (j === i ? e.target.checked : v)))}
                style={{ width: 20, minHeight: 20, marginTop: 4 }}
              />
              <span>
                <strong>
                  {m ? `${categories[m.p.category as CategoryKey].emoji} ${m.p.name}` : it.name}
                  {it.count > 1 && ` × ${it.count}`}
                </strong>
                <small className="muted" style={{ display: "block" }}>
                  {m
                    ? `${m.kind === "rent" ? "대여 월" : "구입"} 급여가 ${won((m.kind === "rent" ? m.p.rent : m.p.buy)!.price)}`
                    : "해피케어 상품 목록에 없는 상품이라 직접 추가해 주세요"}
                  {off && " · 취소·반품된 품목"}
                </small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label>
        넣을 어르신
        <select value={rid} onChange={(e) => setRid(e.target.value)}>
          <option value="">선택</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.guardian ? ` · ${r.guardian}` : ""}
            </option>
          ))}
        </select>
      </label>
      {initial && rid === initial && <p className="ledger-note" style={{ margin: 0 }}>주문자 번호로 자동 선택했어요.</p>}
      {err && <p className="form-err">{err}</p>}
      <div className="btn-row">
        <button className="btn" onClick={hide} disabled={busy}>
          장부와 무관 (숨기기)
        </button>
        <button className="btn primary" onClick={add} disabled={busy}>
          {busy ? "넣는 중…" : "장부에 넣기"}
        </button>
      </div>
    </section>
  );
}
