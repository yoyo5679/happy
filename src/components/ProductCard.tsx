"use client";

import { categories, productUrl, won, type Product } from "@/data/products";
import { withUtm } from "@/lib/utm";

export function ProductCard({ product, campaign, rate = 0.15 }: { product: Product; campaign: string; rate?: number }) {
  const cat = categories[product.category];
  return (
    <a className="product" href={withUtm(productUrl(product), campaign, product.code)} target="_blank" rel="noopener">
      <div className="thumb">
        {product.img ? (
          <img src={`/products/${product.code}.webp`} alt={product.name} loading="lazy" />
        ) : (
          <span aria-hidden>{cat.emoji}</span>
        )}
      </div>
      <div className="info">
        <span className="badges">
          {product.rent && <span className="badge">대여</span>}
          {product.price && <span className="badge">구입</span>}
        </span>
        <strong>{product.name}</strong>
        {product.rent && (
          <span className="price">
            월 대여 본인부담 {won(product.rent * rate)} <s className="muted">{won(product.rent)}</s>
          </span>
        )}
        {product.price && (
          <span className="price">
            구입 본인부담 {won(product.price * rate)} <s className="muted">{won(product.price)}</s>
          </span>
        )}
        <span className="code muted">급여코드 {product.code}</span>
      </div>
      <span className="go" aria-hidden>
        →
      </span>
    </a>
  );
}
