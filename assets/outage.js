/*
 * AELITA PRODUCTION · Баннер «сбой серверной части» (pack-v650).
 *
 * Заказчик 11.10: «везде на сайте (где нужно) напишем, что сейчас проблемы
 * с заходом в кабинет, покупкой билетов и т.д., где у нас используется
 * инфраструктура Яндекса». Сами страницы лежат на GitHub Pages и работают;
 * не работает всё, что ходит на api.aelita-production.ru: покупка билетов
 * и программок, кабинет, регистрация на события, подарочные карты, отзывы,
 * заявки с сайта.
 *
 * pack-v735 (заказчик 29.10: «убери уведомление про Яндекс Облако, вроде как
 * починилось, сейчас важнее про VPN — его нужно отключить при оплате»): облако
 * работает, а сервер не отвечает в основном тем, кто открыл сайт через VPN
 * (страницы — на GitHub Pages, API — в Yandex Cloud). Текст — про VPN; при
 * настоящем сбое он тоже не врёт: «не помогло — напишите».
 *
 * MODE:
 *   'auto' — сайт спрашивает сервер; не ответил за 6 с или ответил 5xx —
 *            баннер. Сервер ожил (Яндекс восстановился или переехали на
 *            свой сервер) — баннер пропадает сам, выкладка не нужна.
 *   'on'   — баннер всегда; 'off' — никогда.
 * Ответ сервера помнится 3 минуты на вкладку (sessionStorage), закрытый
 * крестиком баннер не показывается до конца визита.
 * Подключается из main.js (почти все страницы) и прямо на страницах без
 * него (покупка билета, страница билета, отмена регистрации).
 */
(function () {
  'use strict';
  var MODE = 'auto';
  if (MODE === 'off' || window.__aelitaOutage) return;
  // Автотесты сайта (Playwright, сеть закрыта) — без баннера, иначе он сдвигал
  // бы проверяемый первый экран; свой тест баннера — с ?outage_test=1.
  if (navigator.webdriver && !/[?&]outage_test=1/.test(location.search)) return;
  window.__aelitaOutage = true;
  var path = location.pathname.replace(/^\/en(?=\/|$)/, '');
  // Служебные страницы команды — там свои сообщения о связи.
  if (/^\/(admin|tickets-scan|events-scan)(\/|$)/.test(path)) return;

  var PROBE = 'https://api.aelita-production.ru/tickets/performances-list?notice=1';
  var KEY = 'aelita_outage_v1';
  var HIDE = 'aelita_outage_hidden';
  var en = (document.documentElement.lang || '').indexOf('en') === 0;

  function store(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* приватный режим */ } }
  function load(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  function show() {
    if (document.getElementById('aelitaOutage') || load(HIDE)) return;
    var mail = 'aelita.production@yandex.ru';
    var bot = 'https://t.me/aelita_production_bot';
    var el = document.createElement('div');
    el.id = 'aelitaOutage';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:relative;z-index:60;background:#3a2410;color:#f1e6d4;border-bottom:1px solid rgba(214,181,122,.55);'
      + 'padding:12px 44px 12px 16px;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;text-align:center';
    var a = 'color:#D6B57A;text-decoration:underline';
    el.innerHTML = en
      ? '<strong>Turn off your VPN.</strong> Buying tickets, payment, your account and site forms run on servers in Russia, and they cannot be reached through a VPN. '
        + 'Turn the VPN off and reload the page. Tickets you have already bought remain valid. Still not working? Write to <a style="' + a + '" href="mailto:' + mail + '">' + mail + '</a> '
        + 'or to <a style="' + a + '" href="' + bot + '" target="_blank" rel="noopener">our Telegram bot</a> — we will help.'
      : '<strong>Отключите VPN.</strong> Покупка билетов, оплата, личный кабинет и формы сайта работают через серверы в России — с включённым VPN до них не достучаться. '
        + 'Отключите VPN и обновите страницу. Уже купленные билеты действительны. Не помогло — напишите на <a style="' + a + '" href="mailto:' + mail + '">' + mail + '</a> '
        + 'или <a style="' + a + '" href="' + bot + '" target="_blank" rel="noopener">в наш Telegram-бот</a>, поможем.';
    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', en ? 'Hide' : 'Скрыть');
    x.textContent = '×';
    x.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:0;color:#f1e6d4;font-size:22px;line-height:1;padding:6px 10px;cursor:pointer';
    x.onclick = function () { store(HIDE, '1'); el.parentNode && el.parentNode.removeChild(el); };
    el.appendChild(x);
    document.body.insertBefore(el, document.body.firstChild);
    // Шапка сайта (nav) закреплена сверху и накрыла бы баннер: пока баннер
    // виден, шапка стоит под ним и уезжает вверх вместе с прокруткой.
    var fixed = [].filter.call(document.querySelectorAll('body > nav, body > header, nav'), function (n) {
      var cs = getComputedStyle(n);
      return cs.position === 'fixed' && parseFloat(cs.top) === 0;
    });
    function place() {
      var h = el.parentNode ? el.offsetHeight : 0;
      var top = Math.max(0, h - (window.scrollY || window.pageYOffset || 0));
      fixed.forEach(function (n) { n.style.top = top ? top + 'px' : ''; });
    }
    if (fixed.length) {
      place();
      window.addEventListener('scroll', place, { passive: true });
      window.addEventListener('resize', place);
      x.addEventListener('click', place);
    }
  }

  function decide(down) {
    store(KEY, JSON.stringify({ down: down, at: Date.now() }));
    if (down) {
      if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
    } else {
      var el = document.getElementById('aelitaOutage');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  if (MODE === 'on') { decide(true); return; }
  var cached = null;
  try { cached = JSON.parse(load(KEY) || 'null'); } catch (e) { cached = null; }
  if (cached && Date.now() - cached.at < 3 * 60 * 1000) { decide(cached.down); return; }
  if (!window.fetch) return;
  var done = false;
  var timer = setTimeout(function () { if (!done) { done = true; decide(true); } }, 6000);
  fetch(PROBE, { cache: 'no-store', credentials: 'omit' }).then(function (r) {
    if (done) { if (r.status < 500) decide(false); return; }
    done = true; clearTimeout(timer);
    decide(r.status >= 500);
  }, function () {
    if (done) return;
    done = true; clearTimeout(timer);
    decide(true);
  });
})();
