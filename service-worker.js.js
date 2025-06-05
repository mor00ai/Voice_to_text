const CACHE_NAME = 'voice-to-text-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/mic-192.png',
  './icons/mic-512.png',
  // eventuali altri asset (CSS, JS esterni se presenti)
];

// Installazione: cache risorse essenziali
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aperta e contenuti aggiunti');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Attivazione: elimina cache vecchie
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => 
      Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve risorse dalla cache o rete
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        // opzionale: aggiorna cache con nuova risorsa
        return caches.open(CACHE_NAME).then(cache => {
          // Clona la risposta perché può essere consumata solo una volta
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // fallback se offline e risorsa non in cache
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

