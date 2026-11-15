(function () {
  'use strict';
  var root = document.querySelector('[data-ticket-program]');
  if (!root) return;
  var list = root.querySelector('[data-program-tickets]'), id = root.dataset.ticketProgram;
  if (!list || !/^evt-[a-f0-9]{32}$/.test(id)) return;
  var en = document.documentElement.lang === 'en', request = 0;
  var date = new Intl.DateTimeFormat(en ? 'en-GB' : 'ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short'
  });
  function text(tag, value) {
    var node = document.createElement(tag);
    node.textContent = value;
    return node;
  }
  function closed() {
    list.replaceChildren(text('p', en ? 'Ticket sales are closed.' : 'Продажи закрыты.'));
  }
  function variant(row) {
    var name = row.format === 'online' ? (en ? 'Online' : 'Онлайн') : (en ? 'In person' : 'В зале');
    var price = new Intl.NumberFormat(en ? 'en-GB' : 'ru-RU').format(row.price) + ' ₽';
    var item = document.createElement('div');
    item.append(text('h3', name + ' · ' + price));
    if (row.postponed && Number.isFinite(Date.parse(row.datetime))) {
      item.append(text('p', (en ? 'New date ' : 'Новая дата ') + date.format(new Date(row.datetime)) + (en ? ' · Moscow time' : ' · МСК')));
    }
    if (row.status === 'canceled') {
      item.append(text('p', en ? 'Cancelled.' : 'Отменено.'));
    } else if (row.soldOut === true) {
      item.append(text('p', en ? 'Sold out.' : 'Билеты закончились.'));
    } else if (row.salesOpen === true && row.status === 'on_sale') {
      var link = text('a', en ? 'Buy a ticket' : 'Купить билет');
      link.className = 'btn-outline';
      link.href = (en ? '/en' : '') + '/tickets-buy/?performance=' + encodeURIComponent(row.id);
      item.append(link);
    } else {
      item.append(text('p', en ? 'Ticket sales are closed.' : 'Продажи закрыты.'));
    }
    return item;
  }
  async function refresh() {
    var seq = ++request;
    closed();
    try {
      var response = await fetch('https://api.aelita-production.ru/tickets/performances-list?participation=' + encodeURIComponent(id), {cache: 'no-store'});
      if (!response.ok) return;
      var data = await response.json();
      if (seq !== request || data.id !== id || !Array.isArray(data.variants)) return;
      var rows = data.variants.filter(function (r) {
        return (r.format === 'offline' || r.format === 'online') && r.id === id + '-' + r.format &&
          Number.isSafeInteger(r.price) && r.price > 0;
      });
      if (rows.length) list.replaceChildren.apply(list, rows.map(variant));
    } catch (_) { /* The closed state is the default. */ }
  }
  refresh();
  window.addEventListener('pageshow', function (event) { if (event.persisted) refresh(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
}());
