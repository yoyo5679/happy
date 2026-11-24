"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { categories, type CategoryKey } from "@/data/products";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { BudgetLink } from "@/components/BudgetLink";
import { QuickCost } from "@/components/QuickCost";
import "./scan.css";

type Room = "bath" | "bedroom" | "entrance" | "living";
const ROOMS: { key: Room; label: string; emoji: string; tip: string }[] = [
  { key: "bath", label: "욕실", emoji: "🛁", tip: "문 앞에서 변기·욕조·바닥이 함께 나오게" },
  { key: "bedroom", label: "침실", emoji: "🛏️", tip: "침대(요)와 주변 바닥, 방문 쪽이 나오게" },
  { key: "entrance", label: "현관·문턱", emoji: "🚪", tip: "현관 턱과 신발 벗는 곳이 나오게" },
  { key: "living", label: "거실·복도", emoji: "🛋️", tip: "자주 다니는 길과 바닥이 나오게" },
];
type Hazard = { title: string; detail: string; severity: "high" | "mid" | "low"; fix: CategoryKey[] };
type Result = { usable: boolean; risk: number; summary: string; hazards: Hazard[]; good: string[] };
const SEV = { high: { label: "위험", cls: "sev-high" }, mid: { label: "주의", cls: "sev-mid" }, low: { label: "참고", cls: "sev-low" } };
const RISK = ["", "안전해요", "대체로 안전", "주의가 필요해요", "위험해요", "매우 위험해요"];

/** 사진을 긴 변 1024px JPEG로 줄여 base64로 (전송량·비용 절감, 원본은 보내지 않음) */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const url = c.toDataURL("image/jpeg", 0.75);
  return url.slice(url.indexOf(",") + 1);
}

export function ScanTool() {
  const [room, setRoom] = useState<Room>("bath");
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [rate, setRate] = useState(0.15);
  const cam = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list).filter((f) => f.type.startsWith("image/")).map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 3);
    setFiles(next);
    setResult(null);
    setError("");
  }
  function remove(i: number) {
    setFiles(files.filter((_, j) => j !== i));
    setResult(null);
  }
  function reset(r: Room) {
    setRoom(r);
    setFiles([]);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const images = await Promise.all(files.map((f) => shrink(f.file)));
      const res = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room, images }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "진단에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setResult(data as Result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "진단에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  const info = ROOMS.find((r) => r.key === room)!;
  // 위험도 높은 순서대로 추천 품목 (중복 제거)
  const order = { high: 0, mid: 1, low: 2 };
  const recs: { category: CategoryKey; reason: string }[] = [];
  for (const h of [...(result?.hazards ?? [])].sort((a, b) => order[a.severity] - order[b.severity]))
    for (const c of h.fix) if (categories[c] && !recs.some((r) => r.category === c)) recs.push({ category: c, reason: `${h.title} — ${h.detail}` });

  return (
    <>
      <section className="hero scan-hero">
        <p className="eyebrow">📸 NEW · AI 사진 안전진단</p>
        <h1>
          사진 한 장으로
          <br />
          <span className="hl">우리 집 낙상 위험</span> 찾기
        </h1>
        <p className="muted">부모님 집 사진을 올리면 AI가 위험한 곳을 찾아 필요한 복지용구와 본인부담금을 알려 드려요. 무료 · 회원가입 없음</p>
      </section>

      <div className="card">
        <p className="scan-step">1. 어디를 진단할까요?</p>
        <div className="room-tabs" role="radiogroup" aria-label="진단할 장소">
          {ROOMS.map((r) => (
            <button key={r.key} role="radio" aria-checked={r.key === room} className={r.key === room ? "chip on" : "chip"} onClick={() => reset(r.key)}>
              {r.emoji} {r.label}
            </button>
          ))}
        </div>

        <p className="scan-step">2. 사진을 찍거나 골라 주세요 (최대 3장)</p>
        <p className="muted scan-tip">💡 {info.tip} 찍어 주세요.</p>
        <div className="scan-pick">
          <button className="btn primary" onClick={() => cam.current?.click()} disabled={files.length >= 3 || busy}>
            📷 사진 찍기
          </button>
          <button className="btn" onClick={() => album.current?.click()} disabled={files.length >= 3 || busy}>
            🖼️ 앨범에서 고르기
          </button>
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          <input ref={album} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>
        {files.length > 0 && (
          <div className="scan-thumbs">
            {files.map((f, i) => (
              <figure key={f.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={`올린 사진 ${i + 1}`} />
                <button aria-label={`사진 ${i + 1} 빼기`} onClick={() => remove(i)} disabled={busy}>
                  ✕
                </button>
              </figure>
            ))}
          </div>
        )}

        <button className="btn primary wide scan-go" onClick={run} disabled={!files.length || busy}>
          {busy ? "🔎 AI가 사진을 살펴보고 있어요… (10초 정도)" : `🔎 ${info.label} 안전진단 시작`}
        </button>
        {error && <p className="scan-error" role="alert">{error}</p>}
        <p className="scan-privacy">🔒 사진은 진단에만 쓰고 저장하지 않아요. 사람 얼굴이나 개인 서류는 나오지 않게 찍어 주세요.</p>
      </div>

      {result && (
        <div ref={resultRef}>
          {!result.usable ? (
            <section className="card">
              <h2>사진으로 판단하기 어려워요</h2>
              <p>{result.summary || "집 안이 잘 보이도록 밝은 곳에서 다시 찍어 주세요."}</p>
            </section>
          ) : (
            <>
              <section className={`card scan-result risk-${result.risk}`}>
                <p className="eyebrow">
                  {info.emoji} {info.label} 안전진단 결과
                </p>
                <div className="scan-meter" aria-label={`위험도 5단계 중 ${result.risk}`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= result.risk ? "on" : ""} />
                  ))}
                  <strong>{RISK[result.risk]}</strong>
                </div>
                <p className="scan-summary">{result.summary}</p>

                {result.hazards.length > 0 && (
                  <>
                    <h3>⚠️ 발견된 위험 요소</h3>
                    <ol className="scan-hazards">
                      {result.hazards.map((h, i) => (
                        <li key={i}>
                          <span className={`sev ${SEV[h.severity].cls}`}>{SEV[h.severity].label}</span>
                          <strong>{h.title}</strong>
                          <p>{h.detail}</p>
                          {h.fix.length > 0 && <p className="scan-fix">→ {h.fix.map((c) => categories[c]?.label).filter(Boolean).join(" · ")}</p>}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
                {result.good.length > 0 && (
                  <>
                    <h3>👍 잘 되어 있어요</h3>
                    <ul className="scan-good">
                      {result.good.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="scan-note">※ AI가 사진만 보고 판단한 참고 결과예요. 정확한 위치·치수는 방문 측정으로 확인하는 것이 좋아요.</p>
              </section>

              {recs.length > 0 && (
                <>
                  <h2 className="scan-rec-title">✅ 추천 복지용구</h2>
                  <QuickCost categories={recs.map((r) => r.category)} rate={rate} />
                  <RatePicker rate={rate} onChange={setRate} />
                  {recs.map((r, i) => (
                    <CategoryGroup key={r.category} category={r.category} campaign={`scan_${room}`} rate={rate} rank={i + 1} reason={r.reason} />
                  ))}
                  <div className="actions">
                    <BudgetLink categories={recs.map((r) => r.category)} />
                  </div>
                </>
              )}
            </>
          )}
          <div className="scan-again">
            {ROOMS.filter((r) => r.key !== room).map((r) => (
              <button key={r.key} className="chip" onClick={() => { reset(r.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                {r.emoji} {r.label}도 진단하기
              </button>
            ))}
          </div>
          <ContactCta campaign={`scan_${room}`} />
        </div>
      )}

      {!result && (
        <p className="muted scan-alt">
          사진 찍기 어려우시면 <Link href="/check">1분 낙상 점검표</Link>로 확인해 보세요.
        </p>
      )}
    </>
  );
}
