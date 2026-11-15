// Motore di allerta: funzioni pure, usabili nel browser e in Node (test / futuro worker lato server).
(function (root) {
  "use strict";

  // Soglie (livello 1 = giallo, 2 = arancione, 3 = rosso). Pensate per persone ALL'APERTO, senza riparo:
  // più prudenti delle soglie delle protezioni civili per la popolazione generale. Da tarare con le associazioni.
  const THRESHOLDS = {
    coldApparent: [0, -5, -12],       // °C percepiti, <=
    wetCold: { temp: 5, precip: 0.5 },// pioggia con T <= 5 °C → almeno giallo (ipotermia da bagnato)
    heatApparent: [32, 37, 41],       // °C percepiti, >=
    gust: [60, 80, 100],              // km/h raffiche
    rain1h: [15, 30, 50],             // mm/h (su punto o bacino a monte)
    rain24h: [50, 100, 150],          // mm/24h
    snow24h: [5, 20, 40],             // cm/24h
    snow72hAvalanche: [20, 40, 70],   // cm/72h – indicatore indiretto valanghe
    floodRatio: [3, 6, 10],           // portata GloFAS prevista / mediana ultimi 30 gg
    floodMinBaseline: 1,              // m³/s: sotto questa portata il rapporto non è significativo
    hydroRise1h: [20, 40, 70],        // cm di risalita in 1 h (idrometri in tempo reale)
    hydroRise3h: [30, 60, 100]        // cm di risalita in 3 h
  };

  const HOURS = 72;

  function levelGE(v, th) { let l = 0; for (let i = 0; i < th.length; i++) if (v >= th[i]) l = i + 1; return l; }
  function levelLE(v, th) { let l = 0; for (let i = 0; i < th.length; i++) if (v <= th[i]) l = i + 1; return l; }
  const num = (x) => (typeof x === "number" && isFinite(x) ? x : null);

  function startIndex(times, nowSec) {
    for (let i = 0; i < times.length; i++) if (times[i] >= nowSec - 3600) return i;
    return Math.max(0, times.length - 1);
  }

  function rollingSum(arr, i, w) {
    let s = 0;
    for (let k = Math.max(0, i - w + 1); k <= i; k++) s += num(arr[k]) || 0;
    return s;
  }

  function median(a) {
    const v = a.filter((x) => num(x) !== null).sort((x, y) => x - y);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  // Tiene, per ogni tipo di pericolo, il livello massimo e il momento in cui si raggiunge per la prima volta.
  function Tracker() {
    const best = {};
    return {
      update(type, level, time, value, unit, source) {
        if (!level) return;
        const b = best[type];
        if (!b || level > b.level) best[type] = { type, level, time, value, unit, source };
        else if (level === b.level && Math.abs(value) > Math.abs(b.value) && type !== "cold") { b.value = value; }
        else if (level === b.level && type === "cold" && value < b.value) { b.value = value; }
      },
      list() { return Object.values(best).sort((a, b) => b.level - a.level || a.time - b.time); }
    };
  }

  /**
   * site:      hotspot ({tipo, ...})
   * wx:        risposta Open-Meteo per il punto (hourly con timeformat=unixtime)
   * upstream:  array di risposte Open-Meteo per i punti a monte (stesse ore)
   * flood:     risposta Open-Meteo Flood API (daily.time ISO, daily.river_discharge) o null
   * nowSec:    tempo corrente in secondi
   */
  function evaluate(site, wx, upstream, flood, nowSec) {
    const h = wx.hourly;
    const s = startIndex(h.time, nowSec);
    const e = Math.min(h.time.length, s + HOURS);
    const t = Tracker();
    const T = THRESHOLDS;
    const isRiver = site.tipo === "fiume";
    const isMountain = site.tipo === "montagna" || (wx.elevation || 0) >= 1200;
    const timeline = [], byType = {};
    const mark = (type, lvl, k) => { if (lvl) (byType[type] = byType[type] || new Array(e - s).fill(0))[k] = Math.max(byType[type][k], lvl); };
    const srcs = [h].concat((upstream || []).map((u) => u.hourly));

    for (let i = s; i < e; i++) {
      const time = h.time[i];
      const app = num(h.apparent_temperature[i]);
      const temp = num(h.temperature_2m[i]);
      const pr = num(h.precipitation[i]) || 0;
      let hl = 0;

      if (app !== null) {
        let lc = levelLE(app, T.coldApparent);
        if (temp !== null && temp <= T.wetCold.temp && pr >= T.wetCold.precip) lc = Math.max(lc, 1);
        t.update("cold", lc, time, app, "°C perc.", "modello meteo");
        t.update("heat", levelGE(app, T.heatApparent), time, app, "°C perc.", "modello meteo");
        hl = Math.max(hl, lc, levelGE(app, T.heatApparent));
        mark("cold", lc, i - s); mark("heat", levelGE(app, T.heatApparent), i - s);
      }

      const g = num(h.wind_gusts_10m[i]);
      if (g !== null) t.update("wind", levelGE(g, T.gust), time, g, "km/h raffiche", "modello meteo");
      const wc = num(h.weather_code[i]);
      if (wc !== null && wc >= 95) t.update("wind", 2, time, g || 0, "temporale", "modello meteo");
      hl = Math.max(hl, g !== null ? levelGE(g, T.gust) : 0, wc !== null && wc >= 95 ? 2 : 0);
      mark("wind", Math.max(g !== null ? levelGE(g, T.gust) : 0, wc !== null && wc >= 95 ? 2 : 0), i - s);

      // Pioggia intensa: per i fiumi conta anche il bacino a monte (piene improvvise).
      const rainSrcs = isRiver ? srcs : [h];
      let r1 = 0, r24 = 0;
      for (const src of rainSrcs) {
        if (!src || !src.precipitation) continue;
        r1 = Math.max(r1, num(src.precipitation[i]) || 0);
        r24 = Math.max(r24, rollingSum(src.precipitation, i, 24));
      }
      const lr = Math.max(levelGE(r1, T.rain1h), levelGE(r24, T.rain24h));
      if (lr) t.update(isRiver ? "flood" : "rain", lr, time, Math.round(r24), "mm/24h", isRiver ? "pioggia sul bacino" : "modello meteo");
      hl = Math.max(hl, lr);
      mark(isRiver ? "flood" : "rain", lr, i - s);

      if (isMountain && h.snowfall) {
        const s24 = rollingSum(h.snowfall, i, 24);
        const s72 = rollingSum(h.snowfall, i, 72);
        let ls = Math.max(levelGE(s24, T.snow24h), levelGE(s72, T.snow72hAvalanche));
        if (ls && s24 >= 10 && (g || 0) >= 50) ls = Math.min(3, ls + 1); // neve ventata
        t.update("snow", ls, time, Math.round(s72), "cm/72h", "modello meteo (indicatore valanghe)");
        hl = Math.max(hl, ls);
        mark("snow", ls, i - s);
      }
      timeline.push(hl);
    }

    // Piena da GloFAS (Copernicus EMS) – solo come conferma, la risoluzione è grossolana per bacini piccoli.
    if (isRiver && flood && flood.daily && flood.daily.river_discharge) {
      const d = flood.daily;
      const today = new Date(nowSec * 1000).toISOString().slice(0, 10);
      const past = [], fut = [];
      d.time.forEach((day, k) => (day < today ? past : fut).push({ day, q: num(d.river_discharge[k]) }));
      const base = median(past.slice(-30).map((x) => x.q));
      const next = fut.slice(0, 5).filter((x) => x.q !== null);
      if (base !== null && base >= T.floodMinBaseline && next.length) {
        const peak = next.reduce((a, b) => (b.q > a.q ? b : a));
        const ratio = peak.q / base;
        const lvl = levelGE(ratio, T.floodRatio);
        t.update("flood", lvl, Date.parse(peak.day + "T12:00:00Z") / 1000, Math.round(peak.q), "m³/s (×" + ratio.toFixed(1) + ")", "GloFAS");
      }
    }

    const hazards = t.list();
    return { level: hazards.reduce((m, x) => Math.max(m, x.level), 0), hazards, timeline, byType, startIndex: s, endIndex: e };
  }

  // Aggiunge pericoli calcolati altrove (allerte ufficiali, idrometri) e ricalcola il livello.
  function merge(res, extra) {
    const hazards = res.hazards.concat(extra || []).sort((a, b) => b.level - a.level || a.time - b.time);
    return Object.assign({}, res, { hazards, level: hazards.reduce((m, x) => Math.max(m, x.level), 0) });
  }

  // Idrometro: risalita del livello (serie [{t: sec, h: mm}] ordinata per tempo).
  function hydroHazard(series, nowSec, label) {
    if (!series || series.length < 2) return null;
    const last = series[series.length - 1];
    if (nowSec - last.t > 3 * 3600) return null; // dato vecchio: non lo usiamo
    const at = (dt) => { let best = null; for (const p of series) if (p.t <= last.t - dt) best = p; return best; };
    const p1 = at(3600), p3 = at(3 * 3600);
    const r1 = p1 ? (last.h - p1.h) / 10 : 0, r3 = p3 ? (last.h - p3.h) / 10 : 0; // mm → cm
    const lvl = Math.max(levelGE(r1, THRESHOLDS.hydroRise1h), levelGE(r3, THRESHOLDS.hydroRise3h));
    if (!lvl) return null;
    return { type: "flood", level: lvl, time: last.t, value: Math.round(Math.max(r1, r3)), unit: "cm di risalita", source: "idrometro " + label };
  }

  const api = { THRESHOLDS, evaluate, merge, hydroHazard, levelGE, levelLE, median, rollingSum };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Alerts = api;
})(typeof window !== "undefined" ? window : globalThis);
