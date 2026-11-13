"""Costruisce web/data/dpc-zones.js: i confini semplificati delle zone di allerta della Protezione Civile,
dallo shapefile del Bollettino di criticità nazionale (repository pcm-dpc, licenza CC BY 4.0).
Uso: python3 tools/build_dpc_zones.py   (da rilanciare solo se cambiano le zone)"""
import io, json, struct, time, urllib.request, zipfile
URL = "https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/all/latest_all.zip"
z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(URL, timeout=120).read()))
name = [n for n in z.namelist() if n.endswith("_today.shp")][0][:-4]
shp, dbf = z.read(name + ".shp"), z.read(name + ".dbf")

def read_dbf(b):
    n, hl, rl = struct.unpack("<IHH", b[4:12]); fields = []; p = 32
    while b[p] != 0x0D: fields.append((b[p:p + 11].split(b"\0")[0].decode(), b[p + 16])); p += 32
    rows = []
    for i in range(n):
        r = b[hl + i * rl: hl + (i + 1) * rl]; o = 1; d = {}
        for nm, l in fields: d[nm] = r[o:o + l].decode("latin-1").strip(); o += l
        rows.append(d)
    return rows

def simplify(pts, tol):
    if len(pts) < 5: return pts
    mid = len(pts) // 2; keep = [False] * len(pts); keep[0] = keep[mid] = keep[-1] = True; stack = [(0, mid), (mid, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2 - x1, y2 - y1; n = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, idx = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / n
            if d > best: best, idx = d, i
        if best > tol: keep[idx] = True; stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]

def area(r): return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2

shapes, p = [], 100
while p < len(shp):
    clen = struct.unpack(">i", shp[p + 4:p + 8])[0] * 2; c = shp[p + 8:p + 8 + clen]; p += 8 + clen
    if struct.unpack("<i", c[:4])[0] != 5: shapes.append([]); continue
    nparts, npts = struct.unpack("<ii", c[36:44]); parts = list(struct.unpack("<%di" % nparts, c[44:44 + 4 * nparts])) + [npts]
    pts = struct.unpack("<%dd" % (2 * npts), c[44 + 4 * nparts:44 + 4 * nparts + 16 * npts])
    rings = []
    for k in range(nparts):
        r = [(pts[2 * i], pts[2 * i + 1]) for i in range(parts[k], parts[k + 1])]
        if area(r) < 0 and abs(area(r)) > 0.0008:  # solo anelli esterni (senso orario), senza isolotti
            s = simplify(r, 0.004)
            if len(s) >= 4: rings.append([[round(y, 3), round(x, 3)] for x, y in s])
    shapes.append(rings)
rows = read_dbf(dbf); assert len(rows) == len(shapes)
zones = {}
for row, g in zip(rows, shapes):
    z0 = zones.setdefault(row["Zona_all"], {"n": row["Nome_zona"], "g": []}); z0["g"] += g
open("web/data/dpc-zones.js", "w", encoding="utf-8").write(
    "// Zone di allerta della Protezione Civile (Dipartimento della Protezione Civile, CC BY 4.0). Generato da tools/build_dpc_zones.py il %s\n(typeof window !== 'undefined' ? window : globalThis).DPC_ZONES = %s;\n"
    % (time.strftime("%Y-%m-%d"), json.dumps(zones, ensure_ascii=False, separators=(",", ":"))))
print(len(zones), "zone,", sum(len(z["g"]) for z in zones.values()), "poligoni")
