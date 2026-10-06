# 해피케어복지용구 — 고객 참여형 돌봄 자가진단 툴

블로그·유튜브 방문자가 클릭 몇 번으로 답하면 맞춤 결과를 보여주고, 결과 화면에서 스토어 상품 페이지로 자연스럽게 연결하는 리드 생성용 웹 툴입니다.

| 경로 | 기능 |
|---|---|
| `/` | 랜딩 (두 도구 선택) |
| `/grade` | 우리 부모님 장기요양등급 예상해보기 (12문항 → 1~5등급·인지지원등급 예상 + 추천 용품) |
| `/recommend` | 우리 집 맞춤 복지용구 추천 (8문항 → 우선순위 Top 5 + 추천 이유 + 상품) |
| `/catalog` | 18개 품목 360개 모델 전체 보기 + 본인부담률(15/9/6/0%)별 본인부담금 계산 |

## 상품 데이터

- **`src/data/catalog.json`** — 이로움케어 복지용구 카탈로그(PDF)에서 추출한 360개 모델: 급여코드, 모델명, 품목, 급여가(구입), 대여가(월). 모든 가격은 카탈로그의 15% 본인부담금과 교차 검증했습니다.
- **`public/products/{급여코드}.webp`** — 카탈로그에서 추출한 상품 사진 (333개, 나머지는 아이콘 표시)
- **`src/data/products.ts`** — 품목 이름/설명, 결과 화면에 먼저 보여줄 상품(`featured`) 지정

## 쇼핑몰 연결 (happycaremall.com)

상품 카드를 누르면 아래 순서로 연결됩니다.

1. **`src/data/productLinks.ts`** 에 급여코드별 상세 페이지 주소가 있으면 → 그 상품 페이지
2. 없으면 **`src/config/site.ts`의 `searchUrl`** 이 설정돼 있으면 → 쇼핑몰에서 모델명 검색 결과
3. 둘 다 없으면 → 쇼핑몰 메인(`storeUrl`)

쇼핑몰 검색 주소 형식만 알려 주시면 2번으로 전 상품이 한 번에 연결됩니다.

## 카탈로그 갱신

새 카탈로그 PDF가 나오면 `scripts/catalog/`의 스크립트로 다시 추출할 수 있습니다 (`pdftotext`, Python `pymupdf`·`pillow` 필요).

```bash
pdftotext -bbox-layout -f 5 -l 55 catalog.pdf bbox.html
python3 scripts/catalog/parse_prices.py bbox.html items.json
python3 scripts/catalog/extract_images.py catalog.pdf src/data/catalog.json public/products
```

## 유입 채널 추적

링크 뒤에 `?src=채널명`을 붙여 홍보하세요.

- 블로그: `https://<배포주소>/?src=blog`
- 유튜브 설명란: `https://<배포주소>/grade?src=youtube`

상품 링크로 이동할 때 `utm_source=youtube&utm_medium=care_tool&utm_campaign=grade_check&utm_content=<상품id>`가 자동으로 붙어, 스토어 통계에서 어느 채널·어느 도구가 매출로 이어졌는지 확인할 수 있습니다.

## 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
```

## Vercel 배포

1. https://vercel.com 에서 GitHub 로그인 → **Add New → Project**
2. 이 저장소(`yoyo5679/happy`) 선택 → 설정 그대로 **Deploy**
3. 배포 주소가 나오면 `src/config/site.ts`의 `siteUrl`을 그 주소로 바꿔 주세요 (공유 미리보기용).

이후 GitHub에 push할 때마다 자동으로 재배포됩니다.

## 주의

등급 예상은 공단 인정조사(52개 항목)를 단순화한 **참고용 모의 계산**입니다. 화면 하단과 결과에 실제 판정은 국민건강보험공단이 한다는 안내가 들어가 있습니다. 점수 기준은 `src/lib/grade.ts`, 추천 규칙은 `src/lib/recommend.ts`에서 조정할 수 있습니다.
