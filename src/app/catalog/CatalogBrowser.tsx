"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { RatePicker } from "@/components/RatePicker";
import { ContactCta } from "@/components/ContactCta";
import { categories, isSoldOut, products, type CategoryKey } from "@/data/products";

const keys = Object.keys(categories) as CategoryKey[];

export function CatalogBrowser() {
  const [cat, setCat] = useState<CategoryKey>("electricBed");
  const [rate, setRate] = useState(0.15);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c && c in categories) setCat(c as CategoryKey);
  }, []);

  function pick(c: CategoryKey) {
    setCat(c);
    window.history.replaceState(null, "", `?c=${c}`);
  }

  const list = products.filter((p) => p.category === cat).sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)));
  const usable = keys.filter((k) => products.some((p) => p.category === k));

  return (
    <>
      <div className="page-title">
        <h1>🛒 복지용구 전체 모델</h1>
        <p className="muted">장기요양 등급이 있으면 아래 본인부담금만 내고 구입·대여할 수 있어요. (연 한도 160만원)</p>
      </div>
      <div className="chips" role="tablist">
        {usable.map((k) => (
          <button key={k} role="tab" aria-selected={k === cat} className={k === cat ? "chip on" : "chip"} onClick={() => pick(k)}>
            {categories[k].label}
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
