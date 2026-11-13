(function () {
  "use strict";
  const LEVEL_COLOR = ["#16a34a", "#eab308", "#f97316", "#dc2626"];
  const LEVEL_NAME = [0, 1, 2, 3].map((i) => T("lvl" + i));
  const HZ_NAME = Object.fromEntries(["official", "flood", "rain", "cold", "heat", "snow", "wind"].map((k) => [k, T("hz_" + k)]));
  const HOURLY = "temperature_2m,apparent_temperature,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day";
  const CACHE_KEY = "meteorotte-cache-v1";

  const $ = (s) => document.querySelector(s);
  const state = { results: {}, selected: null, region: "Tutte", lang: "it", fetchedAt: null, markers: {} };

  // ---------- mappa
  const map = L.map("map", { zoomControl: true }).setView([44.6, 14.5], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap · meteo © Open-Meteo (ECMWF, DWD ICON, Météo-France) · piene © Copernicus GloFAS · radar © RainViewer"
  }).addTo(map);

  const radarLayer = L.layerGroup();
  const windLayer = L.layerGroup();
  // Sentieri segnati (Waymarked Trails, dati OSM) e ripari in quota (OSM, file statico generato da tools/fetch_osm.py)
  const trailLayer = L.tileLayer("https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png", { maxZoom: 18, opacity: 0.85, attribution: "sentieri © waymarkedtrails.org (CC BY-SA)" });
  const KIND = {
    bivacco: ["⛺", "Bivacco: non custodito, di solito sempre aperto"],
    rifugio: ["🏠", "Rifugio: in inverno può essere chiuso (a volte resta aperto un locale invernale)"],
    riparo: ["🛖", "Riparo semplice"],
    accoglienza: ["🛏️", "Accoglienza"], associazione: ["🤝", "Associazione"], cibo: ["🍲", "Cibo"], salute: ["⚕️", "Salute"]
  };
  function poi(lat, lon, kind, rows) {
    const box = document.createElement("div");
    rows.filter(Boolean).forEach((r, i) => { const d = document.createElement(i ? "div" : "b"); d.textContent = r; box.appendChild(d); });
    return L.marker([lat, lon], { icon: L.divIcon({ className: "poi", html: (KIND[kind] || ["📍"])[0], iconSize: [24, 24], iconAnchor: [12, 12] }) }).bindPopup(box);
  }
  const shelterLayer = L.layerGroup();
  (window.SHELTERS || []).forEach((s) => poi(s.lat, s.lon, s.k, [s.n || KIND[s.k][1].split(":")[0], KIND[s.k][1], s.q ? "Quota " + s.q + " m" : "", "Fonte: OpenStreetMap, da verificare"]).addTo(shelterLayer));
  const aidLayer = L.layerGroup();
  (window.AIUTI || []).forEach((a) => poi(a.lat, a.lon, a.tipo, [a.nome, (KIND[a.tipo] || [, a.tipo])[1], a.orari, a.contatto, a.verificato ? "Verificato il " + a.verificato : ""]).addTo(aidLayer));
  const overlays = { [T("radar")]: radarLayer, [T("wind")]: windLayer, [T("trails")]: trailLayer };
  if ((window.SHELTERS || []).length) overlays[T("shelters")] = shelterLayer;
  if ((window.AIUTI || []).length) { overlays[T("aid")] = aidLayer; aidLayer.addTo(map); }
  L.control.layers(null, overlays, { collapsed: window.innerWidth < 800 }).addTo(map);

  const legend = L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const d = L.DomUtil.create("div", "legend");
    d.innerHTML = LEVEL_NAME.map((n, i) => `<div><i style="background:${LEVEL_COLOR[i]}"></i>${n}</div>`).join("") + "<div style='color:#64748b'>" + T("next72") + "</div>";
    return d;
  };
  legend.addTo(map);

  // ---------- dati
  function forecastURL(points) {
    const p = new URLSearchParams({
      latitude: points.map((x) => x[0].toFixed(3)).join(","),
      longitude: points.map((x) => x[1].toFixed(3)).join(","),
      hourly: HOURLY, past_days: "1", forecast_days: "4", timeformat: "unixtime", timezone: "GMT", wind_speed_unit: "kmh"
    });
    return "https://api.open-meteo.com/v1/forecast?" + p;
  }
  function floodURL(points) {
    const p = new URLSearchParams({
      latitude: points.map((x) => x[0].toFixed(3)).join(","),
      longitude: points.map((x) => x[1].toFixed(3)).join(","),
      daily: "river_discharge", past_days: "31", forecast_days: "7"
    });
    return "https://flood-api.open-meteo.com/v1/flood?" + p;
  }
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status + " " + url.split("?")[0]);
    const j = await r.json();
    return Array.isArray(j) ? j : [j];
  }

  async function loadAll() {
    $("#status").textContent = T("downloading");
    const points = []; const index = [];
    HOTSPOTS.forEach((s) => {
      index.push({ id: s.id, role: "site" }); points.push([s.lat, s.lon]);
      (s.upstream || []).forEach((u) => { index.push({ id: s.id, role: "up" }); points.push(u); });
    });
    const rivers = HOTSPOTS.filter((s) => s.tipo === "fiume" && s.flood !== false);
    const [wx, fl] = await Promise.all([
      getJSON(forecastURL(points)),
      (rivers.length ? getJSON(floodURL(rivers.map((s) => s.flood || [s.lat, s.lon]))) : Promise.resolve([])).catch((e) => { console.warn("GloFAS non disponibile", e); return []; })
    ]);
    const raw = {};
    HOTSPOTS.forEach((s) => (raw[s.id] = { wx: null, up: [], flood: null }));
    wx.forEach((w, k) => { const ix = index[k]; if (ix.role === "site") raw[ix.id].wx = w; else raw[ix.id].up.push(w); });
    rivers.forEach((s, k) => (raw[s.id].flood = fl[k] || null));
    return raw;
  }

  function compute(raw) {
    const now = Date.now() / 1000;
    state.results = {};
    HOTSPOTS.forEach((s) => {
      const r = raw[s.id];
      if (!r || !r.wx) return;
      state.results[s.id] = { site: s, wx: r.wx, res: Alerts.evaluate(s, r.wx, r.up, r.flood, now) };
    });
  }

  // Modalità server: il worker Docker pubblica api/alerts.json (dati già calcolati, comprese allerte ufficiali e idrometri).
  async function loadServer() {
    const r = await fetch("api/alerts.json", { cache: "no-store" });
    if (!r.ok) throw new Error("api " + r.status);
    const j = await r.json();
    if (Date.now() - Date.parse(j.generated) > 3 * 3600e3) throw new Error("dati del server vecchi");
    state.results = {};
    j.sites.forEach((x) => {
      const site = HOTSPOTS.find((s) => s.id === x.id);
      if (!site) return;
      const n = x.wx.hourly.time.length;
      state.results[x.id] = { site, wx: x.wx, res: Object.assign({ startIndex: 0, endIndex: n }, x.res), hydro: x.hydro, obs: x.obs };
    });
    return j;
  }

  async function refresh() {
    const hhmm = (t) => new Date(t).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
    try {
      const j = await loadServer();
      state.fetchedAt = Date.parse(j.generated); state.mode = "server";
      const ko = Object.entries(j.sources).filter(([, v]) => !/^(ok|nessun|non configurato)/.test(v)).map(([k]) => k);
      $("#status").textContent = T("server") + " " + hhmm(state.fetchedAt) + (ko.length ? " · ⚠️ " + T("missing") + ": " + ko.join(", ") : "");
      return render();
    } catch (e) { console.info("Server non disponibile, uso le API direttamente:", e.message); }
    try {
      const raw = await loadAll();
      state.fetchedAt = Date.now(); state.mode = "direct";
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: state.fetchedAt, raw })); } catch (e) {}
      compute(raw);
      $("#status").textContent = T("direct") + " " + hhmm(state.fetchedAt);
    } catch (e) {
      console.error(e);
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) {}
      if (cached) {
        state.fetchedAt = cached.t; compute(cached.raw);
        $("#status").textContent = T("offline") + " " + new Date(cached.t).toLocaleString(LOCALE);
      } else {
        $("#status").textContent = T("failed") + " (" + e.message + ")";
      }
    }
    render();
  }

  // ---------- interfaccia
  function fmtTime(sec) {
    return new Date(sec * 1000).toLocaleString(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }

  function renderFilters() {
    const regions = ["Tutte"].concat([...new Set(HOTSPOTS.map((s) => s.regione))]);
    $("#filters").innerHTML = regions.map((r) => `<span class="chip ${r === state.region ? "on" : ""}" data-r="${r}">${r === "Tutte" ? T("all") : r}</span>`).join("");
    $("#filters").querySelectorAll(".chip").forEach((c) => c.onclick = () => {
      state.region = c.dataset.r; render();
      const vis = HOTSPOTS.filter((s) => state.region === "Tutte" || s.regione === state.region);
      if (vis.length) map.fitBounds(L.latLngBounds(vis.map((s) => [s.lat, s.lon])).pad(0.3));
    });
  }

  function renderList() {
    const items = Object.values(state.results)
      .filter((x) => state.region === "Tutte" || x.site.regione === state.region)
      .sort((a, b) => b.res.level - a.res.level || a.site.nome.localeCompare(b.site.nome));
    $("#list").innerHTML = items.map((x) => {
      const hz = x.res.hazards.map((h) => `${LEVEL_ICON[h.level]}${ICONS[h.type]}`).join(" ") || "—";
      return `<div class="site ${state.selected === x.site.id ? "sel" : ""}" data-id="${x.site.id}">
        <span class="dot" style="background:${LEVEL_COLOR[x.res.level]}"></span>
        <div><b>${x.site.nome}</b><small>${x.site.regione} · ${x.site.tipo} · ${Math.round(x.wx.elevation)} m</small>
        <div class="hz">${hz}</div></div></div>`;
    }).join("") || "<p style='padding:12px'>" + T("noData") + "</p>";
    $("#list").querySelectorAll(".site").forEach((el) => el.onclick = () => select(el.dataset.id, true));
  }

  function renderMarkers() {
    Object.values(state.markers).forEach((m) => m.remove());
    state.markers = {};
    Object.values(state.results).forEach((x) => {
      const m = L.circleMarker([x.site.lat, x.site.lon], {
        radius: x.site.id === state.selected ? 11 : 8, color: "#fff", weight: 2, fillColor: LEVEL_COLOR[x.res.level], fillOpacity: 0.95
      }).addTo(map).bindTooltip(x.site.nome);
      m.on("click", () => select(x.site.id, false));
      state.markers[x.site.id] = m;
    });
  }

  function sparkline(x) {
    const h = x.wx.hourly, s = x.res.startIndex, e = x.res.endIndex;
    const T = h.apparent_temperature.slice(s, e), P = h.precipitation.slice(s, e), S = (h.snowfall || []).slice(s, e);
    const W = 340, H = 90, n = T.length;
    const tmin = Math.min(...T, 0) - 2, tmax = Math.max(...T, 5) + 2;
    const pmax = Math.max(5, ...P);
    const xs = (i) => (i / (n - 1)) * W, yt = (v) => H - 14 - ((v - tmin) / (tmax - tmin)) * (H - 24);
    const bars = P.map((p, i) => p > 0 ? `<rect x="${xs(i).toFixed(1)}" y="${(H - 12 - (p / pmax) * 40).toFixed(1)}" width="${(W / n).toFixed(1)}" height="${((p / pmax) * 40).toFixed(1)}" fill="${S[i] > 0 ? "#93c5fd" : "#2563eb"}" opacity=".6"/>` : "").join("");
    const line = T.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${yt(v).toFixed(1)}`).join("");
    const zero = (tmin < 0 && tmax > 0) ? `<line x1="0" x2="${W}" y1="${yt(0)}" y2="${yt(0)}" stroke="#94a3b8" stroke-dasharray="3 3"/><text x="2" y="${yt(0) - 2}" font-size="9" fill="#64748b">0°</text>` : "";
    const days = []; for (let i = 0; i < n; i++) { const d = new Date(h.time[s + i] * 1000); if (d.getHours() === 0) days.push(`<line x1="${xs(i)}" x2="${xs(i)}" y1="0" y2="${H - 12}" stroke="#e2e8f0"/><text x="${xs(i) + 2}" y="${H - 2}" font-size="9" fill="#64748b">${d.toLocaleDateString(LOCALE, { weekday: "short" })}</text>`); }
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${days.join("")}${bars}${zero}<path d="${line}" fill="none" stroke="#dc2626" stroke-width="1.6"/>
      <text x="${W - 2}" y="10" font-size="9" text-anchor="end" fill="#64748b">T percepita ${Math.round(Math.min(...T))}…${Math.round(Math.max(...T))}°C · pioggia max ${Math.max(...P).toFixed(1)} mm/h</text></svg>`;
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hm = (sec) => new Date(sec * 1000).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  // Ore di buio: dal tramonto all'alba successiva, dalle previsioni orarie.
  function night(x) {
    const h = x.wx.hourly, d = h.is_day;
    if (!d || !d.length) return "";
    const s = x.res.startIndex, e = x.res.endIndex;
    let a = -1, b = -1;
    if (d[s] === 0) a = s; else for (let i = s + 1; i < e; i++) if (d[i] === 0) { a = i; break; }
    if (a < 0) return "";
    for (let i = a + 1; i < e; i++) if (d[i] === 1) { b = i; break; }
    return `<div class="fact">🌙 ${a === s ? T("darkNow") : T("darkFrom") + " " + hm(h.time[a])}${b > 0 ? " " + T("until") + " " + hm(h.time[b]) : ""}</div>`;
  }
  // Stazione meteo più vicina: dato misurato, non previsto.
  function obsLine(x) {
    const o = x.obs;
    if (!o) return "";
    const p = [o.t + " °C"];
    if (o.wind != null) p.push("💨 " + Math.round(o.wind) + (o.gust != null ? "/" + Math.round(o.gust) : "") + " km/h");
    if (o.snow) p.push("❄️ " + o.snow + " cm");
    return `<div class="fact">🌡️ ${T("measured")} ${esc(o.label)}${o.alt ? " (" + Math.round(o.alt) + " m" : " ("}${o.km ? ", " + o.km + " km" : ""}): <b>${p.join(" · ")}</b> · ${hm(o.time)} <span>${esc(o.source)}</span></div>`;
  }

  // Striscia colorata: livello di allerta ora per ora nelle prossime 72 ore (dai modelli meteo).
  function timeline(x) {
    const tl = x.res.timeline || [];
    if (!tl.length) return "";
    const t0 = x.wx.hourly.time[x.res.startIndex];
    const cells = tl.map((l, i) => `<i style="background:${LEVEL_COLOR[l]}${new Date((t0 + i * 3600) * 1000).getHours() === 0 ? ";border-left:2px solid #0f172a" : ""}" title="${fmtTime(t0 + i * 3600)}"></i>`).join("");
    return `<div class="tlh">${T("tl")} <span>${T("tlSpan")}</span></div><div class="tl">${cells}</div>`;
  }

  // Cartello a schermo intero da proiettare o stampare nei punti di accoglienza.
  function showPoster(x) {
    const lang = LANGS.find((l) => l.code === state.lang);
    const lines = composeMessage(x.site, x.res, state.lang).split("\n");
    let qr = "";
    try { if (window.qrcode) { const q = window.qrcode(0, "M"); q.addData(location.origin + location.pathname); q.make(); qr = q.createSvgTag({ cellSize: 3, margin: 2 }); } } catch (e) {}
    const el = document.createElement("div");
    el.className = "poster";
    el.innerHTML = `<div class="ph" style="background:${LEVEL_COLOR[x.res.level]};color:${x.res.level === 1 ? "#111" : "#fff"}"><span>${x.site.nome}</span>
        <span class="noprint"><button class="btn ghost" id="pprint">${T("print")}</button> <button class="btn ghost" id="pclose">${T("close")}</button></span></div>
      <div class="pb" dir="${lang.rtl ? "rtl" : "ltr"}" lang="${lang.code}"></div>
      <div class="pf">${qr}<div>${T("updated")}: ${new Date(state.fetchedAt).toLocaleString(LOCALE)}<br>${T("posterNote")}${lang.bozza ? "<br>" + T("draftShort") : ""}</div></div>`;
    const pb = el.querySelector(".pb");
    lines.slice(1).forEach((ln) => { const p = document.createElement("p"); p.textContent = ln; pb.appendChild(p); });
    document.body.appendChild(el);
    el.querySelector("#pclose").onclick = () => el.remove();
    el.querySelector("#pprint").onclick = () => { try { window.print(); } catch (e) {} };
  }

  function renderDetail() {
    const d = $("#detail");
    const x = state.results[state.selected];
    if (!x) { d.style.display = "none"; return; }
    const lang = LANGS.find((l) => l.code === state.lang);
    const msg = composeMessage(x.site, x.res, state.lang);
    const rows = x.res.hazards.map((h) => `<tr><td>${LEVEL_ICON[h.level]} ${ICONS[h.type]}</td><td><b>${HZ_NAME[h.type]}</b><br><small>${LEVEL_NAME[h.level]} ${T("from")} ${fmtTime(h.time)} · ${h.value != null ? Math.round(h.value) + " " : ""}${h.unit} · ${h.link ? `<a href="${h.link}" target="_blank" rel="noopener">${h.source}</a>` : h.source}</small></td></tr>`).join("")
      || `<tr><td>🟢</td><td>${T("none72")}</td></tr>`;
    const links = (LINKS[x.site.paese] || []).concat(LINKS.ALL).map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join("");
    d.style.display = "block";
    d.innerHTML = `<h2>${x.site.nome}</h2><p class="note">${x.site.note || ""}<br>${T("emergency")}: <b>${EMERGENCY[x.site.paese] || "112"}</b></p>
      ${timeline(x)}
      ${sparkline(x)}
      ${night(x)}${obsLine(x)}
      ${(x.hydro || []).map((h) => `<div class="fact">💧 ${esc(h.label)}: ${h.h_mm != null ? (h.h_mm / 1000).toFixed(2) + " m" : ""}${h.q != null ? " · " + h.q + " m³/s" : ""} · ${hm(h.t)}${h.soglia ? ` <span>(${T("threshold")}: ${esc(h.soglia)})</span>` : ""}</div>`).join("")}
      <table class="hzt">${rows}</table>
      <div class="msg" dir="${lang.rtl ? "rtl" : "ltr"}" lang="${lang.code}" id="msgbox"></div>
      ${lang.bozza ? `<div class="warn">⚠️ ${lang.label}: ${T("draft")}</div>` : ""}
      <div class="row"><button class="btn" id="copy">${T("copy")}</button><button class="btn ghost" id="copyall">${T("copyAll")}</button><button class="btn ghost" id="poster">${T("poster")}</button><span id="copied" style="font-size:12px;color:#16a34a"></span></div>
      <div class="links">${T("official")} ${links}</div>`;
    $("#msgbox").textContent = msg;
    const copy = async (text) => {
      try { await navigator.clipboard.writeText(text); $("#copied").textContent = T("copied"); }
      catch (e) { $("#copied").textContent = T("copyFail"); }
    };
    $("#copy").onclick = () => copy(msg);
    $("#poster").onclick = () => showPoster(x);
    $("#copyall").onclick = () => copy(LANGS.map((l) => composeMessage(x.site, x.res, l.code)).join("\n\n— — —\n\n"));
  }

  function select(id, pan) {
    state.selected = id;
    const x = state.results[id];
    if (pan && x) map.setView([x.site.lat, x.site.lon], Math.max(map.getZoom(), 9));
    render();
    $("aside").scrollTop = 0;
  }

  function render() { renderFilters(); renderDetail(); renderList(); renderMarkers(); }

  // ---------- lingua dell'interfaccia
  document.documentElement.lang = UI_LANG;
  document.querySelectorAll("[data-t]").forEach((el) => { el.innerHTML = T(el.dataset.t); });
  $("#uilang").innerHTML = UI_LANGS.map((l) => `<option value="${l}" ${l === UI_LANG ? "selected" : ""}>${l.toUpperCase()}</option>`).join("");
  $("#uilang").onchange = (e) => { try { localStorage.setItem("meteorotte-ui", e.target.value); } catch (_) {} location.reload(); };

  // ---------- lingua
  $("#lang").innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.label}</option>`).join("");
  $("#lang").onchange = (e) => { state.lang = e.target.value; renderDetail(); };
  $("#refresh").onclick = refresh;

  // ---------- radar (RainViewer)
  const radarCtl = L.control({ position: "bottomleft" });
  let radarFrames = [], radarTiles = [], radarIdx = 0, radarTimer = null;
  radarCtl.onAdd = () => {
    const d = L.DomUtil.create("div", "radarctl");
    d.innerHTML = `<button id="rplay" class="btn ghost" style="padding:2px 8px">▶</button><input id="rslider" type="range" min="0" max="0" value="0"><span id="rtime"></span>`;
    L.DomEvent.disableClickPropagation(d);
    return d;
  };
  radarCtl.addTo(map);

  function showRadarFrame(i) {
    radarIdx = i;
    radarTiles.forEach((t, k) => t.setOpacity(k === i ? 0.7 : 0));
    const f = radarFrames[i];
    if (f) $("#rtime").textContent = new Date(f.time * 1000).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) + (f.nowcast ? " (previsione)" : "");
    $("#rslider").value = i;
  }
  async function loadRadar() {
    try {
      const r = await fetch("https://api.rainviewer.com/public/weather-maps.json");
      const j = await r.json();
      radarFrames = (j.radar.past || []).concat((j.radar.nowcast || []).map((f) => Object.assign({ nowcast: true }, f)));
      radarLayer.clearLayers();
      radarTiles = radarFrames.map((f) => L.tileLayer(j.host + f.path + "/256/{z}/{x}/{y}/2/1_1.png", { opacity: 0, maxNativeZoom: 7, maxZoom: 18, zIndex: 400 }).addTo(radarLayer));
      $("#rslider").max = radarFrames.length - 1;
      showRadarFrame(Math.max(0, (j.radar.past || []).length - 1));
    } catch (e) { console.warn("Radar non disponibile", e); $("#rtime").textContent = "radar non disponibile"; }
  }
  map.on("overlayadd", (e) => {
    if (e.layer === radarLayer) { document.querySelector(".radarctl").style.display = "flex"; loadRadar(); }
    if (e.layer === windLayer) loadWind();
  });
  map.on("overlayremove", (e) => {
    if (e.layer === radarLayer) { document.querySelector(".radarctl").style.display = "none"; clearInterval(radarTimer); radarTimer = null; }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "rslider") showRadarFrame(+e.target.value); });
  document.addEventListener("click", (e) => {
    if (e.target.id !== "rplay") return;
    if (radarTimer) { clearInterval(radarTimer); radarTimer = null; e.target.textContent = "▶"; }
    else { e.target.textContent = "⏸"; radarTimer = setInterval(() => showRadarFrame((radarIdx + 1) % radarFrames.length), 600); }
  });

  // ---------- vento (griglia Open-Meteo sulla vista corrente)
  let windTimer = null;
  async function loadWind() {
    if (!map.hasLayer(windLayer)) return;
    const b = map.getBounds(), nx = 9, ny = 7, pts = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++)
      pts.push([b.getSouth() + (j + 0.5) * (b.getNorth() - b.getSouth()) / ny, b.getWest() + (i + 0.5) * (b.getEast() - b.getWest()) / nx]);
    const p = new URLSearchParams({
      latitude: pts.map((x) => x[0].toFixed(2)).join(","), longitude: pts.map((x) => x[1].toFixed(2)).join(","),
      current: "wind_speed_10m,wind_direction_10m,wind_gusts_10m", wind_speed_unit: "kmh"
    });
    try {
      const res = await getJSON("https://api.open-meteo.com/v1/forecast?" + p);
      windLayer.clearLayers();
      res.forEach((r, k) => {
        const c = r.current; if (!c) return;
        const col = c.wind_gusts_10m >= 80 ? "#dc2626" : c.wind_gusts_10m >= 60 ? "#f97316" : c.wind_gusts_10m >= 40 ? "#ca8a04" : "#0f172a";
        L.marker(pts[k], { interactive: false, icon: L.divIcon({ className: "wind-arrow", iconSize: [60, 24], iconAnchor: [30, 12],
          html: `<span style="transform:rotate(${(c.wind_direction_10m + 180) % 360}deg);color:${col}">↑</span> ${Math.round(c.wind_speed_10m)}<small>/${Math.round(c.wind_gusts_10m)}</small>` }) }).addTo(windLayer);
      });
    } catch (e) { console.warn("Vento non disponibile", e); }
  }
  map.on("moveend", () => { clearTimeout(windTimer); windTimer = setTimeout(loadWind, 500); });

  // ---------- avvertenze
  function showDisclaimer() {
    if (document.querySelector(".modal")) return;
    const el = document.createElement("div");
    el.className = "modal";
    el.innerHTML = `<div class="mbox"><h2>${T("discTitle")}</h2>
      <ul>${T("disc").map((x) => "<li>" + x + "</li>").join("")}</ul>
      <p class="src">${T("discSrc")} Open-Meteo (ECMWF, DWD, Météo-France), Copernicus EMS GloFAS, MeteoAlarm/EUMETNET, Hub'Eau, ARPAL, ARSO, DHMZ, EAWS/AINEVA, RainViewer, © OpenStreetMap contributors (ODbL), Waymarked Trails.</p>
      <button class="btn" id="mok">${T("discOk")}</button></div>`;
    document.body.appendChild(el);
    el.querySelector("#mok").onclick = () => { try { localStorage.setItem("meteorotte-avvertenze", "1"); } catch (e) {} el.remove(); };
  }
  $("#info").onclick = showDisclaimer;
  try { if (!localStorage.getItem("meteorotte-avvertenze")) showDisclaimer(); } catch (e) { showDisclaimer(); }

  // ---------- notifiche push (solo con il server e su HTTPS)
  const b64 = (s) => Uint8Array.from(atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  async function pushState() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !location.protocol.startsWith("https")) return null;
    const reg = await navigator.serviceWorker.ready;
    return { reg, sub: await reg.pushManager.getSubscription() };
  }
  async function togglePush() {
    const btn = $("#push");
    try {
      const st = await pushState();
      if (!st) return;
      if (st.sub) {
        await fetch("push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: st.sub.endpoint }) });
        await st.sub.unsubscribe(); btn.textContent = "🔔 " + T("pushOff"); return;
      }
      if ((await Notification.requestPermission()) !== "granted") { btn.textContent = "🔕 " + T("pushDenied"); return; }
      const { key } = await (await fetch("push/key")).json();
      const sub = await st.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      const r = await fetch("push/subscribe", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub, region: state.region === "Tutte" ? "*" : state.region, lang: state.lang, min: 2 }) });
      if (!r.ok) throw new Error("push " + r.status);
      btn.textContent = "🔔 " + T("pushOn") + (state.region === "Tutte" ? "" : ": " + state.region);
    } catch (e) { console.warn(e); btn.textContent = "🔕 " + T("pushErr"); }
  }
  pushState().then((st) => { if (!st) return; const b = $("#push"); b.hidden = false; b.textContent = "🔔 " + T(st.sub ? "pushOn" : "pushOff"); b.onclick = togglePush; }).catch(() => {});

  // ---------- avvio
  refresh();
  setInterval(() => { if (state.mode === "direct" && Date.now() - state.fetchedAt < 30 * 60e3) return; refresh(); }, 5 * 60 * 1000);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
