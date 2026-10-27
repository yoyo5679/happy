// 홈 화면·기관용 화면·결과 화면 하단 링크에 쓰는 도구 목록 (이 순서대로 노출)
export const tools = [
  {
    href: "/rooms",
    emoji: "🏠",
    title: "장소별로 찾기",
    short: "장소별로 찾기",
    desc: "욕실·침실·거실·현관마다 필요한 용품을 보거나 1분 안전 점검을 해요.",
  },
  {
    href: "/person",
    emoji: "👵",
    title: "어르신 상태로 찾기",
    short: "어르신 상태로 찾기",
    desc: "걷기·일어서기·피부·소변 상태에 꼭 맞는 용품을 골라 드려요.",
  },
  {
    href: "/budget",
    emoji: "💰",
    title: "예산으로 세트 짜기",
    short: "예산으로 세트 짜기",
    desc: "쓸 금액과 필요한 것을 고르면 실속·표준·든든 세트를 짜 드려요.",
  },
  {
    href: "/grade",
    emoji: "📋",
    title: "등급·혜택 확인",
    short: "등급·혜택 확인하기",
    desc: "18개 질문으로 예상 등급과 160만원 지원 대상인지 확인해요.",
  },
] as const;
