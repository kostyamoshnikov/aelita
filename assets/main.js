/* ============================================================
   Общие мобильные виджеты AELITA PRODUCTION
   (cookie-баннер, кнопка «наверх», CTA-бар, Telegram-виджет)
   Подключается на всех страницах сайта — правки здесь применяются
   сразу везде, без необходимости редактировать каждую страницу.
   ============================================================ */

// Cookie-баннер
var YM_ID = 104681911;
var ymLoaded = false;

// Пиксель VK Рекламы — та же техническая основа, что и счётчик
// top.mail.ru (после перехода на новый рекламный кабинет VK Рекламы,
// 28 января 2026, старый VK.Retargeting.Init/JS API ретаргетинга
// больше не работает — пиксель нового кабинета выдаётся именно в
// виде кода top.mail.ru, id пикселя = id счётчика top.mail.ru).
// ЗАПОЛНИТЬ после создания пикселя в кабинете ads.vk.com (раздел
// «Сайты» → «Добавить пиксель») — см. Site/README.md, раздел
// «Аналитика». Пока 0 — пиксель намеренно не грузится вообще (см.
// loadVkPixel ниже): пустой ID даёт нерабочую заглушку, которая
// выглядит как готовность, но ничего не отслеживает — честнее совсем
// не грузить счётчик, чем грузить нерабочий.
var VK_PIXEL_ID = 0;
var vkPixelLoaded = false;

function loadMetrika(){
  if(ymLoaded) return;
  ymLoaded = true;
  // pack-v540 (перепроверка): контейнер электронной торговли объявляется
  // ДО инициализации счётчика — так требует документация Метрики;
  // покупку в него кладёт AELITA_ecomPurchase (analytics-events.js).
  window.dataLayer = window.dataLayer || [];
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
  (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
  ym(YM_ID, "init", {
       clickmap:true,
       trackLinks:true,
       accurateTrackBounce:true,
       webvisor:true,
       ecommerce:"dataLayer",
       referrer: document.referrer,
       url: location.href
  });
  // Пиксель <noscript> сюда специально не добавлен: он рассчитан на
  // пользователей без JS, а эта функция и так вызывается только из JS —
  // для них она просто никогда не сработает. Итог: без JS теперь нет
  // трекинга совсем, что для соответствия закону лучше, чем безусловный
  // пиксель без согласия.
}

function loadVkPixel(){
  if (vkPixelLoaded) return;
  if (!VK_PIXEL_ID) return; // id ещё не заполнен — см. комментарий выше
  vkPixelLoaded = true;
  var _tmr = window._tmr = window._tmr || [];
  _tmr.push({ id: VK_PIXEL_ID, type: "pageView", start: (new Date()).getTime() });
  (function (d, w, id) {
    if (d.getElementById(id)) return;
    var ts = d.createElement("script"); ts.type = "text/javascript"; ts.async = true; ts.id = id;
    ts.src = "https://top-fwz1.mail.ru/js/code.js";
    var f = function () { var s = d.getElementsByTagName("script")[0]; s.parentNode.insertBefore(ts, s); };
    if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); }
  })(document, window, "topmailru-code");
  // Как и у Метрики выше — без cookie-согласия эта функция не вызывается
  // вообще, поэтому отдельного <noscript>-пикселя тоже намеренно нет.
}

(function(){
  if(localStorage.getItem('cookies_accepted')){
    var b=document.getElementById('cookie-banner');
    if(b) b.style.display='none';
    loadMetrika();
    loadVkPixel();
    if (window.AELITA_initOwnStats) window.AELITA_initOwnStats();
  }
})();

// Пока баннер cookies не принят, он занимает нижнюю часть экрана и визуально
// перекрывает Telegram-виджет и кнопку «наверх» — не даём им появляться поверх
// него, а сразу показываем после принятия (см. updateFixedWidgets ниже).
function isCookieBannerOpen(){
  const b = document.getElementById('cookie-banner');
  return !!(b && b.style.display !== 'none' && !b.classList.contains('hidden'));
}

function acceptCookies(){
  localStorage.setItem('cookies_accepted','1');
  var b=document.getElementById('cookie-banner');
  if(b){b.classList.add('hidden');setTimeout(function(){b.style.display='none'},400);}
  loadMetrika();
  loadVkPixel();
  if (window.AELITA_initOwnStats) window.AELITA_initOwnStats();
  updateFixedWidgets();
  updateCtaBar();
}

// Кнопка «наверх» + Telegram-виджет — единый scroll listener с защитой
// от наложения на ещё не принятый cookie-баннер
function updateFixedWidgets(){
  const pastThreshold = window.scrollY > 400;
  const bannerOpen = isCookieBannerOpen();

  const btn = document.getElementById('back-to-top');
  if(btn) btn.classList.toggle('visible', pastThreshold && !bannerOpen);

  const widget = document.getElementById('tg-widget');
  if(widget){
    if(pastThreshold && !bannerOpen){
      if(!widget.classList.contains('visible')){
        widget.classList.add('visible');
        const bubble = document.getElementById('tg-bubble');
        if(bubble && !bubble.dataset.shown){
          bubble.dataset.shown = '1';
          setTimeout(function(){
            bubble.classList.add('visible');
            setTimeout(function(){ bubble.classList.remove('visible'); }, 4000);
          }, 1000);
        }
      }
    } else {
      widget.classList.remove('visible');
    }
  }
}
window.addEventListener('scroll', updateFixedWidgets);
window.addEventListener('resize', updateFixedWidgets);
updateFixedWidgets();

// Мобильный CTA-бар — прячем, пока cookies не приняты, пока рядом уже видна
// афиша/форма/контакты (там своя кнопка), или пока не принят cookie-баннер
// (иначе они перекрывают друг друга)
let ctaNearOwn = false;
function updateCtaBar(){
  const bar = document.getElementById('mob-cta');
  if(!bar) return;
  const cookiesAccepted = !!localStorage.getItem('cookies_accepted');
  bar.classList.toggle('hidden', !cookiesAccepted || isCookieBannerOpen() || ctaNearOwn);
}
(function(){
  const bar = document.getElementById('mob-cta');
  if(!bar) return;
  updateCtaBar();
  // .hero-btns — кнопки в шапке страницы (например, «Купить билет» на
  // /dyba-show): пока они на экране, бар с той же кнопкой не нужен.
  // Видимые цели храним в Set: колбэк получает только изменившиеся
  // элементы, и es.some() по ним одним «забывал» остальные видимые.
  const targets = document.querySelectorAll('.hero, .hero-btns, #afisha, #subscribe, #contacts, .contact-sec');
  if(!targets.length) return;
  const visible = new Set();
  const obs = new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
    ctaNearOwn = visible.size > 0;
    updateCtaBar();
  }, {threshold:0.1});
  targets.forEach(t=>obs.observe(t));
})();

// Мобильное меню
function handleOverlayClick(e){
  if(!e.target.closest('.m-menu-links')&&!e.target.closest('.m-menu-contacts')){
    toggleMenu();
  }
}

// Блокировка скролла фона через position:fixed с сохранением scrollY —
// не даёт странице «прыгать» при открытии/закрытии меню и надёжнее
// работает на iOS, чем overflow:hidden.
let menuScrollY = 0;

function toggleMenu(){
  const btn = document.querySelector('.burger');
  const menu = document.getElementById('mMenu');
  const close = document.getElementById('close-btn');
  if(!btn||!menu) return;
  const isOpen = menu.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', isOpen);
  if(close) close.classList.toggle('visible', isOpen);

  if(isOpen){
    menuScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${menuScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  } else {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, menuScrollY);
  }
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    const menu = document.getElementById('mMenu');
    if(menu&&menu.classList.contains('open')){
      toggleMenu();
    }
  }
});

// Активное состояние навигации
(function(){
  const path = window.location.pathname.replace(/\/$/,'') || '/';
  document.querySelectorAll('.nav-links a, .m-menu-links a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/,'') || '/';
    if(href === path) a.classList.add('active');
  });
})();

// pack-v468 (ТЗ клиентских текстов, З-4): доводка перехода по якорю.
// Браузер прыгает к #join сразу при разборе документа, а потом шрифты,
// картинки и анимации .reveal меняют высоту блоков выше — и человек
// оказывается не там, куда шёл. Повторяем переход после полной
// загрузки. Сам якорь не трогаем: адрес в строке остаётся прежним.
window.addEventListener('load', function () {
  if (location.hash && location.hash.length > 1) {
    var el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView();
  }
});

// ── Заявки с форм сайта (ТЗ клиентских текстов, З-6, pack-v469) ─────
// Один источник вместо тринадцати инлайн-копий sendTelegram/sendFormspree.
// Раньше обе функции глотали ошибки, ответ Formspree не проверялся, а
// страница безусловно показывала «спасибо» и очищала поля: при сбое
// человек терял и заявку, и свой текст, а мы не узнавали о нём вовсе.
// Теперь успех — только если ХОТЯ БЫ ОДИН канал ответил 2xx.
// ⚠️ Это временная схема до WP-1 R1.6 («Системы и атрибуция»: формы через
// свою функцию) — тогда отправка переедет на сервер вместе с этой логикой.
var AELITA_LEAD = {
  tg: 'https://withered-glade-64b6.kostyamoshnikov.workers.dev',
  formspree: 'https://formspree.io/f/meeyowpw',
};
// Telegram-воркер шлёт текст с разметкой HTML: «<» в тексте заявки ломал
// разметку, и Telegram мог отклонить сообщение целиком.
function aelitaEscHtml(s) {
  return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
}
window.AELITA_sendLead = async function (formName, fields) {
  var keys = Object.keys(fields || {});
  var lines = ['[AELITA] ' + aelitaEscHtml(formName), ''];
  keys.forEach(function (k) {
    var v = String(fields[k] || '').trim();
    if (v) lines.push('<b>' + aelitaEscHtml(k) + ':</b> ' + aelitaEscHtml(v));
  });
  lines.push('', new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }));
  var fd = new FormData();
  fd.append('_subject', '[AELITA] ' + formName);
  keys.forEach(function (k) { fd.append(k, String(fields[k] || '').trim()); });
  var r = await Promise.allSettled([
    fetch(AELITA_LEAD.tg, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: lines.join('\n') }) }),
    fetch(AELITA_LEAD.formspree, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } }),
  ]);
  var tgOk = r[0].status === 'fulfilled' && !!r[0].value && r[0].value.ok;
  var fsOk = r[1].status === 'fulfilled' && !!r[1].value && r[1].value.ok;
  if (!tgOk || !fsOk) console.warn('Заявка ушла не во все каналы', { form: formName, telegram: tgOk, formspree: fsOk });
  return tgOk || fsOk;
};
var AELITA_LEAD_FAIL = {
  ru: 'Не получилось отправить — похоже, связь прервалась. Попробуйте ещё раз или напишите нам: aelita.production@yandex.ru',
  en: "Couldn't send — the connection seems to have dropped. Try again or write to us: aelita.production@yandex.ru",
};
// Сообщение у формы вместо системного alert(). anchorEl — блок успеха
// формы: сообщение встаёт прямо перед ним, то есть рядом с кнопкой.
// Тексты передаются парой RU/EN: строки внутри <script> сборщик EN не
// переводит (i18n/README.md, п. 7), язык выбирается по <html lang>.
window.AELITA_formMessage = function (anchorEl, ru, en, kind) {
  if (!anchorEl || !anchorEl.parentNode) return;
  var text = document.documentElement.lang === 'en' ? (en || ru) : ru;
  var id = (anchorEl.id || 'form') + '__msg';
  var p = document.getElementById(id);
  if (!p) {
    p = document.createElement('p');
    p.id = id;
    p.setAttribute('role', 'alert');
    anchorEl.parentNode.insertBefore(p, anchorEl);
  }
  p.className = 'form-msg form-msg-' + (kind || 'error');
  p.textContent = text || '';
  p.hidden = !text;
};
window.AELITA_formMessageClear = function (anchorEl) {
  if (anchorEl) window.AELITA_formMessage(anchorEl, '', '', 'error');
};

// pack-v522: высота шапки сайта → CSS-переменная --nav-h. Нужна шапкам
// спектаклей с фото (.photo-hero): полоса с фото начинается под шапкой,
// а не уходит под неё. Шапка меняет высоту между брейкпоинтами, поэтому
// меряем, а не прописываем число.
(function () {
  function setNavH() {
    var navs = document.querySelectorAll('nav');
    for (var i = 0; i < navs.length; i++) {
      if (getComputedStyle(navs[i]).position === 'fixed' && navs[i].offsetHeight) {
        document.documentElement.style.setProperty('--nav-h', navs[i].offsetHeight + 'px');
        return;
      }
    }
  }
  setNavH();
  window.addEventListener('resize', setNavH);
  window.addEventListener('load', setNavH);
})();

// pack-v522: «листалка» для ленты фильтров, которая не влезает в экран
// (города в /tickets). Стрелка появляется только с той стороны, куда
// ещё можно прокрутить; по нажатию лента сдвигается на ~2/3 ширины.
(function () {
  var en = document.documentElement.lang === 'en';
  document.querySelectorAll('.filters').forEach(function (strip) {
    if (strip.parentNode.classList.contains('hscroll')) return;
    var box = document.createElement('div');
    box.className = 'hscroll';
    strip.parentNode.insertBefore(box, strip);
    box.appendChild(strip);
    function mk(dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hscroll-btn ' + dir;
      b.textContent = dir === 'next' ? '›' : '‹';
      b.setAttribute('aria-label', dir === 'next' ? (en ? 'Scroll right' : 'Листать вправо') : (en ? 'Scroll left' : 'Листать влево'));
      b.addEventListener('click', function () {
        strip.scrollBy({ left: (dir === 'next' ? 1 : -1) * strip.clientWidth * 0.66, behavior: 'smooth' });
      });
      box.appendChild(b);
    }
    mk('prev'); mk('next');
    function upd() {
      var max = strip.scrollWidth - strip.clientWidth;
      box.classList.toggle('can-prev', strip.scrollLeft > 4);
      box.classList.toggle('can-next', max - strip.scrollLeft > 4);
    }
    strip.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    // выбранный город — целиком в видимой части
    strip.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    upd();
    window.addEventListener('load', upd);
  });
})();

// pack-v522: на телефоне плавающие «Написать нам» и «↑» не мешают читать:
// пока листают вниз — спрятаны, листают вверх или остановились (0,7 с) —
// снова видны. Сама видимость (порог 400 px, cookie-баннер) — по-прежнему
// в updateFixedWidgets; здесь только временное скрытие поверх неё.
(function () {
  var mq = window.matchMedia('(max-width:760px)');
  var lastY = window.scrollY, idle = null;
  function els() { return [document.getElementById('back-to-top'), document.getElementById('tg-widget')].filter(Boolean); }
  function show() { els().forEach(function (e) { e.classList.remove('scroll-hide'); }); }
  window.addEventListener('scroll', function () {
    var y = window.scrollY, dy = y - lastY;
    lastY = y;
    if (!mq.matches) { show(); return; }
    if (dy > 6) els().forEach(function (e) { e.classList.add('scroll-hide'); });
    else if (dy < -6) show();
    clearTimeout(idle);
    idle = setTimeout(show, 700);
  }, { passive: true });
})();

// pack-v535: телефон в формах заявок обязателен (заказчик 29.09). Номер
// считается введённым, если в нём не меньше 10 цифр (с «+7» — 11).
window.AELITA_phoneOk = function (v) { return String(v || '').replace(/\D/g, '').length >= 10; };
window.AELITA_isEn = function () { return (document.documentElement.lang || '').indexOf('en') === 0; };

// ТЗ «покупка без зависаний», Н10: баннер «покупка сейчас может идти
// медленнее» — включается из админки, гаснет сам через 6 часов. Спрашиваем
// сервер не чаще раза в 5 минут за визит (sessionStorage); любой сбой —
// баннера нет, сайт работает как обычно.
(function () {
  var URL = 'https://api.aelita-production.ru/tickets/performances-list?notice=1';
  var CACHE = 'aelita_notice';
  function show(n) {
    if (!n || !n.on || !(Date.parse(n.until) > Date.now()) || document.getElementById('aelitaNotice')) return;
    var en = window.AELITA_isEn && window.AELITA_isEn();
    var el = document.createElement('div');
    el.id = 'aelitaNotice';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:relative;z-index:50;background:#2a2418;color:#e8e2d6;border-bottom:1px solid rgba(214,181,122,.4);padding:10px 16px;font:14px/1.5 Georgia,serif;text-align:center';
    el.textContent = en
      ? 'Buying tickets may be slower than usual right now — we know and are fixing it. If something goes wrong, write to aelita.production@yandex.ru and we will help.'
      : 'Сейчас покупка может идти медленнее обычного — мы знаем и чиним. Если что-то пошло не так, напишите на aelita.production@yandex.ru, поможем.';
    document.body.insertBefore(el, document.body.firstChild);
  }
  // pack-v581 (после случая Say Agency, п. 5): отменённый или перенесённый
  // показ — баннер на странице, где есть ссылка на его покупку, а кнопки
  // «Купить» у отменённого гаснут. Список приходит тем же запросом
  // (Tickets/lib/performance-changes.js). Сравнение — по адресу покупки
  // без utm-меток: у партнёра — страница показа, у нас — ?performance=id.
  function buyKey(href) {
    try {
      var u = new window.URL(href, location.href); // window.: выше в этом блоке URL — строка адреса запроса
      var perf = u.searchParams.get('performance');
      if (perf && u.pathname.replace(/^\/en/, '').indexOf('/tickets-buy') === 0) return 'own:' + perf;
      if (u.hostname !== location.hostname) return 'ext:' + u.hostname + u.pathname.replace(/\/$/, '');
    } catch (e) { /* не адрес */ }
    return null;
  }
  function changeWhen(iso, en) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString(en ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
  }
  function changeText(c, en) {
    var title = (en && c.titleEn) || c.title || '';
    var mail = 'aelita.production@yandex.ru';
    if (c.status === 'canceled') {
      if (en) return title + ', ' + changeWhen(c.datetime, en) + ': the performance has been cancelled. We will refund the full ticket price to the card you paid with within 10 days — no application needed.' +
        (c.channel === 'own' ? ' The details are in the email we sent you.' : ' If the money has not arrived, write to ' + mail + ' and give the email you bought the ticket with.');
      return title + ', ' + changeWhen(c.datetime, en) + ': показ отменён. Стоимость билетов вернём полностью на карту, с которой платили, в течение 10 дней — заявление не нужно.' +
        (c.channel === 'own' ? ' Подробности — в письме, которое мы вам отправили.' : ' Если деньги не пришли — напишите на ' + mail + ' и укажите почту, на которую покупали билет.');
    }
    var was = c.from ? changeWhen(c.from, en) : '';
    if (en) return title + ': the performance has been moved' + (was ? ' from ' + was : '') + ' to ' + changeWhen(c.datetime, en) + '. Tickets are valid for the new date. If it does not suit you, we will refund the full price — ' +
      (c.channel === 'own' ? 'use the link in our email or your account.' : 'write to ' + mail + '.');
    return title + ': показ перенесён' + (was ? ' с ' + was : '') + ' на ' + changeWhen(c.datetime, en) + '. Билеты действуют на новую дату. Если она не подходит — вернём полную стоимость: ' +
      (c.channel === 'own' ? 'по ссылке из нашего письма или в личном кабинете.' : 'напишите на ' + mail + '.');
  }
  function showChanges(list) {
    if (!list || !list.length || document.getElementById('aelitaChanges')) return;
    var byKey = {};
    list.forEach(function (c) {
      var k = c.channel === 'own' ? 'own:' + c.id : buyKey(c.buyUrl || '');
      if (k) byKey[k] = c;
    });
    var hit = [];
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var c = byKey[buyKey(a.getAttribute('href'))];
      if (!c) continue;
      if (hit.indexOf(c) < 0) hit.push(c);
      if (c.status === 'canceled') {
        a.removeAttribute('href');
        a.removeAttribute('target');
        a.setAttribute('aria-disabled', 'true');
        a.classList.add('is-canceled');
        a.textContent = (window.AELITA_isEn && window.AELITA_isEn()) ? 'Cancelled' : 'Показ отменён';
      }
    }
    if (!hit.length) return;
    var en = window.AELITA_isEn && window.AELITA_isEn();
    var el = document.createElement('div');
    el.id = 'aelitaChanges';
    el.className = 'show-change';
    el.setAttribute('role', 'status');
    hit.forEach(function (c) {
      var p = document.createElement('p');
      p.textContent = changeText(c, en);
      el.appendChild(p);
    });
    document.body.insertBefore(el, document.body.firstChild);
  }
  function run() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
      if (c && Date.now() - c.t < 5 * 60 * 1000) { show(c.n); showChanges(c.ch); return; }
    } catch (e) { /* без кэша */ }
    if (!window.fetch) return;
    fetch(URL).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var n = d && d.notice;
      var ch = (d && d.changes) || [];
      try { sessionStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), n: n || null, ch: ch })); } catch (e) { /* приватный режим */ }
      show(n);
      showChanges(ch);
    }).catch(function () { /* баннера нет */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
