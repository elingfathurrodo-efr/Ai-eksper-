const CACHE = 'ai-hyper-shell-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Shell (HTML/CSS/JS inti) dilayani cache-first supaya app tetap terbuka offline.
// Model AI (transformers.js) disimpan terpisah oleh library-nya sendiri (Cache Storage khusus),
// jadi tidak dicampur dengan cache shell ini.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (SHELL.some((p) => url.pathname.endsWith(p.replace('./', '/')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
