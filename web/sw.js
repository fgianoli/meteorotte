// Service worker: app utilizzabile offline con gli ultimi dati scaricati.
const SHELL = "meteorotte-shell-v15", DATA = "meteorotte-data-v2";
const FILES = ["./", "index.html", "qui.html", "guida.html", "js/app.js", "js/alerts.js", "js/i18n.js", "js/ui-i18n.js", "data/hotspots.js", "data/shelters.js", "data/aiuti.js", "data/areas.js", "data/dpc-zones.js", "data/eaws.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(SHELL).then((c) =>
  // un file che non si scarica (per esempio la libreria della mappa da un altro sito) non deve impedire l'installazione
  Promise.all(FILES.map((f) => c.add(f).catch((err) => console.warn("non in cache:", f, err.message))))).then(() => self.skipWaiting())));
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

// Notifiche push
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: "MeteoRotte", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "MeteoRotte", { body: d.body || "", tag: d.tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || "./"));
});
