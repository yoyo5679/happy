"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FloorPlan } from "@/components/FloorPlan";
import { CategoryGroup } from "@/components/CategoryGroup";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { productsFor } from "@/data/products";
import { roomOrder, rooms, type RoomKey } from "@/data/rooms";

export function RoomsBrowser() {
  const [room, setRoom] = useState<RoomKey>("bath");
  const [rate, setRate] = useState(0.15);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("room");
    if (r && r in rooms) setRoom(r as RoomKey);
  }, []);

  function pick(r: RoomKey) {
    setRoom(r);
    window.history.replaceState(window.history.state, "", `?room=${r}`);
  }

  const info = rooms[room];
  const items = info.items.filter((i) => productsFor(i.category).length > 0);

  return (
    <>
      <div className="page-title">
        <h1>🏠 우리 집에서 찾기</h1>
        <p className="muted">집 안에서 걱정되는 곳을 눌러 보세요.</p>
      </div>

      <Link href="/check" className="check-cta">
        <span className="ico" aria-hidden>
          🔍
        </span>
        <span className="txt">
          <strong>어디가 위험한지 모르겠다면?</strong>
          <br />
          1분 안전 점검으로 우리 집 낙상 위험부터 확인해요
        </span>
        <span className="go" aria-hidden>
          →
        </span>
      </Link>

      <div className="card fp-card">
        <FloorPlan selected={room} onSelect={pick} />
      </div>
      <div className="room-tabs" role="tablist">
        {roomOrder.map((r) => (
          <button key={r} role="tab" aria-selected={r === room} className={r === room ? "chip on" : "chip"} onClick={() => pick(r)}>
            {rooms[r].label}
          </button>
        ))}
      </div>

      <section className="room-intro">
        <h2>
          {info.emoji} {info.label}
        </h2>
        <p className="muted">{info.intro}</p>
      </section>

      <RatePicker rate={rate} onChange={setRate} />
      {items.map((i) => (
        <CategoryGroup key={i.category} category={i.category} campaign={`room_${room}`} rate={rate} reason={i.reason} />
      ))}

      <ContactCta campaign={`room_${room}`} />
    </>
  );
}
