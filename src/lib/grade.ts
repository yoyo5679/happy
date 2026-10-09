import type { CategoryKey } from "@/data/products";
import type { Answers, Question } from "./quiz";

// 국민건강보험공단 '장기요양 인정조사표'(5개 영역 52개 항목)의 구성을 따라 18문항으로 줄인 '참고용' 모의 계산입니다.
// 등급 구간(95·75·60·51·45점)과 5등급·인지지원등급의 치매 요건은 「장기요양등급판정기준」을 따르고,
// 문항별 배점은 공단 판정 모형(공개된 단순 계산식이 아님)을 대신해 영역별 비중으로 단순화했습니다.
// 실제 등급은 공단 방문조사 + 의사소견서 + 등급판정위원회 심의로 결정됩니다.

const help = (self: string, part: string, full: string) => [
  { label: self, value: 0 },
  { label: part, value: 1 },
  { label: full, value: 2 },
];

type GradeQuestion = Question & { domain?: DomainKey };

export const gradeQuestions: GradeQuestion[] = [
  {
    id: "age",
    title: "부모님 연령과 질환을 알려주세요",
    description: "장기요양보험은 65세 이상, 또는 65세 미만이라도 노인성 질병이 있으면 신청할 수 있어요.",
    options: [
      { label: "65세 이상", value: 1 },
      { label: "65세 미만 · 치매/뇌졸중/파킨슨 등 노인성 질병 있음", value: 1 },
      { label: "65세 미만 · 해당 질병 없음", value: 0 },
    ],
  },
  // 신체기능 (공식 12개 항목 → 11문항)
  { id: "eat", domain: "adl", title: "식사는 어떻게 하세요?", description: "차려 드린 음식을 드시는 동작만 생각해 주세요.", options: help("혼자 드세요", "흘리거나 잘라 드려야 하는 등 일부 도움", "떠먹여 드려야 해요") },
  { id: "dress", domain: "adl", title: "옷을 입고 벗는 건요?", options: help("혼자 하세요", "단추·지퍼 등 일부 도움", "전부 입혀 드려야 해요") },
  { id: "wash", domain: "adl", title: "세수와 양치질은요?", options: help("혼자 하세요", "준비해 드리거나 일부 도움", "전부 해 드려야 해요") },
  { id: "bath", domain: "adl", title: "목욕은요?", options: help("혼자 하세요", "등 밀기·머리 감기 등 일부 도움", "전부 씻겨 드려야 해요") },
  { id: "turn", domain: "adl", title: "누운 채로 돌아눕는 건요? (체위 변경)", options: help("혼자 돌아누우세요", "잡아 드리면 돌아누우세요", "전부 돌려 드려야 해요") },
  { id: "situp", domain: "adl", title: "누웠다가 일어나 앉는 건요?", options: help("혼자 일어나 앉으세요", "손을 잡아 드려야 해요", "안아서 일으켜 드려야 해요") },
  { id: "transfer", domain: "adl", title: "침대에서 의자·휠체어로 옮겨 앉는 건요?", options: help("혼자 옮겨 앉으세요", "부축하면 옮겨 앉으세요", "들어서 옮겨 드려야 해요") },
  { id: "outroom", domain: "adl", title: "방 밖으로 나오시는 건요?", options: help("혼자 걸어 나오세요", "지팡이·부축이 필요해요", "휠체어나 업어서만 나오세요") },
  { id: "toilet", domain: "adl", title: "화장실 사용은요?", description: "화장실까지 가기, 옷 내리고 올리기, 뒤처리 포함", options: help("혼자 하세요", "일부 도와드려야 해요", "전부 도와드려야 해요") },
  { id: "bowel", domain: "adl", title: "대변 조절은 어떠세요?", options: help("문제없어요", "가끔 실수하세요", "자주 실수하시거나 기저귀를 쓰세요") },
  { id: "bladder", domain: "adl", title: "소변 조절은 어떠세요?", options: help("문제없어요", "가끔 실수하세요", "자주 실수하시거나 기저귀·도뇨관을 쓰세요") },
  // 인지기능 (공식 7개 항목 → 2문항)
  { id: "orient", domain: "cog", title: "오늘 날짜, 지금 계신 곳, 본인 나이를 아세요?", description: "방금 들은 이야기를 기억하시는지도 함께 떠올려 주세요.", options: help("잘 아세요", "가끔 헷갈려 하세요", "대부분 모르세요") },
  { id: "judge", domain: "cog", title: "간단한 부탁을 알아듣고 하시나요?", description: "상황 판단, 의사 표현 포함", options: help("잘 하세요", "가끔 엉뚱하게 하세요", "거의 못 하세요") },
  // 행동변화 (공식 14개 항목 → 1문항)
  { id: "behavior", domain: "beh", title: "다음 같은 행동이 있으세요?", description: "길을 잃음, 밤에 돌아다님, 물건을 도둑맞았다는 의심, 없는 것을 봄, 화내거나 때림, 도움을 거부함", options: [
    { label: "없어요", value: 0 },
    { label: "가끔 있어요", value: 1 },
    { label: "자주 있어요", value: 2 },
  ] },
  // 치매 진단 (5등급·인지지원등급 요건)
  { id: "dementia", title: "치매 진단을 받으셨나요?", description: "5등급과 인지지원등급은 치매가 있어야 받을 수 있어요.", options: [
    { label: "네, 진단받았어요", value: 1 },
    { label: "아니요 / 잘 모르겠어요", value: 0 },
  ] },
  // 간호처치 (공식 9개 항목 → 1문항)
  { id: "nursing", domain: "nurse", title: "다음 같은 처치가 필요하세요?", description: "욕창 간호, 콧줄·뱃줄 식사(경관영양), 산소, 가래 흡인, 소변줄(도뇨관), 장루, 투석", options: [
    { label: "없어요", value: 0 },
    { label: "1가지 있어요", value: 1 },
    { label: "2가지 이상 있어요", value: 2 },
  ] },
  // 재활 (공식 10개 항목 → 1문항)
  { id: "paralysis", domain: "rehab", title: "팔다리 마비나 관절이 굳은 곳이 있나요?", description: "어깨·팔꿈치·손목·고관절·무릎·발목이 잘 안 펴지는 것 포함", options: [
    { label: "없어요", value: 0 },
    { label: "한 부위(한쪽 팔 또는 다리)", value: 1 },
    { label: "두 부위 이상", value: 2 },
  ] },
];

// 영역별 배점 (합계 100점 상한)
// 신체기능은 공식 등급 설명(1등급=일상생활 전적 도움, 2등급=상당 부분, 3등급=부분적, 4등급=일정 부분)과
// 2026년 1분기 인정자 분포(4등급 42.6%, 3등급 23.7%)에 맞춰, 도움 정도가 커질수록 점수가 빠르게 오르게 했습니다.
//   - 문항별: 혼자 0, 일부 도움 0.5, 전적 도움 1 → 평균(s)
//   - 신체기능 점수 = 95 × √s  (모두 전적 도움 → 95점 = 1등급, 모두 일부 도움 → 약 67점 = 3등급, 절반 일부 도움 → 약 50점 = 4등급 경계)
export type DomainKey = "adl" | "cog" | "beh" | "nurse" | "rehab";
export const domains: Record<DomainKey, { label: string; official: string; max: number }> = {
  adl: { label: "신체기능", official: "옷 입기·세수·양치·목욕·식사·체위 변경·일어나 앉기·옮겨 앉기·방 밖으로 나오기·화장실 이용·대변·소변 조절 (12개)", max: 95 },
  cog: { label: "인지기능", official: "단기 기억, 날짜·장소·나이 인지, 지시 이행, 상황 판단, 의사소통 (7개)", max: 8 },
  beh: { label: "행동변화", official: "망상, 환각, 배회, 길 잃음, 폭언·폭행, 도움 거부 등 (14개)", max: 6 },
  nurse: { label: "간호처치", official: "기관지 절개관, 흡인, 산소요법, 욕창, 도뇨관, 경관영양, 투석, 장루 등 (9개)", max: 10 },
  rehab: { label: "재활", official: "팔다리 운동장애, 관절 제한 (10개)", max: 6 },
};
export const domainOrder: DomainKey[] = ["adl", "cog", "beh", "nurse", "rehab"];

export function domainScores(a: Answers): Record<DomainKey, number> {
  const out = {} as Record<DomainKey, number>;
  for (const d of domainOrder) {
    const qs = gradeQuestions.filter((q) => q.domain === d);
    if (d === "adl") {
      const sAvg = qs.reduce((sum, q) => sum + (a[q.id] === 2 ? 1 : a[q.id] === 1 ? 0.5 : 0), 0) / qs.length;
      out[d] = Math.round(domains.adl.max * Math.sqrt(sAvg));
      continue;
    }
    const got = qs.reduce((sum, q) => sum + (a[q.id] ?? 0), 0);
    const max = qs.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.value)), 0);
    out[d] = Math.round((got / max) * domains[d].max);
  }
  return out;
}

export type GradeResult = {
  score: number;
  breakdown?: Record<DomainKey, number>;
  grade: "1등급" | "2등급" | "3등급" | "4등급" | "5등급" | "인지지원등급" | "등급외 가능성" | "신청 대상 아님";
  headline: string;
  detail: string;
  categories: CategoryKey[];
};

export function calcGrade(a: Answers): GradeResult {
  if (a.age === 0) {
    return {
      score: 0,
      grade: "신청 대상 아님",
      headline: "현재는 장기요양보험 신청 대상이 아닐 수 있어요",
      detail: "65세 미만은 노인성 질병이 있어야 신청할 수 있어요. 등급과 관계없이 낙상 예방 용품은 일반 구매로 준비하실 수 있어요.",
      categories: ["safetyHandle", "antiSlipMat", "cane"],
    };
  }

  const breakdown = domainScores(a);
  const score = Math.min(100, domainOrder.reduce((sum, d) => sum + breakdown[d], 0));
  const dementia = a.dementia === 1;

  if (score >= 95)
    return {
      score, breakdown, grade: "1등급",
      headline: "1등급에 해당할 가능성이 있어요",
      detail: "일상생활 전반에 다른 사람의 도움이 필요한 상태예요. 와상 생활에 맞춘 침대와 욕창 예방이 가장 중요해요.",
      categories: ["electricBed", "pressureMattress", "positioning", "simpleToilet", "bathtub"],
    };
  if (score >= 75)
    return {
      score, breakdown, grade: "2등급",
      headline: "2등급에 해당할 가능성이 있어요",
      detail: "일상생활 상당 부분에 도움이 필요해요. 침대에서 일어나고 이동하는 순간을 안전하게 만드는 용품을 추천해요.",
      categories: ["electricBed", "pressureMattress", "wheelchair", "portableToilet", "incontinence"],
    };
  if (score >= 60)
    return {
      score, breakdown, grade: "3등급",
      headline: "3등급에 해당할 가능성이 있어요",
      detail: "부분적으로 도움이 필요한 상태예요. 화장실·욕실 낙상 예방과 이동 보조가 핵심이에요.",
      categories: ["safetyHandle", "portableToilet", "bathChair", "walker"],
    };
  if (score >= 51)
    return {
      score, breakdown, grade: "4등급",
      headline: "4등급에 해당할 가능성이 있어요",
      detail: "일상생활 일부에 도움이 필요해요. 집 안 위험 구간(욕실·문턱)을 정비하면 혼자 하실 수 있는 일이 늘어나요.",
      categories: ["safetyHandle", "antiSlipMat", "walker", "bathChair"],
    };
  if (dementia && score >= 45)
    return {
      score, breakdown, grade: "5등급",
      headline: "5등급(치매특별등급)에 해당할 가능성이 있어요",
      detail: "치매 어르신을 위한 등급이에요. 배회 대비와 낙상 예방 용품을 함께 준비하시면 좋아요.",
      categories: ["wanderingSensor", "safetyHandle", "antiSlipSocks"],
    };
  if (dementia)
    return {
      score, breakdown, grade: "인지지원등급",
      headline: "인지지원등급에 해당할 가능성이 있어요",
      detail: "신체 기능은 비교적 괜찮지만 치매가 있는 경우예요. 인지지원등급은 복지용구 급여도 받을 수 있어요.",
      categories: ["wanderingSensor", "antiSlipSocks", "safetyHandle"],
    };
  return {
    score, breakdown, grade: "등급외 가능성",
    headline: "아직은 등급 기준에 못 미칠 수 있어요",
    detail: "지금은 비교적 건강하신 편이에요. 다만 낙상 한 번이 큰 변화를 만드니, 욕실·현관부터 미리 준비하시길 권해요. 상태가 바뀌면 언제든 다시 신청할 수 있어요.",
    categories: ["safetyHandle", "antiSlipMat", "cane"],
  };
}
