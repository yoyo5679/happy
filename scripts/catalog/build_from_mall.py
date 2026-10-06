"""쇼핑몰(아임웹) 상품 엑셀 + 카탈로그 추출 데이터 → src/data/products.json

usage: python build_from_mall.py <mall.xlsx> <catalog.json> <out.json>

- 쇼핑몰에 진열된 상품만 사용 (쇼핑몰이 기준)
- 같은 모델의 대여/구입 상품을 하나로 묶고 각각의 URL을 보관
- 카탈로그와 모델명이 일치하면 급여코드·추출 이미지를 붙이고 가격을 교차 검증
"""
import json, re, sys, unicodedata
import openpyxl

xlsx, catalog_path, out = sys.argv[1], sys.argv[2], sys.argv[3]

CATS = {"구강세척기": "oralCleaner", "배회감지기": "wanderingSensor", "이동변기": "portableToilet", "목욕의자": "bathChair",
        "성인용보행기": "walker", "안전손잡이": "safetyHandle", "간이변기": "simpleToilet", "미끄럼방지매트": "antiSlipMat",
        "미끄럼방지양말": "antiSlipSocks", "지팡이": "cane", "욕창예방방석": "pressureCushion", "자세변환용구": "positioning",
        "요실금팬티": "incontinence", "욕창예방매트리스": "pressureMattress", "경사로·단차해소기": "ramp", "경사로": "ramp",
        "전동침대": "electricBed", "이동욕조": "bathtub", "수동휠체어": "wheelchair"}
RENT_ONLY = {"electricBed", "wheelchair", "bathtub"}
SKIP = re.compile(r"\[설치\]|박스단위")


def clean(name):
    name = unicodedata.normalize("NFKC", name or "").strip()
    name = re.sub(r"^\|[^|]*\|\s*", "", name)
    name = re.sub(r"^\[[^\]]*\]\s*", "", name)
    return re.sub(r"\s*\[[^\]]*\]$", "", name).strip()


def norm(s, loose=False):
    s = unicodedata.normalize("NFKC", s or "").replace("Ⅱ", "II").replace("Ⅲ", "III")
    if loose:
        s = re.sub(r"\([^)]*\)", "", s)
    return re.sub(r"[\s\-_()·.,'’/]", "", s).upper()


ws = openpyxl.load_workbook(xlsx, read_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
ix = {h: i for i, h in enumerate(rows[0])}
catalog = json.load(open(catalog_path, encoding="utf-8"))

listings = []
for r in rows[1:]:
    raw = r[ix["상품명"]] or ""
    if r[ix["진열상태"]] != "Y" or SKIP.search(raw):
        continue
    m = re.match(r"\s*\|([^|]*)\|", raw)
    path = re.sub(r"https://[^/]+/([^/]*)/.*", r"\1", r[ix["상품URL"]] or "")
    cat = CATS.get(m.group(1)) if m else ("antiSlipMat" if path in ("bathroom", "nonslip") else None)
    if not cat:
        continue
    opts = r[ix["필수옵션값"]] or ""
    full = r[ix["정가"]]
    if not full:
        mm = re.search(r"정상가\)?\s*\(([\d,]+)\)", opts)
        full = mm.group(1) if mm else r[ix["판매가"]]
    listings.append(dict(name=clean(raw), cat=cat, full=int(str(full).replace(",", "")), monthly="월" in opts,
                         url=r[ix["상품URL"]], thumb=r[ix["대표이미지URL"]], soldOut=r[ix["판매상태"]] != "판매중"))


def find_catalog(l):
    same = [p for p in catalog if p["category"] == l["cat"]]
    # 쇼핑몰 분류가 카탈로그와 다를 수 있음 (예: 욕창예방방석이 매트리스 메뉴에 진열) → 모델명이 정확히 같으면 카탈로그 분류를 따름
    exact = [p for p in catalog if norm(p["name"]) == norm(l["name"])]
    if exact and not any(p["category"] == l["cat"] for p in exact):
        return exact
    for loose in (False, True):
        # 괄호 제거 비교는 카탈로그 이름에 괄호가 없을 때만 (예: (소)/(대) 크기 구분 보호)
        hit = [p for p in same if (not loose or "(" not in p["name"]) and norm(p["name"], loose) == norm(l["name"], loose)]
        if hit:
            return hit
    hit = [p for p in same if len(norm(p["name"])) >= 3 and "(" not in p["name"] and (norm(l["name"]).startswith(norm(p["name"])) or norm(p["name"]).startswith(norm(l["name"])))]
    return hit


products, report = {}, {"matched": 0, "mallOnly": 0, "priceMismatch": []}
for l in listings:
    hits = find_catalog(l)
    cp = None
    if hits:
        # 가격까지 맞는 후보 우선
        cp = next((p for p in hits if l["full"] in (p.get("price"), p.get("rent"))), hits[0])
    if cp:
        kind = "rent" if l["full"] == cp.get("rent") else "buy" if l["full"] == cp.get("price") else ("rent" if l["monthly"] else "buy")
        if l["full"] not in (cp.get("price"), cp.get("rent")):
            report["priceMismatch"].append((l["name"], l["full"], cp.get("price"), cp.get("rent")))
        key = cp["code"]
    else:
        # 대여 전용 품목이거나, 매트리스 월 대여가 수준(10만원 미만)이면 대여로 판단
        kind = "rent" if l["monthly"] or l["cat"] in RENT_ONLY or (l["cat"] == "pressureMattress" and l["full"] < 100000) else "buy"
        key = f"{l['cat']}:{norm(l['name'], True)}"
    p = products.setdefault(key, dict(id=key if cp else None, code=cp["code"] if cp else None, name=cp["name"] if cp else l["name"],
                                      category=cp["category"] if cp else l["cat"], img=f"/products/{cp['code']}.webp" if cp and cp.get("img") else l["thumb"]))
    if not p["id"]:
        p["id"] = "m" + re.sub(r"\D", "", l["url"].split("idx=")[-1])
    slot = p.setdefault(kind, None)
    # 판매중 리스팅을 품절보다 우선
    if slot is None or (slot["soldOut"] and not l["soldOut"]):
        p[kind] = dict(price=l["full"], url=l["url"], soldOut=l["soldOut"])

result = []
for p in products.values():
    entry = {k: v for k, v in p.items() if v is not None and k not in ("rent", "buy")}
    if p.get("rent"):
        entry["rent"] = p["rent"]
    if p.get("buy"):
        entry["buy"] = p["buy"]
    result.append(entry)
    report["matched" if p["code"] else "mallOnly"] += 1

order = list(CATS.values())
result.sort(key=lambda p: (order.index(p["category"]), all(v["soldOut"] for v in (p.get("rent"), p.get("buy")) if v)))
with open(out, "w", encoding="utf-8") as f:
    f.write("[\n" + ",\n".join(json.dumps(x, ensure_ascii=False) for x in result) + "\n]\n")
print(len(listings), "listings →", len(result), "products", {k: v for k, v in report.items() if k != "priceMismatch"})
print("price mismatches:", report["priceMismatch"])
