// node test/alerts.test.js – verifica il motore di allerta con dati sintetici
const A = require("../../web/js/alerts.js");
const assert = require("assert");
const now = 1_800_000_000;
function wx(n, f) { const h = { time: [], temperature_2m: [], apparent_temperature: [], precipitation: [], snowfall: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [], weather_code: [] };
  for (let i = 0; i < n; i++) { h.time.push(now - 24 * 3600 + i * 3600); const v = f(i - 24);
    h.temperature_2m.push(v.t ?? 10); h.apparent_temperature.push(v.a ?? 10); h.precipitation.push(v.p ?? 0); h.snowfall.push(v.s ?? 0);
    h.wind_speed_10m.push(10); h.wind_gusts_10m.push(v.g ?? 20); h.wind_direction_10m.push(0); h.weather_code.push(v.c ?? 0); }
  return { elevation: v0(f), hourly: h }; }
function v0(f) { return f(0).elev ?? 200; }
// 1. calmo
let r = A.evaluate({ tipo: "pianura" }, wx(120, () => ({})), [], null, now);
assert.strictEqual(r.level, 0);
// 2. freddo -13 → rosso
r = A.evaluate({ tipo: "bosco" }, wx(120, (i) => ({ a: i === 30 ? -13 : 2 })), [], null, now);
assert.strictEqual(r.level, 3); assert.strictEqual(r.hazards[0].type, "cold");
// 3. pioggia a monte su un fiume → flood anche se sul punto non piove
const up = wx(120, (i) => ({ p: i >= 10 && i < 16 ? 20 : 0 }));
r = A.evaluate({ tipo: "fiume" }, wx(120, () => ({})), [up], null, now);
assert.ok(r.hazards.find((h) => h.type === "flood" && h.level >= 2), "piena da pioggia a monte");
// 4. neve in montagna con vento → neve ventata
r = A.evaluate({ tipo: "montagna" }, wx(120, (i) => ({ s: i >= 0 && i < 12 ? 2 : 0, g: 55, elev: 1800 })), [], null, now);
assert.ok(r.hazards.find((h) => h.type === "snow" && h.level >= 2), "neve ventata");
// 5. GloFAS: portata 8× la mediana → arancione
const days = []; const q = [];
for (let k = -31; k < 7; k++) { days.push(new Date((now + k * 86400) * 1000).toISOString().slice(0, 10)); q.push(k < 0 ? 10 : (k === 2 ? 80 : 12)); }
r = A.evaluate({ tipo: "fiume" }, wx(120, () => ({})), [], { daily: { time: days, river_discharge: q } }, now);
assert.strictEqual(r.hazards.find((h) => h.source === "GloFAS").level, 2);
// 6. temporale → vento arancione
r = A.evaluate({ tipo: "urbano" }, wx(120, (i) => ({ c: i === 5 ? 95 : 0 })), [], null, now);
assert.strictEqual(r.hazards[0].type, "wind"); assert.strictEqual(r.level, 2);
console.log("OK – 6 test superati");
