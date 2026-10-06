# 해피케어복지용구 — 고객 참여형 돌봄 자가진단 툴

블로그·유튜브 방문자가 클릭 몇 번으로 답하면 맞춤 결과를 보여주고, 결과 화면에서 스토어 상품 페이지로 자연스럽게 연결하는 리드 생성용 웹 툴입니다.

| 경로 | 기능 |
|---|---|
| `/` | 첫 화면: 보호자용/기관 선생님용 탭 + 세 도구 (순서는 `src/config/tools.ts`) |
| `/person` | ① 어르신 상태로 찾기 (9문항: 걱정·걷기·일어서기·누워 있는 시간·피부·소변·기억·외출 → Top 5) |
| `/rooms` | ② 우리 집에서 찾기 (직접 그린 평면도에서 욕실·침실·거실·현관 선택, `?room=bath` 바로가기) + 1분 안전 점검 연결 |
| `/check` | ② 안의 가정 낙상 위험 점검표 (13개 항목 → 위험도 + 필요 용품) |
| `/grade` | ③ 등급·혜택 확인 (12문항 장기요양등급 모의 계산 → 예상 등급 + 추천 용품) |
| `/recommend` | 예전 질문형 '집 맞춤' 주소 → `/rooms`로 자동 연결 |
| `/partner` | 방문요양기관 선생님용 도우미 (도구 모음, 품목별 내구연한·급여한도, 본인부담률 표) |
| `/catalog` | 해피케어몰 진열 상품 전체(344개 모델) + 본인부담률(15/9/6/0%)별 본인부담금 |

## 상품 데이터

**쇼핑몰(happycaremall.com)에 진열된 상품이 기준**입니다. 모든 상품 카드는 쇼핑몰의 해당 상품 페이지로 바로 연결됩니다.

- **`src/data/products.json`** — 쇼핑몰 상품 엑셀에서 생성. 모델별 대여(월)/구입 가격, 상품 URL, 품절 여부, 이미지
  - 카탈로그와 모델명이 일치하는 상품(259개)은 급여코드와 카탈로그 사진(`public/products/`)을 붙였고, 나머지는 쇼핑몰 대표 이미지를 씁니다.
  - 품절 상품은 추천 결과에 나오지 않고, 전체 모델 페이지에서는 맨 뒤에 "품절"로 표시됩니다.
  - 본인부담금은 쇼핑몰과 같이 10원 미만 절사합니다.
- **`src/data/products.ts`** — 품목 이름/설명, 결과 화면에 먼저 보여줄 상품(`featured`) 지정

## 상품 갱신 (쇼핑몰 상품을 추가·수정했을 때)

아임웹 관리자에서 상품 엑셀을 다시 내려받아 실행하세요 (Python `openpyxl` 필요).

```bash
python3 scripts/catalog/build_from_mall.py 상품목록.xlsx scripts/catalog/catalog.json src/data/products.json
```

`scripts/catalog/catalog.json`은 이로움케어 카탈로그 PDF에서 추출한 급여코드·가격 데이터이고(`parse_prices.py`, `extract_images.py`로 생성), 쇼핑몰 상품과 모델명으로 매칭하는 데 씁니다.

## 유입 채널 추적

링크 뒤에 `?src=채널명`을 붙여 홍보하세요.

- 블로그: `https://<배포주소>/?src=blog`
- 유튜브 설명란: `https://<배포주소>/person?src=youtube`

상품 링크로 이동할 때 `utm_source=youtube&utm_medium=care_tool&utm_campaign=grade_check&utm_content=<상품id>`가 자동으로 붙어, 스토어 통계에서 어느 채널·어느 도구가 매출로 이어졌는지 확인할 수 있습니다.

## 결과 보내기

모든 결과 화면의 "📩 결과 보내기"는 답변을 링크(`?a=…&r=…`)에 담아 보냅니다. 받은 사람은 같은 결과 화면을 보고, `src`(채널·영업사원·기관 코드)도 함께 전달되어 쇼핑몰 통계에 잡힙니다.

## 방문요양기관 영업 자료 (`marketing/`)

- `해피케어_방문요양기관_소개자료.pdf` — A4 소개 자료 (인쇄용)
- `qr-agency_happycare.png` — 기관 전용 QR (`/partner?src=agency_happycare`)
- `leaflet-agency.html` — 소개 자료 원본 (문구 수정 후 브라우저 인쇄 → PDF 저장)

다른 기관용 QR은 `src=agency_기관코드`만 바꿔 만들면 됩니다.

> 기관에 수급자 소개의 대가(금품·수수료 등)를 제공하거나 약속하는 것은 노인장기요양보험법상 금지됩니다. 기관 코드는 영업 관리용으로만 사용하세요.

## 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
```

## 배포 (Cloudflare Pages, 무료)

사이트는 정적 HTML로 내보냅니다(`next.config.ts`의 `output: "export"` → `out/` 폴더). 서버가 필요 없어 어느 정적 호스팅에도 올릴 수 있습니다.

1. https://dash.cloudflare.com 가입 → **Workers & Pages → Create → Pages → Connect to Git**
2. GitHub 연결 후 저장소 `yoyo5679/happy` 선택
3. 빌드 설정
   - Production branch: 배포할 브랜치
   - Framework preset: **Next.js (Static HTML Export)**
   - Build command: `npx next build`
   - Build output directory: `out`
   - Node 버전은 `.node-version`(22)으로 지정됨
4. **Save and Deploy** → `프로젝트이름.pages.dev` 주소가 생깁니다.
5. 내 도메인: 프로젝트 → **Custom domains** → `care.happycaremall.com` 추가 → 안내되는 CNAME 값을 도메인 관리 화면에 등록
6. 최종 주소가 정해지면 `src/config/site.ts`의 `siteUrl`을 바꿔 주세요 (공유 미리보기용).

이후 GitHub에 push할 때마다 자동으로 다시 배포됩니다.

## 주의

등급 예상은 공단 인정조사(52개 항목)를 단순화한 **참고용 모의 계산**입니다. 화면 하단과 결과에 실제 판정은 국민건강보험공단이 한다는 안내가 들어가 있습니다. 점수 기준은 `src/lib/grade.ts`, 추천 규칙은 `src/lib/person.ts`(어르신)·`src/lib/check.ts`(안전 점검)·`src/data/rooms.ts`(장소별)에서 조정할 수 있습니다.
