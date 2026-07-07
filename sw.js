// Ambara Service Worker
const CACHE='ambara-v2';
const ASSETS=['./','./index.html','./manifest.json','./icon.svg','./model-registry.json'];
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ASSETS).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',e=>{
  const url=e.request.url;
  if(/huggingface|firebase|googleapis|onnx|api\.|cdn-lfs/.test(url))return;
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
      if(r.ok){const x=r.clone();caches.open(CACHE).then(co=>co.put(e.request,x))}
      return r;
    }).catch(()=>caches.match('./index.html')))
  );
});
