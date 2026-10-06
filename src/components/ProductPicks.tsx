"use client";

import { useEffect, useState } from "react";
import { copay, isSoldOut, productUrl, products, won, type CategoryKey, type Product } from "@/data/products";
import { withUtm } from "@/lib/utm";

// 재고 있는 상품 중 무작위 추천. (실제 조회수 기반이 아니므로 '많이 본' 같은 표현은 쓰지 않습니다)
export function ProductPicks({ campaign, exclude = [], count = 6 }: { campaign: string; exclude?: CategoryKey[]; count?: number }) {
  const [picks, setPicks] = useState<Product[]>([]);

  useEffect(() => {
    const pool = products.filter((p) => !isSoldOut(p) && !exclude.includes(p.category));
    const byCat = new Map<CategoryKey, Product[]>();
    for (const p of pool) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
    // 품목이 겹치지 않게 품목별로 하나씩 무작위 선택
    const cats = [...byCat.keys()].sort(() => Math.random() - 0.5).slice(0, count);
    setPicks(cats.map((c) => { const l = byCat.get(c)!; return l[Math.floor(Math.random() * l.length)]; }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (picks.length === 0) return null;

  return (
    <section className="picks">
      <h3>이런 상품은 어떠세요?</h3>
      <div className="picks-row">
        {picks.map((p) => {
          const l = p.rent && !p.rent.soldOut ? p.rent : p.buy!;
          return (
            <a key={p.id} className="pick" href={withUtm(productUrl(p), campaign, `pick_${p.code ?? p.id}`)} target="_blank" rel="noopener">
              <div className="pick-img">
                <img src={p.img} alt={p.name} loading="lazy" />
                {l === p.rent && <span className="badge pick-badge">대여</span>}
              </div>
              <strong>{p.name}</strong>
              <span className="pick-price">
                {l === p.rent ? "월 " : ""}
                {won(copay(l.price, 0.15))}
              </span>
              <span className="pick-list">
                정상가 <s>{won(l.price)}</s>
              </span>
            </a>
          );
        })}
      </div>
      <p className="pick-note muted">본인부담 15% 기준</p>
    </section>
  );
}
