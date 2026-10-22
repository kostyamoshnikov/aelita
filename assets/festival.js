// AELITA PRODUCTION — фестиваль «по часам» (pack-v694).
//
// Страницы фестиваля меняются сами, без правок и выкладки: в день фестиваля
// расписание открыто на сегодняшнем дне (прошёл — на следующем), прошедшее
// приглушено, билеты на начавшийся показ исчезают, после события — просьба
// оставить отзыв (о показе и о фестивале), после фестиваля — «Фестиваль
// прошёл». Время — по часам посетителя, пересчёт раз в минуту.
//
// Данные (между метками FEST-DATA) пишет _tools/DesignSystem/festival/
// build_festival.py из расписания /tochkacuire — руками их не править.
// Движок ниже правится руками.
//
// Проверить заранее: ?fest_now=2026-10-26T12:00 в адресе страницы.
(function () {
  'use strict';
  var DATA = /* FEST-DATA BEGIN */{"slug":"tochkacuire","endsAt":"2026-10-25T22:00:00+03:00","days":[{"date":"2026-10-22","end":"2026-10-22T20:30:00+03:00","inviteOnly":true,"items":[{"start":"2026-10-22T16:30:00+03:00","end":"2026-10-22T17:00:00+03:00","slug":null,"cancelled":false,"invite":true,"title":"Выставочный вернисаж, экскурсия по выставке"},{"start":"2026-10-22T17:00:00+03:00","end":"2026-10-22T18:00:00+03:00","slug":null,"cancelled":false,"invite":true,"title":"«Молодо-зелено»"},{"start":"2026-10-22T18:00:00+03:00","end":"2026-10-22T18:30:00+03:00","slug":null,"cancelled":false,"invite":true,"title":"Фуршет"},{"start":"2026-10-22T18:30:00+03:00","end":"2026-10-22T20:30:00+03:00","slug":"iov","cancelled":false,"invite":true,"title":"«ИОВ:материал»"}]},{"date":"2026-10-23","end":"2026-10-23T22:00:00+03:00","inviteOnly":false,"items":[{"start":"2026-10-23T14:00:00+03:00","end":"2026-10-23T16:00:00+03:00","slug":"lecture-bez-suflera","cancelled":false,"invite":false,"title":"«Без суфлёра»"},{"start":"2026-10-23T16:00:00+03:00","end":"2026-10-23T18:00:00+03:00","slug":"puteshestvenniki","cancelled":false,"invite":false,"title":"«Путешественники»"},{"start":"2026-10-23T18:00:00+03:00","end":"2026-10-23T20:00:00+03:00","slug":"lecture-tanets-v-realnom-mire","cancelled":false,"invite":false,"title":"«Как рождается и живёт танец в реальном мире»"},{"start":"2026-10-23T19:00:00+03:00","end":"2026-10-23T21:00:00+03:00","slug":"prorochestva","cancelled":false,"invite":false,"title":"«Пророчества перелётных птиц»"},{"start":"2026-10-23T20:00:00+03:00","end":"2026-10-23T22:00:00+03:00","slug":"iov","cancelled":false,"invite":false,"title":"«ИОВ:материал»"}]},{"date":"2026-10-24","end":"2026-10-24T21:00:00+03:00","inviteOnly":false,"items":[{"start":"2026-10-24T11:00:00+03:00","end":"2026-10-24T19:00:00+03:00","slug":null,"cancelled":false,"invite":false,"title":"Работа зоны маркетов"},{"start":"2026-10-24T12:00:00+03:00","end":"2026-10-24T14:00:00+03:00","slug":"mk-rospis-gipsa","cancelled":false,"invite":false,"title":"мастер-класс «Роспись гипсовых подставок»"},{"start":"2026-10-24T12:30:00+03:00","end":"2026-10-24T14:30:00+03:00","slug":"art-kvest","cancelled":false,"invite":false,"title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-24T13:00:00+03:00","end":"2026-10-24T15:00:00+03:00","slug":"mk-svecha-iz-voshchiny","cancelled":false,"invite":false,"title":"мастер-класс «Натуральная свеча из вощины»"},{"start":"2026-10-24T14:00:00+03:00","end":"2026-10-24T16:00:00+03:00","slug":"art-kvest","cancelled":false,"invite":false,"title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-24T14:00:00+03:00","end":"2026-10-24T16:00:00+03:00","slug":"mk-prokachay-mozg","cancelled":false,"invite":false,"title":"мастер-класс «Прокачай свой мозг»"},{"start":"2026-10-24T14:00:00+03:00","end":"2026-10-24T16:00:00+03:00","slug":"mozgi","cancelled":false,"invite":false,"title":"«Есть ли у вас мозги?»"},{"start":"2026-10-24T16:00:00+03:00","end":"2026-10-24T18:00:00+03:00","slug":"lecture-landshafty-realnosti","cancelled":false,"invite":false,"title":"«Ландшафты реальности»"},{"start":"2026-10-24T16:00:00+03:00","end":"2026-10-24T18:00:00+03:00","slug":"puteshestvenniki","cancelled":false,"invite":false,"title":"«Путешественники»"},{"start":"2026-10-24T16:30:00+03:00","end":"2026-10-24T18:30:00+03:00","slug":"mk-volshebnye-kraski","cancelled":false,"invite":false,"title":"художественный мастер-класс «Волшебные краски»"},{"start":"2026-10-24T18:00:00+03:00","end":"2026-10-24T20:00:00+03:00","slug":"lecture-art-goroda","cancelled":false,"invite":false,"title":"«Арт-города»"},{"start":"2026-10-24T19:00:00+03:00","end":"2026-10-24T21:00:00+03:00","slug":"porfiriy","cancelled":true,"invite":false,"title":"«Порфирий»"}]},{"date":"2026-10-25","end":"2026-10-25T22:00:00+03:00","inviteOnly":false,"items":[{"start":"2026-10-25T12:00:00+03:00","end":"2026-10-25T14:00:00+03:00","slug":"mk-dinozavry","cancelled":false,"invite":false,"title":"мастер-класс «Динозавры в городе»"},{"start":"2026-10-25T12:30:00+03:00","end":"2026-10-25T14:30:00+03:00","slug":"art-kvest","cancelled":false,"invite":false,"title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-25T13:00:00+03:00","end":"2026-10-25T15:00:00+03:00","slug":"meydey","cancelled":false,"invite":false,"title":"«Мэйдэй-3»"},{"start":"2026-10-25T13:00:00+03:00","end":"2026-10-25T15:00:00+03:00","slug":"mk-tykovka","cancelled":false,"invite":false,"title":"мастер-класс «Тыковка из воздушного пластилина»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","slug":"art-kvest","cancelled":false,"invite":false,"title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","slug":"mk-prokachay-mozg","cancelled":false,"invite":false,"title":"мастер-класс «Прокачай свой мозг»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","slug":"iov","cancelled":false,"invite":false,"title":"«ИОВ:материал»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","slug":"godo","cancelled":false,"invite":false,"title":"«В ожидании Годо»"},{"start":"2026-10-25T15:00:00+03:00","end":"2026-10-25T17:00:00+03:00","slug":"edinorozhka","cancelled":false,"invite":false,"title":"«Волшебная встреча с Единорожкой»"},{"start":"2026-10-25T16:00:00+03:00","end":"2026-10-25T18:00:00+03:00","slug":"puteshestvenniki","cancelled":false,"invite":false,"title":"«Путешественники»"},{"start":"2026-10-25T19:00:00+03:00","end":"2026-10-25T21:00:00+03:00","slug":"rozovoe-maslo","cancelled":false,"invite":false,"title":"«Запах розового масла»"},{"start":"2026-10-25T20:00:00+03:00","end":"2026-10-25T22:00:00+03:00","slug":"dyba-show","cancelled":false,"invite":false,"title":"«Дыба шоу»"}]}],"events":{"lecture-bez-suflera":[{"start":"2026-10-23T14:00:00+03:00","end":"2026-10-23T16:00:00+03:00","title":"«Без суфлёра»"}],"puteshestvenniki":[{"start":"2026-10-23T16:00:00+03:00","end":"2026-10-23T18:00:00+03:00","title":"«Путешественники»"},{"start":"2026-10-24T16:00:00+03:00","end":"2026-10-24T18:00:00+03:00","title":"«Путешественники»"},{"start":"2026-10-25T16:00:00+03:00","end":"2026-10-25T18:00:00+03:00","title":"«Путешественники»"}],"lecture-tanets-v-realnom-mire":[{"start":"2026-10-23T18:00:00+03:00","end":"2026-10-23T20:00:00+03:00","title":"«Как рождается и живёт танец в реальном мире»"}],"prorochestva":[{"start":"2026-10-23T19:00:00+03:00","end":"2026-10-23T21:00:00+03:00","title":"«Пророчества перелётных птиц»"}],"iov":[{"start":"2026-10-23T20:00:00+03:00","end":"2026-10-23T22:00:00+03:00","title":"«ИОВ:материал»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","title":"«ИОВ:материал»"}],"mk-rospis-gipsa":[{"start":"2026-10-24T12:00:00+03:00","end":"2026-10-24T14:00:00+03:00","title":"мастер-класс «Роспись гипсовых подставок»"}],"art-kvest":[{"start":"2026-10-24T12:30:00+03:00","end":"2026-10-24T14:30:00+03:00","title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-24T14:00:00+03:00","end":"2026-10-24T16:00:00+03:00","title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-25T12:30:00+03:00","end":"2026-10-25T14:30:00+03:00","title":"арт-квест «Дети — не зрители»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","title":"арт-квест «Дети — не зрители»"}],"mk-svecha-iz-voshchiny":[{"start":"2026-10-24T13:00:00+03:00","end":"2026-10-24T15:00:00+03:00","title":"мастер-класс «Натуральная свеча из вощины»"}],"mk-prokachay-mozg":[{"start":"2026-10-24T14:00:00+03:00","end":"2026-10-24T16:00:00+03:00","title":"мастер-класс «Прокачай свой мозг»"},{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","title":"мастер-класс «Прокачай свой мозг»"}],"mozgi":[{"start":"2026-10-24T14:00:00+03:00","end":"2026-10-24T16:00:00+03:00","title":"«Есть ли у вас мозги?»"}],"lecture-landshafty-realnosti":[{"start":"2026-10-24T16:00:00+03:00","end":"2026-10-24T18:00:00+03:00","title":"«Ландшафты реальности»"}],"mk-volshebnye-kraski":[{"start":"2026-10-24T16:30:00+03:00","end":"2026-10-24T18:30:00+03:00","title":"художественный мастер-класс «Волшебные краски»"}],"lecture-art-goroda":[{"start":"2026-10-24T18:00:00+03:00","end":"2026-10-24T20:00:00+03:00","title":"«Арт-города»"}],"mk-dinozavry":[{"start":"2026-10-25T12:00:00+03:00","end":"2026-10-25T14:00:00+03:00","title":"мастер-класс «Динозавры в городе»"}],"meydey":[{"start":"2026-10-25T13:00:00+03:00","end":"2026-10-25T15:00:00+03:00","title":"«Мэйдэй-3»"}],"mk-tykovka":[{"start":"2026-10-25T13:00:00+03:00","end":"2026-10-25T15:00:00+03:00","title":"мастер-класс «Тыковка из воздушного пластилина»"}],"godo":[{"start":"2026-10-25T14:00:00+03:00","end":"2026-10-25T16:00:00+03:00","title":"«В ожидании Годо»"}],"edinorozhka":[{"start":"2026-10-25T15:00:00+03:00","end":"2026-10-25T17:00:00+03:00","title":"«Волшебная встреча с Единорожкой»"}],"rozovoe-maslo":[{"start":"2026-10-25T19:00:00+03:00","end":"2026-10-25T21:00:00+03:00","title":"«Запах розового масла»"}],"dyba-show":[{"start":"2026-10-25T20:00:00+03:00","end":"2026-10-25T22:00:00+03:00","title":"«Дыба шоу»"}]},"tickets":{"198f6ee2-d76f-4551-80ca-0d3547c63963":"2026-10-23T16:00:00+03:00","2c06d654-f6be-4db6-83ce-7de3b9437779":"2026-10-24T19:00:00+03:00","635d19c9-0e2e-4b08-a3ee-453f98de9288":"2026-10-25T14:00:00+03:00","97763a2d-aa6d-42ef-b370-3cbfcd12887c":"2026-10-25T14:00:00+03:00","ab3c8e07-dbad-4b45-b06b-0570a59edcba":"2026-10-24T16:00:00+03:00","af08b13e-d6e2-4dec-8776-0e4877430d84":"2026-10-25T16:00:00+03:00","c22b9f5d-138f-435a-a750-822e7cba9533":"2026-10-25T20:00:00+03:00","da1c3ca2-a092-4db3-b402-d2a6c667e5a3":"2026-10-24T14:00:00+03:00","faac4a31-0e35-47d1-82a1-2f0ca7441fdf":"2026-10-23T20:00:00+03:00"},"performances":{"dyba-show-2026-10-25":"2026-10-25T20:00:00+03:00","iov-2026-10-22-open":"2026-10-22T18:30:00+03:00","iov-2026-10-23":"2026-10-23T20:00:00+03:00","iov-2026-10-25":"2026-10-25T14:00:00+03:00","meyday3-2026-10-25":"2026-10-25T13:00:00+03:00","mozgi-2026-10-24":"2026-10-24T14:00:00+03:00","porfiriy-2026-10-24":"2026-10-24T19:00:00+03:00","prorochestva-2026-10-23":"2026-10-23T19:00:00+03:00","rozovoe-maslo-2026-10-25":"2026-10-25T19:00:00+03:00"},"reviewsAnchor":{"lecture-bez-suflera":"#fest-reviews","puteshestvenniki":"#fest-reviews","lecture-tanets-v-realnom-mire":"#fest-reviews","prorochestva":"#fest-reviews","iov":"#audience-reviews","mk-rospis-gipsa":"#fest-reviews","art-kvest":"#fest-reviews","mk-svecha-iz-voshchiny":"#fest-reviews","mk-prokachay-mozg":"#fest-reviews","mozgi":"#fest-reviews","lecture-landshafty-realnosti":"#fest-reviews","mk-volshebnye-kraski":"#fest-reviews","lecture-art-goroda":"#fest-reviews","mk-dinozavry":"#fest-reviews","meydey":"#fest-reviews","mk-tykovka":"#fest-reviews","godo":"#fest-reviews","edinorozhka":"#fest-reviews","rozovoe-maslo":"#fest-reviews","dyba-show":"#fest-reviews","tochkacuire":"#fest-reviews"}}/* FEST-DATA END */;
  if (!DATA || !DATA.days) return;

  var EN = document.documentElement.lang === 'en';
  function L(ru, en) { return EN ? en : ru; }
  var PREFIX = EN ? '/en' : '';
  var MONTHS = EN
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var PROMPT_DAYS = 45; // сколько дней после события просим отзыв

  function nowMs() {
    var m = /[?&]fest_now=([^&#]+)/.exec(location.search);
    if (m) { var t = Date.parse(decodeURIComponent(m[1]) + (/[zZ]|[+-]\d\d:?\d\d$/.test(decodeURIComponent(m[1])) ? '' : '+03:00')); if (!isNaN(t)) return t; }
    return Date.now();
  }
  function ms(s) { return Date.parse(s); }
  function dayLabel(iso) {
    var d = new Date(ms(iso) + 3 * 3600000); // по Москве
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  var slug = location.pathname.replace(/^\/en(?=\/|$)/, '').replace(/index\.html$/, '').replace(/^\/+|\/+$/g, '');
  var state = { dayChosen: false };

  // ── 1. Ссылки на билеты — исчезают в момент начала показа ──
  var CONTAINERS = '.time-item, .iv-date, .show-slot, .up-card, .tk-card, .prog-item, .af-card';
  function tickets(t) {
    var links = document.querySelectorAll('a[href*="cuire-fest.ru/tickets/show/"], [data-performance-id]');
    Array.prototype.forEach.call(links, function (a) {
      var start = null;
      var m = /\/tickets\/show\/([0-9a-f-]{36})/.exec(a.getAttribute('href') || '');
      if (m && DATA.tickets[m[1]]) start = ms(DATA.tickets[m[1]]);
      var pid = a.getAttribute('data-performance-id');
      if (pid && DATA.performances[pid]) start = ms(DATA.performances[pid]);
      if (start == null || t < start) return;
      a.classList.add('fest-gone');
      var c = a.closest(CONTAINERS);
      if (c && !c.classList.contains('time-item')) c.classList.add('fest-past');
    });
    // Нижняя плашка покупки: все её ссылки исчезли — исчезает и она.
    var mob = document.getElementById('mob-cta');
    if (mob) {
      var buy = mob.querySelectorAll('a[href*="cuire-fest.ru"], [data-performance-id]');
      if (buy.length && Array.prototype.every.call(buy, function (x) { return x.classList.contains('fest-gone'); })) mob.classList.add('fest-gone');
    }
  }

  // ── 2. Карточки афиши с data-ends (build_afisha.py) ──
  function afisha(t) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ends]'), function (c) {
      if (t < ms(c.getAttribute('data-ends')) || c.classList.contains('fest-gone')) return;
      c.classList.add('fest-gone');
      // На телефоне главная показывает первые три карточки (:nth-child(-n+3)) —
      // прошедшая уходит в конец ряда, иначе вместо неё ничего не показалось бы.
      if (c.parentNode) c.parentNode.appendChild(c);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-afisha-empty]'), function (p) {
      var box = p.parentNode;
      var cards = box.querySelectorAll('[data-city]');
      var visible = Array.prototype.some.call(cards, function (c) { return !c.classList.contains('fest-gone'); });
      p.hidden = visible;
    });
  }

  // ── 3. Отзывы: форма на странице (своя или созданная здесь) ──
  function reviewsHref(s) { return PREFIX + '/' + s + '/' + (DATA.reviewsAnchor[s] || '#fest-reviews'); }
  function ensureReviews(s, title, after) {
    if (document.getElementById('aud-reviews-form-host')) return document.getElementById('aud-reviews-list') ? (document.getElementById('audience-reviews') || document.getElementById('fest-reviews')) : null;
    var sec = el('section', 'fest-reviews', '<div class="wrap"><h2 class="fest-reviews-h">' + title + '</h2>' +
      '<p class="fest-reviews-lead">' + L('Расскажите, как всё прошло: что запомнилось, что стоит изменить. Отзыв появится на странице сразу или после короткой проверки.', 'Tell us how it went: what stayed with you and what we should change. Your review appears on the page right away or after a short check.') + '</p>' +
      '<div id="aud-reviews-list"></div><div id="aud-reviews-form-host"></div></div>');
    sec.id = 'fest-reviews';
    var main = document.querySelector('main') || document.body;
    if (after && after.parentNode) after.parentNode.insertBefore(sec, after.nextSibling); else main.appendChild(sec);
    function go() { if (window.AelitaReviews) window.AelitaReviews.init(s); }
    if (window.AelitaReviews) go();
    else {
      var sc = document.createElement('script');
      var v = (document.querySelector('script[src*="/assets/festival.js?v="]') || { src: '' }).src.split('v=')[1] || '';
      sc.src = '/assets/reviews.js' + (v ? '?v=' + v : ''); sc.onload = go;
      document.body.appendChild(sc);
    }
    return sec;
  }
  function askReview(s, text, target, place) {
    var id = 'fest-prompt-' + s;
    if (document.getElementById(id) || store('aelita_fest_prompt_' + s) === 'x') return;
    var box = el('div', 'fest-prompt', '<p>' + text + '</p><a class="btn-gold fest-prompt-go" href="#">' + L('Оставить отзыв', 'Leave a review') + '</a>' +
      '<button type="button" class="fest-prompt-x" aria-label="' + L('Скрыть', 'Hide') + '">×</button>');
    box.id = id;
    box.querySelector('.fest-prompt-go').addEventListener('click', function (e) {
      e.preventDefault();
      var tg = typeof target === 'function' ? target() : target;
      if (tg) { tg.classList.add('on'); tg.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    box.querySelector('.fest-prompt-x').addEventListener('click', function () { store('aelita_fest_prompt_' + s, 'x'); box.remove(); });
    if (place && place.parentNode) place.parentNode.insertBefore(box, place.nextSibling);
  }

  // ── 4. Страница события фестиваля ──
  function eventPage(t, evs) {
    var passed = evs.filter(function (e) { return t >= ms(e.end); });
    var upcoming = evs.filter(function (e) { return t < ms(e.end); });
    var main = document.querySelector('main');
    if (!main) return;
    var hero = main.querySelector(':scope > section, :scope > header, :scope > div') || main.firstElementChild;
    if (passed.length) {
      var last = passed[passed.length - 1];
      var sec = ensureReviews(slug, L('Отзывы зрителей', 'Audience reviews'), null);
      if (t - ms(last.end) < PROMPT_DAYS * 86400000) {
        askReview(slug, L('Были на событии фестиваля «Точка Кюри» ' + dayLabel(last.start) + '? Оставьте отзыв — он поможет нам и тем, кто выбирает, куда пойти.',
          'Were you at this Tochka Cuire festival event on ' + dayLabel(last.start) + '? Leave a review — it helps us and people choosing what to see.'),
        function () { return document.getElementById('audience-reviews') || document.getElementById('fest-reviews') || sec; }, hero);
      }
    }
    if (!upcoming.length && !document.body.classList.contains('fest-ended')) {
      document.body.classList.add('fest-ended');
      Array.prototype.forEach.call(document.querySelectorAll('a[href="#join"], a[href="#afisha"].fp-buy, .fp-buy, #mob-cta'), function (x) { x.classList.add('fest-gone'); });
      var join = document.getElementById('join');
      if (join && !join.querySelector('.fest-closed-note')) {
        join.classList.add('fest-closed');
        var note = el('p', 'fest-closed-note', L('Событие прошло — регистрация закрыта. Спасибо всем, кто был с нами!', 'The event has taken place — registration is closed. Thank you to everyone who came!'));
        var w = join.querySelector('.wrap') || join;
        w.insertBefore(note, w.firstChild);
        // Строка «если кнопка не открывает окно регистрации — ссылка» без кнопки ни к чему.
        Array.prototype.forEach.call(join.querySelectorAll('a[href*="timepad.ru"]'), function (a) { var pp = a.closest('p'); if (pp) pp.classList.add('fest-gone'); });
      }
    }
  }

  // ── 5. /tochkacuire: день, прошедшее, «фестиваль прошёл» ──
  function festivalPage(t) {
    var tabs = document.querySelectorAll('.day-tab');
    var over = t >= ms(DATA.endsAt);
    DATA.days.forEach(function (d, i) {
      var tab = tabs[i];
      if (!tab) return;
      var past = t >= ms(d.end);
      tab.classList.toggle('fest-day-past', past);
      if (past && !tab.querySelector('.fest-tag')) tab.appendChild(el('span', 'fest-tag', L('прошёл', 'over')));
      var box = document.getElementById('day-' + i);
      if (!box) return;
      var items = box.querySelectorAll('.time-item');
      d.items.forEach(function (it, j) {
        var row = items[j];
        if (!row) return;
        var ended = t >= ms(it.end);
        var live = !ended && t >= ms(it.start);
        row.classList.toggle('fest-past', ended);
        row.classList.toggle('fest-live', live);
        // Началось — запись и билеты в строке больше не нужны.
        if (t >= ms(it.start)) Array.prototype.forEach.call(row.querySelectorAll('.tix-btn'), function (b) { b.classList.add('fest-gone'); });
        var ev = row.querySelector('.event');
        var tag = row.querySelector('.fest-now');
        if (live && !tag && ev) ev.insertBefore(el('span', 'fest-now', L('идёт сейчас', 'on now')), ev.firstChild);
        if (!live && tag) tag.remove();
        if (ended && it.slug && !it.cancelled && !it.invite && ev && !row.querySelector('.fest-review-link')) {
          var a = el('a', 'fest-review-link', L('Оставить отзыв →', 'Leave a review →'));
          a.href = reviewsHref(it.slug);
          ev.appendChild(a);
        }
      });
    });
    // День по умолчанию — один раз при открытии: сегодняшний, а если он
    // прошёл — следующий; день только по пригласительным пропускаем.
    if (!state.dayChosen && !over && typeof window.showDay === 'function') {
      state.dayChosen = true;
      var pick = -1;
      for (var i = 0; i < DATA.days.length; i++) {
        if (t < ms(DATA.days[i].end) && !DATA.days[i].inviteOnly) { pick = i; break; }
      }
      var cur = Array.prototype.indexOf.call(tabs, document.querySelector('.day-tab.active'));
      var fromHash = /^#day-\d$/.test(location.hash);
      if (pick >= 0 && pick !== cur && !fromHash && tabs[pick]) window.showDay(pick, tabs[pick]);
    }
    var sched = document.getElementById('schedule');
    var firstDayOver = t >= ms(DATA.days[0].end);
    if (firstDayOver && sched) {
      ensureReviews(DATA.slug, L('Отзывы о фестивале', 'Festival reviews'), sched);
    }
    if (over && sched && !document.getElementById('fest-over')) {
      document.body.classList.add('fest-ended');
      var head = sched.querySelector('.sec-head');
      var a0 = dayLabel(DATA.days[0].date + 'T12:00:00+03:00').split(' ');
      var a1 = dayLabel(DATA.days[DATA.days.length - 1].date + 'T12:00:00+03:00').split(' ');
      var range = a0[1] === a1[1] ? a0[0] + '–' + a1[0] + ' ' + a1[1] : a0.join(' ') + ' — ' + a1.join(' ');
      var b = el('div', 'fest-over', '<p class="fest-over-t">' + L('Фестиваль прошёл', 'The festival is over') + '</p>' +
        '<p>' + L('«Точка Кюри» прошла ' + range + '. Спасибо всем, кто был с нами! Расскажите, как всё прошло: отзыв о фестивале — ниже, об отдельном событии — «Оставить отзыв» в расписании.',
          'Tochka Cuire took place on ' + range + '. Thank you to everyone who came! Tell us how it went: a festival review below, or “Leave a review” next to any event in the schedule.') + '</p>' +
        '<a class="btn-gold" href="#fest-reviews">' + L('Оставить отзыв о фестивале', 'Review the festival') + '</a>');
      b.id = 'fest-over';
      if (head && head.parentNode) head.parentNode.insertBefore(b, head.nextSibling);
      Array.prototype.forEach.call(document.querySelectorAll('.hero-btns a[href="#schedule"], #mob-cta'), function (x) { x.classList.add('fest-gone'); });
    }
  }

  function apply() {
    var t = nowMs();
    try { tickets(t); } catch (e) { /* не мешаем странице */ }
    try { afisha(t); } catch (e) { /* — */ }
    try { if (slug === DATA.slug) festivalPage(t); } catch (e) { /* — */ }
    try { if (DATA.events[slug]) eventPage(t, DATA.events[slug]); } catch (e) { /* — */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  setInterval(apply, 60000);
  window.AelitaFestival = { apply: apply, data: DATA };
})();
