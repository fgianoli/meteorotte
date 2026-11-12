// Uscite standard: un messaggio CAP 1.2 per punto in allerta + feed Atom che li elenca.
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const capTime = (sec) => new Date(sec * 1000).toISOString().replace(/\.\d{3}Z$/, "+00:00");
const SEVERITY = ["Minor", "Moderate", "Severe", "Extreme"];
const LANG_TAG = { it: "it-IT", en: "en-GB", fr: "fr-FR", ar: "ar", fa: "fa", ps: "ps", ur: "ur", ti: "ti", wo: "wo", mnk: "mnk", ff: "ff" };
const HZ_NAME = { official: "Allerta ufficiale", flood: "Piena", rain: "Pioggia intensa", cold: "Freddo", heat: "Caldo", snow: "Neve/valanghe", wind: "Vento/temporali" };

function capAlert(entry, ctx) {
  const { site, res, messages } = entry;
  const sent = ctx.generated;
  const expires = sent + ctx.validitySec;
  const onset = Math.max(sent, Math.min(...res.hazards.map((h) => h.time)));
  const event = res.hazards.map((h) => HZ_NAME[h.type] || h.type).filter((v, i, a) => a.indexOf(v) === i).join(", ");
  const desc = res.hazards.map((h) => `${HZ_NAME[h.type]} – livello ${h.level} – ${h.value != null ? h.value + " " : ""}${h.unit} (${h.source})`).join("\n");
  const infos = Object.keys(messages).map((lang) => `
  <info>
    <language>${LANG_TAG[lang] || lang}</language>
    <category>Met</category>
    <event>${esc(event)}</event>
    <urgency>Expected</urgency>
    <severity>${SEVERITY[res.level]}</severity>
    <certainty>Possible</certainty>
    <onset>${capTime(onset)}</onset>
    <expires>${capTime(expires)}</expires>
    <senderName>${esc(ctx.senderName)}</senderName>
    <headline>${esc(messages[lang].split("\n")[0])}</headline>
    <description>${esc(desc)}</description>
    <instruction>${esc(messages[lang].split("\n").slice(1).join("\n"))}</instruction>
    ${ctx.publicUrl ? `<web>${esc(ctx.publicUrl)}</web>` : ""}
    <area>
      <areaDesc>${esc(site.nome)}</areaDesc>
      <circle>${site.lat},${site.lon} ${ctx.radiusKm}</circle>
    </area>
  </info>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${esc(ctx.sender)}.${site.id}.${sent}</identifier>
  <sender>${esc(ctx.sender)}</sender>
  <sent>${capTime(sent)}</sent>
  <status>${esc(ctx.status)}</status>
  <msgType>Alert</msgType>
  <scope>Restricted</scope>
  <restriction>Allerta calcolata automaticamente per operatori umanitari. Non è un'allerta ufficiale: verificare con le protezioni civili.</restriction>${infos}
</alert>
`;
}

function atomFeed(entries, ctx) {
  const base = (ctx.publicUrl || "").replace(/\/$/, "");
  const items = entries.map((e) => `
  <entry>
    <id>${esc(ctx.sender)}.${e.site.id}.${ctx.generated}</id>
    <title>${esc(e.messages.it.split("\n")[0])}</title>
    <updated>${capTime(ctx.generated)}</updated>
    <link type="application/cap+xml" href="${base}/api/cap/${e.site.id}.xml"/>
    <summary>${esc(e.messages.it)}</summary>
  </entry>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${esc(ctx.sender)}</id>
  <title>MeteoRotte – allerte attive</title>
  <updated>${capTime(ctx.generated)}</updated>
  <link rel="self" href="${base}/api/feed.atom"/>${items}
</feed>
`;
}

module.exports = { capAlert, atomFeed };
