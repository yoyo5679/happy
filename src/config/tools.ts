// 홈 화면·기관용 화면·결과 화면 하단 링크에 쓰는 도구 목록 (이 순서대로 노출)
export const tools = [
  {
    href: "/person",
    emoji: "👵",
    title: "어르신 상태로 찾기",
    short: "어르신 상태로 찾기",
    desc: "걷기·일어서기·피부·소변 상태에 꼭 맞는 용품을 골라 드려요.",
  },
  {
    href: "/rooms",
    emoji: "🏠",
    title: "우리 집에서 찾기",
    short: "우리 집에서 찾기",
    desc: "욕실·침실·거실·현관별로 보거나 1분 안전 점검을 해요.",
  },
  {
    href: "/grade",
    emoji: "📋",
    title: "등급·혜택 확인",
    short: "등급·혜택 확인하기",
    desc: "18개 질문으로 예상 등급과 160만원 지원 대상인지 확인해요.",
  },
] as const;
