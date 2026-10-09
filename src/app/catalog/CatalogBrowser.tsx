"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { categories, categoryGroups, isSoldOut, products, type CategoryKey } from "@/data/products";

const count = (c: CategoryKey) => products.filter((p) => p.category === c).length;
const groups = categoryGroups.map((g) => ({ ...g, items: g.items.filter((c) => count(c) > 0) }));
const groupOf = (c: CategoryKey) => groups.find((g) => g.items.includes(c)) ?? groups[0];

export function CatalogBrowser() {
  const [cat, setCat] = useState<CategoryKey>("electricBed");
  const [rate, setRate] = useState(0.15);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c && c in categories && count(c as CategoryKey) > 0) setCat(c as CategoryKey);
  }, []);

  function pick(c: CategoryKey) {
    setCat(c);
    window.history.replaceState(window.history.state, "", `?c=${c}`);
  }

  const group = groupOf(cat);
  const list = products.filter((p) => p.category === cat).sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)));

  return (
    <>
      <div className="page-title">
        <h1>🛒 복지용구 전체 모델</h1>
        <p className="muted">장기요양 등급이 있으면 아래 본인부담금만 내고 구입·대여할 수 있어요.</p>
      </div>

      <nav className="cat-groups" role="tablist" aria-label="품목 분류">
        {groups.map((g) => (
          <button key={g.key} role="tab" aria-selected={g.key === group.key} className={g.key === group.key ? "on" : ""} onClick={() => pick(g.items[0])}>
            <span className="ico" aria-hidden>
              {g.emoji}
            </span>
            {g.label}
          </button>
        ))}
      </nav>

      <div className="cat-items" role="tablist" aria-label={`${group.label} 세부 품목`}>
        {group.items.map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? "chip on" : "chip"} onClick={() => pick(c)}>
            {categories[c].label} <span className="cnt">{count(c)}</span>
          </button>
        ))}
      </div>

      <RatePicker rate={rate} onChange={setRate} />
      <section className="card group">
        <h3>
          {categories[cat].emoji} {categories[cat].label} <span className="muted">· {list.length}개</span>
        </h3>
        <p className="reason">{categories[cat].desc}</p>
        {list.map((p) => (
          <ProductCard key={p.id} product={p} campaign="catalog" rate={rate} />
        ))}
      </section>
      <ContactCta campaign="catalog" />
    </>
  );
}
