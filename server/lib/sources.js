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
  const since = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19) + "Z";
  for (const code of codes) {
    try {
      const j = await get("https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?" + new URLSearchParams({
        code_entite: code, grandeur_hydro: "H", date_debut_obs: since, size: "1000", sort: "asc"
      }));
      out[code] = {
        label: labels[code] || code,
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
  const out = {};
  for (const code of codes) {
    try {
      const j = await get(`${OMIRL}/charts/${code}/Idro`, JSONH);
      const data = ((j.dataSeries || [])[0] || {}).data || [];
      const lastT = data.length ? data[data.length - 1][0] : 0;
      const th = (re) => { const l = (j.horizontalLines || []).find((x) => re.test(x.name)); return l ? l.value : null; };
      out[code] = {
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
  for (const m of xml.matchAll(/<postaja\s+sifra="(\d+)"[^>]*>([\s\S]*?)<\/postaja>/g)) {
    const g = (t) => { const r = m[2].match(new RegExp(`<${t}>([^<]*)</${t}>`)); return r ? decode(r[1]) : null; };
    const n = (t) => { const v = parseFloat(g(t)); return isFinite(v) ? v : null; };
    const d = g("datum_cet");
    out[m[1]] = { label: g("ime_kratko"), t: d ? Date.parse(d.replace(" ", "T") + ":00+01:00") / 1000 : null, h_cm: n("vodostaj"), q: n("pretok"),
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
// Tutte le reti disponibili; una rete che non risponde non blocca le altre.
async function stations() {
  const nets = { ARSO: arsoMeteo, DHMZ: dhmzMeteo, ARPAL: omirlMeteo };
  const res = await Promise.allSettled(Object.values(nets).map((f) => f()));
  const ko = Object.keys(nets).filter((_, i) => res[i].status !== "fulfilled");
  if (ko.length === res.length) throw new Error("nessuna rete di stazioni raggiungibile");
  return { list: res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((s) => s.lat && s.lon && s.t !== null), ko };
}

module.exports = { forecast, glofas, hubeau, meteoalarm, eaws, omirlHydro, arsoHydro, stations, norm };
