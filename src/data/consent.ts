// 웹 장부(/my) 이용 동의서 문구 — 웹 동의 화면 · 인쇄용 동의서(/consent) · 처리방침(/privacy)이 같이 씁니다.
// 문구를 바꾸면 CONSENT_VERSION도 올려 주세요 (누가 어느 문구에 동의했는지 기록됩니다).
import { site } from "@/config/site";

export const CONSENT_VERSION = "2026-11-v2";

export const RETENTION = "동의를 철회하시거나, 마지막 이용일로부터 3년이 지나면 지체 없이 파기합니다.";

export type ConsentSection = {
  key: "collect" | "sensitive" | "guardian" | "overseas" | "marketing";
  title: string;
  required: boolean;
  rows: [string, string][];
};

export const consentSections: ConsentSection[] = [
  {
    key: "collect",
    title: "개인정보 수집·이용 동의",
    required: true,
    rows: [
      ["목적", "복지용구 이용 현황(남은 한도·구입·대여 내역) 안내, 대여 만료·내구연한 등 이용 안내, 상담"],
      [
        "항목",
        "어르신 성함, 보호자 휴대폰 번호(원문은 저장하지 않고 되돌릴 수 없는 대조값으로만 보관), 복지용구 구입·대여 품목·금액·기간, 연 한도 적용기간·남은 금액, 동의하신 분의 성함·관계(동의 증빙)",
      ],
      ["보유기간", RETENTION],
    ],
  },
  {
    key: "sensitive",
    title: "민감정보 처리 동의",
    required: true,
    rows: [
      ["목적", "본인부담금과 남은 한도 계산"],
      ["항목", "장기요양 수급 사실(복지용구 이용 내역), 본인부담률(감경·기초수급 여부가 드러날 수 있음) · 등급과 질환 정보는 수집하지 않습니다"],
      ["보유기간", RETENTION],
    ],
  },
  {
    key: "guardian",
    title: "보호자(가족) 열람 동의",
    required: true,
    rows: [
      ["받는 사람", "위 보호자 및 보호자가 링크를 전달한 가족"],
      ["목적", "어르신의 복지용구 이용 현황 확인"],
      ["항목", "어르신 성함(일부 가림), 본인부담률, 이용 품목·금액, 남은 한도"],
      ["방법", "해피케어가 보내드린 전용 링크로 열람 (링크가 다른 사람에게 넘어가지 않도록 주의해 주세요)"],
    ],
  },
  {
    key: "overseas",
    title: "개인정보 국외 이전 동의",
    required: true,
    rows: [
      ["받는 자", "Cloudflare, Inc. (privacy@cloudflare.com)"],
      ["이전 국가", "미국 및 Cloudflare 데이터센터가 있는 국가"],
      ["시기·방법", "장부에 입력·조회할 때마다 네트워크로 전송되어 보관"],
      ["목적", "웹 장부 서버·데이터베이스 운영(보관)"],
      ["항목", "위 수집·민감정보 항목 전체"],
      ["보유기간", RETENTION],
    ],
  },
  {
    key: "marketing",
    title: "광고성 정보 수신 동의",
    required: false,
    rows: [
      ["내용", "내구연한이 지나 새로 받을 수 있는 품목, 남은 한도로 이용할 수 있는 품목 등 안내"],
      ["방법", "카카오톡·문자·전화"],
      ["보유기간", "수신 동의를 철회할 때까지"],
    ],
  },
];

export const consentNotice = [
  "위 동의를 거부하실 수 있습니다. 필수 항목에 동의하지 않으시면 웹 장부(이용 현황 링크)만 이용하실 수 없고, 복지용구 구입·대여와 공단 청구는 그대로 이용하실 수 있습니다.",
  "광고성 정보 수신은 선택이며, 동의하지 않아도 웹 장부를 이용하실 수 있습니다.",
  `동의는 언제든 이용 현황 화면의 '동의 철회' 버튼이나 ${site.phone}로 철회하실 수 있습니다.`,
];

export const relations = ["본인", "배우자", "아들", "딸", "며느리", "사위", "손자녀", "기타 가족", "법정대리인"];

