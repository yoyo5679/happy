// 등급별 혜택 (2026년 기준) — 매년 1월 갱신 필요
// 재가급여 월 한도액: 2026년 장기요양위원회 의결(2025.11) 기준
export const BENEFIT_YEAR = 2026;
export const EQUIPMENT_LIMIT = 1_600_000; // 복지용구 연 한도 (등급 무관)

export type GradeName = "1등급" | "2등급" | "3등급" | "4등급" | "5등급" | "인지지원등급";

export const gradeBenefits: Record<GradeName, { monthly: number; services: string; facility: string }> = {
  "1등급": { monthly: 2_512_900, services: "방문요양 · 방문목욕 · 방문간호 · 주야간보호 · 단기보호", facility: "요양원 입소 가능" },
  "2등급": { monthly: 2_331_200, services: "방문요양 · 방문목욕 · 방문간호 · 주야간보호 · 단기보호", facility: "요양원 입소 가능" },
  "3등급": { monthly: 1_528_200, services: "방문요양 · 방문목욕 · 방문간호 · 주야간보호 · 단기보호", facility: "원칙적으로 재가 이용 (치매 등 사유가 있으면 심의 후 입소 가능)" },
  "4등급": { monthly: 1_409_700, services: "방문요양 · 방문목욕 · 방문간호 · 주야간보호 · 단기보호", facility: "원칙적으로 재가 이용 (치매 등 사유가 있으면 심의 후 입소 가능)" },
  "5등급": { monthly: 1_208_900, services: "방문요양 · 방문목욕 · 방문간호 · 주야간보호 · 단기보호 (치매 맞춤 프로그램)", facility: "원칙적으로 재가 이용 (치매 등 사유가 있으면 심의 후 입소 가능)" },
  "인지지원등급": { monthly: 676_320, services: "주야간보호 중심 (인지 활동 프로그램)", facility: "요양원 입소 불가" },
};
