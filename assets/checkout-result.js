/* Uses existing authenticated my-orders; never creates orders or payments. */
(function () {
  'use strict';
  var generation = 0, abort = null;
  function safeLink(raw, online) {
    try {
      var u = new URL(raw);
      if (u.protocol !== 'https:' || u.hostname !== 'aelita-production.ru' || u.port || u.username || u.password) return null;
      if (online) return /^\/(en\/)?matrix-online\/$/.test(u.pathname) && /^#access=[A-Za-z0-9_.-]+$/.test(u.hash) ? u.href : null;
      return u.pathname === '/ticket/' && /^[A-Za-z0-9_.-]+$/.test(u.searchParams.get('t') || '') ? u.href : null;
    } catch (_) { return null; }
  }
  function reset() {
    generation++;
    if (abort) abort.abort();
    abort = null;
    var box = document.getElementById('paid-details');
    if (box) box.replaceChildren();
  }
  async function render(options) {
    reset();
    var id = generation, box = document.getElementById('paid-details');
    if (!box || !options.orderId) return;
    var token = options.getToken(), EN = /^en/i.test(document.documentElement.lang || '');
    var T = EN ? {
      loading: 'Loading your tickets…', login: 'Sign in to open your tickets. Your order is already confirmed.',
      wait: 'Could not load the ticket links. Open your account or retry; you do not need to pay again.',
      retry: 'Show tickets', number: 'Order', count: 'Active tickets', amount: 'Total', when: 'Date', format: 'Format', offlineName: 'Offline', onlineName: 'Online',
      online: 'Open stream page', offline: 'Open ticket', none: 'No active ticket links are available. Check the current status in your account.',
      detail: 'Open your tickets here — there is no need to wait for email.'
    } : {
      loading: 'Открываем ваши билеты…', login: 'Войдите, чтобы открыть билеты. Заказ уже подтверждён.',
      wait: 'Не удалось загрузить ссылки на билеты. Откройте кабинет или повторите — оплачивать заново не нужно.',
      retry: 'Показать билеты', number: 'Заказ', count: 'Действующих билетов', amount: 'Сумма', when: 'Дата', format: 'Формат', offlineName: 'Офлайн', onlineName: 'Онлайн',
      online: 'Перейти к трансляции', offline: 'Открыть билет', none: 'Ссылок на действующие билеты сейчас нет. Проверьте актуальный статус в кабинете.',
      detail: 'Откройте билеты здесь — ждать письма не нужно.'
    };
    function node(tag, text) { var n = document.createElement(tag); if (text != null) n.textContent = String(text); return n; }
    function current() { return generation === id && options.getToken() === token; }
    function message(text, retry) {
      box.replaceChildren(node('p', text));
      if (retry) {
        var button = node('button', T.retry); button.type = 'button'; button.className = 'retry-btn';
        button.addEventListener('click', function () { render(options); }); box.appendChild(button);
      }
    }
    if (!token) { message(T.login); return; }
    abort = new AbortController();
    message(T.loading);
    try {
      var response = await options.request(options.apiBase + '/my-orders', {headers: {'Authorization': 'Bearer ' + token}, signal: abort.signal});
      var payload = response.ok ? await response.json() : null;
      if (!current()) { if (generation === id) reset(); return; }
      if (response.status === 401) { message(T.login); return; }
      var order = payload && Array.isArray(payload.orders) && payload.orders.find(function (o) { return o.orderId === options.orderId && o.role === 'buyer'; });
      if (!order) { message(T.wait, true); return; }
      var fragment = document.createDocumentFragment(), title = node('h3', order.title || ''), facts = node('dl');
      fragment.appendChild(title);
      var modes = new Set((Array.isArray(order.onlineTickets) ? order.onlineTickets : []).map(function(t){return t.mode;}).filter(function(m){return m === 'offline' || m === 'online';}));
      if(Array.isArray(order.ticketPages) && order.ticketPages.length) modes.add('offline');
      var format = Array.from(modes).map(function(m){return m === 'online' ? T.onlineName : T.offlineName;}).join(' + ');
      [[T.number, order.orderNumber], [T.when, order.datetime ? new Date(order.datetime).toLocaleString(EN ? 'en-GB' : 'ru-RU', {timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short'}) + (EN ? ' MSK' : ' МСК') : null],
        [T.format, format], [T.count, order.ticketsCount], [T.amount, order.totalAmount != null ? order.totalAmount + ' ₽' : null]].forEach(function (pair) {
        if (pair[1] == null || pair[1] === '') return;
        facts.append(node('dt', pair[0]), node('dd', pair[1]));
      });
      fragment.appendChild(facts);
      var links = node('div'), seen = new Set(); links.className = 'paid-ticket-links';
      function add(raw, label, online) {
        var href = safeLink(raw, online); if (!href || seen.has(href)) return; seen.add(href);
        var a = node('a', label); a.href = href; a.className = 'retry-btn'; a.rel = 'noreferrer'; links.appendChild(a);
      }
      (Array.isArray(order.ticketPages) ? order.ticketPages : []).forEach(function (u, i) { add(u, T.offline + ' ' + (i + 1), false); });
      (Array.isArray(order.onlineTickets) ? order.onlineTickets : []).forEach(function (t) { if (t.mode === 'online' && t.accessUrl) add(t.accessUrl, T.online + (t.ticketNumber ? ' · ' + t.ticketNumber : ''), true); });
      fragment.appendChild(links); fragment.appendChild(node('p', seen.size ? T.detail : T.none));
      if (current()) box.replaceChildren(fragment);
    } catch (_) { if (current()) message(T.wait, true); }
  }
  window.addEventListener('pagehide', reset);
  window.addEventListener('storage', function (event) { if (event.key === 'aelita_account_token' || event.key === null) reset(); });
  window.addEventListener('aelita:account-changed', reset);
  window.AelitaCheckoutResult = {render: render, reset: reset};
})();
