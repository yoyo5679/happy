// 홈 화면과 결과 화면 하단 링크에 쓰는 도구 목록 (이 순서대로 노출)
export const tools = [
  {
    href: "/person",
    emoji: "👵",
    title: "어르신 맞춤 복지용구 추천",
    short: "어르신 맞춤 용품 추천받기",
    desc: "걷기·일어서기·피부·소변 상태에 꼭 맞는 용품을 골라 드려요.",
  },
  {
    href: "/recommend",
    emoji: "🏠",
    title: "우리 집 맞춤 복지용구 추천",
    short: "우리 집 맞춤 용품 추천받기",
    desc: "집 구조와 생활 동선에 맞는 낙상 예방 용품을 골라 드려요.",
  },
  {
    href: "/grade",
    emoji: "📋",
    title: "장기요양등급 모의 계산",
    short: "장기요양등급 모의 계산하기",
    desc: "12개 질문으로 1~5등급·인지지원등급 가능성을 확인해요.",
  },
] as const;
