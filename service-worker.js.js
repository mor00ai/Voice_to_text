// Service Worker per Voice to Text PWA
// Versione cache basata su timestamp per auto-aggiornamento
const CACHE_NAME = `voice-to-text-v${Date.now()}`;
const STATIC_CACHE_NAME = `voice-to-text-static-v${Date.now()}`;

// File da cachare per il funzionamento offline
const CACHE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Installa il service worker
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        // Forza l'attivazione del nuovo service worker
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Error during install:', error);
      })
  );
});

// Attiva il service worker e pulisce cache vecchie
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Rimuovi cache vecchie che non corrispondono alla versione attuale
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Prendi controllo di tutte le pagine aperte
        return self.clients.claim();
      })
      .catch(error => {
        console.error('[SW] Error during activate:', error);
      })
  );
});

// Intercetta le richieste di rete
self.addEventListener('fetch', event => {
  // Ignora richieste non-HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Ignora richieste POST e altri metodi non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.match(event.request)
          .then(cachedResponse => {
            // Se trovato in cache, restituisci la versione cachata
            if (cachedResponse) {
              // Per i file principali, controlla anche la rete per aggiornamenti
              if (shouldCheckNetwork(event.request.url)) {
                fetchAndCache(event.request, cache);
              }
              return cachedResponse;
            }

            // Se non in cache, scarica dalla rete
            return fetchAndCache(event.request, cache);
          });
      })
      .catch(error => {
        console.error('[SW] Error in fetch handler:', error);
        
        // Fallback per la pagina principale
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        
        // Per altre risorse, restituisci errore
        return new Response('Offline', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
  );
});

// Funzione helper per scaricare e cachare
function fetchAndCache(request, cache) {
  return fetch(request)
    .then(response => {
      // Controlla se la risposta è valida
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // Clona la risposta perché può essere consumata solo una volta
      const responseToCache = response.clone();
      
      // Aggiungi alla cache solo se è una risorsa cachabile
      if (shouldCache(request.url)) {
        cache.put(request, responseToCache);
      }

      return response;
    })
    .catch(error => {
      console.error('[SW] Fetch failed:', error);
      throw error;
    });
}

// Determina se un URL dovrebbe essere controllato sulla rete per aggiornamenti
function shouldCheckNetwork(url) {
  const mainFiles = ['/', '/index.html', '/manifest.json', '/sw.js'];
  return mainFiles.some(file => url.endsWith(file));
}

// Determina se un URL dovrebbe essere cachato
function shouldCache(url) {
  // Non cachare risorse esterne (API, CDN, ecc.)
  const currentOrigin = self.location.origin;
  if (!url.startsWith(currentOrigin)) {
    return false;
  }

  // Non cachare query parameters dinamiche (eccetto versioning)
  const urlObj = new URL(url);
  const hasVersionParam = urlObj.searchParams.has('v');
  const hasOtherParams = Array.from(urlObj.searchParams.keys()).filter(key => key !== 'v').length > 0;
  
  if (hasOtherParams) {
    return false;
  }

  return true;
}

// Gestisce messaggi dal client
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message });
      })
    );
  }
});

// Sincronizzazione in background (se supportata)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Qui puoi aggiungere logica per sincronizzare dati
      Promise.resolve()
    );
  }
});

// Gestione notifiche push (se necessarie in futuro)
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'Nuova notifica da Voice to Text',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Apri App',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: '/icons/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Voice to Text PWA', options)
  );
});

// Gestione click su notifiche
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[SW] Service Worker loaded, version:', CACHE_NAME);
