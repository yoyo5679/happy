"use client";

import { useState } from "react";
import { categories, copay, isSoldOut, productUrl, won, type Product } from "@/data/products";
import { withUtm } from "@/lib/utm";

export function ProductCard({ product, campaign, rate = 0.15 }: { product: Product; campaign: string; rate?: number }) {
  const cat = categories[product.category];
  const soldOut = isSoldOut(product);
  const [imgOk, setImgOk] = useState(!!product.img);
  return (
    <a
      className={soldOut ? "product sold-out" : "product"}
      href={withUtm(productUrl(product), campaign, product.code ?? product.id)}
      target="_blank"
      rel="noopener"
    >
      <div className="thumb">
        {imgOk ? (
          <img src={product.img} alt={product.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
        ) : (
          <span aria-hidden>{cat.emoji}</span>
        )}
      </div>
      <div className="info">
        <span className="badges">
          {product.rent && <span className="badge">대여</span>}
          {product.buy && <span className="badge">구입</span>}
          {soldOut && <span className="badge out">품절</span>}
        </span>
        <strong>{product.name}</strong>
        {product.rent && (
          <span className="price">
            월 본인부담 {won(copay(product.rent.price, rate))} <s className="muted">{won(product.rent.price)}</s>
          </span>
        )}
        {product.buy && (
          <span className="price">
            본인부담 {won(copay(product.buy.price, rate))} <s className="muted">{won(product.buy.price)}</s>
          </span>
        )}
        {product.code && <span className="code muted">급여코드 {product.code}</span>}
      </div>
      <span className="go" aria-hidden>
        →
      </span>
    </a>
  );
}
