/**
 * Service Worker pour NotreTab
 * Stratégie : Cache-first pour assets, Network-first pour l'API
 */

// v3 : purge les caches v2, qui contenaient les réponses de /api/users —
// dont celle de l'authentification, qui transporte le hash bcrypt (V09).
const CACHE_VERSION = 'notretab-v3';
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const API_CACHE = `${CACHE_VERSION}-api`;

/**
 * Routes jamais mises en cache : les comptes.
 * `/api/users?email=<exact>` renvoie le hash bcrypt (l'authentification le
 * compare dans le navigateur), et le cache du service worker est persisté sur
 * le disque du profil. Les autres collections restent cachées : c'est ce qui
 * fait le mode hors ligne, et ce sont des données que l'utilisateur possède.
 */
function isAccountRoute(pathname) {
  return pathname === '/api/users'
    || pathname.startsWith('/api/users/')
    // /api/auth/* : une réponse d'authentification ne se rejoue pas depuis le
    // disque. Démarrer hors ligne reste possible — AuthContext conserve la
    // session quand /auth/me échoue pour cause de réseau, et ne la ferme que
    // sur un 401 explicite.
    || pathname.startsWith('/api/auth/');
}

// Ne pas pré-cacher index.html — il doit toujours venir du réseau
// pour que le bon bundle JS (hash Vite) soit référencé après déploiement
const STATIC_ASSETS = [
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
      const purgeOldVersions = Promise.all(
        cacheNames
          .filter((name) => name.startsWith('notretab-') && name !== ASSET_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );

      // Ceinture et bretelles : purge toute entrée de compte qui aurait été
      // écrite dans le cache courant (version non bumpée, régression future).
      const purgeAccounts = caches.open(API_CACHE).then((cache) =>
        cache.keys().then((requests) =>
          Promise.all(
            requests
              .filter((req) => isAccountRoute(new URL(req.url).pathname))
              .map((req) => {
                console.log('[SW] Purging cached account response:', req.url);
                return cache.delete(req);
              })
          )
        )
      );

      return Promise.all([purgeOldVersions, purgeAccounts]);
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
    const offline = () =>
      new Response(
        JSON.stringify({ error: 'Offline - API unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );

    // Les comptes ne sont ni écrits ni relus depuis le cache : réseau ou rien.
    if (isAccountRoute(url.pathname)) {
      event.respondWith(fetch(request).catch(offline));
      return;
    }

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
            return offline();
          });
        })
    );
    return;
  }

  // index.html : toujours réseau (sinon le vieux bundle JS est servi après déploiement)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
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
    })
  );
});

// Message depuis la page : force update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker loaded');
