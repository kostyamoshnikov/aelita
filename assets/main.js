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
