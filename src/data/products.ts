// ✏️ 카탈로그 — 실제 상품명/링크/가격/이미지로 바꿔 주세요.
// 추천 로직은 `category` 값으로 상품을 찾으므로, 카테고리 키만 맞으면
// 한 카테고리에 상품을 여러 개 넣어도 됩니다 (앞에 있는 상품이 먼저 노출).

export type CategoryKey =
  | "electricBed"
  | "manualBed"
  | "pressureMattress"
  | "pressureCushion"
  | "positioning"
  | "safetyHandle"
  | "antiSlip"
  | "bathChair"
  | "portableToilet"
  | "walker"
  | "cane"
  | "wheelchair"
  | "ramp"
  | "wanderingSensor"
  | "incontinence";

export const categories: Record<
  CategoryKey,
  { label: string; emoji: string; supply: "대여" | "구매" | "대여·구매" }
> = {
  electricBed: { label: "전동침대", emoji: "🛏️", supply: "대여" },
  manualBed: { label: "수동침대", emoji: "🛏️", supply: "대여" },
  pressureMattress: { label: "욕창예방 매트리스", emoji: "🧊", supply: "대여·구매" },
  pressureCushion: { label: "욕창예방 방석", emoji: "🟦", supply: "구매" },
  positioning: { label: "자세변환용구", emoji: "🔄", supply: "구매" },
  safetyHandle: { label: "안전손잡이", emoji: "🤚", supply: "구매" },
  antiSlip: { label: "미끄럼방지 매트·양말", emoji: "🧦", supply: "구매" },
  bathChair: { label: "목욕의자", emoji: "🛁", supply: "구매" },
  portableToilet: { label: "이동변기", emoji: "🚽", supply: "구매" },
  walker: { label: "성인용 보행기", emoji: "🦯", supply: "구매" },
  cane: { label: "지팡이", emoji: "🦯", supply: "구매" },
  wheelchair: { label: "수동휠체어", emoji: "♿", supply: "대여" },
  ramp: { label: "경사로", emoji: "📐", supply: "대여·구매" },
  wanderingSensor: { label: "배회감지기", emoji: "📡", supply: "대여" },
  incontinence: { label: "요실금 팬티", emoji: "🩲", supply: "구매" },
};

export type Product = {
  id: string;
  category: CategoryKey;
  name: string;
  /** 상품 상세 페이지 주소 */
  url: string;
  /** 짧은 한 줄 설명 */
  summary: string;
  /** 표시용 가격 문구 (예: "월 대여료 문의", "본인부담 15% 기준 12,000원") */
  priceNote?: string;
  /** public/ 아래 이미지 경로 또는 외부 이미지 URL */
  image?: string;
};

const store = "https://smartstore.naver.com/happycare/products";

export const products: Product[] = [
  { id: "bed-e1", category: "electricBed", name: "3모터 전동침대", url: `${store}/1001`, summary: "등·다리·높이 조절로 기립과 간병이 편해요", priceNote: "장기요양 대여 품목" },
  { id: "bed-m1", category: "manualBed", name: "2크랭크 수동침대", url: `${store}/1002`, summary: "전기 없이 손잡이로 등·다리 각도 조절", priceNote: "장기요양 대여 품목" },
  { id: "mat-1", category: "pressureMattress", name: "에어 욕창예방 매트리스", url: `${store}/1003`, summary: "공기 순환으로 장시간 누워 계셔도 압력 분산" },
  { id: "cus-1", category: "pressureCushion", name: "욕창예방 방석", url: `${store}/1004`, summary: "휠체어·의자 장시간 착석 시 엉덩이 압력 완화" },
  { id: "pos-1", category: "positioning", name: "자세변환 쿠션", url: `${store}/1005`, summary: "돌아눕히기·옆으로 눕기 자세 유지" },
  { id: "hdl-1", category: "safetyHandle", name: "욕실 안전손잡이", url: `${store}/1006`, summary: "변기·욕조 옆 기립 보조, 낙상 예방" },
  { id: "hdl-2", category: "safetyHandle", name: "침대·현관 지지 손잡이", url: `${store}/1007`, summary: "공사 없이 설치하는 거치형 지지대" },
  { id: "slip-1", category: "antiSlip", name: "욕실 미끄럼방지 매트", url: `${store}/1008`, summary: "젖은 바닥에서도 미끄러지지 않게" },
  { id: "bath-1", category: "bathChair", name: "등받이 목욕의자", url: `${store}/1009`, summary: "앉아서 안전하게 샤워" },
  { id: "toi-1", category: "portableToilet", name: "침실용 이동변기", url: `${store}/1010`, summary: "밤중 화장실 이동 없이 침대 옆에서" },
  { id: "walk-1", category: "walker", name: "실버카(보행보조차)", url: `${store}/1011`, summary: "외출·산책 시 기대어 걷고 앉아 쉴 수 있어요" },
  { id: "cane-1", category: "cane", name: "4발 지팡이", url: `${store}/1012`, summary: "일반 지팡이보다 넓은 지지면으로 안정적" },
  { id: "wc-1", category: "wheelchair", name: "경량 수동휠체어", url: `${store}/1013`, summary: "접이식, 차량 적재 쉬움", priceNote: "장기요양 대여 품목" },
  { id: "ramp-1", category: "ramp", name: "문턱 경사로", url: `${store}/1014`, summary: "현관·방 문턱 단차 해소" },
  { id: "wan-1", category: "wanderingSensor", name: "GPS 배회감지기", url: `${store}/1015`, summary: "치매 어르신 위치를 보호자 휴대폰으로", priceNote: "장기요양 대여 품목" },
  { id: "inc-1", category: "incontinence", name: "요실금 팬티", url: `${store}/1016`, summary: "외출 시에도 안심" },
];

export function productsFor(category: CategoryKey, limit = 2): Product[] {
  return products.filter((p) => p.category === category).slice(0, limit);
}
