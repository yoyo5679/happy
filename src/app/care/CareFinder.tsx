"use client";

import { useCallback, useEffect, useState } from "react";
import { ContactCta } from "@/components/ContactCta";
import { AudienceTabs } from "@/components/AudienceTabs";

type Kind = "visit" | "bath" | "day" | "short" | "home";
type Item = {
  code: string;
  name: string;
  addr: string;
  desig: string;
  cap: number;
  kinds: Kind[];
  grades: Partial<Record<Kind, [string, number]>>;
  shown: Kind[];
  km: number;
  lat: number;
  lng: number;
};
type Sort = "near" | "grade" | "old";

const KINDS: { key: Kind; label: string; emoji: string }[] = [
  { key: "visit", label: "방문요양", emoji: "🏠" },
  { key: "bath", label: "방문목욕", emoji: "🛁" },
  { key: "day", label: "주야간보호", emoji: "🌤️" },
  { key: "short", label: "단기보호", emoji: "🛏️" },
  { key: "home", label: "요양원", emoji: "🏥" },
];
const label = (k: Kind) => KINDS.find((x) => x.key === k)!.label;
const SORTS: { key: Sort; label: string }[] = [
  { key: "near", label: "가까운 순" },
  { key: "grade", label: "평가등급 순" },
  { key: "old", label: "오래된 순" },
];
const GRADE_NAME: Record<string, string> = { A: "최우수", B: "우수", C: "양호", D: "보통", E: "미흡" };
const years = (d: string) => (d ? Math.max(0, new Date().getFullYear() - Number(d.slice(0, 4))) : null);

export function CareFinder() {
  const [pos, setPos] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [sort, setSort] = useState<Sort>("near");
  const [radius, setRadius] = useState(5);
  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<{ name: string; lat: number; lng: number }[] | null>(null);

  function locate() {
    setErr("");
    if (!navigator.geolocation) return setErr("이 기기에서는 위치를 쓸 수 없어요. 동네 이름으로 찾아 주세요.");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, name: "내 위치" }),
      () => {
        setLoading(false);
        setErr("위치 권한이 꺼져 있어요. 아래에서 동네 이름이나 주소로 찾아 주세요.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  async function findPlace(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setPlaces(null);
    try {
      const r = await fetch(`/api/ltc/place?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.startsWith?.("setup:") ? "지금은 위치 검색을 쓸 수 없어요." : j.error);
      if (!j.places.length) throw new Error("찾는 곳이 없어요. 'OO동'이나 도로명 주소로 입력해 보세요.");
      if (j.places.length === 1) setPos(j.places[0]);
      else setPlaces(j.places);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const search = useCallback(async () => {
    if (!pos) return;
    setLoading(true);
    setErr("");
    try {
      const p = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng), r: String(radius), sort, kinds: kinds.join(",") });
      const r = await fetch(`/api/ltc/search?${p}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setItems(j.items);
      setTotal(j.total);
    } catch (e) {
      setErr((e as Error).message || "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [pos, radius, sort, kinds]);

  useEffect(() => {
    search();
  }, [search]);

  return (
    <>
      <AudienceTabs current="find" />
      <div className="page-title">
        <h1>📍 가까운 장기요양기관 찾기</h1>
        <p className="muted">방문요양·방문목욕·주야간보호·단기보호·요양원을 공단 평가등급과 함께 보여 드려요.</p>
      </div>

      <section className="card">
        <button className="btn primary wide" onClick={locate}>
          📍 내 위치에서 찾기
        </button>
        <form className="care-place" onSubmit={findPlace}>
          <input className="staff-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="또는 동네·주소 (예: 갈현동, 통일로 83길)" />
          <button className="btn">찾기</button>
        </form>
        {places && (
          <ul className="pick-list">
            {places.map((p) => (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => {
                    setPos(p);
                    setPlaces(null);
                  }}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {pos && <p className="ledger-note">기준 위치: {pos.name}</p>}
      </section>

      <section className="card">
        <p className="small muted" style={{ margin: "0 0 6px" }}>
          종류 (안 고르면 전체)
        </p>
        <div className="bp-chips" style={{ margin: 0 }}>
          {KINDS.map((k) => (
            <button key={k.key} className={kinds.includes(k.key) ? "chip on" : "chip"} onClick={() => setKinds((s) => (s.includes(k.key) ? s.filter((x) => x !== k.key) : [...s, k.key]))}>
              {k.emoji} {k.label}
            </button>
          ))}
        </div>
        <div className="seg-group care-sort" role="tablist">
          {SORTS.map((s) => (
            <button key={s.key} role="tab" aria-selected={sort === s.key} className={sort === s.key ? "seg on" : "seg"} onClick={() => setSort(s.key)}>
              <strong>{s.label}</strong>
            </button>
          ))}
        </div>
        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          반경
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {[2, 5, 10, 20].map((r) => (
              <option key={r} value={r}>
                {r}km
              </option>
            ))}
          </select>
        </label>
      </section>

      {err && <p className="card form-err">{err}</p>}
      {!pos && !err && <p className="muted bp-empty">위치를 정하면 가까운 기관을 보여 드려요.</p>}
      {loading && <p className="muted">찾는 중…</p>}
      {pos && items && !loading && (
        <>
          <p className="muted small">
            {radius}km 안에 {total}곳{total > items.length && ` (먼저 ${items.length}곳)`} · {SORTS.find((s) => s.key === sort)!.label}
          </p>
          {items.length === 0 && <p className="card muted">이 근처에서 찾지 못했어요. 반경을 넓혀 보세요.</p>}
          <ul className="care-list">
            {items.map((x) => (
              <CareCard key={x.code} x={x} />
            ))}
          </ul>
        </>
      )}

      <p className="ledger-note">
        국민건강보험공단 공개자료 기준 (기관현황 2026.6.10 · 평가결과 2026.6.25). 평가등급은 공단 정기평가 결과(A 최우수 ~ E 미흡)이며, 평가 전인 기관도
        있어요. 해피케어는 특정 기관을 추천하거나 소개 대가를 받지 않아요. 이용 전 기관에 직접 확인해 주세요.
      </p>
      <ContactCta campaign="care" />
    </>
  );
}

function CareCard({ x }: { x: Item }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [pErr, setPErr] = useState("");
  async function loadPhone() {
    setPErr("");
    try {
      const r = await fetch(`/api/ltc/phone?c=${x.code}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPhone(j.phone || "");
      if (j.phone) location.href = `tel:${j.phone.replace(/-/g, "")}`;
    } catch {
      setPErr("전화번호를 불러오지 못했어요.");
    }
  }
  const y = years(x.desig);
  return (
    <li className="card care-card">
      <div className="care-head">
        <strong>{x.name}</strong>
        <span className="care-km">{x.km}km</span>
      </div>
      <div className="care-kinds">
        {x.kinds.map((k) => {
          const g = x.grades[k];
          return (
            <span key={k} className={`care-kind${x.shown.includes(k) ? "" : " dim"}`}>
              {label(k)}{" "}
              {g ? (
                <b className={`grade g${g[0]}`} title={`${g[1]}년 평가`}>
                  {g[0]} {GRADE_NAME[g[0]]}
                </b>
              ) : (
                <em className="muted">평가 전</em>
              )}
            </span>
          );
        })}
      </div>
      <p className="care-addr">{x.addr}</p>
      <p className="small muted" style={{ margin: 0 }}>
        {x.desig && `${x.desig.slice(0, 4)}년 지정${y != null ? ` (${y}년째)` : ""}`}
        {x.cap > 0 && ` · 정원 ${x.cap}명`}
      </p>
      <div className="care-actions">
        {phone ? (
          <a className="btn small" href={`tel:${phone.replace(/-/g, "")}`}>
            📞 {phone}
          </a>
        ) : (
          <button className="btn small" onClick={loadPhone}>
            📞 전화
          </button>
        )}
        <a className="btn small" href={`https://map.kakao.com/link/to/${encodeURIComponent(x.name)},${x.lat},${x.lng}`} target="_blank" rel="noopener">
          🗺️ 길찾기
        </a>
      </div>
      {phone === "" && <p className="small muted">등록된 전화번호가 없어요.</p>}
      {pErr && <p className="small form-err">{pErr}</p>}
    </li>
  );
}
