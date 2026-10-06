import re, sys, json, html
from xml.etree import ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
txt = open(src, encoding="utf-8").read()
txt = re.sub(r"<!DOCTYPE[^>]*>", "", txt)
txt = re.sub(r'xmlns="[^"]*"', "", txt)
root = ET.fromstring(txt)
# catalog page start -> category
ranges = [(7,"구강세척기"),(8,"이동변기"),(11,"목욕의자"),(15,"성인용보행기"),(23,"안전손잡이"),(41,"간이변기"),(43,"미끄럼방지매트"),(53,"미끄럼방지양말"),(61,"지팡이"),(66,"욕창예방방석"),(71,"자세변환용구"),(76,"요실금팬티"),(85,"욕창예방매트리스"),(92,"경사로"),(96,"전동침대"),(98,"이동욕조"),(99,"수동휠체어")]
def cat_for(pg, code):
    if code.startswith("C18"): return "배회감지기"
    c = None
    for start, name in ranges:
        if pg >= start: c = name
    return c
items = []
pages = root.iter("page")
for pi, page in enumerate(pages):
    pdfp = 5 + pi
    W = float(page.get("width"))
    lines = []
    for ln in page.iter("line"):
        words = [w.text or "" for w in ln.iter("word")]
        lines.append(dict(t=" ".join(words), x=float(ln.get("xMin")), y=float(ln.get("yMin")), X=float(ln.get("xMax")), Y=float(ln.get("yMax"))))
    for c in lines:
        m = re.match(r"급여코드:\s*([A-Z0-9]+)", c["t"])
        if not m: continue
        code = m.group(1)
        # name: closest line above, overlapping x start
        cands = [l for l in lines if l["Y"] <= c["y"] + 1 and c["y"] - l["Y"] < 25 and abs(l["x"] - c["x"]) < 60 and l is not c and 40 < l["x"] < W - 40 and not re.search(r"^급여|본인부담|^NEW$|^\d\d ", l["t"])]
        name = None
        if cands:
            l = max(cands, key=lambda l: (l["Y"] - abs(l["x"] - c["x"]) / 5))
            name = re.sub(r"\s*급여가.*$", "", re.sub(r"^NEW\s*", "", l["t"])).strip()
        def amount(label, maxdy):
            col = [l for l in lines if l["t"].startswith(label) and -40 < l["y"] - c["y"] < maxdy and -10 < l["x"] - c["x"] < 140]
            if not col: return None
            g = min(col, key=lambda l: abs(l["y"] - c["y"]) + abs(l["x"] - c["x"]) / 4)
            mm = re.search(r"([\d,]+)원", g["t"])
            if not mm:
                row = [l for l in lines if abs(l["y"] - g["y"]) < 4 and 0 < l["x"] - g["x"] < 260 and re.search(r"[\d,]+원", l["t"])]
                if row: mm = re.search(r"([\d,]+)원", min(row, key=lambda l: l["x"])["t"])
            return int(mm.group(1).replace(",", "")) if mm else None
        rent = amount("대여가", 60)
        price = amount("급여가", 130 if rent else 60)
        half = 0 if c["x"] < W / 2 else 1
        pg = 2 * pdfp - 3 + half
        items.append(dict(code=code, name=name, price=price, rent=rent, page=pg, category=cat_for(pg, code)))
json.dump(items, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(items))
