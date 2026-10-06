// ✏️ 매장 정보
export const site = {
  name: "해피케어복지용구",
  /** 쇼핑몰 메인 주소 */
  storeUrl: "https://happycaremall.com/index",
  /**
   * 쇼핑몰 검색 결과 주소 형식. {q} 자리에 상품 모델명이 들어갑니다.
   * 예) "https://happycaremall.com/search?keyword={q}"
   * 비워 두면 상품별 링크(src/data/productLinks.ts)가 없는 상품은 쇼핑몰 메인으로 연결됩니다.
   */
  searchUrl: "",
  /** 상담 전화번호 (tel: 링크로 사용) */
  phone: "1588-0000",
  /** 카카오톡 채널 채팅 링크 (없으면 빈 문자열) */
  kakaoUrl: "",
  /** 배포 주소 (공유/OG 태그용) */
  siteUrl: "https://happycare-tools.vercel.app",
};
