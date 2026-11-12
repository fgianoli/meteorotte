"""Trova, per ogni punto fluviale, la cella GloFAS (0.05°) vicina con la portata mediana più alta,
cioè quella che sta davvero sull'asta principale del fiume. Uso: python3 tools/snap_glofas.py"""
import json, re, statistics, urllib.request, urllib.parse

src = open("data/hotspots.js", encoding="utf-8").read()
pts = re.findall(r'id: "([^"]+)".*?tipo: "fiume", lat: ([\d.]+), lon: ([\d.]+)', src)
for sid, lat, lon in pts:
    lat, lon = float(lat), float(lon)
    cand = [(round(lat + dy * 0.05, 3), round(lon + dx * 0.05, 3)) for dy in range(-2, 3) for dx in range(-2, 3)]
    q = urllib.parse.urlencode({"latitude": ",".join(str(c[0]) for c in cand), "longitude": ",".join(str(c[1]) for c in cand),
                                "daily": "river_discharge", "past_days": 31, "forecast_days": 1})
    data = json.load(urllib.request.urlopen("https://flood-api.open-meteo.com/v1/flood?" + q, timeout=30))
    best = max(((statistics.median([x for x in r["daily"]["river_discharge"] if x is not None] or [0]), c) for r, c in zip(data, cand)))
    print(f'{sid:22s} flood: [{best[1][0]}, {best[1][1]}]  mediana {best[0]:.1f} m³/s')
