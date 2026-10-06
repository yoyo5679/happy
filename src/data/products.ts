// 상품 데이터: 해피케어몰 진열 상품 (products.json)
// 가격은 쇼핑몰 급여가/월 대여가이며, 본인부담금은 부담률을 곱해 10원 미만 절사합니다.
import data from "./products.json";
import { site } from "@/config/site";

export type CategoryKey =
  | "oralCleaner"
  | "wanderingSensor"
  | "portableToilet"
  | "bathChair"
  | "walker"
  | "safetyHandle"
  | "simpleToilet"
  | "antiSlipMat"
  | "antiSlipSocks"
  | "cane"
  | "pressureCushion"
  | "positioning"
  | "incontinence"
  | "pressureMattress"
  | "ramp"
  | "electricBed"
  | "bathtub"
  | "wheelchair";

export const categories: Record<CategoryKey, { label: string; emoji: string; desc: string }> = {
  oralCleaner: { label: "구강세척기", emoji: "🪥", desc: "치아·잇몸을 세척해 구강질환을 예방해요" },
  wanderingSensor: { label: "배회감지기", emoji: "📡", desc: "인지장애 어르신의 배회·실종을 미리 막아요" },
  portableToilet: { label: "이동변기", emoji: "🚽", desc: "화장실까지 가기 어려울 때 방에서 안전하게" },
  bathChair: { label: "목욕의자", emoji: "🛁", desc: "목욕할 때 자세를 잡아 주고 편안하게" },
  walker: { label: "성인용 보행기", emoji: "🦯", desc: "실내·외에서 혼자 이동할 수 있도록 보조해요" },
  safetyHandle: { label: "안전손잡이", emoji: "🤚", desc: "앉고 일어설 때 잡을 곳을 만들어 사고를 예방해요" },
  simpleToilet: { label: "간이변기", emoji: "🧴", desc: "누워 계시거나 소변 조절이 어려울 때" },
  antiSlipMat: { label: "미끄럼방지 매트", emoji: "🟫", desc: "욕실·실내 바닥 미끄럼 낙상을 예방해요" },
  antiSlipSocks: { label: "미끄럼방지 양말", emoji: "🧦", desc: "실내에서 미끄러지지 않도록" },
  cane: { label: "지팡이", emoji: "🦯", desc: "보행이 불편할 때 걸음을 보조해요" },
  pressureCushion: { label: "욕창예방 방석", emoji: "🟦", desc: "오래 앉아 계시거나 휠체어를 쓰실 때" },
  positioning: { label: "자세변환용구", emoji: "🔄", desc: "누워 계실 때 자세·위치 변환을 도와요" },
  incontinence: { label: "요실금 팬티", emoji: "🩲", desc: "요실금이 있어도 쾌적한 일상을" },
  pressureMattress: { label: "욕창예방 매트리스", emoji: "🛌", desc: "체중을 분산하고 통풍시켜 욕창을 예방해요" },
  ramp: { label: "경사로", emoji: "📐", desc: "휠체어·보행기 이동 시 문턱 단차를 없애요" },
  electricBed: { label: "전동침대", emoji: "🛏️", desc: "일어나는 동작을 보조하고 자립을 도와요" },
  bathtub: { label: "이동욕조", emoji: "🛀", desc: "방 안에서 이동 없이 간편하게 목욕" },
  wheelchair: { label: "수동휠체어", emoji: "♿", desc: "걷기 어렵거나 오래 걷기 힘들 때" },
};

type Listing = {
  /** 급여가(구입) 또는 월 대여가 */
  price: number;
  /** 쇼핑몰 상품 페이지 */
  url: string;
  soldOut: boolean;
};

export type Product = {
  id: string;
  /** 급여코드 (카탈로그와 일치 확인된 상품만) */
  code?: string;
  name: string;
  category: CategoryKey;
  /** 로컬(/products/…) 또는 쇼핑몰 대표 이미지 URL */
  img: string;
  rent?: Listing;
  buy?: Listing;
};

// 쇼핑몰 상품 엑셀 + 카탈로그로 생성 (scripts/catalog/build_from_mall.py)
export const products = data as Product[];

export const isSoldOut = (p: Product) => [p.rent, p.buy].every((l) => !l || l.soldOut);

/** 결과 화면에 먼저 보여줄 상품 (id). 지정하지 않은 카테고리는 쇼핑몰 진열 순서대로 노출. */
export const featured: Partial<Record<CategoryKey, string[]>> = {
  // electricBed: ["S03090200002"],
};

export function productsFor(category: CategoryKey, limit = 3): Product[] {
  const all = products.filter((p) => p.category === category && !isSoldOut(p));
  const pick = featured[category] ?? [];
  const head = pick.map((id) => all.find((p) => p.id === id)).filter((p): p is Product => !!p);
  return [...head, ...all.filter((p) => !pick.includes(p.id))].slice(0, limit);
}

export function countFor(category: CategoryKey): number {
  return products.filter((p) => p.category === category).length;
}

export function productUrl(p: Product): string {
  const l = [p.rent, p.buy].find((x) => x && !x.soldOut) ?? p.rent ?? p.buy;
  return l?.url ?? site.storeUrl;
}

export const RATES = [
  { rate: 0.15, label: "일반 15%" },
  { rate: 0.09, label: "감경 9%" },
  { rate: 0.06, label: "감경 6%" },
  { rate: 0, label: "기초수급 0%" },
] as const;

/** 본인부담금: 10원 미만 절사 (쇼핑몰 표기와 동일) */
export const copay = (price: number, rate: number) => Math.floor((price * rate) / 10) * 10;

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 결과 공유 문구용: "전동침대 (예: SE7030 월 본인부담 11,470원)" */
export function categorySummary(category: CategoryKey, rate: number): string {
  const label = categories[category].label;
  const p = productsFor(category, 1)[0];
  if (!p) return label;
  const l = p.rent && !p.rent.soldOut ? p.rent : p.buy ?? p.rent;
  if (!l) return label;
  return `${label} (예: ${p.name} ${l === p.rent ? "월 " : ""}본인부담 ${won(copay(l.price, rate))})`;
}
