/* Djabri service worker: caches images + fonts, keeps the page itself fresh. */
const IMG = 'dj-img-v1', PAGE = 'dj-page-v1', MAX_IMG = 120;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('dj-') && k !== IMG && k !== PAGE) await caches.delete(k);
  await self.clients.claim();
})()));

async function trim(cache){
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMG; i++) await cache.delete(keys[i]);
}
// show cached copy instantly, refresh it in the background
async function swr(req){
  const cache = await caches.open(IMG);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')){ cache.put(req, res.clone()).then(() => trim(cache)); }
    return res;
  }).catch(() => hit);
  return hit || net;
}
// always try the network first so updates to the site show up, fall back offline
async function pageFirst(req){
  const cache = await caches.open(PAGE);
  try{
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }catch(e){
    return (await cache.match(req)) || (await cache.match('/')) || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return; // never touch videos / writes
  const u = new URL(r.url);
  if (r.mode === 'navigate' && u.origin === location.origin) return e.respondWith(pageFirst(r));
  if (u.hostname === 'res.cloudinary.com' && r.destination === 'image') return e.respondWith(swr(r));
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') return e.respondWith(swr(r));
  // everything else (Firebase data, Cloudinary video, API calls) goes straight to the network
});
