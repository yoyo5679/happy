import type { CategoryKey } from "@/data/products";
import type { Answers, Question } from "./quiz";
import { collector, type Recommendation } from "./recommender";

// 어르신 몸 상태(걷기·일어서기·누워 있는 시간·피부·소변·기억)를 기준으로 한 추천
export const personQuestions: Question[] = [
  {
    id: "concern",
    title: "요즘 가장 걱정되는 게 뭐예요?",
    description: "가장 가까운 하나를 골라 주세요. 결과에서 이 부분을 먼저 챙겨 드려요.",
    options: [
      { label: "걷다가 넘어지실까 봐", value: 0 },
      { label: "오래 누워 계셔서", value: 1 },
      { label: "화장실·소변 실수", value: 2 },
      { label: "깜빡하시거나 길을 잃으실까 봐", value: 3 },
      { label: "혼자 외출이 힘드셔서", value: 4 },
    ],
  },
  {
    id: "walk",
    title: "평소 어떻게 걸으세요?",
    options: [
      { label: "혼자 잘 걸으세요", value: 0 },
      { label: "조금만 걸어도 다리가 아프거나 휘청거리세요", value: 1 },
      { label: "지팡이를 짚으세요", value: 2 },
      { label: "보행기를 쓰시거나 부축이 필요해요", value: 3 },
      { label: "주로 휠체어를 타세요", value: 4 },
      { label: "거의 걷지 못하세요", value: 5 },
    ],
  },
  {
    id: "stand",
    title: "의자나 침대에서 일어나실 때는요?",
    options: [
      { label: "쉽게 일어나세요", value: 0 },
      { label: "손으로 무언가를 짚어야 일어나세요", value: 1 },
      { label: "누가 잡아 드려야 일어나세요", value: 2 },
    ],
  },
  {
    id: "lying",
    title: "하루 중 누워 계시는 시간은요?",
    options: [
      { label: "밤에 주무실 때만", value: 0 },
      { label: "낮에도 반나절 정도", value: 1 },
      { label: "하루 대부분", value: 2 },
    ],
  },
  {
    id: "sitting",
    title: "의자나 휠체어에 오래 앉아 계시나요?",
    options: [
      { label: "아니요, 자주 움직이세요", value: 0 },
      { label: "네, 하루 몇 시간씩 앉아 계세요", value: 1 },
    ],
  },
  {
    id: "skin",
    title: "엉덩이·꼬리뼈·등 피부 상태는요?",
    options: [
      { label: "괜찮아요", value: 0 },
      { label: "빨갛게 눌린 자국이 잘 안 없어져요", value: 1 },
      { label: "욕창이 있어요", value: 2 },
    ],
  },
  {
    id: "continence",
    title: "소변 조절은 어떠세요?",
    options: [
      { label: "괜찮아요", value: 0 },
      { label: "기침하거나 급할 때 가끔 새요", value: 1 },
      { label: "자주 새거나 기저귀를 쓰세요", value: 2 },
    ],
  },
  {
    id: "memory",
    title: "기억력은 어떠세요?",
    options: [
      { label: "괜찮아요", value: 0 },
      { label: "가끔 깜빡하세요", value: 1 },
      { label: "길을 잃으신 적이 있어요", value: 2 },
    ],
  },
  {
    id: "outing",
    title: "바깥 외출은 얼마나 하세요?",
    options: [
      { label: "거의 안 나가세요", value: 0 },
      { label: "가까운 곳만 가끔", value: 1 },
      { label: "병원·시장·산책 등 자주 나가세요", value: 2 },
    ],
  },
];

const CONCERN: CategoryKey[][] = [
  ["safetyHandle", "antiSlipSocks", "cane", "walker"],
  ["electricBed", "pressureMattress", "positioning", "pressureCushion"],
  ["incontinence", "portableToilet", "simpleToilet"],
  ["wanderingSensor", "antiSlipSocks"],
  ["walker", "wheelchair", "cane"],
];

export function recommendPerson(a: Answers): Recommendation[] {
  const { concern = 0, walk = 0, stand = 0, lying = 0, sitting = 0, skin = 0, continence = 0, memory = 0, outing = 0 } = a;
  const c = collector();
  const bedridden = walk === 5 || lying === 2;

  // 걷기
  if (walk === 1) {
    c.add("cane", "다리에 힘이 빠지기 시작할 때 지팡이 하나가 넘어짐을 크게 줄여요.", 6);
    c.add("antiSlipSocks", "휘청이실 때 실내 미끄러짐이 가장 위험해요. 바닥이 고무 처리된 양말로 바꿔 주세요.", 5);
  }
  if (walk === 2) {
    c.add("cane", "일반 지팡이가 불안하다면 바닥을 네 발로 짚는 지팡이가 더 안정적이에요.", 6);
    c.add("walker", "지팡이로도 불안하시다면 양손으로 기대는 보행기가 훨씬 안전해요.", outing >= 1 ? 8 : 6);
  }
  if (walk === 3) {
    c.add("walker", "기대어 걷고 힘들 땐 바로 앉아 쉴 수 있어 혼자 걷는 시간이 늘어나요.", 9);
    if (outing >= 1) c.add("wheelchair", "먼 외출이나 병원 갈 때는 접이식 휠체어가 있으면 보호자도 편해요.", 6);
  }
  if (walk === 4) {
    c.add("wheelchair", "몸에 맞는 가벼운 휠체어는 실내외 이동과 외출을 함께 편하게 해요.", 10);
    c.add("pressureCushion", "휠체어에 앉아 계시는 시간이 길면 엉덩이 욕창 예방 방석이 꼭 필요해요.", 8);
  }

  // 누워 계시는 시간
  if (bedridden) {
    c.add("electricBed", "등·다리·높이 조절로 식사·기저귀 교체·일어나기가 모두 쉬워져요.", 10);
    c.add("pressureMattress", "하루 대부분 누워 계시면 욕창 위험이 높아요. 매트리스부터 바꿔 주세요.", 9);
    c.add("positioning", "2시간마다 돌아눕혀 드릴 때 쿠션이 있으면 자세가 유지되고 보호자 허리도 지켜요.", 7);
    c.add("simpleToilet", "누운 채로 용변을 보실 수 있어 밤중 간병이 한결 수월해져요.", 6);
    c.add("bathtub", "욕실까지 옮기지 않고 방 안에서 목욕할 수 있어요.", 5);
  } else if (lying === 1) {
    c.add("electricBed", "낮에도 누워 계신다면 등받이를 세워 식사·TV 시청을 편하게 하실 수 있어요.", 7);
  }

  // 일어서기
  if (stand >= 1 && !bedridden) {
    c.add("safetyHandle", "앉았다 일어서는 순간이 넘어짐이 가장 많은 때예요. 잡을 곳을 만들어 드리세요.", stand === 2 ? 9 : 8);
  }
  if (stand === 2 && !bedridden) {
    c.add("electricBed", "침대 높이를 올려 드리면 무릎에 힘이 덜 들어 혼자 일어서기 쉬워져요.", 7);
  }

  // 피부
  if (skin >= 1) {
    if (lying >= 1 || bedridden) c.add("pressureMattress", "눌린 자국이 안 없어지는 건 욕창의 첫 신호예요. 체압을 분산하는 매트리스가 필요해요.", skin === 2 ? 10 : 9);
    if (sitting === 1 || walk === 4) c.add("pressureCushion", "앉아 계실 때 엉덩이에 압력이 몰리지 않도록 방석을 바꿔 주세요.", skin === 2 ? 10 : 9);
    if (skin === 2) c.add("positioning", "욕창이 있을 땐 같은 부위가 눌리지 않게 자세를 자주 바꿔 드려야 해요.", 8);
    if (!c.has("pressureMattress") && !c.has("pressureCushion")) {
      c.add("pressureCushion", "피부가 쉽게 눌린다면 오래 앉는 자리부터 압력을 분산해 주세요.", 7);
    }
  } else if (sitting === 1 && walk >= 3) {
    c.add("pressureCushion", "오래 앉아 계시면 아직 괜찮더라도 미리 욕창 예방 방석을 쓰시는 게 좋아요.", 6);
  }

  // 소변
  if (continence >= 1) {
    c.add("incontinence", "패드가 내장된 팬티라 일반 속옷처럼 입으시고 외출도 안심하실 수 있어요.", continence === 2 ? 9 : 8);
  }
  if (continence === 2 && walk >= 2 && !bedridden) {
    c.add("portableToilet", "급할 때 화장실까지 가기 어렵다면 침대 옆 이동변기가 실수와 낙상을 함께 줄여요.", 7);
  }
  if (continence >= 1 && bedridden) {
    c.add("simpleToilet", "누운 채로 쓰는 소변기로 밤중 실수와 기저귀 교체를 줄일 수 있어요.", 7);
  }

  // 기억
  if (memory === 2) c.add("wanderingSensor", "혼자 나가셨을 때 위치를 바로 확인할 수 있어 보호자 마음이 놓여요.", 10);
  if (memory >= 1 && walk <= 3) {
    c.add("antiSlipSocks", "깜빡하시고 양말 바람으로 다니다 미끄러지시는 경우가 많아요.", 5);
  }

  // 아직 건강하신 경우에도 기본 낙상 예방
  if (walk <= 1) {
    c.add("safetyHandle", "아직 괜찮으셔도 욕실·변기 옆 손잡이 하나가 가장 확실한 낙상 예방이에요.", 4);
    c.add("antiSlipSocks", "실내 미끄럼 사고를 막는 가장 손쉬운 방법이에요.", 3);
  }

  c.boost(CONCERN[concern] ?? [], 3);
  return c.finish();
}
