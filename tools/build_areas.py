"""Costruisce i confini semplificati delle aree di allerta per la mappa:
  web/data/areas.js  regioni italiane e dipartimenti francesi (aree MeteoAlarm)
  web/data/eaws.js   micro-regioni dei bollettini valanghe (EAWS)
Uso: python3 tools/build_areas.py   (da rilanciare solo se cambiano i confini)"""
import json, re, time, unicodedata, urllib.request

def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "MeteoRotte/0.5"}), timeout=90))

def key(name):  # stessa normalizzazione usata dal worker per i nomi delle aree MeteoAlarm
    s = unicodedata.normalize("NFD", name.split("/")[0]).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", re.sub(r"\be\b", " ", s)).strip()

def simplify(pts, tol):  # Douglas-Peucker iterativo
    if len(pts) < 5: return pts
    mid = len(pts) // 2  # gli anelli sono chiusi (primo punto = ultimo): si parte da due metà
    keep = [False] * len(pts); keep[0] = keep[mid] = keep[-1] = True; stack = [(0, mid), (mid, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2 - x1, y2 - y1; n = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, idx = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / n
            if d > best: best, idx = d, i
        if best > tol: keep[idx] = True; stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]

def rings(geom, tol, min_pts=4):  # solo anelli esterni, come [[lat, lon], ...]
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    out = []
    for p in polys:
        r = simplify([(c[0], c[1]) for c in p[0]], tol)
        if len(r) >= min_pts: out.append([[round(y, 3), round(x, 3)] for x, y in r])
    return out

areas = {"italy": {}, "france": {}}
for f in get("https://cdn.jsdelivr.net/gh/openpolis/geojson-italy@master/geojson/limits_IT_regions.geojson")["features"]:
    n = f["properties"]["reg_name"].split("/")[0]
    areas["italy"][key(n)] = {"n": n, "g": rings(f["geometry"], 0.01, 12)}
for f in get("https://cdn.jsdelivr.net/gh/gregoiredavid/france-geojson@master/departements-version-simplifiee.geojson")["features"]:
    areas["france"][key(f["properties"]["nom"])] = {"n": f["properties"]["nom"], "c": f["properties"]["code"], "g": rings(f["geometry"], 0.01, 6)}

eaws = {}
for prov in ["IT-21", "IT-23", "IT-25", "IT-34", "IT-36", "IT-57", "FR", "SI"]:
    for f in get(f"https://regions.avalanches.org/micro-regions/{prov}_micro-regions.geojson.json")["features"]:
        if f["properties"].get("end_date"): continue
        eaws[f["properties"]["id"]] = rings(f["geometry"], 0.004, 4)

hdr = "// Generato da tools/build_areas.py il %s. Fonti: openpolis/geojson-italy (ISTAT), gregoiredavid/france-geojson (IGN), EAWS regions.\n" % time.strftime("%Y-%m-%d")
dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
open("web/data/areas.js", "w", encoding="utf-8").write(hdr + "window.AREAS = " + dump(areas) + ";\n")
open("web/data/eaws.js", "w", encoding="utf-8").write(hdr + "window.EAWS_REGIONS = " + dump(eaws) + ";\n")
print("regioni IT", len(areas["italy"]), "dipartimenti FR", len(areas["france"]), "micro-regioni EAWS", len(eaws))
