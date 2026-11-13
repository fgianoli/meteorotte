// Worker: scarica i dati una volta per tutti, calcola le allerte, pubblica JSON + CAP + Atom.
const fs = require("fs");
const path = require("path");
const S = require("./lib/shared");
const src = require("./lib/sources");
const { capAlert, atomFeed } = require("./lib/cap");

const PUBLIC = process.env.PUBLIC_DIR || "/data/public";
const PRIVATE = process.env.PRIVATE_DIR || "/data/private";
const INTERVAL = (+process.env.INTERVAL_MIN || 60) * 60 * 1000;
const FAST = Math.max(2, +process.env.FAST_MIN || 10) * 60 * 1000; // idrometri e allerte ufficiali
const RETRY = Math.min(FAST, 10 * 60 * 1000);
let cache = null; // previsioni dei modelli: cambiano al massimo ogni ora, non serve riscaricarle a ogni giro
const CTX = {
  sender: process.env.CAP_SENDER || "meteorotte.local",
  senderName: process.env.CAP_SENDER_NAME || "MeteoRotte (prototipo)",
  status: process.env.CAP_STATUS || "Actual",
  publicUrl: process.env.PUBLIC_URL || "",
  radiusKm: +process.env.CAP_RADIUS_KM || 5
};

const log = (...a) => console.log(new Date().toISOString(), ...a);

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function dist(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

function officialType(event, site) {
  const e = event.toLowerCase();
  const mountain = site.tipo === "montagna";
  if (/rain|flood|precipitation/.test(e)) return site.tipo === "fiume" ? "flood" : "rain";
  if (/thunder|wind|storm/.test(e)) return "wind";
  if (/snow|ice|avalanche/.test(e)) return mountain ? "snow" : "cold";
  if (/low.?temp|cold|frost/.test(e)) return "cold";
  if (/high.?temp|heat/.test(e)) return "heat";
  return null;
}

// Grado di pericolo EAWS (1–5) alla quota del valico → livello MeteoRotte.
// Per chi cammina di notte senza attrezzatura: 2 moderato → giallo, 3 marcato → arancione, 4–5 forte/molto forte → rosso.
const TREELINE_M = 2000;
function avalancheHazard(bulletins, site, now) {
  if (!bulletins) return null;
  const q = site.quota || 1800;
  const bound = (v) => (v === "treeline" ? TREELINE_M : +v);
  let best = null;
  for (const b of bulletins) {
    if (b.end && b.end < now) continue;
    for (const r of b.ratings) {
      const e = r.elevation;
      if (e && e.lowerBound != null && q < bound(e.lowerBound)) continue;
      if (e && e.upperBound != null && q >= bound(e.upperBound)) continue;
      if (!best || r.value > best.value) best = Object.assign({ value: r.value }, b);
    }
  }
  if (!best) return null;
  const level = best.value >= 4 ? 3 : best.value === 3 ? 2 : best.value === 2 ? 1 : 0;
  if (!level) return null;
  return { type: "snow", level, time: Math.max(now, best.start || now), value: best.value, unit: `grado pericolo valanghe (scala 1–5) – ${best.region}, quota ${q} m`, source: "Bollettino valanghe " + best.provider, link: best.link };
}

async function settle(name, p, status) {
  try { const v = await p; status[name] = "ok"; return v; }
  catch (e) { status[name] = "errore: " + e.message; log("⚠️", name, e.message); return null; }
}

async function run() {
  const now = Date.now() / 1000;
  const status = {};
  const H = S.HOTSPOTS;

  // punti meteo: ogni hotspot + i punti a monte dei fiumi
  const points = [], index = [];
  H.forEach((s) => {
    index.push({ id: s.id, role: "site" }); points.push([s.lat, s.lon]);
    (s.upstream || []).forEach((u) => { index.push({ id: s.id, role: "up" }); points.push(u); });
  });
  const rivers = H.filter((s) => s.tipo === "fiume" && s.flood !== false);
  const feeds = [...new Set(H.filter((s) => s.meteoalarm).map((s) => s.meteoalarm.feed))];
  const codes = [...new Set(H.flatMap((s) => s.hubeau || []))];
  const eawsProviders = [...new Set(H.flatMap((s) => (s.eaws || []).map((id) => (id.startsWith("FR") ? "FR" : id.split("-").slice(0, 2).join("-")))))];
  const today = process.env.EAWS_DATE || new Date(now * 1000 + 3600e3).toISOString().slice(0, 10);

  const full = !cache || Date.now() - cache.t >= INTERVAL - 30000;
  const omirlCodes = [...new Set(H.flatMap((s) => s.omirl || []))];
  const [liguria, slovenia, stz] = await Promise.all([
    settle("idrometri-arpal", src.omirlHydro(omirlCodes), status),
    settle("idrometri-arso", src.arsoHydro(), status),
    settle("stazioni-meteo", src.stations(H), status)
  ]);
  // Météo-France: Vigilance per dipartimento e controllo della scadenza della chiave
  let vig = null;
  if (src.MFKEY) {
    vig = await settle("meteo-france", src.vigilance(), status);
    const exp = src.mfKeyExpiry(), days = exp ? Math.floor((exp - now) / 86400) : null;
    if (vig && days !== null && days < 30) status["meteo-france"] = `attenzione: la chiave scade ${days < 0 ? "ed è scaduta" : "tra " + days + " giorni"} (${new Date(exp * 1000).toISOString().slice(0, 10)}), va rigenerata su portail-api.meteofrance.fr`;
  } else status["meteo-france"] = "non configurato";
  if (stz && stz.ko.length) status["stazioni-meteo"] = "ok (mancano: " + stz.ko.join(", ") + ")";
  const [wx, fl, hydro, aval, ...ma] = await Promise.all([
    full ? settle("open-meteo", src.forecast(points), status) : cache.wx,
    full ? settle("glofas", src.glofas(rivers.map((s) => s.flood || [s.lat, s.lon])), status) : cache.fl,
    settle("hubeau", src.hubeau(codes), status),
    full ? settle("valanghe-eaws", src.eaws(eawsProviders, today), status) : cache.aval,
    ...feeds.map((f) => settle("meteoalarm-" + f, src.meteoalarm(f), status))
  ]);
  if (!wx) throw new Error("Open-Meteo non disponibile: mantengo i dati precedenti");
  if (aval && aval.missing.length) status["valanghe-eaws"] = aval.missing.length === eawsProviders.length ? "nessun bollettino oggi (fuori stagione?)" : "ok (mancano: " + aval.missing.join(", ") + ")";
  if (full) cache = { t: Date.now(), wx, fl, aval, status: { "open-meteo": status["open-meteo"], glofas: status.glofas, "valanghe-eaws": status["valanghe-eaws"] } };
  else Object.assign(status, cache.status);
  const warnings = Object.fromEntries(feeds.map((f, k) => [f, ma[k] || []]));

  const raw = {};
  H.forEach((s) => (raw[s.id] = { wx: null, up: [] }));
  wx.forEach((w, k) => { const ix = index[k]; if (ix.role === "site") raw[ix.id].wx = w; else raw[ix.id].up.push(w); });
  const flood = {}; rivers.forEach((s, k) => (flood[s.id] = fl ? fl[k] : null));

  const sites = [];
  for (const site of H) {
    const r = raw[site.id];
    if (!r.wx || !r.wx.hourly) continue;
    let res = S.Alerts.evaluate(site, r.wx, r.up, flood[site.id] || null, now);
    const extra = [];

    // allerte ufficiali MeteoAlarm sull'area del punto
    if (site.meteoalarm) {
      const aree = site.meteoalarm.aree.map(src.norm);
      const best = {};
      for (const w of warnings[site.meteoalarm.feed] || []) {
        if (!(w.expires > now) || !aree.includes(src.norm(w.area))) continue;
        if (!best[w.event] || w.level > best[w.event].level) best[w.event] = w;
      }
      const ws = Object.values(best);
      if (ws.length) {
        const top = ws.reduce((a, b) => (b.level > a.level ? b : a));
        extra.push({ type: "official", level: top.level, time: Math.min(...ws.map((w) => w.onset || now)), value: null, unit: ws.map((w) => w.event).join(", "), source: "MeteoAlarm", link: top.link });
        // traduce l'evento ufficiale nel pericolo corrispondente, così il messaggio contiene il consiglio pratico giusto
        for (const w of ws) {
          const t = officialType(w.event, site);
          if (t) extra.push({ type: t, level: w.level, time: w.onset || now, value: null, unit: w.event, source: "MeteoAlarm", link: w.link });
        }
      }
    }
    // Vigilance Météo-France sul dipartimento (per i punti italiani solo i fenomeni indicati in fen)
    if (site.vigilance && vig) {
      const mountain = site.tipo === "montagna";
      const MAP = { 1: ["wind", "vento"], 2: [site.tipo === "fiume" ? "flood" : "rain", "pioggia-inondazione"], 3: ["wind", "temporali"], 4: ["flood", "piene"], 5: [mountain ? "snow" : "cold", "neve-ghiaccio"], 6: ["heat", "caldo"], 7: ["cold", "grande freddo"], 8: ["snow", "valanghe"] };
      const list = (vig[site.vigilance.dep] || []).filter((v) => MAP[v.fen] && v.end > now && (!site.vigilance.fen || site.vigilance.fen.includes(v.fen)));
      const byFen = {};
      for (const v of list) if (!byFen[v.fen] || v.level > byFen[v.fen].level) byFen[v.fen] = v;
      for (const v of Object.values(byFen)) extra.push({ type: MAP[v.fen][0], level: v.level, time: Math.max(now, v.begin), value: null, unit: `Vigilance ${MAP[v.fen][1]} – dipartimento ${site.vigilance.dep}`, source: "Météo-France", link: "https://vigilance.meteofrance.fr" });
      if (Object.keys(byFen).length) extra.push({ type: "official", level: Math.max(...Object.values(byFen).map((v) => v.level)), time: now, value: null, unit: "Vigilance Météo-France: " + Object.values(byFen).map((v) => MAP[v.fen][1]).join(", "), source: "Météo-France", link: "https://vigilance.meteofrance.fr" });
    }
    // bollettini valanghe ufficiali (AINEVA/Arpa regionali, Météo-France) sulle micro-regioni del valico
    for (const rid of site.eaws || []) {
      const hz = avalancheHazard(aval && aval.ratings[rid], site, process.env.EAWS_DATE ? Date.parse(process.env.EAWS_DATE + "T12:00:00Z") / 1000 : now);
      if (hz) extra.push(hz);
    }
    // idrometri in tempo reale
    for (const code of site.hubeau || []) {
      const h = hydro && hydro[code];
      const hz = h && S.Alerts.hydroHazard(h.series, now, h.label);
      if (hz) extra.push(hz);
    }
    const hydroNow = [];
    // idrometri ARPAL: soglie ufficiali arancione/rossa, altrimenti velocità di risalita
    for (const code of site.omirl || []) {
      const h = liguria && liguria[code];
      if (!h || !h.series.length) continue;
      const last = h.series[h.series.length - 1];
      hydroNow.push({ code, label: h.label, t: last.t, h_mm: last.h, soglia: h.orange ? `arancione ${h.orange} m, rossa ${h.red} m` : "" });
      if (now - last.t > 3 * 3600) continue;
      const m = last.h / 1000;
      const lvl = h.red != null && m >= h.red ? 3 : h.orange != null && m >= h.orange ? 2 : 0;
      if (lvl) extra.push({ type: "flood", level: lvl, time: last.t, value: Math.round(m * 100) / 100, unit: "m – sopra la soglia ufficiale", source: "idrometro " + h.label });
      else { const hz = S.Alerts.hydroHazard(h.series, now, h.label); if (hz) extra.push(hz); }
    }
    // idrometri ARSO: portata rispetto alle tre soglie ufficiali di piena
    for (const code of site.arso || []) {
      const h = slovenia && slovenia[code];
      if (!h || h.t == null) continue;
      hydroNow.push({ code, label: h.label, t: h.t, h_mm: h.h_cm != null ? h.h_cm * 10 : null, q: h.q, soglia: h.soglie[0] ? `piena da ${h.soglie[0]} m³/s` : "" });
      if (now - h.t > 3 * 3600 || h.q == null) continue;
      const lvl = h.soglie.reduce((l, th, i) => (th != null && h.q >= th ? i + 1 : l), 0);
      if (lvl) extra.push({ type: "flood", level: lvl, time: h.t, value: Math.round(h.q), unit: "m³/s – sopra la soglia di piena", source: "idrometro " + h.label });
    }
    res = S.Alerts.merge(res, extra);

    // stazione meteo più vicina (entro 25 km) con un dato recente
    let obs = null;
    for (const st of (stz && stz.list) || []) {
      if (st.time && now - st.time > 3 * 3600) continue;
      const km = dist(site.lat, site.lon, st.lat, st.lon);
      if (km <= 25 && (!obs || km < obs.km)) obs = Object.assign({ km: Math.round(km) }, st);
    }

    const h = r.wx.hourly, a = res.startIndex, b = res.endIndex;
    const cut = (k) => (h[k] || []).slice(a, b);
    const messages = Object.fromEntries(S.LANGS.map((l) => [l.code, S.composeMessage(site, res, l.code)]));
    hydroNow.push(...(site.hubeau || []).map((c) => hydro && hydro[c] && hydro[c].series.length ? { code: c, label: hydro[c].label, t: hydro[c].series.at(-1).t, h_mm: hydro[c].series.at(-1).h } : null).filter(Boolean));
    sites.push({
      id: site.id,
      wx: { elevation: r.wx.elevation, hourly: { time: cut("time"), apparent_temperature: cut("apparent_temperature"), temperature_2m: cut("temperature_2m"), precipitation: cut("precipitation"), snowfall: cut("snowfall"), wind_gusts_10m: cut("wind_gusts_10m"), is_day: cut("is_day") } },
      obs: obs && { label: obs.label, km: obs.km, alt: obs.alt, t: obs.t, wind: obs.wind, gust: obs.gust, snow: obs.snow, time: obs.time, source: obs.source },
      res: { level: res.level, hazards: res.hazards, timeline: res.timeline },
      hydro: hydroNow,
      messages
    });
  }

  const generated = Math.floor(now);
  const out = { generated: new Date(generated * 1000).toISOString(), modelsUpdated: new Date(cache.t).toISOString(), validUntil: new Date((generated + 2 * INTERVAL / 1000) * 1000).toISOString(), sources: status, sites };
  writeAtomic(path.join(PUBLIC, "alerts.json"), JSON.stringify(out));

  // CAP + Atom
  const ctx = Object.assign({ generated, validitySec: 2 * INTERVAL / 1000 }, CTX);
  const active = sites.filter((x) => x.res.level > 0).map((x) => Object.assign({ site: H.find((s) => s.id === x.id) }, x));
  const capDir = path.join(PUBLIC, "cap");
  fs.mkdirSync(capDir, { recursive: true });
  for (const f of fs.readdirSync(capDir)) fs.unlinkSync(path.join(capDir, f));
  active.forEach((e) => writeAtomic(path.join(capDir, e.id + ".xml"), capAlert(e, ctx)));
  writeAtomic(path.join(PUBLIC, "feed.atom"), atomFeed(active, ctx));

  // storico per tarare le soglie (privato: non servito dal web)
  const day = out.generated.slice(0, 10);
  fs.mkdirSync(path.join(PRIVATE, "history"), { recursive: true });
  if (full) fs.appendFileSync(path.join(PRIVATE, "history", day + ".jsonl"),
    sites.map((x) => JSON.stringify({ t: out.generated, id: x.id, level: x.res.level, hz: x.res.hazards.map((z) => [z.type, z.level, z.value, z.source]) })).join("\n") + "\n");

  log(`✓ ${full ? "completo" : "rapido"} · ${sites.length} punti, ${active.length} in allerta`, JSON.stringify(status));
  return out;
}

async function loop() {
  let wait = FAST;
  try { await run(); } catch (e) { log("✗", e.message); wait = RETRY; }
  if (process.env.RUN_ONCE) return;
  setTimeout(loop, wait);
}

if (require.main === module) loop();
module.exports = { run };
