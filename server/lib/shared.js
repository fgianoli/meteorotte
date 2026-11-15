// Carica il codice condiviso con la web app (punti critici, messaggi, motore di allerta).
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;

function find(file) {
  const dirs = [process.env.SHARED_DIR, path.join(__dirname, "..", "shared"), path.join(__dirname, "..", "..", "web", "js"), path.join(__dirname, "..", "..", "web", "data")];
  for (const d of dirs) if (d && fs.existsSync(path.join(d, file))) return path.join(d, file);
  throw new Error("File condiviso non trovato: " + file);
}
require(find("hotspots.js"));
require(find("i18n.js"));
try { require(find("corridors.js")); } catch (e) { globalThis.CORRIDORS = []; }
try { require(find("dpc-zones.js")); } catch (e) { globalThis.DPC_ZONES = {}; }
const Alerts = require(find("alerts.js"));
const g = globalThis;
module.exports = { Alerts, HOTSPOTS: g.HOTSPOTS, LANGS: g.LANGS, MSG: g.MSG, ICONS: g.ICONS, LEVEL_ICON: g.LEVEL_ICON, EMERGENCY: g.EMERGENCY, LINKS: g.LINKS, DPC_ZONES: g.DPC_ZONES, CORRIDORS: g.CORRIDORS, composeMessage: g.composeMessage };
