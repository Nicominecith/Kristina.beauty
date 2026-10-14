// Einfacher Service Worker: App-Shell offline, API/Funktionen immer live.
const CACHE = 'kb-v14';
const SHELL = ['/', '/index.html', '/styles.css', '/extras.css', '/extras.js', '/account.css', '/account.js', '/social.js', '/i18n.js', '/i18n_more.js', '/gutschein.js', '/logo.webp', '/logo-trim.webp', '/manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
    const u = new URL(e.request.url);
    if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/.netlify/') || u.pathname.includes('employee_portal')) return;
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
