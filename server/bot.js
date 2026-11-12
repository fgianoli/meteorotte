// Bot Telegram per gli operatori: iscrizione per zona, lingue e livello minimo.
// Invia le allerte agli operatori, che decidono se e come inoltrarle. Nessun invio diretto ai migranti.
const fs = require("fs");
const path = require("path");
const S = require("./lib/shared");

const TOKEN = process.env.TELEGRAM_TOKEN;
const API = (process.env.TELEGRAM_API || "https://api.telegram.org").replace(/\/$/, "");
const PUBLIC = process.env.PUBLIC_DIR || "/data/public";
const PRIVATE = process.env.PRIVATE_DIR || "/data/private";
const ACCESS_CODE = process.env.BOT_ACCESS_CODE || "";
const REPEAT_H = +process.env.BOT_REPEAT_HOURS || 12;
const APP_URL = process.env.PUBLIC_URL || "";
const SUBS = path.join(PRIVATE, "subs.json");
const SENT = path.join(PRIVATE, "sent.json");

if (!TOKEN) { console.error("TELEGRAM_TOKEN mancante: il bot non parte."); process.exit(0); }

const log = (...a) => console.log(new Date().toISOString(), ...a);
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(v, null, 1)); fs.renameSync(f + ".tmp", f); };

let subs = readJSON(SUBS, {});
let sent = readJSON(SENT, {});
const REGIONS = [...new Set(S.HOTSPOTS.map((s) => s.regione))];
const LCODES = S.LANGS.map((l) => l.code);

async function tg(method, params) {
  const r = await fetch(`${API}/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params) });
  const j = await r.json();
  if (!j.ok) throw new Error(method + ": " + j.description);
  return j.result;
}
async function send(chat, text) {
  // Telegram accetta al massimo 4096 caratteri per messaggio
  for (let i = 0; i < text.length; i += 4000) await tg("sendMessage", { chat_id: chat, text: text.slice(i, i + 4000), disable_web_page_preview: true });
}

const HELP = `🛟 MeteoRotte – allerte per operatori

/zone – elenco delle zone
/iscrivi 1 3 (oppure: tutte) – ricevi le allerte di queste zone
/disiscrivi 2 (oppure: tutte)
/lingue it ar fa – lingue dei messaggi (${LCODES.join(" ")})
/livello 2 – livello minimo: 1 giallo, 2 arancione, 3 rosso
/stato – situazione attuale delle tue zone
/punti – elenco dei punti con il loro codice
/punto ventimiglia-roja – messaggio completo per un punto
/stop – cancella la tua iscrizione

Le allerte sono calcolate automaticamente e non sostituiscono quelle ufficiali.`;

function currentAlerts() { return readJSON(path.join(PUBLIC, "alerts.json"), null); }
function siteOf(id) { return S.HOTSPOTS.find((s) => s.id === id); }
function chatRegions(sub) { return sub.regions.includes("*") ? REGIONS : sub.regions; }

function renderSite(entry, langs) {
  const site = siteOf(entry.id);
  const parts = langs.map((l) => entry.messages[l]).filter(Boolean);
  const tech = entry.res.hazards.map((h) => `• ${S.LEVEL_ICON[h.level]}${S.ICONS[h.type] || ""} ${h.value != null ? h.value + " " : ""}${h.unit} – ${h.source}`).join("\n");
  return `${parts.join("\n\n— — —\n\n")}\n\n🔧 Dettagli per l'operatore (${site.regione}):\n${tech || "nessuna soglia superata"}${APP_URL ? "\n🗺 " + APP_URL : ""}`;
}

async function handle(msg) {
  const chat = String(msg.chat.id);
  const [cmdRaw, ...args] = (msg.text || "").trim().split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const sub = subs[chat];

  if (cmd === "/start") {
    if (ACCESS_CODE && args[0] !== ACCESS_CODE && !(sub && sub.ok)) return send(chat, "Questo bot è riservato agli operatori. Scrivi /start seguito dal codice di accesso.");
    subs[chat] = sub || { ok: true, regions: [], langs: ["it", "en"], min: 2, name: msg.chat.title || msg.chat.username || "" };
    subs[chat].ok = true; writeJSON(SUBS, subs);
    return send(chat, HELP);
  }
  if (!sub || !sub.ok) return send(chat, "Prima scrivi /start" + (ACCESS_CODE ? " seguito dal codice di accesso." : "."));

  switch (cmd) {
    case "/help": return send(chat, HELP);
    case "/zone": return send(chat, REGIONS.map((r, i) => `${i + 1}. ${r}${sub.regions.includes("*") || sub.regions.includes(r) ? " ✅" : ""}`).join("\n"));
    case "/iscrivi":
    case "/disiscrivi": {
      const add = cmd === "/iscrivi";
      if (args[0] === "tutte") sub.regions = add ? ["*"] : [];
      else {
        if (sub.regions.includes("*")) sub.regions = REGIONS.slice();
        for (const a of args) { const r = REGIONS[+a - 1]; if (!r) continue; sub.regions = sub.regions.filter((x) => x !== r); if (add) sub.regions.push(r); }
      }
      writeJSON(SUBS, subs);
      return send(chat, "Zone attive:\n" + (chatRegions(sub).join("\n") || "nessuna"));
    }
    case "/lingue": {
      const ok = args.filter((a) => LCODES.includes(a));
      if (ok.length) { sub.langs = ok; writeJSON(SUBS, subs); }
      return send(chat, "Lingue dei messaggi: " + sub.langs.join(", ") + "\nDisponibili: " + LCODES.join(" "));
    }
    case "/livello": {
      const n = +args[0];
      if (n >= 1 && n <= 3) { sub.min = n; writeJSON(SUBS, subs); }
      return send(chat, "Livello minimo: " + S.LEVEL_ICON[sub.min] + " " + sub.min);
    }
    case "/punti": return send(chat, S.HOTSPOTS.map((s) => `${s.id} – ${s.nome}`).join("\n"));
    case "/stato": {
      const a = currentAlerts();
      if (!a) return send(chat, "Dati non ancora disponibili.");
      const regs = chatRegions(sub);
      const lines = a.sites.filter((x) => regs.includes(siteOf(x.id).regione)).sort((x, y) => y.res.level - x.res.level)
        .map((x) => `${S.LEVEL_ICON[x.res.level]} ${siteOf(x.id).nome} ${x.res.hazards.map((h) => S.ICONS[h.type]).filter((v, i, z) => z.indexOf(v) === i).join("")}`);
      return send(chat, `Aggiornamento: ${new Date(a.generated).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}\n\n` + (lines.join("\n") || "Nessuna zona selezionata: usa /iscrivi"));
    }
    case "/punto": {
      const a = currentAlerts();
      const e = a && a.sites.find((x) => x.id === args[0]);
      return send(chat, e ? renderSite(e, sub.langs) : "Punto non trovato: vedi /punti");
    }
    case "/stop": delete subs[chat]; writeJSON(SUBS, subs); return send(chat, "Iscrizione cancellata.");
    default: return send(chat, HELP);
  }
}

// Invio automatico: una volta per (chat, punto, pericolo, livello) ogni REPEAT_H ore; un aumento di livello si invia subito.
let lastGenerated = null;
async function dispatch() {
  const a = currentAlerts();
  if (!a || a.generated === lastGenerated) return;
  lastGenerated = a.generated;
  const now = Date.now();
  for (const k of Object.keys(sent)) if (now - sent[k] > 3 * 24 * 3600e3) delete sent[k];
  for (const [chat, sub] of Object.entries(subs)) {
    if (!sub.ok) continue;
    const regs = chatRegions(sub);
    for (const e of a.sites) {
      const site = siteOf(e.id);
      if (!site || !regs.includes(site.regione) || e.res.level < sub.min) continue;
      const fresh = e.res.hazards.filter((h) => h.level >= sub.min).filter((h) => {
        const key = `${chat}|${e.id}|${h.type}|${h.level}`;
        return !sent[key] || now - sent[key] > REPEAT_H * 3600e3;
      });
      if (!fresh.length) continue;
      try {
        await send(chat, renderSite(e, sub.langs));
        fresh.forEach((h) => (sent[`${chat}|${e.id}|${h.type}|${h.level}`] = now));
        log("→", chat, e.id, "livello", e.res.level);
      } catch (err) { log("✗ invio", chat, err.message); if (/blocked|not found|kicked/i.test(err.message)) delete subs[chat]; }
    }
  }
  writeJSON(SENT, sent); writeJSON(SUBS, subs);
}

async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const ups = await tg("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
      for (const u of ups) {
        offset = u.update_id + 1;
        if (u.message && u.message.text) await handle(u.message).catch((e) => log("✗", e.message));
      }
    } catch (e) { log("✗ polling", e.message); await new Promise((r) => setTimeout(r, 5000)); }
  }
}

log("Bot avviato,", Object.keys(subs).length, "iscritti");
setInterval(() => dispatch().catch((e) => log("✗ dispatch", e.message)), 60 * 1000);
dispatch().catch(() => {});
poll();
