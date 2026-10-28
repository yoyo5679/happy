# 해피케어복지용구 — 고객 참여형 돌봄 자가진단 툴

블로그·유튜브 방문자가 클릭 몇 번으로 답하면 맞춤 결과를 보여주고, 결과 화면에서 스토어 상품 페이지로 자연스럽게 연결하는 리드 생성용 웹 툴입니다.

| 경로 | 기능 |
|---|---|
| `/` | 첫 화면: 보호자용/기관 선생님용 탭 + 세 도구 (순서는 `src/config/tools.ts`) |
| `/person` | ② 어르신 상태로 찾기 (9문항: 걱정·걷기·일어서기·누워 있는 시간·피부·소변·기억·외출 → Top 5) |
| `/rooms` | ① 장소별로 찾기 (직접 그린 평면도에서 욕실·침실·거실·현관 선택, `?room=bath` 바로가기) + 1분 안전 점검 연결 |
| `/check` | ② 안의 가정 낙상 위험 점검표 (13개 항목 → 위험도 + 필요 용품) |
| `/grade` | ③ 등급·혜택 확인 (공식 인정조사표 5개 영역을 따른 18문항 장기요양등급 모의 계산, 결과에 '어떻게 계산했나요?' 설명 → 예상 등급 + 추천 용품) |
| `/recommend` | 예전 질문형 '집 맞춤' 주소 → `/rooms`로 자동 연결 |
| `/partner` | 방문요양기관 선생님용 도우미 (도구 모음, 품목별 내구연한·급여한도, 본인부담률 표) |
| `/budget` | 예산으로 세트 짜기 (160만원 중 쓸 금액 + 필요한 묶음 → 선택한 예산 기준 실속형(가장 합리적인 모델)·표준형(실속형과 예산의 중간)·든든형(예산에 가장 가깝게, 수량은 `QTY_CAP` 급여 수량 한도 안에서) 세트, 대여는 기본 3개월, `?c=품목,품목`·`?g=묶음`·`?b=금액`으로 미리 채우기) |
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

- 블로그: `https://happycare.pages.dev/?src=blog`
- 유튜브 설명란: `https://happycare.pages.dev/person?src=youtube`

상품 링크로 이동할 때 `utm_source=youtube&utm_medium=care_tool&utm_campaign=grade_check&utm_content=<상품id>`가 자동으로 붙어, 스토어 통계에서 어느 채널·어느 도구가 매출로 이어졌는지 확인할 수 있습니다.

## 등급별 혜택 (매년 1월 갱신)

`src/data/benefits.ts` — 2026년 재가급여 월 한도액(1등급 2,512,900원 ~ 인지지원등급 676,320원), 복지용구 연 160만원, 등급별 이용 서비스·시설 입소 여부. 등급 결과 화면의 혜택 카드에 쓰입니다.

## 쇼핑몰 장바구니 담기 (/budget)

예산 세트(실속·표준·든든) 카드마다 "🛒 세트 장바구니에 담기" 버튼이 있어요. 누르면 해피케어몰 장바구니로 가서 세트 상품이 한 번에 담깁니다.

- 주소: `https://happycaremall.com/shop_cart?hc_cart=1330r,1004x4&hc_r=15&hc_m=3` (`src/lib/cart.ts`에서 만듦)
  - `hc_cart`: 쇼핑몰 상품번호(idx) + `r`(대여) + `x수량` · `hc_r`: 본인부담률(%) · `hc_m`: 대여 개월
- 담는 일은 쇼핑몰 쪽 스크립트 **`imweb/cart-import.html`** 이 합니다. 아임웹 관리자 → 설정 → SEO → 고급 설정 → 공통 코드 삽입 → **Footer Code** 맨 끝에 붙여 넣고 저장하세요.
  - 상품마다 필수옵션을 읽어 본인부담률(`15%`·`9%`·`6%`·`0%` 글자로 찾음) → 대여기간(고른 개월 이하에서 가장 긴 기간 + 모자란 달은 `1개월 연장`) → 색상 등 나머지는 첫 번째 값으로 고릅니다.
  - 기간 옵션 없이 월 단위로 등록된 대여 상품(정상가 10만원 미만)은 개월 수만큼 담습니다.
  - 이미 장바구니에 있는 상품은 건너뛰고, 품절·판매중지 상품은 담지 않고 결과 창에 알려 줍니다.
  - 쇼핑몰 옵션 이름 규칙(`본인부담금 15%(…)`, `일반 15%(월 …원)`, `3개월`·`6개월`·`1개월 연장`)을 바꾸면 이 스크립트도 확인하세요.
  - Footer Code 편집기는 HTML 기호를 풀어서 저장하므로 이 스크립트에는 HTML 기호를 쓰지 않습니다.
- 아임웹은 배송방법(택배·직접배송)이 다른 상품을 한 주문으로 결제하지 못합니다("배송방법이 일치하는 상품끼리 결제할 수 있습니다"). 그래서 "전동침대 방문설치" 배송 템플릿도 **택배**(무료)로 두고, **`imweb/install-label.html`**(Footer Code)이 상품 상세·장바구니의 전동침대 배송 방법을 '방문설치'로 바꿔 보여 줍니다. 장바구니에서는 상품명 앞 `|전동침대|`로 침대 줄을 알아봅니다.
- 장바구니에 담기는 가격은 쇼핑몰 기준이라, 쇼핑몰 상품을 바꾼 뒤에는 위 "상품 갱신"으로 `products.json`도 꼭 다시 만들어 주세요 (안 그러면 도구 화면 금액과 장바구니 금액이 달라져요).

## 쇼핑몰 카테고리 필터 칩 (Footer Code)

쇼핑몰 카테고리 페이지의 필터 칩을 품목마다 다르게 보여 줍니다 (예: 지팡이 = 네발·가벼운 300g 이하·100cm 이상 길게, 전동침대 = 최저·최고 높이·등판 각도·최대하중·폭). 복지용구는 본인부담금이 정해져 있어 가격대 칩은 쓰지 않습니다. `PAGES`에서 메뉴를 `"KEEP"`으로 두면 그 페이지는 쇼핑몰 원래 칩을 그대로 씁니다.

- 쇼핑몰 쪽 코드: **`imweb/category-filter.html`** (Footer Code 맨 끝에 붙여 넣기). 칩을 누르면 그 카테고리 상품 전체를 아임웹 목록 API로 한 번 받아 함께 거르고, 결과는 12개씩 보여 줍니다.
- 칩 데이터: **`public/imweb/filters.json`** → `https://happycare.pages.dev/imweb/filters.json` (`public/_headers`로 쇼핑몰에서 읽기 허용)
- 상품이 바뀌면 관리자 상품 → 엑셀 다운로드 → **상품 정보 일괄 수정용**(요약설명 규격표 포함)을 받아 다시 만들고 배포하세요.

```bash
python3 scripts/catalog/build_filters.py 상품정보수정용.xlsx public/imweb/filters.json
```

칩 이름·기준은 `scripts/catalog/build_filters.py`의 `RULES`, 메뉴 주소와 품목 연결은 `PAGES`에서 바꿉니다. 판별은 상품명 앞 `|분류|`와 요약설명의 '제품 주요규격' 표(중량·규격·재질·계절·흡수량 등)를 씁니다.

## 쇼핑몰 메뉴 링크 보정 (Footer Code)

- **`imweb/category-tab-fix.html`**: 카테고리 페이지 가운데 탭에서 하위 분류가 있는 탭(성인용보행기·안전손잡이·양말·요실금팬티)을 누르면 그 분류의 '전체'로 이동
- **`imweb/home-icon-fix.html`**: 메인 아이콘 메뉴의 '성인용 보행기'(/walker 워커만) → /walker-all, '안전손잡이'(/grab-bar-pole 기둥형만) → /grab-bar. 디자인 모드에서 위젯 링크를 직접 고치면 필요 없음

## 결과 보내기

모든 결과 화면의 "📩 결과 보내기"는 답변을 링크(`?a=…&r=…`)에 담아 보냅니다. 받은 사람은 같은 결과 화면을 보고, `src`(채널·영업사원·기관 코드)도 함께 전달되어 쇼핑몰 통계에 잡힙니다.

## 방문요양기관 영업 자료 (`marketing/`)

- `해피케어_방문요양기관_소개자료.pdf` — A4 소개 자료 (인쇄용)
- `qr-agency_happycare.png` — 기관 전용 QR (`https://happycare.pages.dev/partner?src=agency_happycare`)
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
6. 주소가 바뀌면 `src/config/site.ts`의 `siteUrl`을 바꿔 주세요 (공유 미리보기용).

현재 주소: **https://happycare.pages.dev**

이후 GitHub에 push할 때마다 자동으로 다시 배포됩니다.

## 주의

등급 예상은 공단 인정조사(52개 항목)를 단순화한 **참고용 모의 계산**입니다. 화면 하단과 결과에 실제 판정은 국민건강보험공단이 한다는 안내가 들어가 있습니다. 점수 기준은 `src/lib/grade.ts`, 추천 규칙은 `src/lib/person.ts`(어르신)·`src/lib/check.ts`(안전 점검)·`src/data/rooms.ts`(장소별)에서 조정할 수 있습니다.

## 고객 장부 (/staff · /my)

- `/staff`: 직원용. 어르신 등록 → 공단 조회 잔액 입력 → 해피케어 구입·대여 품목 추가하면 남은 한도가 자동 계산됩니다.
- `/my?k=…`: 보호자용 읽기 전용 화면 (직원 화면에서 링크를 카톡으로 보냄, 이름은 가려서 표시).
- 서버: `functions/api/[[path]].ts` (Cloudflare Pages Functions) + D1 데이터베이스. 표는 첫 요청 때 자동 생성됩니다.

### Cloudflare 설정 (한 번만)
1. Cloudflare 대시보드 → 스토리지 및 데이터베이스 → D1 → 데이터베이스 생성 (이름 예: `happycare-db`)
2. Workers 및 Pages → `happycare` → 설정 → 바인딩 → 추가 → D1 데이터베이스 → 변수 이름 `DB`, 방금 만든 DB 선택
3. 같은 설정 → 변수 및 암호 → 추가 → 유형 "암호(Secret)", 이름 `STAFF_PASSWORD`, 값은 직원 비밀번호
4. 배포 → 최근 배포 "다시 시도"(재배포) 해야 설정이 적용됩니다.

로컬 테스트: `npx next build` 후 `wrangler pages dev out --d1 DB` (`.dev.vars`에 `STAFF_PASSWORD=...`)

### 개인정보 동의
- 보호자 링크는 **동의 전에는 장부 내용을 보내지 않습니다.** 처음 열면 동의 화면(필수 4 · 선택 1)이 나오고, 동의 기록(일시·동의자·관계·버전)이 `consents` 표에 남습니다.
- 종이로 받은 경우 직원 화면에서 "종이 동의서로 받았어요"로 기록. 인쇄용 동의서: `/consent`
- 보호자가 '동의 철회'를 누르면 장부가 바로 삭제됩니다 (동의·철회 기록만 남음).
- 문구는 `src/data/consent.ts`, 사업자 정보는 `src/config/site.ts`의 `business` (대표자·주소·보호책임자 채우기). 문구를 바꾸면 `CONSENT_VERSION`을 올리고 `functions/api/[[path]].ts`의 같은 상수도 맞춰 주세요 → 모두 다시 동의받습니다.
- 개인정보처리방침: `/privacy` (푸터에 링크)

### 아임웹 주문 가져오기 (/staff → 🛒 아임웹 주문 가져오기)
- Cloudflare 암호: `IMWEB_API_KEY`, `IMWEB_SECRET_KEY` (아임웹 관리자 → 외부 서비스 연동(API)). 넣은 뒤 재배포.
- 화면에서 '연결 확인'이 먼저 실행되고, 최근 30/60/90일 주문을 불러옵니다. 주문자 휴대폰 번호가 어르신의 보호자 연락처와 같으면 자동 선택.
- 상품은 쇼핑몰 상품번호(idx)로 `products.json`과 맞춰 급여가로 넣습니다. 목록에 없는 상품·취소된 품목은 체크가 꺼져 있습니다.
- 장부에 넣었거나 숨긴 주문은 `imweb_orders` 표에 기록되어 다시 나오지 않습니다.
