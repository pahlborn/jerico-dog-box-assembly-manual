var CACHE_NAME = 'jerico-v1';
var urlsToCache = [
  '/jerico-dog-box-assembly-manual/',
  '/jerico-dog-box-assembly-manual/index.html',
  '/jerico-dog-box-assembly-manual/build-log.html',
  '/jerico-dog-box-assembly-manual/specs.html',
  '/jerico-dog-box-assembly-manual/styles.css',
  '/jerico-dog-box-assembly-manual/app.js',
  '/jerico-dog-box-assembly-manual/field-sync.js',
  '/jerico-dog-box-assembly-manual/version.js',
  '/jerico-dog-box-assembly-manual/gallery.js',
  '/jerico-dog-box-assembly-manual/gallery.css',
  '/jerico-dog-box-assembly-manual/findings.js',
  '/jerico-dog-box-assembly-manual/changelog.js',
  '/jerico-dog-box-assembly-manual/search.js',
  '/jerico-dog-box-assembly-manual/icon-192.png',
  '/jerico-dog-box-assembly-manual/icon-512.png'
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
