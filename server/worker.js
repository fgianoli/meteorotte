// Worker: scarica i dati una volta per tutti, calcola le allerte, pubblica JSON + CAP + Atom.
const fs = require("fs");
const path = require("path");
const S = require("./lib/shared");
const src = require("./lib/sources");
const { capAlert, atomFeed } = require("./lib/cap");

const PUBLIC = process.env.PUBLIC_DIR || "/data/public";
const PRIVATE = process.env.PRIVATE_DIR || "/data/private";
const INTERVAL = (+process.env.INTERVAL_MIN || 60) * 60 * 1000;
const RETRY = 10 * 60 * 1000;
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

  const [wx, fl, hydro, aval, ...ma] = await Promise.all([
    settle("open-meteo", src.forecast(points), status),
    settle("glofas", src.glofas(rivers.map((s) => s.flood || [s.lat, s.lon])), status),
    settle("hubeau", src.hubeau(codes), status),
    settle("valanghe-eaws", src.eaws(eawsProviders, today), status),
    ...feeds.map((f) => settle("meteoalarm-" + f, src.meteoalarm(f), status))
  ]);
  if (!wx) throw new Error("Open-Meteo non disponibile: mantengo i dati precedenti");
  if (aval && aval.missing.length) status["valanghe-eaws"] = aval.missing.length === eawsProviders.length ? "nessun bollettino oggi (fuori stagione?)" : "ok (mancano: " + aval.missing.join(", ") + ")";
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
    res = S.Alerts.merge(res, extra);

    const h = r.wx.hourly, a = res.startIndex, b = res.endIndex;
    const cut = (k) => (h[k] || []).slice(a, b);
    const messages = Object.fromEntries(S.LANGS.map((l) => [l.code, S.composeMessage(site, res, l.code)]));
    const hydroNow = (site.hubeau || []).map((c) => hydro && hydro[c] && hydro[c].series.length ? { code: c, label: hydro[c].label, t: hydro[c].series.at(-1).t, h_mm: hydro[c].series.at(-1).h } : null).filter(Boolean);
    sites.push({
      id: site.id,
      wx: { elevation: r.wx.elevation, hourly: { time: cut("time"), apparent_temperature: cut("apparent_temperature"), temperature_2m: cut("temperature_2m"), precipitation: cut("precipitation"), snowfall: cut("snowfall"), wind_gusts_10m: cut("wind_gusts_10m") } },
      res: { level: res.level, hazards: res.hazards },
      hydro: hydroNow,
      messages
    });
  }

  const generated = Math.floor(now);
  const out = { generated: new Date(generated * 1000).toISOString(), validUntil: new Date((generated + 2 * INTERVAL / 1000) * 1000).toISOString(), sources: status, sites };
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
  fs.appendFileSync(path.join(PRIVATE, "history", day + ".jsonl"),
    sites.map((x) => JSON.stringify({ t: out.generated, id: x.id, level: x.res.level, hz: x.res.hazards.map((z) => [z.type, z.level, z.value, z.source]) })).join("\n") + "\n");

  log(`✓ ${sites.length} punti, ${active.length} in allerta`, JSON.stringify(status));
  return out;
}

async function loop() {
  let wait = INTERVAL;
  try { await run(); } catch (e) { log("✗", e.message); wait = RETRY; }
  if (process.env.RUN_ONCE) return;
  setTimeout(loop, wait);
}

if (require.main === module) loop();
module.exports = { run };
