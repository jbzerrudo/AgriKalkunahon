/* AgriKalkunahon service worker.
   VERSION is rewritten by build.js from a hash of the sources, so every build gets a new cache name.
   Required Notice: Copyright 2026 Jef Zerrudo (https://github.com/jbzerrudo/AgriKalkunahon)
   PolyForm Noncommercial License 1.0.0 */
const VERSION = 'agrikalkunahon-696fe12a';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // Delete old caches and take over open pages. If an older cache existed this is an update, not a first
  // install, so reload the open pages: an installed copy then shows the new build at once. The reload is
  // started after activation finishes (not awaited inside waitUntil), otherwise activation would wait on
  // a navigation that itself waits on activation.
  e.waitUntil(caches.keys().then(keys => {
    const old = keys.filter(k => k !== VERSION);
    return Promise.all(old.map(k => caches.delete(k))).then(() => self.clients.claim()).then(() => {
      if (old.length) self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.navigate(c.url).catch(() => {})));
    });
  }));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // The page itself: network first so an online user always gets the newest build; cache is the fallback.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }); const c = await caches.open(VERSION); c.put(req, res.clone()); return res; }
      catch (err) { return (await caches.match(req)) || (await caches.match('./index.html')); }
    })());
    return;
  }
  // Everything else: cache first, then network.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(VERSION); c.put(req, res.clone()); } return res; }
    catch (err) { return cached || Response.error(); }
  })());
});
