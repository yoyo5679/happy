"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { categories, productsFor, poleHandles, POLE_HANDLE_URL, type CategoryKey } from "@/data/products";
import { ProductCard } from "@/components/ProductCard";
import { withUtm } from "@/lib/utm";
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
type Hazard = { title: string; detail: string; severity: "high" | "mid" | "low"; fix: CategoryKey[]; photo: number; x: number; y: number };
type Result = { usable: boolean; risk: number; summary: string; hazards: Hazard[]; good: string[]; pole?: { where: string; photo: number; x: number; y: number } };
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
  const [sentImages, setSentImages] = useState<string[]>([]);
  const [showStickers, setShowStickers] = useState(true);
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
      setSentImages(images);
      setShowStickers(true);
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

  // 사진 위에 붙일 스티커: 위험 요소별 첫 번째 추천 용품 (같은 자리·같은 품목 중복 제거)
  const placed: { photo: number; x: number; y: number; label: string; img?: string }[] = [];
  for (const h of result?.hazards ?? []) {
    const c = h.fix.find((f) => categories[f]);
    if (!c || h.photo < 0) continue;
    if (placed.some((p) => p.label === categories[c].label && p.photo === h.photo && Math.abs(p.x - h.x) + Math.abs(p.y - h.y) < 150)) continue;
    placed.push({ photo: h.photo, x: h.x, y: h.y, label: categories[c].label, img: productsFor(c, 1)[0]?.img });
  }
  // 기둥형 안전손잡이는 어느 집에나 도움이 되므로 항상 표시
  const poles = poleHandles(2);
  const pole = result?.pole;
  if (result?.usable && pole && pole.photo >= 0 && poles[0]) placed.push({ photo: pole.photo, x: pole.x, y: pole.y, label: "기둥 안전손잡이", img: poles[0].img });

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

              {placed.length > 0 && (
                <section className="card scan-place">
                  <h3>📍 이렇게 놓으면 좋아요</h3>
                  <p className="muted">추천 용품을 놓을 자리를 사진에 표시했어요.</p>
                  <div className="scan-ba" role="tablist">
                    <button role="tab" aria-selected={!showStickers} className={!showStickers ? "chip on" : "chip"} onClick={() => setShowStickers(false)}>
                      지금
                    </button>
                    <button role="tab" aria-selected={showStickers} className={showStickers ? "chip on" : "chip"} onClick={() => setShowStickers(true)}>
                      용품 놓아 보기 ✨
                    </button>
                  </div>
                  {sentImages.map((img, pi) => {
                    const here = placed.filter((s) => s.photo === pi);
                    if (!here.length) return null;
                    return (
                      <div key={pi} className="scan-stage">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`data:image/jpeg;base64,${img}`} alt={`올린 사진 ${pi + 1}`} />
                        {showStickers &&
                          here.map((s, i) => (
                            <div key={i} className={`scan-sticker ${s.x > 640 ? "to-left" : s.x < 360 ? "to-right" : ""}`} style={{ left: `${Math.min(97, Math.max(3, s.x / 10))}%`, top: `${Math.min(97, Math.max(28, s.y / 10))}%` }}>
                              <div className="scan-sticker-card">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {s.img && <img src={s.img} alt="" />}
                                <span>{s.label}</span>
                              </div>
                              <span className="scan-pin" aria-hidden />
                            </div>
                          ))}
                      </div>
                    );
                  })}
                  <p className="scan-note">※ AI가 사진을 보고 고른 대략적인 위치예요. 정확한 설치 위치는 방문 측정 후 정해져요.</p>
                </section>
              )}

              <>
                  <h2 className="scan-rec-title">✅ 추천 복지용구</h2>
                  {recs.length > 0 && <QuickCost categories={recs.map((r) => r.category)} rate={rate} />}
                  <RatePicker rate={rate} onChange={setRate} />
                  {poles.length > 0 && (
                    <section className="card group pole-group">
                      <h3>
                        <span className="pole-badge">어디든 추천</span> 🧍 기둥 안전손잡이
                      </h3>
                      <p className="reason">
                        바닥과 천장 사이에 세우는 손잡이라 벽에 구멍을 뚫지 않고 원하는 곳 어디에나 설치할 수 있어요. 일어서고 앉는 곳마다 붙잡을 곳이 생겨 낙상 예방 효과가 커요.
                        {pole?.where && <><br /><strong>📍 이 사진에서는: {pole.where}</strong></>}
                      </p>
                      {poles.map((p) => (
                        <ProductCard key={p.id} product={p} campaign={`scan_${room}_pole`} rate={rate} />
                      ))}
                      <a className="more" href={withUtm(POLE_HANDLE_URL, `scan_${room}_pole`, "pole_all")}>
                        기둥 안전손잡이 전체 모델 보기 →
                      </a>
                    </section>
                  )}
                  {recs.map((r, i) => (
                    <CategoryGroup key={r.category} category={r.category} campaign={`scan_${room}`} rate={rate} rank={i + 1} reason={r.reason} />
                  ))}
                  <div className="actions">
                    <BudgetLink categories={[...new Set<CategoryKey>(["safetyHandle", ...recs.map((r) => r.category)])]} />
                  </div>
              </>
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
