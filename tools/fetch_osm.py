"""Scarica da OpenStreetMap (Overpass) bivacchi e ripari liberi (niente rifugi custoditi a pagamento) entro RADIUS km dai punti critici
e scrive web/data/shelters.js. Da rilanciare ogni tanto: python3 tools/fetch_osm.py"""
import json, re, sys, time, urllib.request, urllib.parse
RADIUS = 15000
src = open("web/data/hotspots.js", encoding="utf-8").read()
pts = [(float(a), float(b)) for a, b in re.findall(r'tipo: "[a-z]+", lat: ([\d.]+), lon: ([\d.]+)', src)]
URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
data, failed = {"elements": []}, []
for n, (la, lo) in enumerate(pts, 1):  # una richiesta per punto: le query grandi vanno in timeout
    q = f'[out:json][timeout:25];(nwr["tourism"="wilderness_hut"](around:{RADIUS},{la},{lo});nwr["amenity"="shelter"]["shelter_type"~"^(basic_hut|weather_shelter|lean_to)$"](around:{RADIUS},{la},{lo}););out center tags;'
    for k, url in enumerate(URLS * 2):
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "MeteoRotte/0.4"})
            els = json.load(urllib.request.urlopen(req, timeout=40))["elements"]
            data["elements"] += els; print(f"{n}/{len(pts)} ok ({len(els)})", flush=True); break
        except Exception as e:
            print(f"{n}/{len(pts)} {url.split('/')[2]}: {e}", file=sys.stderr, flush=True); time.sleep(3 + 2 * k)
    else:
        failed.append((la, lo))
    time.sleep(2)
if failed: print(f"ATTENZIONE: {len(failed)} punti senza risposta (i server Overpass sono spesso sovraccarichi): rilancia più tardi.", file=sys.stderr)
if not data["elements"]: sys.exit("Nessun dato scaricato: file non modificato")
out, seen = [], set()
for e in data["elements"]:
    t = e.get("tags", {}); la = e.get("lat") or e.get("center", {}).get("lat"); lo = e.get("lon") or e.get("center", {}).get("lon")
    if la is None or t.get("access") in ("private", "no", "customers") or t.get("fee") == "yes": continue  # solo ripari liberi e gratuiti
    kind = "bivacco" if t.get("tourism") == "wilderness_hut" else "riparo"
    key = (round(la, 4), round(lo, 4))
    if key in seen: continue
    seen.add(key)
    ele = re.match(r"-?\d+", t.get("ele", "") or "")
    out.append({"n": t.get("name", ""), "k": kind, "lat": round(la, 5), "lon": round(lo, 5), "q": int(ele.group()) if ele else None})
out.sort(key=lambda x: (x["k"], x["n"]))
open("web/data/shelters.js", "w", encoding="utf-8").write(
    "// Bivacchi, rifugi e ripari da OpenStreetMap (© OpenStreetMap contributors, ODbL). Generato da tools/fetch_osm.py il %s\nwindow.SHELTERS = %s;\n"
    % (time.strftime("%Y-%m-%d"), json.dumps(out, ensure_ascii=False, separators=(",", ":"))))
from collections import Counter; print(len(out), Counter(x["k"] for x in out))
