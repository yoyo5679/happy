"use client";

import type { KeyboardEvent } from "react";
import { rooms, type RoomKey } from "@/data/rooms";

// 해피케어 색상으로 직접 그린 집 평면도. 방을 누르면 onSelect.
const AREAS: Record<RoomKey, { x: number; y: number; w: number; h: number; lx: number; ly: number }> = {
  bath: { x: 20, y: 20, w: 170, h: 130, lx: 105, ly: 96 },
  bedroom: { x: 20, y: 160, w: 230, h: 180, lx: 135, ly: 300 },
  living: { x: 200, y: 20, w: 380, h: 230, lx: 400, ly: 200 },
  entrance: { x: 260, y: 260, w: 320, h: 80, lx: 420, ly: 300 },
};

export function FloorPlan({ selected, onSelect }: { selected: RoomKey; onSelect: (r: RoomKey) => void }) {
  const key = (r: RoomKey) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(r);
    }
  };

  return (
    <svg className="floorplan" viewBox="0 0 600 360" role="group" aria-label="집 평면도에서 장소 선택">
      <rect x="10" y="10" width="580" height="340" rx="10" fill="#f3f1ec" />

      {(Object.keys(AREAS) as RoomKey[]).map((r) => {
        const a = AREAS[r];
        const on = selected === r;
        return (
          <g key={r} className="fp-room" role="button" tabIndex={0} aria-pressed={on} aria-label={rooms[r].label} onClick={() => onSelect(r)} onKeyDown={key(r)}>
            <rect x={a.x} y={a.y} width={a.w} height={a.h} rx="4" fill={on ? "#d3eef0" : r === "bath" ? "#e9f1f4" : r === "entrance" ? "#ece6dc" : "#f8f3ea"} stroke={on ? "#068291" : "#8a8f8f"} strokeWidth={on ? 5 : 3} />
          </g>
        );
      })}

      {/* 가구 (클릭은 방 영역이 받도록 pointer-events 없음) */}
      <g pointerEvents="none" stroke="#9aa3a3" strokeWidth="2" fill="#fff">
        {/* 욕실: 욕조, 변기, 세면대 */}
        <rect x="32" y="32" width="70" height="40" rx="12" />
        <rect x="40" y="38" width="54" height="28" rx="9" fill="#cfe9ef" />
        <ellipse cx="160" cy="48" rx="14" ry="17" />
        <rect x="150" y="27" width="20" height="9" rx="2" />
        <rect x="128" y="112" width="44" height="26" rx="6" />
        <ellipse cx="150" cy="125" rx="12" ry="7" fill="#cfe9ef" />
        {/* 침실: 침대, 협탁 */}
        <rect x="40" y="185" width="110" height="140" rx="8" />
        <rect x="50" y="193" width="40" height="24" rx="6" fill="#eef5f5" />
        <rect x="100" y="193" width="40" height="24" rx="6" fill="#eef5f5" />
        <rect x="40" y="228" width="110" height="97" rx="6" fill="#bfe3e6" />
        <rect x="162" y="185" width="30" height="30" rx="4" />
        {/* 거실·주방: 주방 상판, 식탁, 소파, 테이블, TV */}
        <rect x="215" y="30" width="170" height="26" rx="3" fill="#e6e2da" />
        <circle cx="260" cy="43" r="7" fill="#cfd6d6" />
        <circle cx="290" cy="43" r="7" fill="#cfd6d6" />
        <rect x="235" y="90" width="80" height="50" rx="6" />
        <circle cx="250" cy="82" r="7" />
        <circle cx="300" cy="82" r="7" />
        <circle cx="250" cy="148" r="7" />
        <circle cx="300" cy="148" r="7" />
        <path d="M430 70 h120 v30 h-90 v60 h-30 z" fill="#fbe2cc" />
        <rect x="480" y="120" width="50" height="40" rx="5" />
        <rect x="562" y="70" width="8" height="90" rx="2" fill="#5d6466" stroke="none" />
        {/* 현관: 문, 신발장, 매트 */}
        <path d="M520 340 a50 50 0 0 1 50 -50" fill="none" strokeDasharray="5 5" />
        <line x1="570" y1="290" x2="570" y2="340" strokeWidth="4" stroke="#7b6a55" />
        <rect x="275" y="272" width="90" height="20" rx="3" fill="#e6e2da" />
        <rect x="430" y="300" width="70" height="30" rx="4" fill="#d9cfbf" />
      </g>

      {/* 라벨 */}
      {(Object.keys(AREAS) as RoomKey[]).map((r) => {
        const a = AREAS[r];
        const on = selected === r;
        const text = `${rooms[r].emoji} ${rooms[r].label}`;
        const w = 46 + rooms[r].label.length * 24;
        return (
          <g key={`l-${r}`} pointerEvents="none">
            <rect x={a.lx - w / 2} y={a.ly - 22} width={w} height="44" rx="22" fill={on ? "#068291" : "rgba(55,62,64,0.78)"} />
            <text x={a.lx} y={a.ly + 8} textAnchor="middle" fontSize="23" fontWeight="800" fill="#fff">
              {text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
