// Service worker: app utilizzabile offline con gli ultimi dati scaricati.
const SHELL = "meteorotte-shell-v3", DATA = "meteorotte-data-v2";
const FILES = ["./", "index.html", "js/app.js", "js/alerts.js", "js/i18n.js", "data/hotspots.js", "manifest.webmanifest", "icons/icon.svg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.includes("/api/") || url.hostname.endsWith("open-meteo.com") || url.hostname.endsWith("rainviewer.com")) {
    // rete prima, cache come ripiego
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(DATA).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  }
});
