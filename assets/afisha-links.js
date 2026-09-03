// AELITA PRODUCTION — синхронизация кнопок «Купить билет» на афише
// (Site/index.html, Site/tickets/index.html) с _tools/Tickets/ —
// НЕ рендерит карточки показов целиком (авторский текст/дизайн
// карточек остаётся ручным, статичным), только подставляет актуальный
// href/target у ссылок с [data-performance-id].
//
// Зачем: до этого файла ссылка на fest-показы (cuire-fest.ru) и на
// свои показы (/tickets-buy/) были захардкожены в HTML вручную и
// синхронизировались только тем, что мы правили оба места параллельно
// при каждой правке. Источник правды по каналу продаж уже был —
// _tools/Tickets/config/events.js (buyUrl считается из salesChannel:
// 'ticketscloud' → внешняя ссылка на фестиваль, 'in_house' → наша
// продажа, см. её докстринг) — просто сайт его не читал. Теперь
// читает, при загрузке страницы, через уже существующий публичный
// эндпоинт `performances-list.js`.
//
// Если API_BASE не заполнен (Gateway ещё не задеплоен) — тихо
// ничего не делает, ссылки остаются с тем href/target, что уже в
// HTML (тот же принцип «пусто — не ломает», что у остальных
// API_BASE/*_URL констант в паке).
(function () {
  var API_BASE = 'https://api.aelita-production.ru/tickets';
  if (!API_BASE) return;

  fetch(API_BASE + '/performances-list')
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (list) {
      list.forEach(function (p) {
        var els = document.querySelectorAll('[data-performance-id="' + p.id + '"]');
        els.forEach(function (el) {
          el.href = p.buyUrl;
          if (p.salesChannel !== 'in_house') {
            el.target = '_blank';
            el.rel = 'noopener';
          } else {
            el.removeAttribute('target');
            el.removeAttribute('rel');
          }
        });
      });
    })
    .catch(function (e) {
      // Не критично — ссылки остаются с последним захардкоженным
      // значением, страница не ломается ни при недоступности API,
      // ни при отсутствии сети.
      console.error('afisha-links: не удалось обновить ссылки', e);
    });
})();
