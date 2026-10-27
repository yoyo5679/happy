"""쇼핑몰(아임웹) '상품 정보 일괄 수정용' 엑셀 → public/imweb/filters.json

usage: python build_filters.py <상품정보수정용.xlsx> public/imweb/filters.json

쇼핑몰 카테고리 페이지의 필터 칩(imweb/category-filter.html)이 읽는 데이터입니다.
- 상품명 앞 |분류|로 품목을 나누고, 요약설명의 '제품 주요규격' 표(항목/값)와 판매가(본인부담 15%)로 칩을 판별합니다.
- 품목마다 칩이 다릅니다. 전동침대는 쇼핑몰의 원래 필터를 그대로 씁니다(KEEP).
- 칩 이름이나 기준을 바꾸려면 아래 RULES만 고치고 다시 실행하세요.
"""
import html, json, re, sys
import openpyxl

xlsx, out = sys.argv[1], sys.argv[2]

# 쇼핑몰 메뉴 주소 → 품목 (하위 메뉴 '전체' 페이지 번호 포함)
PAGES = {
    "cushion": "욕창예방방석", "mattress": "욕창예방매트리스", "positioning": "자세변환용구",
    "walker-all": "성인용보행기", "239": "성인용보행기", "walker": "성인용보행기", "shoulder-walker": "성인용보행기",
    "walker-rollator": "성인용보행기", "walker-stroller": "성인용보행기",
    "wheelchair": "수동휠체어", "cane": "지팡이", "ramp": "경사로·단차해소기",
    "grab-bar": "안전손잡이", "249": "안전손잡이", "grab-bar-pole": "안전손잡이", "grab-bar-stand": "안전손잡이",
    "grab-bar-toilet": "안전손잡이", "grab-bar-wall": "안전손잡이",
    "nonslip": "미끄럼방지매트", "socks": "미끄럼방지양말", "254": "미끄럼방지양말", "socks-men": "미끄럼방지양말",
    "socks-women": "미끄럼방지양말", "commode": "이동변기", "portable-toilet": "간이변기", "shower-chair": "목욕의자",
    "underwear": "요실금팬티", "265": "요실금팬티", "underwear-men": "요실금팬티", "underwear-women": "요실금팬티",
    # 쇼핑몰 원래 필터를 그대로 쓰는 곳
    "electric-bed": "KEEP",
}


def num(text, unit):
    m = re.search(r"([\d.]+)\s*" + unit, text or "")
    return float(m.group(1)) if m else None


def kg(text):
    w = num(text, "kg")
    if w is None:
        g = num(text, "g")
        w = g / 1000 if g is not None else None
    return w


def dims(text):
    """'79 x 12 x 3cm' → [79, 12, 3] (범위 '75~84'는 큰 값)"""
    parts = re.split(r"\s*[x×*]\s*", (text or "").split("cm")[0])
    out = []
    for p in parts:
        nums = [float(n) for n in re.findall(r"[\d.]+", p)]
        if nums:
            out.append(max(nums))
    return out


def has(text, *words):
    return any(w in (text or "") for w in words)


def range_max(text):
    nums = [float(n) for n in re.findall(r"[\d.]+", text or "")]
    return max(nums) if nums else None


# 품목별 칩: (key, 이름, 묶음, 판별 함수(상품)). 같은 묶음 안의 칩은 '또는', 묶음끼리는 '그리고'로 거릅니다.
RULES = {
    "수동휠체어": [
        ("light", "가벼운 14kg 이하", "spec", lambda p: (kg(p["spec"].get("중량")) or 99) <= 14),
    ],
    "성인용보행기": [
        ("seat", "앉아 쉬는 의자", "spec", lambda p: bool(p["spec"].get("의자높이"))),
        ("light", "가벼운 5.5kg 이하", "spec", lambda p: (kg(p["spec"].get("중량")) or 99) <= 5.5),
    ],
    "지팡이": [
        ("quad", "네발(다족형)", "spec", lambda p: has(p["spec"].get("형태"), "다족", "4발") or has(p["model"], "사발", "네발", "4발")),
        ("light", "가벼운 300g 이하", "spec", lambda p: (kg(p["spec"].get("중량")) or 99) <= 0.3),
        ("long", "100cm 이상 길게", "spec", lambda p: (range_max(p["spec"].get("길이")) or 0) >= 100),
    ],
    "경사로·단차해소기": [
        (f"h{h}", f"문턱 {h}cm", "height", (lambda h: lambda p: (dims(p["spec"].get("규격")) + [0, 0, 0])[2] == h)(h))
        for h in (1, 2, 3, 4, 5)
    ],
    "안전손잡이": [
        ("wood", "원목", "mat", lambda p: has(p["spec"].get("재질"), "원목", "천연목", "고무나무", "목재")),
        ("metal", "금속(스틸·알루미늄)", "mat", lambda p: has(p["spec"].get("재질"), "스테인", "스틸", "알루미늄")),
        ("load100", "100kg까지 지지", "spec", lambda p: (num(p["spec"].get("최대하중"), "kg") or 0) >= 100),
    ],
    "미끄럼방지매트": [
        ("small", "작은 크기(75cm 이하)", "size", lambda p: 0 < max(dims(p["spec"].get("규격")) or [0]) <= 75),
        ("mid", "중간 크기(76~120cm)", "size", lambda p: 75 < max(dims(p["spec"].get("규격")) or [0]) <= 120),
        ("large", "큰 크기(180cm 이상)", "size", lambda p: max(dims(p["spec"].get("규격")) or [0]) >= 180),
        ("glow", "어두울 때 빛나는 축광", "spec", lambda p: has(p["spec"].get("재질"), "축광") or has(p["model"], "축광", "야광")),
    ],
    "미끄럼방지양말": [
        ("all", "사계절용", "season", lambda p: has(p["spec"].get("계절"), "사계절")),
        ("winter", "겨울용", "season", lambda p: has(p["spec"].get("계절"), "겨울")),
        ("cover", "덧신", "spec", lambda p: has(p["model"], "덧신")),
        ("unisex", "남녀공용", "spec", lambda p: has(p["spec"].get("대상"), "공용") or has(p["model"], "공용")),
    ],
    "요실금팬티": [
        ("cc-s", "적은 양(50cc 이하)", "cc", lambda p: 0 < (num(p["spec"].get("흡수량"), "cc") or 0) <= 50),
        ("cc-m", "보통(60~100cc)", "cc", lambda p: 50 < (num(p["spec"].get("흡수량"), "cc") or 0) <= 100),
        ("cc-l", "많은 양(110cc 이상)", "cc", lambda p: (num(p["spec"].get("흡수량"), "cc") or 0) > 100),
        ("xxl", "XXL까지", "spec", lambda p: has(p["spec"].get("사이즈"), "XXL")),
    ],
    "목욕의자": [
        ("adj", "높이 조절", "spec", lambda p: "~" in (p["spec"].get("좌면높이") or "")),
    ],
    "이동변기": [
        ("wood", "원목 가구형", "mat", lambda p: has(p["spec"].get("재질"), "원목", "고무나무", "천연목", "목재")),
        ("alu", "가벼운 알루미늄", "mat", lambda p: has(p["spec"].get("재질"), "알루미늄")),
    ],
    "간이변기": [
        ("men", "남성 소변기", "kind", lambda p: has(p["spec"].get("종류"), "남성")),
        ("women", "여성 소변기", "kind", lambda p: has(p["spec"].get("종류"), "여성")),
        ("stool", "대변기", "kind", lambda p: has(p["spec"].get("종류"), "대변")),
    ],
    "욕창예방매트리스": [],
    "욕창예방방석": [],
    "자세변환용구": [],
}


def nice(v):
    """가격 칸 경계를 보기 좋은 값으로 (500원·천원·5천원 단위)"""
    step = 500 if v < 10000 else 1000 if v < 20000 else 5000
    return int(round(v / step) * step), step


def price_chips(items):
    """본인부담(15%) 가격대 칩 3개: 품목 상품을 셋으로 나누는 경계를 보기 좋게 반올림.
    가격 정렬이 따로 있으므로 규격 칩이 1개 이하인 품목에만 붙입니다."""
    prices = sorted(p["price"] for p in items if p["price"])
    if len(prices) < 6:
        return []
    (a, step), (b, _) = nice(prices[len(prices) // 3]), nice(prices[len(prices) * 2 // 3])
    if b <= a:
        b = a + step
    rent = all(p["rent"] for p in items)
    won = lambda v: (f"{v // 10000}만" if v % 10000 == 0 else f"{v:,}") + "원"
    pre = "월 " if rent else ""
    return [
        ("p1", f"{pre}{won(a)} 이하", "price", lambda p: p["price"] <= a),
        ("p2", f"{pre}{won(a)}~{won(b)}", "price", lambda p: a < p["price"] <= b),
        ("p3", f"{pre}{won(b)} 넘게", "price", lambda p: p["price"] > b),
    ]


ws = openpyxl.load_workbook(xlsx, read_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
ix = {h: i for i, h in enumerate(rows[0])}
products = []
for r in rows[1:]:
    if not str(r[ix["상품번호"]]).isdigit() or r[ix["판매상태"]] == "숨김":
        continue
    m = re.match(r"\s*\|([^|]*)\|\s*(.*)", r[ix["상품명"]] or "")
    if not m:
        continue
    summary = r[ix["요약설명"]] or ""
    spec = {}
    j = summary.find("제품 주요규격")
    if j >= 0:
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", summary[j:], re.S)]
        for a, b in zip(cells[0::2], cells[1::2]):
            if a and len(a) < 15:
                spec[a] = b
    products.append(dict(idx=int(r[ix["상품번호"]]), kind=m.group(1), model=m.group(2), spec=spec,
                         price=int(r[ix["판매가"]] or 0), rent="대여기간" in (r[ix["필수옵션명"]] or "")))

kinds, report = {}, []
for kind, rules in RULES.items():
    items = [p for p in products if p["kind"] == kind]
    chips = rules + (price_chips(items) if len(rules) < 2 else [])
    tags = {}
    for p in items:
        keys = [k for k, _, _, f in chips if f(p)]
        if keys:
            tags[str(p["idx"])] = " ".join(keys)
    # 해당 상품이 없거나 모든 상품이 해당하는 칩은 거를 의미가 없어 뺌
    used = []
    for k, label, group, _ in chips:
        n = sum(k in t.split() for t in tags.values())
        if 0 < n < len(items):
            used.append({"k": k, "l": label, "g": group, "n": n})
        report.append(f"{kind:<10} {label:<20} {n:>3}/{len(items)}")
    keep = {c["k"] for c in used}
    tags = {i: " ".join(k for k in t.split() if k in keep) for i, t in tags.items()}
    kinds[kind] = {"chips": used, "items": {i: t for i, t in tags.items() if t}}

with open(out, "w", encoding="utf-8") as f:
    json.dump({"pages": PAGES, "kinds": kinds}, f, ensure_ascii=False, separators=(",", ":"))
print("\n".join(report))
print(len(products), "products →", out)
