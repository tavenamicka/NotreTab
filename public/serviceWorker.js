/**
 * Service Worker pour NotreTab
 * Stratégie : Cache-first pour assets, Network-first pour l'API
 */

const CACHE_VERSION = 'notretab-v1';
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets statiques à mettre en cache au install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg'
];

// Installation : mettre en cache les assets statiques
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache (expected for dynamic routes)', err);
      });
    })
  );

  self.skipWaiting(); // Force activation immédiate
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('notretab-') && name !== ASSET_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  self.clients.claim(); // Prendre le contrôle des clients existants
});

// Fetch : stratégie de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer non-GET
  if (request.method !== 'GET') {
    return;
  }

  // API : Network-first (données toujours fraîches, offline fallback)
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre à jour le cache avec la nouvelle réponse
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network fail : retourner la version en cache si disponible
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Returning cached API response:', url.pathname);
              return cachedResponse;
            }
            // Pas de cache : erreur
            return new Response(
              JSON.stringify({ error: 'Offline - API unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Assets (CSS, JS, images) : Cache-first (vitesse, offline support)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          // Ne cacher que les réponses 200 OK
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Cacher la réponse pour les prochains accès
          const responseToCache = response.clone();
          caches.open(ASSET_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Fallback : si ni cache ni network, retourner un placeholder
          return new Response(
            '<h1>Offline</h1><p>Asset unavailable. Check your connection.</p>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          );
        })
    )
  );
});

// Message depuis la page : force update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker loaded');
