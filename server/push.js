// Notifiche push del browser (Web Push) per chi non usa Telegram.
// Salva solo l'indirizzo tecnico della sottoscrizione, la zona, la lingua e il livello minimo: nessun dato personale.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const webpush = require("web-push");
const S = require("./lib/shared");

const PUBLIC = process.env.PUBLIC_DIR || "/data/public";
const PRIVATE = process.env.PRIVATE_DIR || "/data/private";
const PORT = +process.env.PUSH_PORT || 3000;
const REPEAT_H = +process.env.BOT_REPEAT_HOURS || 12;
const APP_URL = process.env.PUBLIC_URL || "";
const CONTACT = process.env.PUSH_CONTACT || (APP_URL ? APP_URL : "mailto:admin@example.org");
const MAX_SUBS = +process.env.PUSH_MAX_SUBS || 5000;
// Si inviano notifiche solo ai servizi push dei browser: evita che il server venga usato per chiamare indirizzi arbitrari.
const ALLOWED = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); };
const KEYS = path.join(PRIVATE, "vapid.json"), SUBS = path.join(PRIVATE, "push-subs.json"), SENT = path.join(PRIVATE, "push-sent.json");

let keys = readJSON(KEYS, null);
if (!keys) { keys = webpush.generateVAPIDKeys(); writeJSON(KEYS, keys); log("Chiavi VAPID generate"); }
webpush.setVapidDetails(CONTACT, keys.publicKey, keys.privateKey);
let subs = readJSON(SUBS, {});
let sent = readJSON(SENT, {});
const REGIONS = [...new Set(S.HOTSPOTS.map((s) => s.regione))];
const LCODES = S.LANGS.map((l) => l.code);
const id = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 16);

function validEndpoint(e) {
  try { const u = new URL(e); return u.protocol === "https:" && ALLOWED.test(u.hostname); } catch (_) { return false; }
}

function body(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 8192) { reject(new Error("troppo grande")); req.destroy(); } });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  try {
    const url = req.url.split("?")[0];
    if (req.method === "GET" && url === "/push/key") return send(200, { key: keys.publicKey });
    if (req.method === "POST" && url === "/push/subscribe") {
      const b = await body(req), s = b.subscription;
      if (!s || !validEndpoint(s.endpoint) || !s.keys || typeof s.keys.p256dh !== "string" || typeof s.keys.auth !== "string") return send(400, { error: "sottoscrizione non valida" });
      if (!subs[id(s.endpoint)] && Object.keys(subs).length >= MAX_SUBS) return send(503, { error: "troppe sottoscrizioni" });
      subs[id(s.endpoint)] = {
        sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
        region: REGIONS.includes(b.region) ? b.region : "*", lang: LCODES.includes(b.lang) ? b.lang : "it", min: [1, 2, 3].includes(b.min) ? b.min : 2
      };
      writeJSON(SUBS, subs);
      return send(200, { ok: true });
    }
    if (req.method === "POST" && url === "/push/unsubscribe") {
      const b = await body(req);
      if (typeof b.endpoint === "string") { delete subs[id(b.endpoint)]; writeJSON(SUBS, subs); }
      return send(200, { ok: true });
    }
    send(404, { error: "non trovato" });
  } catch (e) { send(400, { error: "richiesta non valida" }); }
});

let lastGenerated = null;
async function dispatch() {
  const a = readJSON(path.join(PUBLIC, "alerts.json"), null);
  if (!a || a.generated === lastGenerated) return;
  lastGenerated = a.generated;
  const now = Date.now();
  for (const k of Object.keys(sent)) if (now - sent[k] > 3 * 24 * 3600e3) delete sent[k];
  for (const [sid, s] of Object.entries(subs)) {
    for (const e of a.sites) {
      const site = S.HOTSPOTS.find((x) => x.id === e.id);
      if (!site || (s.region !== "*" && s.region !== site.regione) || e.res.level < s.min) continue;
      const fresh = e.res.hazards.filter((h) => h.level >= s.min).filter((h) => { const k = `${sid}|${e.id}|${h.type}|${h.level}`; return !sent[k] || now - sent[k] > REPEAT_H * 3600e3; });
      if (!fresh.length) continue;
      const lines = (e.messages[s.lang] || e.messages.it).split("\n");
      const payload = JSON.stringify({ title: lines[0], body: lines.slice(1).join("\n").slice(0, 600), tag: e.id, url: APP_URL || "./" });
      try {
        await webpush.sendNotification(s.sub, payload, { TTL: 6 * 3600, urgency: e.res.level >= 3 ? "high" : "normal" });
        fresh.forEach((h) => (sent[`${sid}|${e.id}|${h.type}|${h.level}`] = now));
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) { delete subs[sid]; break; } // sottoscrizione scaduta
        log("✗ push", err.statusCode || err.message);
      }
    }
  }
  writeJSON(SENT, sent); writeJSON(SUBS, subs);
}

if (require.main === module) {
  server.listen(PORT, () => log("Push in ascolto sulla porta", PORT, "–", Object.keys(subs).length, "sottoscrizioni"));
  setInterval(() => dispatch().catch((e) => log("✗ dispatch", e.message)), 60 * 1000);
}
module.exports = { server, validEndpoint };
