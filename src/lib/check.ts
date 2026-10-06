import type { CategoryKey } from "@/data/products";
import type { Answers, Question } from "./quiz";
import { collector, type Recommendation } from "./recommender";

// 가정 낙상 위험 점검표: 해당하면 '예'(1). 공유 링크 인코딩을 위해 Question 형식을 씁니다.
type CheckItem = Question & { area: string; category: CategoryKey; reason: string; priority: number };

const yn = [
  { label: "아니요", value: 0 },
  { label: "예", value: 1 },
];

const item = (id: string, area: string, title: string, category: CategoryKey, reason: string, priority: number): CheckItem => ({
  id, area, title, options: yn, category, reason, priority,
});

export const checkItems: CheckItem[] = [
  item("door", "현관", "현관이나 방 문턱에 단차가 있다", "ramp", "문턱은 발이 걸려 넘어지기 가장 쉬운 곳이에요. 경사로로 단차를 없애 주세요.", 6),
  item("shoes", "현관", "신발을 신고 벗을 때 잡을 곳이 없다", "safetyHandle", "현관에서 한 발로 서는 순간 균형을 잃기 쉬워요. 지지 손잡이를 놓아 주세요.", 7),
  item("floor", "거실·복도", "바닥이 미끄럽거나 양말만 신고 다니신다", "antiSlipSocks", "미끄럼방지 양말 하나로 실내 미끄럼 사고를 크게 줄일 수 있어요.", 6),
  item("hall", "거실·복도", "이동할 때 벽이나 가구를 짚고 다니신다", "walker", "가구를 짚고 다니실 정도면 실내용 보행기가 훨씬 안전해요.", 7),
  item("bedlow", "침실", "바닥에서 주무시거나 침대가 낮다", "electricBed", "바닥·낮은 침대에서 일어나는 동작이 낙상의 시작이 되는 경우가 많아요.", 8),
  item("bedgrab", "침실", "침대에서 일어날 때 잡을 곳이 없다", "safetyHandle", "침대 옆 지지대가 있으면 혼자 일어서기가 쉬워져요.", 7),
  item("night", "침실", "밤에 화장실 가는 길이 멀거나 어둡다", "portableToilet", "밤중 화장실 길은 낙상이 가장 많은 곳이에요. 침대 옆 이동변기로 동선을 없애 주세요.", 8),
  item("bathfloor", "욕실·화장실", "욕실 바닥이 미끄럽다", "antiSlipMat", "젖은 욕실 바닥은 집에서 가장 위험한 곳이에요. 미끄럼방지 매트를 깔아 주세요.", 8),
  item("toilet", "욕실·화장실", "변기에서 일어나실 때 힘들어하신다", "safetyHandle", "변기 옆 안전손잡이는 가장 효과가 큰 낙상 예방 용품이에요.", 9),
  item("shower", "욕실·화장실", "서서 샤워하시거나 욕조를 넘어 들어가신다", "bathChair", "앉아서 씻으면 미끄러질 위험이 크게 줄어요.", 7),
  item("fell", "어르신", "최근 1년 안에 넘어지신 적이 있다", "safetyHandle", "한 번 넘어지신 분은 다시 넘어질 위험이 높아요. 손잡이부터 설치해 주세요.", 10),
  item("cane", "어르신", "걸음이 불안하지만 지팡이·보행기 없이 다니신다", "cane", "걸음이 불안하시다면 지팡이로 지지점을 하나 더 만들어 드리세요.", 6),
  item("lost", "어르신", "혼자 나가셨다가 길을 잃으신 적이 있다", "wanderingSensor", "위치를 바로 확인할 수 있어 보호자 마음이 놓여요.", 9),
];

export const checkAreas = [...new Set(checkItems.map((i) => i.area))];

export type CheckResult = { count: number; level: "낮음" | "주의" | "높음"; recs: Recommendation[] };

export function evaluateCheck(a: Answers): CheckResult {
  const c = collector();
  let count = 0;
  for (const i of checkItems) {
    if (a[i.id] === 1) {
      count++;
      c.add(i.category, i.reason, i.priority);
    }
  }
  const level = count >= 5 || a.fell === 1 ? "높음" : count >= 2 ? "주의" : "낮음";
  return { count, level, recs: c.finish() };
}
