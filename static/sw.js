// sw.js - معطل بالكامل (لا يخزن أي شيء)
self.addEventListener('install', () => {
    console.log('SW: Install - doing nothing');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
    console.log('SW: Activate - cleared all caches');
});

self.addEventListener('fetch', (event) => {
    // لا تفعل شيء، دع المتصفح يتعامل مع الطلبات بشكل طبيعي
    return;
});