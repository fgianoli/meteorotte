// fetch con timeout e tentativi ripetuti
const UA = "MeteoRotte/0.2 (+https://github.com/; allerte umanitarie)";
async function get(url, { tries = 3, timeout = 30000, type = "json" } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split("?")[0]}`);
      return type === "json" ? await r.json() : await r.text();
    } catch (e) {
      err = e;
      if (String(e.message).includes("HTTP 4") && !String(e.message).includes("429")) break;
      await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
    } finally { clearTimeout(to); }
  }
  throw err;
}
module.exports = { get };
