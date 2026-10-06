// 상품 데이터: 이로움케어 복지용구 카탈로그(catalog.json, 360개 품목)
// 가격은 카탈로그 기준 급여가/대여가(월)이며, 본인부담금은 부담률을 곱해 계산합니다.
import catalog from "./catalog.json";
import { productLinks } from "./productLinks";
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

export type Product = {
  /** 급여코드 */
  code: string;
  /** 모델명 */
  name: string;
  category: CategoryKey;
  /** 카탈로그 페이지 */
  page: number;
  /** 급여가 (구입) */
  price?: number;
  /** 대여가 (월) */
  rent?: number;
  /** public/products/{code}.webp 이미지 있음 */
  img?: boolean;
};

export const products = catalog as Product[];

/** 결과 화면에 먼저 보여줄 상품 (급여코드). 지정하지 않은 카테고리는 카탈로그 순서대로 노출. */
export const featured: Partial<Record<CategoryKey, string[]>> = {
  // electricBed: ["S03090200002", "S03090200001"],
};

export function productsFor(category: CategoryKey, limit = 3): Product[] {
  const all = products.filter((p) => p.category === category);
  const pick = featured[category] ?? [];
  const head = pick.map((c) => all.find((p) => p.code === c)).filter((p): p is Product => !!p);
  return [...head, ...all.filter((p) => !pick.includes(p.code))].slice(0, limit);
}

export function countFor(category: CategoryKey): number {
  return products.filter((p) => p.category === category).length;
}

export function productUrl(p: Product): string {
  if (productLinks[p.code]) return productLinks[p.code];
  if (site.searchUrl) return site.searchUrl.replace("{q}", encodeURIComponent(p.name));
  return site.storeUrl;
}

export const RATES = [
  { rate: 0.15, label: "일반 15%" },
  { rate: 0.09, label: "감경 9%" },
  { rate: 0.06, label: "감경 6%" },
  { rate: 0, label: "기초수급 0%" },
] as const;

export const won = (n: number) => `${Math.floor(n).toLocaleString("ko-KR")}원`;
