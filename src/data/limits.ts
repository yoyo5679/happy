import type { CategoryKey } from "./products";

// 품목별 사용 가능 햇수(내구연한) / 급여 한도 — 「복지용구 급여범위 및 급여기준 등에 관한 고시」 별표2 기준 (고시 개정 시 확인)
export const limits: { category: CategoryKey; durability: string; qty: string; label?: string }[] = [
  { category: "electricBed", durability: "10년", qty: "1개" },
  { category: "pressureMattress", durability: "3년", qty: "1개" },
  { category: "wheelchair", durability: "5년", qty: "1개" },
  { category: "bathtub", durability: "5년", qty: "1개" },
  { category: "walker", durability: "5년", qty: "2개" },
  { category: "cane", durability: "2년", qty: "1개" },
  { category: "portableToilet", durability: "5년", qty: "1개" },
  { category: "bathChair", durability: "5년", qty: "1개" },
  { category: "pressureCushion", durability: "3년", qty: "1개" },
  { category: "wanderingSensor", durability: "2년", qty: "2개", label: "배회감지기(태그형)" },
  { category: "oralCleaner", durability: "5년", qty: "1개", label: "구강세척기(마우스피스형)" },
  { category: "safetyHandle", durability: "없음", qty: "10개" },
  { category: "antiSlipMat", durability: "없음", qty: "5개" },
  { category: "antiSlipSocks", durability: "없음", qty: "6켤레" },
  { category: "incontinence", durability: "없음", qty: "4개" },
  { category: "positioning", durability: "없음", qty: "5개" },
  { category: "simpleToilet", durability: "없음", qty: "2개" },
  { category: "ramp", durability: "2년", qty: "6개", label: "경사로(실내용)" },
];

export const rateTargets = [
  { rate: "15%", who: "일반 수급자" },
  { rate: "9%", who: "보험료 감경 대상자 (보험료 순위 25% 초과 50% 이하)" },
  { rate: "6%", who: "의료급여 수급자 · 차상위 감경 대상자 · 보험료 순위 25% 이하 등" },
  { rate: "0%", who: "국민기초생활수급자" },
];
