import specs from "./specifications.json";
import pageMap from "./catalog-pages.json";
import audit from "./specification-audit.json";
import { products, type CategoryKey, type Product } from "./products";

export type Spec = typeof specs[number];
export type SizeRow = { id: string; name: string; category: CategoryKey; spec?: Spec; product: Product; page?: number; sourceStatus: "catalog_matched" | "catalog_not_listed" | "unregistered" };
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
// The mall is the source of membership. A catalog entry alone must never create a listing.
export const excludedSizeCategories: CategoryKey[] = ["wanderingSensor", "oralCleaner", "antiSlipSocks", "incontinence"];
export function availableSizeProduct(product: Product): Product {
  return { ...product,
    buy: product.buy && !product.buy.soldOut ? product.buy : undefined,
    rent: product.rent && !product.rent.soldOut ? product.rent : undefined,
  };
}
export const sizeRows: SizeRow[] = products.map(availableSizeProduct).filter(p => !excludedSizeCategories.includes(p.category) && (p.buy || p.rent)).map(product => {
  const spec = specs.find(s => product.code && s.category === product.category && s.code === product.code)
    ?? specs.find(s => s.category === product.category && normalize(s.name) === normalize(product.name));
  const checked = (audit.products as Record<string, { status: string }>)[product.id];
  return { sourceStatus: spec ? "catalog_matched" : checked?.status === "catalog_not_listed" ? "catalog_not_listed" : "unregistered", id: product.id, name: product.name, category: product.category, product, spec,
    page: spec?.page ?? (product.code ? (pageMap as Record<string, number>)[product.code] : undefined) };
});
export const sizeFields: [keyof Spec, string][] = [["width","가로"],["depth","세로"],["height","높이"],["seat","좌면 가로 × 세로 / 높이"],["weight","무게"],["load","최대하중"],["material","재질"]];
export function specValue(row: SizeRow, key: keyof Spec): string {
  if (!row.spec) return row.sourceStatus === "catalog_not_listed" ? "첨부 카탈로그 미수록" : "치수 미등록";
  const value = row.spec[key];
  if (value === null || value === undefined || value === "") return "원본 미기재";
  if (value === "해당 없음" || value === "원본 미기재") return value;
  if (["width", "depth", "height", "seat"].includes(key)) return `${value} cm`;
  if (key === "weight" || key === "load") return `${value} kg`;
  return String(value);
}
export function comparableValue(row: SizeRow, key: "width" | "weight"): number {
  const value = row.spec?.[key];
  return typeof value === "number" ? value : Number(String(value ?? "").match(/\d+(?:\.\d+)?/)?.[0] ?? Infinity);
}
