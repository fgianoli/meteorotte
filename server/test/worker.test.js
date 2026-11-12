// Test end-to-end: Open-Meteo e Telegram simulati in locale; GloFAS, Hub'Eau e MeteoAlarm reali se raggiungibili.
// node test/worker.test.js
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { spawn } = require("child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "meteorotte-"));
const sentMessages = [];
let updates = [
  { update_id: 1, message: { chat: { id: 42, username: "op" }, text: "/start segreto" } },
  { update_id: 2, message: { chat: { id: 42 }, text: "/iscrivi tutte" } },
  { update_id: 3, message: { chat: { id: 42 }, text: "/livello 1" } },
  { update_id: 4, message: { chat: { id: 42 }, text: "/lingue it ar" } },
  { update_id: 5, message: { chat: { id: 42 }, text: "/stato" } }
];

function fakeForecast(q) {
  const lats = q.get("latitude").split(","), lons = q.get("longitude").split(",");
  const now = Math.floor(Date.now() / 3600e3) * 3600;
  return lats.map((la, k) => {
    la = +la; const n = 120, h = { time: [], temperature_2m: [], apparent_temperature: [], precipitation: [], snowfall: [], wind_speed_10m: [], wind_gusts_10m: [], wind_direction_10m: [], weather_code: [] };
    for (let i = 0; i < n; i++) {
      const t = 12 - (la - 41) * 2.5 + 5 * Math.sin(i / 24 * 2 * Math.PI);
      h.time.push(now - 24 * 3600 + i * 3600); h.temperature_2m.push(t); h.apparent_temperature.push(t - 3);
      h.precipitation.push(k % 5 === 0 && i > 40 && i < 46 ? 25 : 0); h.snowfall.push(0);
      h.wind_speed_10m.push(15); h.wind_gusts_10m.push(30); h.wind_direction_10m.push(200); h.weather_code.push(0);
    }
    return { latitude: la, longitude: +lons[k], elevation: 300, hourly: h };
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/v1/forecast") return json(fakeForecast(u.searchParams));
  if (u.pathname.endsWith("/getUpdates")) { const u2 = updates; updates = []; setTimeout(() => json({ ok: true, result: u2 }), u2.length ? 0 : 300); return; }
  if (u.pathname.endsWith("/sendMessage")) { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { sentMessages.push(JSON.parse(b)); json({ ok: true, result: {} }); }); return; }
  res.writeHead(404); res.end();
});

server.listen(0, async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  Object.assign(process.env, { OPENMETEO_URL: base, PUBLIC_DIR: path.join(tmp, "public"), PRIVATE_DIR: path.join(tmp, "private"), RUN_ONCE: "1", PUBLIC_URL: "https://example.org" });
  const { run } = require("../worker.js");
  const out = await run();

  const pub = path.join(tmp, "public");
  const j = JSON.parse(fs.readFileSync(path.join(pub, "alerts.json")));
  assert.strictEqual(j.sites.length, 22, "22 punti");
  assert.ok(j.sites.some((s) => s.res.level >= 2), "almeno un'allerta arancione (pioggia simulata)");
  assert.ok(Object.keys(j.sites[0].messages).length === 8, "8 lingue");
  const caps = fs.readdirSync(path.join(pub, "cap"));
  assert.ok(caps.length > 0, "CAP generati");
  const cap = fs.readFileSync(path.join(pub, "cap", caps[0]), "utf8");
  assert.ok(cap.includes("urn:oasis:names:tc:emergency:cap:1.2") && cap.includes("<circle>"), "CAP valido");
  assert.ok(fs.readFileSync(path.join(pub, "feed.atom"), "utf8").includes("<entry>"), "feed Atom");
  console.log("worker OK –", caps.length, "CAP · fonti:", JSON.stringify(out.sources));
  const official = j.sites.flatMap((s) => s.res.hazards.filter((h) => h.type === "official").map((h) => s.id + ": " + h.unit));
  const hydro = j.sites.flatMap((s) => s.hydro.map((h) => `${h.label} ${(h.h_mm / 1000).toFixed(2)} m`));
  console.log("MeteoAlarm attive sui punti:", official.length ? official.join(" | ") : "nessuna");
  console.log("Idrometri Roya:", hydro.join(" | ") || "non disponibili");

  // bot
  const bot = spawn(process.execPath, [path.join(__dirname, "..", "bot.js")], {
    env: Object.assign({}, process.env, { TELEGRAM_TOKEN: "TEST", TELEGRAM_API: base, BOT_ACCESS_CODE: "segreto" }), stdio: ["ignore", "pipe", "pipe"]
  });
  let botLog = ""; bot.stdout.on("data", (d) => (botLog += d)); bot.stderr.on("data", (d) => (botLog += d));
  await new Promise((r) => setTimeout(r, 2500));
  // forza un nuovo giro del dispatcher con un alerts.json nuovo
  await run();
  await new Promise((r) => setTimeout(r, 65000));
  bot.kill();
  server.close();
  const texts = sentMessages.map((m) => m.text);
  assert.ok(texts.some((t) => t.includes("/iscrivi")), "risponde a /start");
  assert.ok(texts.some((t) => t.startsWith("Aggiornamento:")), "risponde a /stato");
  const alerts = texts.filter((t) => t.includes("Dettagli per l'operatore"));
  assert.ok(alerts.length > 0, "invia allerte");
  assert.ok(alerts[0].includes("— — —"), "messaggi in più lingue");
  const subs = JSON.parse(fs.readFileSync(path.join(tmp, "private", "subs.json")));
  assert.deepStrictEqual(subs["42"].langs, ["it", "ar"]);
  console.log(`bot OK – ${sentMessages.length} messaggi, di cui ${alerts.length} allerte. Esempio:\n\n${alerts[0].slice(0, 700)}`);
  process.exit(0);
});
