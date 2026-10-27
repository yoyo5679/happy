"use client";

import { calcLedger, dot, today, type Item, type Recipient } from "@/lib/ledger";
import { categories, won, type CategoryKey } from "@/data/products";

const rateLabel = (r: number) => (r === 0 ? "본인부담 없음" : `본인부담 ${Math.round(r * 100)}%`);

/** 남은 한도 + 이용 중인 품목 (보호자 화면 · 직원 화면 공용) */
export function LedgerView({
  recipient,
  items,
  actions,
}: {
  recipient: Recipient;
  items: Item[];
  /** 직원 화면: 품목별 수정 버튼 등 */
  actions?: (it: Item) => React.ReactNode;
}) {
  const L = calcLedger(recipient, items);
  const pct = Math.max(0, Math.min(100, (L.remaining / L.limit) * 100));
  const rents = L.items.filter((c) => c.item.kind === "rent");
  const buys = L.items.filter((c) => c.item.kind === "buy");
  const expired = today() > L.end;

  return (
    <>
      <section className="card ledger-head">
        <p className="ledger-who">
          <strong>{recipient.name} 어르신</strong>
          <span>
            {[recipient.grade, rateLabel(recipient.rate)].filter(Boolean).join(" · ")}
          </span>
        </p>
        <p className="ledger-label">올해 복지용구 남은 금액</p>
        <p className={`ledger-amount${L.remaining < 0 ? " minus" : ""}`}>{won(L.remaining)}</p>
        <div className="ledger-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <dl className="ledger-dl">
          <div>
            <dt>연 한도</dt>
            <dd>{won(L.limit)}</dd>
          </div>
          {L.scheduled > 0 && (
            <div>
              <dt>대여 예정분 빼면</dt>
              <dd>{won(L.afterScheduled)}</dd>
            </div>
          )}
          <div>
            <dt>적용 기간</dt>
            <dd>
              {dot(L.start)} ~ {dot(L.end)}
            </dd>
          </div>
        </dl>
        <p className="ledger-note">
          {dot(recipient.base_date)} 공단 조회 금액에서 그 뒤 해피케어 이용분을 뺀 금액이에요. 다른 업체 이용분은 다음 조회 때 반영돼요.
        </p>
        {expired && <p className="ledger-alert warn">적용 기간이 지났어요. 새 기간 잔액으로 다시 조회가 필요해요.</p>}
      </section>

      {L.alerts.length > 0 && (
        <section className="ledger-alerts">
          {L.alerts.map((a, i) => (
            <p key={i} className={`ledger-alert ${a.tone}`}>
              {a.tone === "warn" ? "⚠️ " : "🔔 "}
              {a.text}
            </p>
          ))}
        </section>
      )}

      {rents.length > 0 && (
        <section className="card">
          <h2 className="ledger-h2">대여 중</h2>
          <ul className="ledger-items">
            {rents.map(({ item: it, copay }) => (
              <li key={it.id}>
                <div className="ledger-item-main">
                  <span className="ledger-emoji" aria-hidden>
                    {categories[it.category as CategoryKey]?.emoji ?? "📦"}
                  </span>
                  <div>
                    <strong>{it.name}</strong>
                    <small>
                      {dot(it.date)} ~ {it.end_date ? dot(it.end_date) : "계속"} · 월 {won(it.price)}
                    </small>
                  </div>
                </div>
                <p className="ledger-copay">
                  월 본인부담 <b>{won(copay)}</b>
                </p>
                {actions?.(it)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {buys.length > 0 && (
        <section className="card">
          <h2 className="ledger-h2">구입한 품목</h2>
          <ul className="ledger-items">
            {buys.map(({ item: it, copay, renewAt }) => (
              <li key={it.id}>
                <div className="ledger-item-main">
                  <span className="ledger-emoji" aria-hidden>
                    {categories[it.category as CategoryKey]?.emoji ?? "📦"}
                  </span>
                  <div>
                    <strong>
                      {it.name}
                      {it.qty > 1 && ` × ${it.qty}`}
                    </strong>
                    <small>
                      {dot(it.date)} 구입 · {won(it.price * it.qty)}
                      {renewAt && ` · ${dot(renewAt)}부터 재구입 가능`}
                    </small>
                  </div>
                </div>
                <p className="ledger-copay">
                  본인부담 <b>{won(copay)}</b>
                </p>
                {actions?.(it)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {L.items.length === 0 && (
        <section className="card">
          <p className="muted">아직 해피케어에서 이용한 품목이 없어요.</p>
        </section>
      )}
    </>
  );
}
