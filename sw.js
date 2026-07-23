// ── AELITA PRODUCTION · Service Worker ──────────────────────────
// Стратегия: Cache First для статики, Network First для HTML страниц

const CACHE_NAME = 'aelita-v1';
const STATIC_CACHE = 'aelita-static-v1';

// Страницы и ресурсы для предварительного кэширования при установке
const PRECACHE_URLS = [
  '/',
  '/tickets/',
  '/projects/',
  '/iov/',
  '/porfiriy/',
  '/tochkacuiri/',
  '/about/',
  '/contacts/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/assets/style.css',
  '/assets/main.js',
];

// ── Установка: кэшируем ключевые страницы ───────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Активация: удаляем старые кэши ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: стратегия по типу ресурса ────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Только наш домен
  if (url.origin !== location.origin) return;

  // HTML страницы — Network First (свежий контент важнее)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Статика (CSS, JS, иконки, шрифты) — Cache First
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Всё остальное — Network First
  event.respondWith(networkFirst(request));
});

// ── Стратегия: Network First ─────────────────────────────────────
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Офлайн-заглушка для HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return cache.match('/offline.html') || new Response(
        '<html><body style="background:#0B0B0D;color:#E8E6E1;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1 style="font-size:2rem;letter-spacing:.2em">АЭЛИТА</h1><p style="color:#C9B8A3">Нет подключения к интернету</p></div></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    return new Response('', { status: 503 });
  }
}

// ── Стратегия: Cache First ────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}
