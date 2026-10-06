import sys, re, json, io
import pymupdf
from PIL import Image
pdf, catalog, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
codes = {r["code"] for r in json.load(open(catalog))}
doc = pymupdf.open(pdf)
found = {}
for pno in range(4, 55):
    page = doc[pno]
    W = page.rect.width
    # product anchors: '급여코드:' word followed by the code
    words = page.get_text("words")
    anchors = []
    for i, w in enumerate(words):
        if w[4].startswith("급여코드"):
            m = re.search(r"([A-Z]\d{11})", w[4]) or (i + 1 < len(words) and re.search(r"([A-Z]\d{11})", words[i + 1][4]))
            if m and m.group(1) in codes:
                anchors.append((m.group(1), w[0], w[1]))
    imgs = []
    for info in page.get_images(full=True):
        xref, smask = info[0], info[1]
        for r in page.get_image_rects(xref):
            imgs.append((xref, smask, r))
    for code, x, y in anchors:
        half = 0 if x < W / 2 else 1
        same = [a for a in anchors if (0 if a[1] < W / 2 else 1) == half]
        # column: anchors whose x is right of us on the same half bound our cell
        right = [a[1] for a in same if a[1] > x + 50 and abs(a[2] - y) < 200]
        xmax = min(right) if right else (W / 2 if half == 0 else W) - 10
        below = [a[2] for a in same if a[2] > y + 30 and abs(a[1] - x) < 50]
        ymax = min(below) if below else page.rect.height
        cell = pymupdf.Rect(x - 25, y - 30, xmax, ymax - 30)
        best = None
        for xref, smask, r in imgs:
            c = pymupdf.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            if c in cell and r.width > 40 and r.height > 40:
                if not best or r.get_area() > best[2].get_area():
                    best = (xref, smask, r)
        if not best:
            continue
        xref, smask, r = best
        im = Image.open(io.BytesIO(doc.extract_image(xref)["image"]))
        if im.mode == "CMYK":
            from PIL import ImageChops
            im = ImageChops.invert(im) if False else im
        im = im.convert("RGB")
        if smask:
            mask = Image.open(io.BytesIO(doc.extract_image(smask)["image"])).convert("L").resize(im.size)
            bg = Image.new("RGB", im.size, "white")
            bg.paste(im, mask=mask)
            im = bg
        im.thumbnail((360, 360))
        im.save(f"{outdir}/{code}.webp", "WEBP", quality=78)
        found[code] = round(r.get_area())
print(len(found), "of", len(codes))
missing = sorted(codes - set(found))
print("missing", missing)
