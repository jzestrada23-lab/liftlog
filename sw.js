var CACHE = 'liftlog-v4';
var FILES = [
  './', './index.html', './styles.css', './engine.js', './data.js', './app.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'
];

function fresh(url) { return fetch(new Request(url, { cache: 'reload' })); }

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(FILES.map(function (u) {
        return fresh(u).then(function (res) {
          if (!res || !res.ok) throw new Error('fetch failed ' + u);
          return c.put(u, res);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fresh(e.request.url).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit || caches.match('./index.html'); });
      return hit || net;
    })
  );
});
