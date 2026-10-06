import type { CategoryKey } from "@/data/products";
import type { Answers, Question } from "./quiz";

export const recommendQuestions: Question[] = [
  {
    id: "home",
    title: "어떤 집에 사세요?",
    options: [
      { label: "아파트 (엘리베이터 있음)", value: 0 },
      { label: "빌라·주택 (계단 있음)", value: 1 },
      { label: "단독주택 (마당·현관 단차)", value: 2 },
    ],
  },
  {
    id: "mobility",
    title: "평소 어떻게 움직이세요?",
    options: [
      { label: "혼자 잘 걸으세요", value: 0 },
      { label: "지팡이 또는 벽을 짚고 걸으세요", value: 1 },
      { label: "보행기·부축이 필요해요", value: 2 },
      { label: "휠체어를 쓰세요", value: 3 },
      { label: "대부분 누워 계세요", value: 4 },
    ],
  },
  {
    id: "sleep",
    title: "주무시는 곳은요?",
    options: [
      { label: "바닥에 요를 깔고 주무세요", value: 0 },
      { label: "일반 침대", value: 1 },
      { label: "간병·의료용 침대", value: 2 },
    ],
  },
  {
    id: "bathroom",
    title: "욕실은 어떤 구조인가요?",
    options: [
      { label: "욕조가 있어요", value: 0 },
      { label: "샤워 공간만 있어요", value: 1 },
    ],
  },
  {
    id: "threshold",
    title: "현관이나 욕실에 문턱(단차)이 있나요?",
    options: [
      { label: "없어요", value: 0 },
      { label: "있어요", value: 1 },
    ],
  },
  {
    id: "nightToilet",
    title: "밤에 화장실을 자주 가시나요?",
    options: [
      { label: "거의 안 가세요", value: 0 },
      { label: "1~2번", value: 1 },
      { label: "3번 이상 / 가다가 넘어질 뻔한 적 있어요", value: 2 },
    ],
  },
  {
    id: "fall",
    title: "최근 1년 안에 넘어지신 적 있나요?",
    options: [
      { label: "없어요", value: 0 },
      { label: "있어요", value: 1 },
    ],
  },
  {
    id: "wander",
    title: "혼자 나가셨다가 길을 잃으신 적 있나요?",
    options: [
      { label: "없어요", value: 0 },
      { label: "있어요 / 걱정돼요", value: 1 },
    ],
  },
];

export type Recommendation = { category: CategoryKey; reason: string; priority: number };

export function recommend(a: Answers): Recommendation[] {
  const out: Recommendation[] = [];
  const add = (category: CategoryKey, reason: string, priority: number) => {
    const existing = out.find((r) => r.category === category);
    if (existing) {
      existing.priority = Math.max(existing.priority, priority);
      return;
    }
    out.push({ category, reason, priority });
  };

  const { home = 0, mobility = 0, sleep = 0, bathroom = 0, threshold = 0, nightToilet = 0, fall = 0, wander = 0 } = a;

  // 침실
  if (mobility >= 4) {
    add("electricBed", "누워 계신 시간이 길면 등·높이 조절이 되는 전동침대가 간병 부담을 크게 줄여요.", 10);
    add("pressureMattress", "같은 자세로 오래 계시면 욕창 위험이 높아요. 매트리스부터 바꿔 주세요.", 9);
    add("positioning", "돌아눕히기 쉽게 도와주는 쿠션으로 보호자 허리도 지킬 수 있어요.", 6);
  } else if (sleep === 0 && mobility >= 1) {
    add("electricBed", "바닥에서 일어나실 때 무릎·허리에 큰 부담이 가요. 침대 높이에서 바로 서실 수 있게 해 주세요.", 8);
  } else if (sleep === 0) {
    add("manualBed", "지금은 괜찮으셔도, 바닥에서 일어나는 동작이 낙상의 시작이 되는 경우가 많아요.", 4);
  }
  if (mobility === 3) {
    add("wheelchair", "실내외 이동이 휠체어 중심이라면 가벼운 접이식이 외출을 편하게 해요.", 7);
    add("pressureCushion", "휠체어에 오래 앉아 계시면 엉덩이 욕창 예방 방석이 꼭 필요해요.", 7);
  }

  // 화장실·욕실
  if (nightToilet >= 2 || (nightToilet >= 1 && mobility >= 2)) {
    add("portableToilet", "밤중 화장실 길은 낙상이 가장 많이 일어나는 곳이에요. 침대 옆 이동변기로 동선을 없애 주세요.", 9);
  }
  if (mobility >= 1 || fall === 1) {
    add("safetyHandle", "변기·욕조 옆에서 앉고 일어설 때 잡을 곳이 있으면 낙상이 크게 줄어요.", fall ? 10 : 8);
  }
  add("antiSlip", bathroom === 0 ? "욕조 안팎은 집에서 가장 미끄러운 곳이에요." : "젖은 샤워 바닥에 미끄럼방지 매트 하나로 큰 사고를 막을 수 있어요.", fall ? 8 : 5);
  if (mobility >= 1 && mobility <= 3) {
    add("bathChair", "서서 샤워하시는 게 불안하다면 앉아서 씻는 게 훨씬 안전해요.", 6);
  }

  // 이동
  if (mobility === 1) add("cane", "지팡이를 쓰신다면 바닥에 네 발로 서는 4발 지팡이가 더 안정적이에요.", 5);
  if (mobility === 2 || (mobility === 1 && home >= 1)) {
    add("walker", "기대어 걷고 힘들 땐 앉아 쉴 수 있는 보행기로 외출 범위를 넓혀 드리세요.", 7);
  }
  if (threshold === 1 && mobility >= 2) {
    add("ramp", "보행기·휠체어는 작은 문턱에도 걸려요. 경사로로 단차를 없애 주세요.", mobility === 3 ? 8 : 6);
  }

  // 인지
  if (wander === 1) add("wanderingSensor", "혼자 나가셨을 때 위치를 바로 확인할 수 있어 보호자 마음이 놓여요.", 9);

  return out.sort((x, y) => y.priority - x.priority).slice(0, 5);
}
