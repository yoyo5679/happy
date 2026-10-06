"use client";

import { categories, type Product } from "@/data/products";
import { withUtm } from "@/lib/utm";

export function ProductCard({ product, campaign }: { product: Product; campaign: string }) {
  const cat = categories[product.category];
  return (
    <a className="product" href={withUtm(product.url, campaign, product.id)} target="_blank" rel="noopener">
      <div className="thumb">
        {product.image ? <img src={product.image} alt="" /> : <span aria-hidden>{cat.emoji}</span>}
      </div>
      <div className="info">
        <span className="badge">{cat.supply}</span>
        <strong>{product.name}</strong>
        <span className="muted">{product.summary}</span>
        {product.priceNote && <span className="price">{product.priceNote}</span>}
      </div>
      <span className="go" aria-hidden>
        →
      </span>
    </a>
  );
}
