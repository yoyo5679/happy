# 해피케어복지용구 — 고객 참여형 돌봄 자가진단 툴

블로그·유튜브 방문자가 클릭 몇 번으로 답하면 맞춤 결과를 보여주고, 결과 화면에서 스토어 상품 페이지로 자연스럽게 연결하는 리드 생성용 웹 툴입니다.

| 경로 | 기능 |
|---|---|
| `/` | 랜딩 (두 도구 선택) |
| `/grade` | 우리 부모님 장기요양등급 예상해보기 (12문항 → 1~5등급·인지지원등급 예상 + 추천 용품) |
| `/recommend` | 우리 집 맞춤 복지용구 추천 (8문항 → 우선순위 Top 5 + 추천 이유 + 상품) |
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
