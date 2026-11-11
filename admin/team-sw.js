// The staff app works online. Nothing from its scope is written to Cache Storage.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/admin/')) return;
  event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => new Response(
    '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Аэлита · Команда</title><main><h1>Нет подключения</h1><p>Для админки и CRM нужен интернет.</p><p><a href="/admin/team/">Открыть приложение снова</a></p></main></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )));
});
