"use client";

import Link from "next/link";
import { categories, countFor, productsFor, type CategoryKey } from "@/data/products";
import { ProductCard } from "./ProductCard";

type Props = { category: CategoryKey; campaign: string; rate: number; rank?: number; reason?: string };

export function CategoryGroup({ category, campaign, rate, rank, reason }: Props) {
  const cat = categories[category];
  const total = countFor(category);
  const list = productsFor(category);
  if (list.length === 0) return null;
  return (
    <section className="card group">
      <h3>
        {rank !== undefined && <span className="rank">{rank}</span>} {cat.emoji} {cat.label}
      </h3>
      <p className="reason">{reason ?? cat.desc}</p>
      {list.map((p) => (
        <ProductCard key={p.id} product={p} campaign={campaign} rate={rate} />
      ))}
      {total > 3 && (
        <Link className="more" href={`/catalog?c=${category}`}>
          {cat.label} 전체 {total}개 모델 비교하기 →
        </Link>
      )}
    </section>
  );
}
