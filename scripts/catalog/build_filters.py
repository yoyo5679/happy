"""쇼핑몰(아임웹) '상품 정보 일괄 수정용' 엑셀 → public/imweb/filters.json

usage: python build_filters.py <상품정보수정용.xlsx> public/imweb/filters.json

쇼핑몰 카테고리 페이지의 필터 칩(imweb/category-filter.html)이 읽는 데이터입니다.
- 상품명 앞 |분류|로 품목을 나누고, 요약설명의 '제품 주요규격' 표(항목/값)와 상품명으로 칩을 판별합니다.
- 품목마다 칩이 다릅니다. 복지용구는 본인부담금이 정해져 있어 가격대 칩은 쓰지 않습니다.
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
    "electric-bed": "전동침대",
    # 쇼핑몰 원래 필터를 그대로 쓰려면 "KEEP"
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


def range_min(text):
    nums = [float(n) for n in re.findall(r"[\d.]+", text or "")]
    return min(nums) if nums else None


# 품목별 칩: (key, 이름, 묶음, 판별 함수(상품)). 같은 묶음 안의 칩은 '또는', 묶음끼리는 '그리고'로 거릅니다.
RULES = {
    # 가정용 전동침대는 오르내릴 때 낙상이 잦아 최저 높이가 중요하고, 보호자가 돌볼 땐 높이 올라가는 게 허리 부담을 줄임
    "전동침대": [
        ("low", "낮게 내려가는(최저 31cm 이하)", "spec", lambda p: (range_min(p["spec"].get("높이조절")) or 99) <= 31),
        ("high", "높이 올라가는(최고 70cm 이상)", "spec", lambda p: (range_max(p["spec"].get("높이조절")) or 0) >= 70),
        ("back80", "상체 높이 세우는(등판 80° 이상)", "spec", lambda p: (range_max(p["spec"].get("등각도")) or 0) >= 80),
        ("load200", "200kg까지 지지", "spec", lambda p: (num(p["spec"].get("최대하중"), "kg") or 0) >= 200),
        ("narrow", "폭 95cm 이하(좁은 방)", "spec", lambda p: 0 < (dims(p["spec"].get("규격")) or [999])[0] <= 95),
    ],
    "수동휠체어": [
        ("light", "가벼운 14kg 이하", "spec", lambda p: (kg(p["spec"].get("중량")) or 99) <= 14),
        ("narrow", "폭 60cm 이하(좁은 문)", "spec", lambda p: 0 < (dims(p["spec"].get("규격")) or [999])[0] <= 60),
        ("tall", "등받이 높은 형(높이 120cm 이상)", "spec", lambda p: ((dims(p["spec"].get("규격")) + [0, 0, 0])[2]) >= 120),
        ("air", "에어 타이어(승차감)", "tire", lambda p: has(p["spec"].get("재질"), "에어타이어")),
        ("pu", "펑크 없는 PU 타이어", "tire", lambda p: has(p["spec"].get("재질"), "PU타이어")),
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
        ("light", "가벼운 5kg 이하", "spec", lambda p: (kg(p["spec"].get("중량")) or 99) <= 5),
        ("tall", "등받이 높은 대형(높이 95cm 이상)", "spec", lambda p: ((dims(p["spec"].get("규격")) + [0, 0, 0])[2]) >= 95),
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
    "욕창예방매트리스": [
        ("nopower", "전기 없이 쓰는 폼·고무형", "spec", lambda p: has(p["spec"].get("재질"), "고무") or has(p["model"], "FOAM")),
        ("thick", "두께 10cm 이상", "spec", lambda p: ((dims(p["spec"].get("규격")) + [0, 0, 0])[2]) >= 10),
        ("quiet", "저소음(MUTE) 모델", "spec", lambda p: has(p["model"], "MUTE") and not has(p["model"], "FOAM")),
        ("anti", "항균 소재", "spec", lambda p: has(p["spec"].get("재질"), "항균")),
    ],
    "욕창예방방석": [
        ("air", "공기 셀(에어)형", "mat", lambda p: has(p["spec"].get("재질"), "TPU") and not has(p["spec"].get("재질"), "젤")),
        ("rubber", "고무·라텍스형", "mat", lambda p: has(p["spec"].get("재질"), "고무", "라텍스", "NR", "EPDM")),
        ("thick", "두께 8cm 이상", "spec", lambda p: ((dims(p["spec"].get("규격")) + [0, 0, 0])[2]) >= 8),
        ("light", "가벼운 1.2kg 이하", "spec", lambda p: (kg(p["spec"].get("중량")) or 99) <= 1.2),
    ],
    "자세변환용구": [
        ("long", "긴 쿠션(70cm 이상)", "spec", lambda p: len(dims(p["spec"].get("규격"))) == 3 and max(dims(p["spec"].get("규격"))) >= 70),
        ("flat", "납작한 시트·보드형", "spec", lambda p: len(dims(p["spec"].get("규격"))) == 2),
        ("latex", "천연 라텍스", "spec", lambda p: has(p["spec"].get("재질"), "라텍스")),
        ("gel", "젤 포함", "spec", lambda p: has(p["spec"].get("재질"), "젤")),
    ],
}


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
    products.append(dict(idx=int(r[ix["상품번호"]]), kind=m.group(1), model=m.group(2), spec=spec))

# 'ATA-4030(박스단위)'처럼 규격표가 없는 묶음 상품은 낱개 상품의 규격을 씀
by_model = {(p["kind"], p["model"]): p["spec"] for p in products}
for p in products:
    if not p["spec"]:
        p["spec"] = by_model.get((p["kind"], re.sub(r"\s*\(박스단위\)$", "", p["model"])), {})

kinds, report = {}, []
for kind, rules in RULES.items():
    items = [p for p in products if p["kind"] == kind]
    tags = {}
    for p in items:
        keys = [k for k, _, _, f in rules if f(p)]
        if keys:
            tags[str(p["idx"])] = " ".join(keys)
    # 해당 상품이 없거나 모든 상품이 해당하는 칩은 거를 의미가 없어 뺌
    used = []
    for k, label, group, _ in rules:
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
