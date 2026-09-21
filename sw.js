var CACHE_NAME = 'jerico-v2';
// Relativ, nicht absolut: GitHub Pages unterscheidet Gross- und Kleinschreibung
// im Pfad, und das Repository heisst "Jerico-...". Ein absoluter Pfad in der
// falschen Schreibweise laesst cache.addAll scheitern - und damit die gesamte
// Installation des Service Workers, also den Offline-Betrieb.
var urlsToCache = [
  './',
  './index.html',
  './build-log.html',
  './specs.html',
  './styles.css',
  './app.js',
  './field-sync.js',
  './version.js',
  './gallery.js',
  './gallery.css',
  './findings.js',
  './changelog.js',
  './search.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  self.skipWaiting(); // Sofort aktiv, nicht auf das Schliessen alter Tabs warten
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Network-first: erst das Netz, bei Ausfall der Cache (Werkstatt ohne Empfang)
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
