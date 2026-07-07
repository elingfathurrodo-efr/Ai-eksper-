// Minimal app-shell cache so the UI itself opens offline.
// Model weights are cached separately by WebLLM/browser Cache Storage —
// this worker deliberately does NOT touch those (they're huge and
// versioned by the model runtime, not by app deploys).
const CACHE = "ai-hyper-shell-v2";
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/tokens.css",
  "css/layout.css",
  "css/components.css",
  "css/themes.css",
  "js/app.js",
  "js/ui.js",
  "js/chat.js",
  "js/agents.js",
  "js/models.js",
  "js/router.js",
  "js/auth.js",
  "js/quota.js",
  "js/storage.js",
  "js/config.js",
  "data/model-registry.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept cross-origin (CDN/model/Firebase/cloud gateway) calls.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
          .catch(() => cached)
    )
  );
});
