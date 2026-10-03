// Service Worker: hält alle Dateien der App für den Offline-Betrieb vor.
// VERSION und DATEIEN setzt scripts/baue-site.js beim Deploy ein. Ohne Build (lokale Entwicklung)
// ist DATEIEN leer und der Service Worker reicht alle Anfragen unverändert ans Netz durch.
const VERSION = "dev";
const DATEIEN = [];
const CACHE = "physiologie-" + VERSION;

self.addEventListener("install", e => {
  if (!DATEIEN.length) return;
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("physiologie-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", e => { if (e.data === "aktivieren") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Nur eigene Dateien; Anfragen an GitHub (Synchronisierung) gehen immer direkt ans Netz
  if (!DATEIEN.length || e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const anfrage = e.request.mode === "navigate" ? new URL("./", self.registration.scope).href : e.request;
    const treffer = await cache.match(anfrage, { ignoreSearch: true });
    if (treffer) return treffer;
    return fetch(e.request);
  })());
});
