// Fonti dati: Open-Meteo (meteo), GloFAS (piene), Hub'Eau (idrometri FR), MeteoAlarm (allerte ufficiali)
const { get } = require("./http");

const OM = (process.env.OPENMETEO_URL || "https://api.open-meteo.com").replace(/\/$/, "");
const FLOOD = (process.env.FLOOD_URL || "https://flood-api.open-meteo.com").replace(/\/$/, "");
const KEY = process.env.OPENMETEO_APIKEY || "";
const HOURLY = "temperature_2m,apparent_temperature,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,is_day";

const coords = (pts, d = 3) => ({ latitude: pts.map((p) => p[0].toFixed(d)).join(","), longitude: pts.map((p) => p[1].toFixed(d)).join(",") });
const arr = (j) => (Array.isArray(j) ? j : [j]);
const withKey = (p) => (KEY ? Object.assign(p, { apikey: KEY }) : p);

async function chunked(pts, size, fn) {
  const out = [];
  for (let i = 0; i < pts.length; i += size) out.push(...(await fn(pts.slice(i, i + size))));
  return out;
}

function forecast(points) {
  return chunked(points, 50, async (pts) => arr(await get(`${OM}/v1/forecast?` + new URLSearchParams(withKey({
    ...coords(pts), hourly: HOURLY, past_days: "1", forecast_days: "4", timeformat: "unixtime", timezone: "GMT", wind_speed_unit: "kmh"
  })))));
}

function glofas(points) {
  if (!points.length) return Promise.resolve([]);
  return chunked(points, 50, async (pts) => arr(await get(`${FLOOD}/v1/flood?` + new URLSearchParams(withKey({
    ...coords(pts), daily: "river_discharge", past_days: "31", forecast_days: "7"
  })))));
}

// Idrometri francesi in tempo reale (livello H in mm). Restituisce { code: { label, series:[{t,h}] } }
async function hubeau(codes) {
  const out = {};
  if (!codes.length) return out;
  const ref = await get("https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?" + new URLSearchParams({ code_station: codes.join(","), format: "json", size: "50" }))
    .catch(() => ({ data: [] }));
  const labels = Object.fromEntries((ref.data || []).map((s) => [s.code_station, s.libelle_station]));
  const pos = Object.fromEntries((ref.data || []).map((s) => [s.code_station, [s.latitude_station, s.longitude_station]]));
  const since = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19) + "Z";
  for (const code of codes) {
    try {
      const j = await get("https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?" + new URLSearchParams({
        code_entite: code, grandeur_hydro: "H", date_debut_obs: since, size: "1000", sort: "asc"
      }));
      out[code] = {
        label: labels[code] || code, lat: (pos[code] || [])[0], lon: (pos[code] || [])[1],
        series: (j.data || []).map((o) => ({ t: Date.parse(o.date_obs) / 1000, h: o.resultat_obs })).filter((p) => isFinite(p.h)).sort((a, b) => a.t - b.t)
      };
    } catch (e) { out[code] = { label: labels[code] || code, series: [], error: e.message }; }
  }
  return out;
}

// MeteoAlarm: feed Atom con estratti CAP. Restituisce le allerte attive del paese.
const tag = (s, t) => { const m = s.match(new RegExp(`<cap:${t}>([\\s\\S]*?)</cap:${t}>`)); return m ? m[1].trim() : null; };
const decode = (s) => s && s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
async function meteoalarm(feed) {
  const xml = await get(`https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${feed}`, { type: "text" });
  return xml.split("<entry>").slice(1).map((e) => {
    const event = decode(tag(e, "event")) || "";
    const color = (event.match(/\b(yellow|orange|red)\b/i) || [])[1];
    const link = (e.match(/<link type="application\/cap\+xml" href="([^"]+)"/) || [])[1];
    return {
      area: decode(tag(e, "areaDesc")), event, severity: tag(e, "severity"),
      level: color ? { yellow: 1, orange: 2, red: 3 }[color.toLowerCase()] : 0,
      onset: Date.parse(tag(e, "onset") || tag(e, "effective")) / 1000, expires: Date.parse(tag(e, "expires")) / 1000,
      link: decode(link)
    };
  }).filter((x) => x.level > 0);
}

// Bollettini valanghe EAWS (CAAMLv6) dall'aggregatore europeo: AINEVA/Arpa regionali, Météo-France, ARSO…
// File per provider: https://static.avalanche.report/eaws_bulletins/<data>/<data>-<provider>.json (es. IT-21 Piemonte, FR, SI, IT-36 FVG)
const EAWS = (process.env.EAWS_URL || "https://static.avalanche.report/eaws_bulletins").replace(/\/$/, "");
const DANGER = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 };
async function eaws(providers, date) {
  const out = { ratings: {}, missing: [] };
  for (const prov of providers) {
    let j = null;
    try { j = await get(`${EAWS}/${date}/${date}-${prov}.json`, { tries: 2 }); }
    catch (e) { if (/HTTP 404/.test(e.message)) { out.missing.push(prov); continue; } throw e; }
    for (const b of j.bulletins || []) {
      const provider = (b.source && b.source.provider) || {};
      for (const r of b.regions || []) {
        (out.ratings[r.regionID] = out.ratings[r.regionID] || []).push({
          region: r.name || r.regionID, provider: provider.name || prov, link: provider.website || "",
          start: Date.parse(b.validTime && b.validTime.startTime) / 1000, end: Date.parse(b.validTime && b.validTime.endTime) / 1000,
          ratings: (b.dangerRatings || []).map((d) => ({ value: DANGER[d.mainValue] || 0, elevation: d.elevation || null, period: d.validTimePeriod || "all_day" }))
        });
      }
    }
  }
  return out;
}

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// --- Idrometri ARPAL (Liguria, portale OMIRL): serie a 15 minuti e soglie ufficiali arancione/rossa
const OMIRL = "https://omirl.regione.liguria.it/Omirl/rest";
const JSONH = { headers: { Accept: "application/json" } };
async function omirlHydro(codes) {
  const out = {}, pos = {};
  try { (await get(`${OMIRL}/stations/Idro`, JSONH)).forEach((s) => (pos[s.shortCode] = [s.lat, s.lon])); } catch (e) { /* senza coordinate l'idrometro non compare sulla mappa */ }
  for (const code of codes) {
    try {
      const j = await get(`${OMIRL}/charts/${code}/Idro`, JSONH);
      const data = ((j.dataSeries || [])[0] || {}).data || [];
      const lastT = data.length ? data[data.length - 1][0] : 0;
      const th = (re) => { const l = (j.horizontalLines || []).find((x) => re.test(x.name)); return l ? l.value : null; };
      out[code] = {
        lat: (pos[code] || [])[0], lon: (pos[code] || [])[1],
        label: `${j.river || ""} – ${(j.title || code).split(" - ")[0]}`.replace(/^ – /, ""),
        series: data.filter((p) => p[0] >= lastT - 6 * 3600e3 && isFinite(p[1])).map((p) => ({ t: p[0] / 1000, h: p[1] * 1000 })),
        orange: th(/arancio/i), red: th(/ross/i)
      };
    } catch (e) { out[code] = { label: code, series: [], error: e.message }; }
  }
  return out;
}

// --- Idrometri ARSO (Slovenia): ultimo valore di tutte le stazioni, con le tre soglie ufficiali di piena sulla portata
async function arsoHydro() {
  const xml = await get("https://www.arso.gov.si/xml/vode/hidro_podatki_zadnji.xml", { type: "text" });
  const out = {};
  for (const m of xml.matchAll(/<postaja\s+sifra="(\d+)"([^>]*)>([\s\S]*?)<\/postaja>/g)) {
    const at = (k) => { const r = m[2].match(new RegExp(k + '="([^"]*)"')); return r ? +r[1] : null; };
    const g = (t) => { const r = m[3].match(new RegExp(`<${t}>([^<]*)</${t}>`)); return r ? decode(r[1]) : null; };
    const n = (t) => { const v = parseFloat(g(t)); return isFinite(v) ? v : null; };
    const d = g("datum_cet");
    out[m[1]] = { lat: at("wgs84_sirina"), lon: at("wgs84_dolzina"), label: g("ime_kratko"), t: d ? Date.parse(d.replace(" ", "T") + ":00+01:00") / 1000 : null, h_cm: n("vodostaj"), q: n("pretok"),
      soglie: [n("prvi_vv_pretok"), n("drugi_vv_pretok"), n("tretji_vv_pretok")] };
  }
  return out;
}

// --- Stazioni meteo: osservazioni attuali. Restituisce [{label, lat, lon, alt, t, wind, gust, snow, time, source}]
async function arsoMeteo() {
  const xml = await get("https://meteo.arso.gov.si/uploads/probase/www/observ/surface/text/sl/observationAms_si_latest.xml", { type: "text", timeout: 60000 });
  return xml.split("<metData>").slice(1).map((b) => {
    const g = (t) => { const r = b.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return r ? r[1] : null; };
    const n = (t, k = 1) => { const v = parseFloat(g(t)); return isFinite(v) ? Math.round(v * k * 10) / 10 : null; };
    const v = g("valid_UTC"), p = v && v.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+)/);
    return { label: decode(g("domain_longTitle")), lat: n("domain_lat"), lon: n("domain_lon"), alt: n("domain_altitude"), t: n("t"), wind: n("ff_val", 3.6), gust: n("ffmax_val", 3.6), snow: n("snow"),
      time: p ? Date.UTC(+p[3], +p[2] - 1, +p[1], +p[4], +p[5]) / 1000 : null, source: "ARSO" };
  });
}
async function dhmzMeteo() {
  const xml = await get("https://vrijeme.hr/hrvatska_n.xml", { type: "text" });
  const d = xml.match(/<Datum>(\d+)\.(\d+)\.(\d+)<\/Datum>\s*<Termin>(\d+)<\/Termin>/);
  const time = d ? Date.UTC(+d[3], +d[2] - 1, +d[1], +d[4]) / 1000 : null; // termine in UTC
  return xml.split("<Grad").slice(1).map((b) => {
    const g = (t) => { const r = b.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return r ? r[1].trim() : null; };
    const n = (t, k = 1) => { const v = parseFloat(g(t)); return isFinite(v) ? Math.round(v * k * 10) / 10 : null; };
    return { label: g("GradIme"), lat: n("Lat"), lon: n("Lon"), alt: null, t: n("Temp"), wind: n("VjetarBrzina", 3.6), gust: null, snow: null, time, source: "DHMZ" };
  });
}
async function omirlMeteo() {
  const j = await get(`${OMIRL}/stations/Termo`, JSONH);
  return j.map((s) => ({ label: s.name, lat: s.lat, lon: s.lon, alt: s.alt, t: isFinite(s.value) ? s.value : null, wind: null, gust: null, snow: null, time: Date.parse(s.refDate + "Z") / 1000, source: "ARPAL" }));
}
// --- Météo-France (chiave gratuita in METEOFRANCE_APIKEY, da portail-api.meteofrance.fr)
const MF = "https://public-api.meteofrance.fr/public";
const MFKEY = (process.env.METEOFRANCE_APIKEY || "").trim();
const mfGet = (p, opt = {}) => get(MF + p, Object.assign({ headers: { apikey: MFKEY } }, opt));
// Scadenza della chiave (è un JWT): secondi Unix, oppure null se non si riesce a leggerla.
function mfKeyExpiry() {
  try { return JSON.parse(Buffer.from(MFKEY.split(".")[1], "base64url").toString()).exp || null; } catch (e) { return null; }
}
function km(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
let mfList = null, mfListT = 0;
// Osservazioni a 6 minuti delle 3 stazioni Météo-France più vicine (entro 25 km) a ciascun punto.
async function mfMeteo(sites) {
  if (!mfList || Date.now() - mfListT > 24 * 3600e3) {
    const csv = await mfGet("/DPObs/v2/liste-stations", { type: "text" });
    mfList = csv.split("\n").slice(1).map((l) => l.split(";")).filter((c) => c.length >= 6 && isFinite(+c[3]))
      .map((c) => ({ id: c[0], label: c[2].toLowerCase().replace(/(^|[\s_-])\p{L}/gu, (m) => m.toUpperCase()).replace(/_/g, " "), lat: +c[3], lon: +c[4], alt: +c[5] }));
    mfListT = Date.now();
  }
  const pick = new Map();
  for (const s of sites) mfList.map((st) => [km(s.lat, s.lon, st.lat, st.lon), st]).filter((x) => x[0] <= 25).sort((a, b) => a[0] - b[0]).slice(0, 3).forEach((x) => pick.set(x[1].id, x[1]));
  const out = [];
  for (const st of pick.values()) {
    try {
      const j = await mfGet(`/DPObs/v2/station/infrahoraire-6m?id_station=${st.id}&format=json`, { tries: 2 });
      const o = Array.isArray(j) ? j[j.length - 1] : null;
      if (!o) continue;
      const r = (v, k = 1, off = 0) => (typeof v === "number" ? Math.round((v * k + off) * 10) / 10 : null);
      out.push({ label: st.label, lat: st.lat, lon: st.lon, alt: st.alt, t: r(o.t, 1, -273.15), wind: r(o.ff, 3.6), gust: r(o.raf10, 3.6), snow: r(o.sss, 100), time: Date.parse(o.validity_time) / 1000, source: "Météo-France" });
    } catch (e) { /* una stazione che non risponde non blocca le altre */ }
  }
  return out;
}
// Vigilance: allerte ufficiali francesi per dipartimento. Restituisce { "05": [{ fen, level, begin }] } (level 1 giallo … 3 rosso).
async function vigilance() {
  const j = await mfGet("/DPVigilance/v1/cartevigilance/encours");
  const out = {};
  for (const p of (j.product && j.product.periods) || []) {
    for (const d of (p.timelaps && p.timelaps.domain_ids) || []) {
      for (const ph of d.phenomenon_items || []) {
        const items = (ph.timelaps_items || []).filter((t) => t.color_id >= 2);
        const level = Math.min(3, (items.length ? Math.max(...items.map((t) => t.color_id)) : ph.phenomenon_max_color_id) - 1);
        if (!(level >= 1)) continue;
        const begin = Date.parse(items.length ? items[0].begin_time : p.begin_validity_time) / 1000;
        const end = Date.parse(items.length ? items[items.length - 1].end_time : p.end_validity_time) / 1000;
        (out[d.domain_id] = out[d.domain_id] || []).push({ fen: +ph.phenomenon_id, level, begin, end });
      }
    }
  }
  return out;
}

// --- Protezione Civile: Bollettino di criticità nazionale (zone di allerta; idrogeologico, temporali, idraulico; oggi e domani)
const zlib = require("zlib");
const DPC_URL = "https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/all/latest_all.zip";
function unzip(buf, wanted) { // estrae dall'archivio i file il cui nome supera il filtro
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("archivio zip non valido");
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = {};
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nl);
    if (wanted(name)) {
      const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), data = buf.subarray(start, start + csize);
      out[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    }
    p += 46 + nl + el + cl;
  }
  return out;
}
function readDbf(b) {
  const n = b.readUInt32LE(4), hl = b.readUInt16LE(8), rl = b.readUInt16LE(10), fields = [];
  for (let p = 32; b[p] !== 0x0d; p += 32) fields.push([b.toString("latin1", p, p + 11).split("\0")[0], b[p + 16]]);
  const rows = [];
  for (let i = 0; i < n; i++) { let o = hl + i * rl + 1; const d = {}; for (const [nm, l] of fields) { d[nm] = b.toString("latin1", o, o + l).trim(); o += l; } rows.push(d); }
  return rows;
}
const dpcLevel = (s) => (/ROSSA/i.test(s) ? 3 : /ARANCIONE/i.test(s) ? 2 : /GIALLA/i.test(s) ? 1 : 0);
// Restituisce { issued: "AAAAMMGG_HHMM", zones: { "Ligu-A": { name, idrogeo: [oggi, domani], temporali: [..], idraulico: [..] } } }
async function dpc() {
  const files = unzip(await get(DPC_URL, { type: "buffer", timeout: 90000 }), (n) => /_(today|tomorrow)\.dbf$/.test(n));
  const zones = {}; let issued = "";
  for (const [name, buf] of Object.entries(files)) {
    const k = /_today/.test(name) ? 0 : 1; issued = name.slice(0, 13);
    for (const r of readDbf(buf)) {
      const z = (zones[r.Zona_all] = zones[r.Zona_all] || { name: r.Nome_zona, idrogeo: [0, 0], temporali: [0, 0], idraulico: [0, 0] });
      z.idrogeo[k] = Math.max(z.idrogeo[k], dpcLevel(r.Idrogeo)); z.temporali[k] = Math.max(z.temporali[k], dpcLevel(r.Temporali)); z.idraulico[k] = Math.max(z.idraulico[k], dpcLevel(r.Idraulico));
    }
  }
  if (!Object.keys(zones).length) throw new Error("bollettino vuoto");
  return { issued, zones };
}

// Tutte le reti disponibili; una rete che non risponde non blocca le altre.
async function stations(sites) {
  const nets = { ARSO: arsoMeteo, DHMZ: dhmzMeteo, ARPAL: omirlMeteo };
  if (MFKEY) nets["Météo-France"] = () => mfMeteo(sites || []);
  const res = await Promise.allSettled(Object.values(nets).map((f) => f()));
  const ko = Object.keys(nets).filter((_, i) => res[i].status !== "fulfilled");
  if (ko.length === res.length) throw new Error("nessuna rete di stazioni raggiungibile");
  return { list: res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((s) => s.lat && s.lon && s.t !== null), ko };
}

module.exports = { forecast, glofas, hubeau, meteoalarm, eaws, omirlHydro, arsoHydro, stations, vigilance, dpc, mfKeyExpiry, MFKEY, norm };
