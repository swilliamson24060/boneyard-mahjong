// Keeps the game playable offline. Every file it needs is cached when the
// service worker installs. While there is a network each request still goes
// to it first, asking the server whether the file has changed rather than
// trusting the browser's own copy (GitHub Pages lets browsers keep files
// for ten minutes), so a new version shows at once, with the cache as the
// fallback when the network is gone or too slow; the font, which never
// changes, comes from the cache first. A new list of files wants a new name
// for the cache, so that old copies are cleared away: only Boneyard's own,
// since other games on the same site share the browser's cache store.

const PREFIX = 'boneyard-';
const CACHE = `${PREFIX}2`;
const SLOW = 3500; // ms to wait on the network before answering from the cache

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/game.css',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/main.js',
  'js/night.js',
  'js/score.js',
  'js/ui/board.js',
  'js/ui/faces.js',
  'js/ui/sound.js',
  'js/engine/deal.js',
  'js/engine/game.js',
  'js/engine/layout.js',
  'js/engine/layouts.js',
  'js/engine/midnight.js',
  'js/engine/rng.js',
  'js/engine/solver.js',
  'js/engine/tiles.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(request));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {}); // failing after the cache has answered is no matter
  const cached = () => cache.match(request, { ignoreSearch: true });
  const slow = new Promise((resolve) => setTimeout(resolve, SLOW)).then(cached);
  try {
    return (await Promise.race([network, slow])) || (await network);
  } catch {
    return (await cached()) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
