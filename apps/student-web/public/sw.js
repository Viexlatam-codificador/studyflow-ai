// StudyFlow AI — minimal service worker.
// Just enough for Chrome/Android's PWA installability criteria (a fetch
// handler) plus a small cache for the app shell's static assets, so the
// icon/manifest still resolve on a flaky connection. Deliberately does NOT
// cache pages/API responses — this app is session- and data-driven, and a
// stale cached dashboard would be actively misleading.
const CACHE_NAME = "studyflow-shell-v1";
const SHELL_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellAsset = SHELL_ASSETS.includes(url.pathname);
  if (!isShellAsset || event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
