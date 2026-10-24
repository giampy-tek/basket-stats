// Cache-first per l'app, così funziona anche senza rete in palestra.
const CACHE = 'basket-stats-v1'
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./']))) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && (r.type === 'basic' || r.url.includes('fonts.g'))) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
      return r
    }).catch(() => caches.match(e.request).then((m) => m || caches.match('./'))),
  )
})
