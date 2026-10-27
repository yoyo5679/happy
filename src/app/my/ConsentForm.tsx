"use client";

import { useState } from "react";
import Link from "next/link";
import { ConsentTable } from "@/components/ConsentTable";
import { consentNotice, consentSections, relations, type ConsentSection } from "@/data/consent";
import { site } from "@/config/site";

type Checks = Record<ConsentSection["key"], boolean>;
const empty: Checks = { collect: false, sensitive: false, guardian: false, overseas: false, marketing: false };

export function ConsentForm({ token, version, name, onDone }: { token: string; version: string; name: string; onDone: () => void }) {
  const [checks, setChecks] = useState<Checks>(empty);
  const [open, setOpen] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [relation, setRelation] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const all = consentSections.every((s) => checks[s.key]);
  const requiredOk = consentSections.filter((s) => s.required).every((s) => checks[s.key]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!requiredOk) return setErr("필수 항목에 모두 동의해 주세요.");
    setBusy(true);
    try {
      const r = await fetch("/api/my/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ k: token, version, signer, relation, ...checks }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "잠시 후 다시 시도해 주세요.");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form consent-form" onSubmit={submit}>
      <div>
        <h2 className="ledger-h2">이용 동의가 필요해요</h2>
        <p className="muted" style={{ margin: 0 }}>
          {name} 어르신의 복지용구 이용 현황을 보여드리려면 아래 동의가 필요해요. 한 번만 하시면 돼요.
        </p>
      </div>

      <label className="consent-all">
        <input type="checkbox" checked={all} onChange={(e) => setChecks(Object.fromEntries(consentSections.map((s) => [s.key, e.target.checked])) as Checks)} />
        <span>전체 동의 (선택 항목 포함)</span>
      </label>

      <ul className="consent-list">
        {consentSections.map((s) => (
          <li key={s.key}>
            <div className="consent-row">
              <label>
                <input type="checkbox" checked={checks[s.key]} onChange={(e) => setChecks((c) => ({ ...c, [s.key]: e.target.checked }))} />
                <span>
                  <em className={s.required ? "req" : "opt"}>{s.required ? "필수" : "선택"}</em> {s.title}
                </span>
              </label>
              <button type="button" className="link" onClick={() => setOpen(open === s.key ? null : s.key)} aria-expanded={open === s.key}>
                {open === s.key ? "닫기" : "보기"}
              </button>
            </div>
            {open === s.key && <ConsentTable section={s} />}
          </li>
        ))}
      </ul>

      <ul className="consent-notice">
        {consentNotice.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <div className="form-row">
        <label>
          동의하시는 분 성함
          <input value={signer} onChange={(e) => setSigner(e.target.value)} required maxLength={40} />
        </label>
        <label>
          어르신과 관계
          <select value={relation} onChange={(e) => setRelation(e.target.value)} required>
            <option value="">선택</option>
            {relations.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      {err && <p className="form-err">{err}</p>}
      <button className="btn primary" disabled={busy}>
        {busy ? "저장 중…" : "동의하고 이용 현황 보기"}
      </button>
      <p className="ledger-note" style={{ margin: 0 }}>
        자세한 내용은 <Link href="/privacy">개인정보처리방침</Link>을 확인해 주세요. 문의 {site.phone}
      </p>
    </form>
  );
}
