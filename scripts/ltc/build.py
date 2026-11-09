"""장기요양기관 검색용 데이터 만들기

입력 (공공데이터포털에서 직접 내려받은 파일)
  1. 국민건강보험공단_장기요양기관 시설별 현황 (XLSX) : 주소·지정일자·기관유형·정원
  2. 국민건강보험공단_장기요양기관 평가 결과 (CSV, cp949) : 급여종류별 평가등급
출력
  public/ltc/facilities-{시도코드}.json  (직원 화면 '기관 데이터 갱신'이 D1로 옮기고 카카오로 좌표를 붙임)
  public/ltc/meta.json

사용: python3 -I scripts/ltc/build.py 시설별현황.xlsx 평가결과.csv
"""
import csv
import json
import os
import sys
from collections import defaultdict

import openpyxl

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "ltc")

# 기관유형코드 → 보여줄 종류 (방문간호·복지용구는 제외)
def kinds_of(code: str) -> set[str]:
    c = code.strip()
    if c in ("B01", "C01"):
        return {"visit"}
    if c in ("B02", "C02"):
        return {"bath"}
    if c in ("B03", "C03") or c[:1] in ("H", "I"):
        return {"day"}
    if c in ("B04", "C04", "A05"):
        return {"short"}
    if c in ("A01", "A02", "A03", "A04", "S41") or c[:1] in ("G", "M"):
        return {"home"}
    return set()

# 평가결과 급여종류 → 종류
EVAL_KIND = {"04": "visit", "05": "bath", "07": "day", "08": "short", "01": "home", "02": "home", "03": "home"}


def main(xlsx: str, evcsv: str) -> None:
    wb = openpyxl.load_workbook(xlsx, read_only=True)
    gen = {}
    for i, r in enumerate(wb["일반현황"].iter_rows(values_only=True)):
        if i == 0 or not r[0]:
            continue
        gen[str(r[0])] = r

    kinds: dict[str, set[str]] = defaultdict(set)
    ptype: dict[str, str] = {}  # 공단 API 조회용 기관유형코드
    cap: dict[str, int] = defaultdict(int)  # 입소시설 정원
    for sheet in ("입소인원", "인력현황"):
        for i, r in enumerate(wb[sheet].iter_rows(values_only=True)):
            if i == 0 or not r[0]:
                continue
            code, t = str(r[0]), str(r[1] or "")
            k = kinds_of(t)
            if not k:
                continue
            kinds[code] |= k
            ptype.setdefault(code, t)
            if sheet == "입소인원" and "home" in k and isinstance(r[3], (int, float)) and t[:1] == "A":
                cap[code] = max(cap[code], int(r[3]))

    # 평가: 기관·종류별 가장 최근 평가
    best: dict[tuple[str, str], tuple[str, str, int]] = {}
    with open(evcsv, encoding="cp949") as f:
        for r in csv.DictReader(f):
            code = r["장기요양기관기호"].replace("-", "")
            kind = EVAL_KIND.get(r["급여종류"][:2])
            grade = (r["평가등급"] or "").strip()
            if not kind or grade not in ("A", "B", "C", "D", "E"):
                continue
            date = r["평가일자"]
            year = int(r["평가구분"][:4]) if r["평가구분"][:4].isdigit() else 0
            key = (code, kind)
            if key not in best or date > best[key][1]:
                best[key] = (grade, date, year)

    by_sido: dict[str, list] = defaultdict(list)
    for code, r in gen.items():
        k = kinds.get(code)
        addr = (r[9] or "").strip()
        if not k or not addr:
            continue
        d = str(r[7] or "")
        grades = {kd: [best[(code, kd)][0], best[(code, kd)][2]] for kd in k if (code, kd) in best}
        by_sido[str(r[3])].append(
            {
                "c": code,
                "n": str(r[1]).strip(),
                "a": " ".join(addr.split()),
                # 시도 시군구 법정동명: 주소로 못 찾을 때 이름 검색 범위·동네 중심 위치로 씀
                "b": " ".join(str(r[6] or "").split()),
                "d": f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else "",
                "k": sorted(k),
                "g": grades,
                "p": ptype.get(code, ""),
                "q": cap.get(code, 0),
            }
        )

    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith("facilities-"):
            os.remove(os.path.join(OUT, f))
    total = 0
    for sido, rows in sorted(by_sido.items()):
        rows.sort(key=lambda x: x["c"])
        with open(os.path.join(OUT, f"facilities-{sido}.json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
        total += len(rows)
    meta = {
        "sido": sorted(by_sido),
        "count": total,
        "facilitiesAsOf": "2026-06-10",
        "evaluationAsOf": "2026-06-25",
        "version": "2026-06-25",
    }
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    print(json.dumps(meta, ensure_ascii=False))
    print("graded", sum(1 for rows in by_sido.values() for x in rows if x["g"]))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
