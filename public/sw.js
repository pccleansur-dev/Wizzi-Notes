const CACHE_NAME = 'wizzi-note-v1';

// Assets del shell de la app que se cachean en la instalación
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Eliminar caches viejos
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar esquemas no cacheables (chrome-extension://, moz-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Las llamadas a /api/* siempre van a la red (nunca cachear respuestas de IA)
  if (url.pathname.startsWith('/api/')) return;

  // Para el resto: network-first con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Solo cachear respuestas válidas GET
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
