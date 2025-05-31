const CACHE_NAME = 'voice-to-text-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png'
];

// Installa il Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installazione');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Errore durante il caching:', error);
      })
  );
});

// Attiva il Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Attivazione');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminazione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercetta le richieste di rete
self.addEventListener('fetch', (event) => {
  // Salta le richieste non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Salta le richieste di Chrome extension
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Salta le richieste a domini esterni per condivisione social
  if (event.request.url.includes('wa.me') || 
      event.request.url.includes('t.me') || 
      event.request.url.includes('api.whatsapp.com') ||
      event.request.url.includes('telegram.org')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Restituisci dalla cache se disponibile
        if (response) {
          console.log('Service Worker: Servito dalla cache:', event.request.url);
          return response;
        }

        // Altrimenti fai la richiesta di rete
        console.log('Service Worker: Richiesta di rete:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Verifica se la risposta è valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona la risposta per metterla in cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Errore fetch:', error);
            
            // Restituisci una pagina offline se disponibile
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
});

// Gestisce i messaggi dal client
self.addEventListener('message', (event) => {
  console.log('Service Worker: Messaggio ricevuto:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Gestisce le notifiche push (se necessario in futuro)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push ricevuto');
  
  const options = {
    body: event.data ? event.data.text() : 'Nuova notifica da Voice to Text',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
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
    self.registration.showNotification('Voice to Text', options)
  );
});

// Gestisce i click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Click su notifica:', event);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Chiudi semplicemente la notifica
    return;
  } else {
    // Click sulla notifica principale
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Gestisce la sincronizzazione in background
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Qui puoi aggiungere logica per sincronizzare dati offline
      console.log('Sincronizzazione dati completata')
    );
  }
});