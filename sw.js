const CACHE = 'holidays-v3';
const SHELL = ['./', './app.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network first, cache as the offline fallback — so a deployed change shows up
// on the next open instead of being pinned to whatever was cached at install.
// Supabase reads are cached the same way, so a trip you have opened once is
// readable offline (notes, links, packing list).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const url = e.request.url;
        if (r.ok && (url.startsWith(self.location.origin) || url.includes('/rest/v1/'))) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
