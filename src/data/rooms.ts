import type { CategoryKey } from "./products";

export type RoomKey = "living" | "bedroom" | "bath" | "entrance";

export const rooms: Record<RoomKey, { label: string; emoji: string; intro: string; items: { category: CategoryKey; reason: string }[] }> = {
  living: {
    label: "거실·주방",
    emoji: "🛋️",
    intro: "하루 중 가장 오래 움직이는 공간이에요. 걷고, 앉고, 일어서는 동작을 안전하게.",
    items: [
      { category: "walker", reason: "가구를 짚고 다니신다면 실내용 보행기로 기대어 걸으세요." },
      { category: "antiSlipSocks", reason: "마루·장판 위 양말은 미끄러워요. 바닥이 고무 처리된 양말로." },
      { category: "cane", reason: "걸음이 조금 불안하실 때 가장 먼저 준비하는 보조기구예요." },
      { category: "pressureCushion", reason: "소파·의자에 오래 앉아 계신다면 엉덩이 압력을 나눠 주세요." },
      { category: "wheelchair", reason: "실내 이동이 어려우시면 가벼운 접이식 휠체어를." },
    ],
  },
  bedroom: {
    label: "침실",
    emoji: "🛏️",
    intro: "잠자리에서 일어나는 순간과 밤중 화장실 길이 가장 위험해요.",
    items: [
      { category: "electricBed", reason: "높이·등받이 조절로 혼자 일어나기 쉬워지고 간병도 편해져요." },
      { category: "pressureMattress", reason: "오래 누워 계시면 욕창 예방 매트리스가 꼭 필요해요." },
      { category: "portableToilet", reason: "밤중 화장실 길을 없애 낙상을 막아요." },
      { category: "positioning", reason: "돌아눕기·자세 유지를 도와 욕창과 보호자 허리를 지켜요." },
      { category: "simpleToilet", reason: "누운 채로 용변을 볼 수 있어 밤중 간병이 수월해요." },
      { category: "incontinence", reason: "밤사이 실수가 걱정되면 패드 내장 팬티로." },
    ],
  },
  bath: {
    label: "욕실",
    emoji: "🛁",
    intro: "집에서 낙상이 가장 많이 일어나는 곳이에요. 가장 먼저 정비해 주세요.",
    items: [
      { category: "safetyHandle", reason: "변기·욕조 옆 손잡이는 가장 효과가 큰 낙상 예방 용품이에요." },
      { category: "antiSlipMat", reason: "젖은 바닥에 미끄럼방지 매트 한 장으로 큰 사고를 막아요." },
      { category: "bathChair", reason: "앉아서 씻으면 미끄러질 위험이 크게 줄어요." },
      { category: "bathtub", reason: "욕실까지 이동이 어려우면 방에서 쓰는 이동욕조를." },
    ],
  },
  entrance: {
    label: "현관·외부",
    emoji: "🚪",
    intro: "문턱과 신발 신는 순간, 그리고 바깥 외출을 안전하게.",
    items: [
      { category: "ramp", reason: "현관·방 문턱 단차를 없애 걸려 넘어지지 않게." },
      { category: "safetyHandle", reason: "신발 신고 벗을 때 잡을 지지대를 놓아 주세요." },
      { category: "walker", reason: "기대어 걷고 앉아 쉴 수 있는 실버카로 외출을 편하게." },
      { category: "wheelchair", reason: "먼 외출·병원 방문엔 접이식 휠체어가 있으면 든든해요." },
      { category: "wanderingSensor", reason: "혼자 나가셨을 때 위치를 바로 확인할 수 있어요." },
    ],
  },
};

export const roomOrder: RoomKey[] = ["living", "bedroom", "bath", "entrance"];
