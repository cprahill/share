self.addEventListener('install', e => { e.waitUntil(caches.open('sl-v2').then(c => c.addAll(['./','./index.html','./manifest.webmanifest','./icon.svg']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k!=='sl-v2').map(k => caches.delete(k))))); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
