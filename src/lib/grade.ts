import type { CategoryKey } from "@/data/products";
import type { Answers, Question } from "./quiz";

// 장기요양 인정조사(52개 항목)를 12문항으로 단순화한 '참고용' 모의 계산입니다.
// 실제 등급은 국민건강보험공단 방문조사 + 의사소견서 + 등급판정위원회 심의로 결정됩니다.

const help = [
  { label: "혼자서 하세요", value: 0 },
  { label: "일부 도움이 필요해요", value: 1 },
  { label: "전적으로 도움이 필요해요", value: 2 },
];

export const gradeQuestions: Question[] = [
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
  { id: "eat", title: "식사는 어떻게 하세요?", options: help },
  { id: "dress", title: "옷 입기·세수·양치는요?", options: help },
  { id: "toilet", title: "화장실 이용은요?", description: "화장실까지 가기, 옷 내리기, 뒤처리 포함", options: help },
  { id: "bath", title: "목욕은요?", options: help },
  {
    id: "move",
    title: "방 안에서 움직이거나 돌아눕는 건요?",
    options: [
      { label: "혼자서 걸어 다니세요", value: 0 },
      { label: "지팡이·벽을 짚거나 부축이 필요해요", value: 1 },
      { label: "대부분 누워 계세요", value: 2 },
    ],
  },
  {
    id: "continence",
    title: "대소변 조절은 어떠세요?",
    options: [
      { label: "문제 없어요", value: 0 },
      { label: "가끔 실수하세요", value: 1 },
      { label: "자주 실수하시거나 기저귀를 쓰세요", value: 2 },
    ],
  },
  {
    id: "cognition",
    title: "날짜나 가족 얼굴을 잘 기억하세요?",
    options: [
      { label: "잘 기억하세요", value: 0 },
      { label: "가끔 헷갈려 하세요", value: 1 },
      { label: "자주 헷갈리거나 못 알아보세요", value: 2 },
    ],
  },
  {
    id: "behavior",
    title: "길을 잃거나, 밤에 돌아다니거나, 의심·화를 내는 행동이 있나요?",
    options: [
      { label: "없어요", value: 0 },
      { label: "가끔 있어요", value: 1 },
      { label: "자주 있어요", value: 2 },
    ],
  },
  {
    id: "dementia",
    title: "치매 진단을 받으셨나요?",
    options: [
      { label: "네, 진단받았어요", value: 1 },
      { label: "아니요 / 잘 모르겠어요", value: 0 },
    ],
  },
  {
    id: "paralysis",
    title: "팔다리 마비나 관절 굳음이 있나요?",
    options: [
      { label: "없어요", value: 0 },
      { label: "한쪽 팔이나 다리", value: 1 },
      { label: "양쪽 또는 여러 부위", value: 2 },
    ],
  },
  {
    id: "nursing",
    title: "욕창, 콧줄·뱃줄 식사, 산소요법, 도뇨관 같은 처치가 필요한가요?",
    options: [
      { label: "없어요", value: 0 },
      { label: "있어요", value: 1 },
    ],
  },
];

export type GradeResult = {
  score: number;
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

  const adl = (a.eat ?? 0) + (a.dress ?? 0) + (a.toilet ?? 0) + (a.bath ?? 0) + (a.move ?? 0) + (a.continence ?? 0); // 0~12
  const score = Math.min(
    100,
    adl * 5 + (a.cognition ?? 0) * 5 + (a.behavior ?? 0) * 4 + (a.paralysis ?? 0) * 6 + (a.nursing ?? 0) * 10,
  );
  const dementia = a.dementia === 1;

  if (score >= 95)
    return {
      score, grade: "1등급",
      headline: "1등급에 해당할 가능성이 있어요",
      detail: "일상생활 전반에 다른 사람의 도움이 필요한 상태예요. 와상 생활에 맞춘 침대와 욕창 예방이 가장 중요해요.",
      categories: ["electricBed", "pressureMattress", "positioning", "simpleToilet", "bathtub"],
    };
  if (score >= 75)
    return {
      score, grade: "2등급",
      headline: "2등급에 해당할 가능성이 있어요",
      detail: "일상생활 상당 부분에 도움이 필요해요. 침대에서 일어나고 이동하는 순간을 안전하게 만드는 용품을 추천해요.",
      categories: ["electricBed", "pressureMattress", "wheelchair", "portableToilet", "incontinence"],
    };
  if (score >= 60)
    return {
      score, grade: "3등급",
      headline: "3등급에 해당할 가능성이 있어요",
      detail: "부분적으로 도움이 필요한 상태예요. 화장실·욕실 낙상 예방과 이동 보조가 핵심이에요.",
      categories: ["safetyHandle", "portableToilet", "bathChair", "walker"],
    };
  if (score >= 51)
    return {
      score, grade: "4등급",
      headline: "4등급에 해당할 가능성이 있어요",
      detail: "일상생활 일부에 도움이 필요해요. 집 안 위험 구간(욕실·문턱)을 정비하면 혼자 하실 수 있는 일이 늘어나요.",
      categories: ["safetyHandle", "antiSlipMat", "walker", "bathChair"],
    };
  if (dementia && score >= 45)
    return {
      score, grade: "5등급",
      headline: "5등급(치매특별등급)에 해당할 가능성이 있어요",
      detail: "치매 어르신을 위한 등급이에요. 배회 대비와 낙상 예방 용품을 함께 준비하시면 좋아요.",
      categories: ["wanderingSensor", "safetyHandle", "antiSlipSocks"],
    };
  if (dementia)
    return {
      score, grade: "인지지원등급",
      headline: "인지지원등급에 해당할 가능성이 있어요",
      detail: "신체 기능은 비교적 괜찮지만 치매가 있는 경우예요. 인지지원등급은 복지용구 급여도 받을 수 있어요.",
      categories: ["wanderingSensor", "antiSlipSocks", "safetyHandle"],
    };
  return {
    score, grade: "등급외 가능성",
    headline: "아직은 등급 기준에 못 미칠 수 있어요",
    detail: "지금은 비교적 건강하신 편이에요. 다만 낙상 한 번이 큰 변화를 만드니, 욕실·현관부터 미리 준비하시길 권해요. 상태가 바뀌면 언제든 다시 신청할 수 있어요.",
    categories: ["safetyHandle", "antiSlipMat", "cane"],
  };
}
