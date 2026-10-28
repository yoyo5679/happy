"use client";

import { useCallback, useEffect, useState } from "react";
import { categories, products, won, type CategoryKey, type Product } from "@/data/products";
import type { Recipient } from "@/lib/ledger";

type Api = <T = Record<string, unknown>>(method: string, path: string, body?: unknown) => Promise<T>;
type ImItem = { prod_no: string; name: string; count: number; price: number; status: string };
type Elder = { name: string; from: string } | null;
// 주문자 이름·번호 원문은 받지 않음: 번호 끝 4자리, 대조값, 번호로 찾은 어르신만
type ImOrder = { order_no: string; date: string; total: number; phone_tail: string; phone_hash: string; phone_rid: string; items: ImItem[]; elder?: Elder };
type Check = { ok: boolean; count: number | null; sample: (Omit<ImOrder, "items"> & { elder: Elder }) | null; keys: string[] };
const NEW = "__new";

// 쇼핑몰 상품번호(idx) → 상품·구입/대여
const byIdx = new Map<string, { p: Product; kind: "buy" | "rent" }>();
for (const p of products) {
  for (const kind of ["buy", "rent"] as const) {
    const idx = p[kind]?.url.match(/[?&]idx=(\d+)/)?.[1];
    if (idx && !byIdx.has(idx)) byIdx.set(idx, { p, kind });
  }
}
const cancelled = (s: string) => /CANCEL|RETURN|REFUND|취소|반품|환불/i.test(s);
// 배송이 시작된(배송중·배송완료·구매확정) 주문만 한꺼번에 넣기에 포함
const shippedStatus = (s: string) => /DELIVERING|DELIVERY|SHIPP|^COMPLETE$|PURCHASE|CONFIRM|배송중|배송완료|구매확정/i.test(s);
const STATUS: [RegExp, string][] = [
  [/CANCEL|취소/i, "취소"],
  [/RETURN|반품/i, "반품"],
  [/EXCHANGE|교환/i, "교환"],
  [/REFUND|환불/i, "환불"],
  [/PURCHASE|CONFIRM|구매확정/i, "구매확정"],
  [/DELIVERY_COMPLETE|^COMPLETE$|배송완료/i, "배송완료"],
  [/DELIVERING|SHIPP|배송중/i, "배송중"],
  [/STANDBY|PREPAR|READY|배송준비|발송대기/i, "배송준비"],
  [/PAY_COMPLETE|결제완료/i, "결제완료"],
  [/PAY_WAIT|입금대기/i, "입금대기"],
];
const statusLabel = (s: string) => STATUS.find(([re]) => re.test(s))?.[1] ?? (s || "상태 모름");
/** 넣을 품목이 모두 배송 시작 이후인지 */
const shipped = (o: ImOrder) => defaultPicks(o).every((l) => shippedStatus(l.it.status));

type Line = { i: number; it: ImItem; m?: { p: Product; kind: "buy" | "rent" }; off: boolean };
const linesOf = (o: ImOrder): Line[] => o.items.map((it, i) => ({ i, it, m: byIdx.get(it.prod_no), off: cancelled(it.status) }));
/** 기본으로 넣을 품목: 해피케어 상품과 맞고 취소되지 않은 것 */
const defaultPicks = (o: ImOrder) => linesOf(o).filter((l) => l.m && !l.off);

/** 주문서의 어르신 성함으로 새 장부 (등급·잔액·적용기간은 직원이 나중에 확인) */
/** start: 그 어르신의 가장 이른 주문일 → 그 뒤 주문이 모두 한도에서 빠지게 */
function newRecipientFrom(o: ImOrder, start = o.date): Recipient {
  return {
    name: o.elder!.name,
    rate: 0.15,
    period_start: start,
    base_remaining: 1_600_000,
    base_date: start,
    guardian_hash: o.phone_hash,
    needs_check: true,
  };
}

/** 주문 품목을 장부에 넣고, 처리한 주문으로 기록 */
async function importOrder(api: Api, o: ImOrder, target: string, picked: Line[]) {
  for (const { it, m } of picked) {
    const { p, kind } = m!;
    await api("POST", `recipients/${target}/items`, {
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
  await api("POST", "imweb/mark", { order_no: o.order_no, action: "added", recipient_id: target });
}

const ymdKst = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export function ImwebImport({ api, recipients: initialRecipients, onBack }: { api: Api; recipients: Recipient[]; onBack: () => void }) {
  // 가져오는 중에 새로 등록한 어르신도 다음 주문에서 바로 찾을 수 있게
  const [recipients, setRecipients] = useState(initialRecipients);
  const [check, setCheck] = useState<Check | null>(null);
  const [err, setErr] = useState("");
  const [from, setFrom] = useState(() => ymdKst(new Date(Date.now() - 30 * 86400_000)));
  const [bulk, setBulk] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const [orders, setOrders] = useState<ImOrder[] | null>(null);
  const [page, setPage] = useState({ page: 0, total: 1, partial: false });
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    api<Check>("GET", "imweb/check").then(setCheck, (e: Error) =>
      setErr(e.message === "setup:IMWEB" ? "Cloudflare에 IMWEB_API_KEY · IMWEB_SECRET_KEY가 아직 없어요. 넣은 뒤 재배포해 주세요." : e.message),
    );
  }, [api]);

  // 시작일부터 모든 페이지를 차례로 불러옴 (호출 제한에 걸리면 잠깐 쉬었다가 이어서)
  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr("");
    setOrders([]);
    let pageNo = 1;
    let guard = 0;
    try {
      while (guard++ < 200) {
        const j = await api<{ orders: ImOrder[]; page: number; totalPage: number; partial?: boolean }>("GET", `imweb/orders?from=${from}&page=${pageNo}`);
        setOrders((o) => {
          const prev = o ?? [];
          return [...prev, ...j.orders.filter((x) => !prev.some((y) => y.order_no === x.order_no))];
        });
        setPage({ page: j.page, total: j.totalPage, partial: !!j.partial });
        if (j.partial) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (j.page >= j.totalPage) break;
        pageNo = j.page + 1;
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, from]);

  useEffect(() => {
    if (check?.ok) loadAll();
  }, [check, loadAll]);

  // 1순위: 주문서의 어르신 성함 (같은 이름이 여럿이면 번호까지 맞는 분) → 2순위: 주문자 번호(서버에서 대조) → 없으면 새로 등록
  const matchRecipient = (o: ImOrder): { id: string; by: string } => {
    if (o.elder) {
      const same = recipients.filter((r) => r.name === o.elder!.name);
      const hit = same.find((r) => r.id === o.phone_rid) ?? (same.length === 1 ? same[0] : undefined);
      if (hit) return { id: hit.id!, by: "주문서의 어르신 성함으로 찾았어요." };
    }
    const byPhone = o.phone_rid ? recipients.find((r) => r.id === o.phone_rid) : undefined;
    if (byPhone && (!o.elder || byPhone.name === o.elder.name)) return { id: byPhone.id!, by: "주문자 번호로 찾았어요." };
    if (o.elder) return { id: NEW, by: "" };
    return { id: "", by: "" };
  };

  // 자동으로 어르신을 찾았고 넣을 품목이 있는 주문 (오래된 주문부터)
  const auto = (orders ?? [])
    .filter((o) => matchRecipient(o).id && defaultPicks(o).length > 0 && shipped(o))
    .sort((a, b) => a.date.localeCompare(b.date));
  const waiting = (orders ?? []).filter((o) => defaultPicks(o).length > 0 && !shipped(o)).length;
  // 불러온 주문 중 그 어르신의 가장 이른 주문일
  const earliestFor = (name: string) =>
    (orders ?? []).filter((o) => o.elder?.name === name).reduce((m, o) => (o.date && o.date < m ? o.date : m), "9999-12-31");

  async function importAll() {
    if (!auto.length) return;
    if (!confirm(`자동으로 어르신을 찾은 주문 ${auto.length}건을 장부에 넣을까요?\n(장부에 없는 어르신은 새로 등록돼요. 나머지 주문은 직접 골라 주세요)`)) return;
    const created = new Map<string, string>(); // 새로 등록한 어르신 성함 → id
    const errors: string[] = [];
    setBulk({ done: 0, total: auto.length, errors });
    for (const [n, o] of auto.entries()) {
      try {
        let target = matchRecipient(o).id;
        if (target === NEW) {
          const name = o.elder!.name;
          if (!created.has(name)) {
            const r = newRecipientFrom(o, earliestFor(name));
            const j = await api<{ id: string }>("POST", "recipients", r);
            created.set(name, j.id);
            setRecipients((list) => [{ ...r, id: j.id }, ...list]);
          }
          target = created.get(name)!;
        }
        await importOrder(api, o, target, defaultPicks(o));
        setOrders((list) => list!.filter((x) => x.order_no !== o.order_no));
      } catch (e) {
        errors.push(`${o.order_no}: ${(e as Error).message}`);
      }
      setBulk({ done: n + 1, total: auto.length, errors: [...errors] });
    }
  }

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
                가장 최근 주문: {check.sample.date} · {won(check.sample.total)}
                <br />
                {check.sample.elder
                  ? `주문서에서 어르신 성함을 찾았어요: ${check.sample.elder.name} ('${check.sample.elder.from}' 항목)`
                  : "이 주문에서는 어르신 성함 항목을 찾지 못했어요. 성함이 있는 주문인데 못 찾으면 아래 '응답 항목 보기'를 캡처해서 보내 주세요."}
              </p>
            )}
            <button className="link small" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "닫기" : "응답 항목 보기 (문제 생길 때 확인용)"}
            </button>
            {showRaw && (
              <pre className="link-box" style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", maxHeight: 360, overflow: "auto" }}>
                {check.keys.join("\n") || "(주문 없음)"}
              </pre>
            )}
          </>
        )}
      </section>

      {check?.ok && (
        <>
          <div className="bp-chips" style={{ margin: "8px 0", alignItems: "center" }}>
            {[
              ["최근 30일", ymdKst(new Date(Date.now() - 30 * 86400_000))],
              ["9월 1일부터", `${new Date().getFullYear()}-09-01`],
              ["올해 1월부터", `${new Date().getFullYear()}-01-01`],
            ].map(([label, d]) => (
              <button key={label} className={from === d ? "chip on" : "chip"} onClick={() => setFrom(d)} disabled={loading}>
                {label}
              </button>
            ))}
            <label className="small" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              시작일
              <input type="date" value={from} max={ymdKst(new Date())} onChange={(e) => e.target.value && setFrom(e.target.value)} disabled={loading} />
            </label>
          </div>
          {loading && (
            <p className="muted">
              {from}부터 주문 불러오는 중… {page.total > 1 && `(${page.page}/${page.total})`} {orders && `${orders.length}건`}
            </p>
          )}
          {!loading && auto.length > 0 && (
            <button className="btn primary wide" onClick={importAll} disabled={!!bulk && bulk.done < bulk.total}>
              ✅ 어르신을 자동으로 찾은 주문 {auto.length}건 한꺼번에 장부에 넣기
            </button>
          )}
          {!loading && waiting > 0 && (
            <p className="ledger-note">🚚 아직 배송 전인 주문 {waiting}건은 한꺼번에 넣기에서 빠져요. 배송이 시작되면 다음에 불러올 때 함께 들어가요.</p>
          )}
          {bulk && (
            <p className="ledger-note">
              {bulk.done < bulk.total ? `넣는 중… ${bulk.done}/${bulk.total}` : `${bulk.total - bulk.errors.length}건을 장부에 넣었어요.`}
              {bulk.errors.length > 0 && ` 실패 ${bulk.errors.length}건: ${bulk.errors.join(" / ")}`}
            </p>
          )}
          <p className="ledger-note">이미 장부에 넣었거나 숨긴 주문은 다시 나오지 않아요. 주문자 휴대폰 번호가 어르신의 보호자 연락처와 같으면 자동으로 골라져요.</p>
          {orders?.length === 0 && !loading && <p className="card muted">새로 가져올 주문이 없어요.</p>}
          {orders?.map((o) => {
            const m = matchRecipient(o);
            return (
              <OrderCard
                key={`${o.order_no}:${m.id}`}
                api={api}
                order={o}
                recipients={recipients}
                initial={m.id}
                matchedBy={m.by}
                start={o.elder ? earliestFor(o.elder.name) : o.date}
                onCreated={(r) => setRecipients((list) => [r, ...list])}
                onDone={() => setOrders((list) => list!.filter((x) => x.order_no !== o.order_no))}
              />
            );
          })}
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
  matchedBy,
  start,
  onCreated,
  onDone,
}: {
  start: string;
  api: Api;
  order: ImOrder;
  recipients: Recipient[];
  initial: string;
  matchedBy: string;
  onCreated: (r: Recipient) => void;
  onDone: () => void;
}) {
  const lines = linesOf(o);
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
      let target = rid;
      if (rid === NEW) {
        const r = newRecipientFrom(o, start);
        const j = await api<{ id: string }>("POST", "recipients", r);
        target = j.id;
        onCreated({ ...r, id: j.id });
      }
      await importOrder(api, o, target, picked);
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
        <strong>{o.date}</strong> {o.phone_tail && <span className="muted">· 주문자 번호 끝 {o.phone_tail}</span>}
        <br />
        <span className="muted small">
          주문번호 {o.order_no} · 결제 {won(o.total)}
        </span>
        {o.elder && (
          <>
            <br />
            👵 어르신: <strong>{o.elder.name}</strong> <span className="muted small">(주문서 &lsquo;{o.elder.from}&rsquo;)</span>
          </>
        )}
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
                  {` · ${statusLabel(it.status)}`}
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
          {o.elder && <option value={NEW}>➕ {o.elder.name} 어르신 새로 등록하고 넣기</option>}
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.has_phone ? " · 📱" : ""}
            </option>
          ))}
        </select>
      </label>
      {defaultPicks(o).length > 0 && !shipped(o) && (
        <p className="ledger-note" style={{ margin: 0 }}>
          🚚 아직 배송 전이에요. 지금 넣지 말고 두시면, 배송이 시작된 뒤 다시 불러올 때 한꺼번에 넣기에 들어가요.
        </p>
      )}
      {rid === NEW ? (
        <p className="ledger-note" style={{ margin: 0 }}>
          장부에 없는 어르신이라 새로 등록해요. 넣은 뒤 장부에서 등급·본인부담률·공단 잔액·적용기간을 꼭 확인해 주세요. (그 전까지는 160만원·15%로 계산돼요)
        </p>
      ) : (
        initial && rid === initial && matchedBy && <p className="ledger-note" style={{ margin: 0 }}>{matchedBy}</p>
      )}
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
