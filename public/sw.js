/* ============================================================
   REWARDLY - Service Worker PWA
   Permet l'installation de l'application sur Android/iOS/Windows
   ============================================================ */

const CACHE_NAME = "rewardly-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/images/logo.png",
  "/dashboard",
  "/tasks",
  "/deposit",
  "/withdraw",
  "/profile",
];

// Installation : précache les fichiers essentiels
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activation : nettoie les anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch : stratégie "network first, cache fallback" pour les pages
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache les réponses réussies
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // Fallback au cache si hors ligne
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback pour les navigations
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("", { status: 404 });
        });
      })
  );
});

// Message pour déclencher l'installation
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});