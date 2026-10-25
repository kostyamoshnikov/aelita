/* ============================================================
   Общие мобильные виджеты AELITA PRODUCTION
   (cookie-баннер, кнопка «наверх», CTA-бар, Telegram-виджет)
   Подключается на всех страницах сайта — правки здесь применяются
   сразу везде, без необходимости редактировать каждую страницу.
   ============================================================ */

/* ── pack-v690: версия для слабовидящих ─────────────────────────
   Глаз в шапке, пункт в мобильном меню и ссылка в подвале включают
   режим; панель сверху — размер шрифта (3), цвета (3: чёрным по белому,
   белым по чёрному, синим по голубому), изображения вкл/выкл, «Обычная
   версия». Настройки — localStorage 'aelita_a11y' (на этом устройстве),
   ?a11y=1 в адресе — включить. Стили — style.css, блок pack-v690. */
(function(){ try {
  var KEY='aelita_a11y', root=document.documentElement;
  var EN=/^en/i.test(root.lang||'')||/^\/en(\/|$)/.test(location.pathname);
  var T=EN?{size:'Font size',sizeS:'Size',colors:'Colours',colorsS:'Colour',img:'Images',imgS:'Images',on:'On',off:'Off',normal:'Standard version',link:'Version for the visually impaired',c:['Black on white','White on black','Dark blue on light blue'],s:['Normal','Large','Extra large']}
          :{size:'Размер шрифта',sizeS:'Шрифт',colors:'Цвета',colorsS:'Цвет',img:'Изображения',imgS:'Фото',on:'Вкл',off:'Выкл',normal:'Обычная версия',link:'Версия для слабовидящих',c:['Чёрным по белому','Белым по чёрному','Синим по голубому'],s:['Обычный','Крупный','Очень крупный']};
  var st={on:0,s:1,c:1,img:1};
  try{var raw=localStorage.getItem(KEY); if(raw){var o=JSON.parse(raw); for(var k in st){ if(o&&typeof o[k]==='number') st[k]=o[k]; }}}catch(e){}
  if(/[?&]a11y=1\b/.test(location.search)) st.on=1;
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){} }
  function cls(){
    var c=root.className.replace(/\ba11y(-[a-z0-9]+)?\b/g,'').replace(/\s+/g,' ').trim();
    if(st.on) c+=' a11y a11y-s'+st.s+' a11y-c'+st.c+(st.img?'':' a11y-noimg');
    root.className=c.trim();
  }
  cls(); // как можно раньше — до построения панели
  var EYE='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  var bar=null;
  function alts(){
    document.querySelectorAll('.a11y-alt').forEach(function(s){ s.remove(); });
    if(!st.on||st.img) return;
    document.querySelectorAll('main img[alt], header img[alt]').forEach(function(im){
      var a=(im.getAttribute('alt')||'').trim(); if(!a) return;
      var s=document.createElement('span'); s.className='a11y-alt'; s.textContent=a;
      im.parentNode.insertBefore(s, im.nextSibling);
    });
  }
  
  function lab(full,short){ return '<span class="a11y-lab"><span class="a11y-full">'+full+':</span><span class="a11y-short" aria-hidden="true">'+short+':</span></span>'; }
  // Текст, у которого размер задан в px (а не в rem), сам не растёт — меряем
  // при базовых 16 px и при выбранном размере и увеличиваем такие узлы вручную.
  function fixPx(){
    document.querySelectorAll('[data-a11y-fs]').forEach(function(e){ e.style.removeProperty('font-size'); e.removeAttribute('data-a11y-fs'); });
    if(!st.on||!document.body) return;
    var els=[].filter.call(document.body.querySelectorAll('*'),function(e){
      if(e.closest('#a11y-bar,svg,script,style,noscript')) return false;
      for(var n=e.firstChild;n;n=n.nextSibling){ if(n.nodeType===3&&n.textContent.trim()) return true; }
      return false;
    });
    root.style.setProperty('font-size','16px','important');
    var f0=els.map(function(e){ return parseFloat(getComputedStyle(e).fontSize)||0; });
    root.style.removeProperty('font-size');
    var k=(parseFloat(getComputedStyle(root).fontSize)||16)/16;
    els.forEach(function(e,i){
      var f1=parseFloat(getComputedStyle(e).fontSize)||0;
      if(f0[i]&&f0[i]<24&&Math.abs(f1-f0[i])<0.5){ e.style.setProperty('font-size',(f0[i]*k).toFixed(1)+'px','important'); e.setAttribute('data-a11y-fs',''); }
    });
  }
  function btn(label,attrs,html){ return '<button type="button" '+attrs+' aria-label="'+label+'" title="'+label+'">'+html+'</button>'; }
  function buildBar(){
    if(bar){ bar.remove(); bar=null; }
    if(!st.on) return;
    bar=document.createElement('div'); bar.id='a11y-bar'; bar.setAttribute('role','region'); bar.setAttribute('aria-label',T.link);
    var h='<div class="a11y-grp">'+lab(T.size,T.sizeS);
    [1,2,3].forEach(function(n){ h+=btn(T.s[n-1],'class="a11y-s" data-s="'+n+'" aria-pressed="'+(st.s===n)+'"','A'); });
    h+='</div><div class="a11y-grp">'+lab(T.colors,T.colorsS);
    [1,2,3].forEach(function(n){ h+=btn(T.c[n-1],'class="a11y-c a11y-c'+n+'" data-c="'+n+'" aria-pressed="'+(st.c===n)+'"','A'); });
    h+='</div><div class="a11y-grp">'+lab(T.img,T.imgS)+btn(T.img+': '+T.on,'class="a11y-i" data-i="1" aria-pressed="'+(st.img===1)+'"',T.on)+btn(T.img+': '+T.off,'class="a11y-i" data-i="0" aria-pressed="'+(st.img===0)+'"',T.off)+'</div>';
    h+='<div class="a11y-grp">'+btn(T.normal,'class="a11y-off"',EYE+'<span class="a11y-off-t">'+T.normal+'</span>')+'</div>';
    bar.innerHTML=h;
    document.body.insertBefore(bar, document.body.firstChild);
    bar.addEventListener('click',function(e){
      var b=e.target.closest('button'); if(!b) return;
      if(b.dataset.s) st.s=+b.dataset.s;
      else if(b.dataset.c) st.c=+b.dataset.c;
      else if(b.dataset.i) st.img=+b.dataset.i;
      else if(b.classList.contains('a11y-off')) st.on=0;
      apply(b.className);
    });
  }
  function apply(focusCls,noSave){
    if(!noSave) save(); cls(); buildBar(); alts(); fixPx();
    try{ window.dispatchEvent(new Event('resize')); }catch(e){}
    document.querySelectorAll('.a11y-btn').forEach(function(b){ b.setAttribute('aria-pressed',st.on?'true':'false'); });
    document.querySelectorAll('.a11y-menu-link span, .a11y-foot-link').forEach(function(el){ el.textContent=st.on?T.normal:T.link; });
    document.querySelectorAll('.a11y-btn').forEach(function(b){ b.title=st.on?T.normal:T.link; b.setAttribute('aria-label',b.title); });
    if(st.on&&bar&&focusCls){ var f=bar.querySelector('button[class="'+focusCls+'"][aria-pressed="true"]')||bar.querySelector('button'); if(f) f.focus(); }
  }
  function toggle(e){
    if(e) e.preventDefault();
    var menu=document.getElementById('mMenu');
    if(menu&&menu.classList.contains('open')&&typeof window.toggleMenu==='function') window.toggleMenu();
    st.on=st.on?0:1; apply(st.on?'a11y-s':'');
    if(st.on) window.scrollTo(0,0);
  }
  function init(){
    // без общего style.css (страница /app) режиму нечем рисоваться — не включаем
    if(!document.querySelector('link[href*="/assets/style.css"]')){ st.on=0; cls(); return; }
    var nav=document.querySelector('body > nav');
    if(nav){
      var inner=nav.querySelector('.nav-in')||nav;
      var b=document.createElement('button'); b.type='button'; b.className='a11y-btn';
      b.setAttribute('aria-label',T.link); b.title=T.link; b.innerHTML=EYE;
      var before=inner.querySelector('.lang-switch')||inner.querySelector('.burger');
      if(before) before.parentNode.insertBefore(b,before); else inner.appendChild(b);
      b.addEventListener('click',toggle);
    }
    var ml=document.querySelector('.m-menu-links');
    if(ml){ var a=document.createElement('a'); a.href='#'; a.className='a11y-menu-link'; a.innerHTML=EYE+'<span>'+T.link+'</span>'; a.addEventListener('click',toggle); ml.appendChild(a); }
    var rq=document.querySelector('footer .requisites');
    if(rq){ var f=document.createElement('a'); f.href='#'; f.className='a11y-foot-link'; f.textContent=T.link; f.addEventListener('click',toggle); rq.appendChild(document.createTextNode(' · ')); rq.appendChild(f); }
    apply('',1);
    window.addEventListener('load',function(){ if(st.on) fixPx(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
 } catch(e) { /* режим для слабовидящих не должен ломать остальной main.js */ }
})();

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

// pack-v654: «↑» и «Написать нам» — только там и тогда, где они нужны
// (заказчик 12.10: «периодически просто появляются и перегораживают»).
// Раньше обе кнопки всплывали на всех страницах уже после 400 px (меньше
// полэкрана телефона), а на телефоне возвращались через 0,7 с после
// каждой остановки — то есть висели поверх текста почти всё время.
// Правила теперь такие:
//  «↑» — только на длинных страницах (от 4 экранов) и только глубже
//        2 экранов от начала. Постоянно — только если справа от текста
//        есть пустое поле шире кнопки (широкий монитор). Иначе (телефон,
//        ноутбук) — когда человек сам листает вверх (≥ 80 px подряд):
//        значит, хочет вернуться; через 2,5 с без прокрутки или при
//        листании вниз снова прячется.
//  «Написать нам» — не на страницах, где оно лишнее (TG_OFF: контакты,
//        команда, пресса, партнёры, страницы людей). После первого
//        экрана — только если слева от текста есть пустое поле шире
//        кнопки (широкий монитор). Иначе (телефон, ноутбук) — только в
//        конце страницы, когда показался футер: дочитал и остался вопрос.
//        Подсказка-пузырь — один раз за визит и только не на телефоне.
//  Обе — не поверх ссылки, кнопки или поля: если кнопка закрыла бы
//        заметную часть (≥15%) чего-то нажимаемого, она уходит, пока это
//        не проедет. Уголок большой карточки-ссылки — не помеха.
//        «Написать нам» (стоит подолгу) — ещё и не поверх текста и
//        картинок: только на пустом месте (pack-v657).
//  Обе — не поверх непринятого cookie-баннера (как раньше).
var AELITA_TG_OFF = [
  'contacts', 'team', 'festival-team', 'rezidents', 'press', 'mentions', 'partners',
  'alexandra-chubenko', 'alexandra-gubanova', 'alexey-tsymlov', 'anastasia-silantyeva', 'anton-vdovichenko',
  'denis-smetnev',
  'ekaterina-ilyina', 'ivan-sachkov', 'katya-abdulova',
  'konstantin-moshnikov', 'ksenia-shamarina', 'maria-pavlova', 'mikhail-kazmiruk',
  'svetlana-nikiforova', 'valentina-bykova', 'vanya-dyba', 'viktor-ignatov', 'yulia-bychkova'
];
var fwSlug = location.pathname.replace(/^\/en(?=\/|$)/, '').replace(/^\/+|\/+$/g, '').split('/')[0];
var fwTgOff = AELITA_TG_OFF.indexOf(fwSlug) !== -1;
// pack-v657: «Написать нам» встаёт только на пустое место — под подвалом на
// компьютере для неё оставлена полоса (style.css, .fw-tg-slot), как на телефоне
if(!fwTgOff && document.getElementById('tg-widget')) document.documentElement.classList.add('fw-tg-slot');
var fwPhone = window.matchMedia('(max-width:760px)');
var fwLastY = window.scrollY, fwUpAcc = 0, fwWantUp = false, fwIdle = null, fwSettle = null, fwRaf = 0;

// Есть ли под кнопкой (в её нынешнем месте) ссылка, кнопка или поле.
// elementsFromPoint пропускает элементы с pointer-events:none, а саму
// видимую кнопку мы отбрасываем вручную.
function fwCovers(el, box, strict){
  if(!el || !box || !document.elementsFromPoint) return false;
  var rr = el.getBoundingClientRect();
  if(!rr.width || !rr.height) return false;
  // Скрытая (или ещё всплывающая) кнопка сдвинута вниз translateY из
  // style.css — проверяем место, где она будет стоять видимой.
  var dy = 0;
  try { dy = new DOMMatrixReadOnly(getComputedStyle(box).transform).m42 || 0; } catch(e) {}
  var r = { left: rr.left, right: rr.right, top: rr.top - dy, bottom: rr.bottom - dy }, t = r.top;
  var pts = [];
  [r.left + 3, (r.left + r.right) / 2, r.right - 3].forEach(function(x){
    [r.top + 3, (r.top + r.bottom) / 2, r.bottom - 3].forEach(function(y){ pts.push([x, y]); });
  });
  for(var i = 0; i < pts.length; i++){
    var under = document.elementsFromPoint(pts[i][0], pts[i][1]);
    for(var j = 0; j < under.length; j++){
      var u = under[j];
      if(box.contains(u)) continue;
      if(u === document.body || u === document.documentElement) break;
      var hit = u.closest('a,button,input,select,textarea,label,summary,[role="button"],[onclick]');
      if(hit){
        // Карточка-ссылка на всю ширину экрана не мешает: кнопка закрывает
        // её уголок, нажать есть куда. Мешает, если закрыта заметная часть
        // (≥15%) — кнопка «Купить», ссылка в футере, поле формы.
        var h = hit.getBoundingClientRect();
        var ix = Math.max(0, Math.min(r.right, h.right) - Math.max(r.left, h.left));
        var iy = Math.max(0, Math.min(r.bottom, h.bottom) - Math.max(t, h.top));
        var area = h.width * h.height;
        if(!area || ix * iy / area >= 0.15) return true;
      }
      // strict («Написать нам» стоит подолгу): мешает и текст, и картинка —
      // кнопка встаёт только на пустое место
      if(strict && (u.tagName === 'IMG' || [].some.call(u.childNodes, function(n){ return n.nodeType === 3 && n.textContent.trim().length > 1; }))) return true;
      break; // верхний элемент под кнопкой — не нажимаемый
    }
  }
  return false;
}

// pack-v657: ширина пустого поля слева и справа от колонки текста. На
// ноутбуках (до ~1800 px) колонка .wrap идёт почти от края до края, и
// кнопка «на поле» на деле стоит поверх текста.
function fwMargins(){
  // берём самую широкую колонку: первая попавшаяся .wrap бывает узкой
  // (шапка, врезка), и поле по ней выходит обманчиво широким
  var W = document.documentElement.clientWidth, L = Infinity, R = Infinity;
  var ws = document.querySelectorAll('.wrap');
  for(var i = 0; i < ws.length; i++){
    var r = ws[i].getBoundingClientRect();
    if(!r.width || !r.height) continue;
    var cs = getComputedStyle(ws[i]);
    L = Math.min(L, r.left + (parseFloat(cs.paddingLeft) || 0));
    R = Math.min(R, W - r.right + (parseFloat(cs.paddingRight) || 0));
  }
  if(L === Infinity){ var side = (W - Math.min(W, 1320)) / 2 + 24; return { left: side, right: side }; }
  return { left: L, right: R };
}

function updateFixedWidgets(){
  var y = window.scrollY, vh = window.innerHeight;
  var H = document.documentElement.scrollHeight;
  var phone = fwPhone.matches;
  var bannerOpen = isCookieBannerOpen();

  // Плашка «Купить билет» (.mob-cta) внизу телефона бывает в две строки —
  // поднимаем кнопки над ней на её настоящую высоту, иначе ложатся на неё.
  var bar = document.getElementById('mob-cta');
  var lift = (phone && bar && !bar.classList.contains('hidden') && bar.offsetHeight) ? (bar.offsetHeight + 12) + 'px' : '';
  ['back-to-top', 'tg-widget'].forEach(function(id){
    var e = document.getElementById(id);
    if(e && e.style.bottom !== lift) e.style.bottom = lift;
  });

  var btn = document.getElementById('back-to-top');
  if(btn){
    var m = fwMargins();
    var roomR = !phone && m.right >= 24 + btn.offsetWidth + 12;   // «↑» целиком на пустом поле
    var show = H >= vh * 4 && y > vh * 2 && !bannerOpen && (roomR || fwWantUp);
    if(show && fwCovers(btn, btn)) show = false;
    btn.classList.toggle('visible', show);
  }

  var widget = document.getElementById('tg-widget');
  if(widget){
    var showTg = false;
    if(!fwTgOff && !bannerOpen){
      var tb = widget.querySelector('.tg-btn');
      var roomL = !phone && tb && fwMargins().left >= 24 + tb.offsetWidth + 12;  // целиком на пустом поле
      var f = document.querySelector('footer');
      var atEnd = f ? f.getBoundingClientRect().top < vh : (y + vh >= H - vh * 0.5);
      // есть пустое поле — после первого экрана (и у подвала короткой
      // страницы); нет (телефон, ноутбук) — только в конце страницы
      showTg = roomL ? (y > vh || atEnd) : atEnd;
    }
    var tgBtn = widget.querySelector('.tg-btn');
    if(showTg && fwCovers(tgBtn, widget, true)) showTg = false;
    if(showTg){
      if(!widget.classList.contains('visible')){
        widget.classList.add('visible');
        var bubble = document.getElementById('tg-bubble');
        var seen = false;
        try { seen = !!sessionStorage.getItem('aelita_tg_bubble'); } catch(e) {}
        if(bubble && roomL && !seen && !bubble.dataset.shown){  // пузырь — только на пустом поле, не поверх футера
          bubble.dataset.shown = '1';
          try { sessionStorage.setItem('aelita_tg_bubble', '1'); } catch(e) {}
          setTimeout(function(){
            bubble.classList.add('visible');
            setTimeout(function(){ bubble.classList.remove('visible'); }, 4000);
          }, 1000);
        }
      }
    } else {
      widget.classList.remove('visible');
      var b2 = document.getElementById('tg-bubble');
      if(b2) b2.classList.remove('visible');
    }
  }
}
function fwSchedule(){
  if(fwRaf) return;
  fwRaf = requestAnimationFrame(function(){ fwRaf = 0; updateFixedWidgets(); });
}
window.addEventListener('scroll', function(){
  var y = window.scrollY, dy = y - fwLastY;
  fwLastY = y;
  // отскок iOS у нижнего края даёт ложное «вверх» — его не считаем;
  // любое движение вниз (в том числе прыжок в самый конец) сбрасывает
  var bounce = y + window.innerHeight >= document.documentElement.scrollHeight - 2;
  if(dy > 6){ fwUpAcc = 0; fwWantUp = false; }
  else if(dy < 0 && !bounce && y > 0){ fwUpAcc += -dy; if(fwUpAcc >= 80) fwWantUp = true; }
  clearTimeout(fwIdle);
  fwIdle = setTimeout(function(){ fwUpAcc = 0; fwWantUp = false; updateFixedWidgets(); }, 2500);
  // плавная прокрутка докатывается уже после последнего кадра — ещё раз
  // смотрим, что под кнопкой, когда страница встала
  clearTimeout(fwSettle);
  fwSettle = setTimeout(updateFixedWidgets, 150);
  fwSchedule();
}, { passive: true });
window.addEventListener('resize', fwSchedule);
window.addEventListener('load', fwSchedule);
// догрузились картинки, раскрылся блок — то, что под кнопкой, могло сместиться
if('ResizeObserver' in window && document.body) new ResizeObserver(fwSchedule).observe(document.body);
// блоки .reveal «выплывают» до секунды после остановки — ссылка может
// подъехать под кнопку уже без прокрутки
document.addEventListener('transitionend', function(e){
  if(e.target && e.target.classList && e.target.classList.contains('reveal')) fwSchedule();
}, true);
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
  if(typeof updateFixedWidgets === 'function') updateFixedWidgets();
}
(function(){
  const bar = document.getElementById('mob-cta');
  if(!bar) return;
  updateCtaBar();
  // .hero-btns — кнопки в шапке страницы (например, «Купить билет» на
  // /dyba-show): пока они на экране, бар с той же кнопкой не нужен.
  // Видимые цели храним в Set: колбэк получает только изменившиеся
  // элементы, и es.some() по ним одним «забывал» остальные видимые.
  const targets = document.querySelectorAll('.hero, .hero-btns, #afisha, #subscribe, #contacts, .contact-sec, .fact-panel');
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
// pack-v601 (решение заказчика 09.10): заявка уходит на НАШ сервер —
// функция aelita-inbox-leads (_tools/Inbox/leads.js), хранение в Яндекс
// Облаке (Россия), админка → «Заявки с сайта», уведомление команде шлёт
// сервер (Telegram + почта). Раньше браузер слал заявку напрямую в
// Formspree (США) и в личный Cloudflare-воркер — у нас она не хранилась.
// Успех — только ответ 2xx сервера; иначе форма показывает AELITA_LEAD_FAIL
// и текст человека остаётся в полях.
var AELITA_LEAD_URL = 'https://api.aelita-production.ru/leads';
function aelitaLeadId() {
  var a = new Uint8Array(10);
  try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
  return 'l' + Date.now().toString(36) + '-' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
window.AELITA_sendLead = async function (formName, fields) {
  var clean = {};
  Object.keys(fields || {}).forEach(function (k) { var v = String(fields[k] || '').trim(); if (v) clean[k] = v; });
  var body = JSON.stringify({ form: formName, fields: clean, lang: document.documentElement.lang === 'en' ? 'en' : 'ru', page: location.pathname, client_id: aelitaLeadId() });
  // Одна повторная попытка при обрыве сети — с тем же client_id (сервер не задвоит).
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      var res = await fetch(AELITA_LEAD_URL, { method: 'POST', body: body });
      if (res.ok) return true;
      if (res.status < 500) { console.warn('Заявка не принята', { form: formName, status: res.status }); return false; }
    } catch (e) { /* сеть — пробуем ещё раз */ }
  }
  return false;
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
  // pack-v611: та же листалка — и у других лент, которые на телефоне
  // уходят за край: дни программы (/tochkacuire), фильтр проектов, вкладки
  // «Сотрудничества». У .filters — прежний отступ снизу (hscroll-filters).
  document.querySelectorAll('.filters, .days-tabs, .filter-bar, .collab-tabs').forEach(function (strip) {
    if (strip.parentNode.classList.contains('hscroll')) return;
    var box = document.createElement('div');
    box.className = 'hscroll' + (strip.classList.contains('filters') ? ' hscroll-filters' : '');
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
      var btn = e.target.closest('.filter-btn, .day-tab, button, a');
      if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    upd();
    window.addEventListener('load', upd);
  });
})();

// pack-v629: на телефоне плавающие «Написать нам» (с подсказкой) и «↑»
// закрывали кнопку «Оплатить» и поля формы (заказчик 10.10, /programs).
// Пока на экране поле формы или кнопка оплаты — они спрятаны (.form-hide).
(function () {
  if (!('IntersectionObserver' in window)) return;
  var mq = window.matchMedia('(max-width:760px)');
  var seen = new Set();
  function els() { return [document.getElementById('back-to-top'), document.getElementById('tg-widget')].filter(Boolean); }
  function apply() {
    var hide = mq.matches && seen.size > 0;
    els().forEach(function (e) { e.classList.toggle('form-hide', hide); });
    if (hide) { var b = document.getElementById('tg-bubble'); if (b) b.classList.remove('visible'); }
  }
  function start() {
    var targets = document.querySelectorAll('.join-field, [id^="payBtn"], .pay-box, main form, .submit-btn');
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      apply();
    });
    targets.forEach(function (t) { io.observe(t); });
    if (mq.addEventListener) mq.addEventListener('change', apply);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
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

// pack-v650: баннер «сбой серверной части» (assets/outage.js) — сам решает,
// показываться ли: только если api.aelita-production.ru не отвечает.
(function () {
  try {
    if (window.__aelitaOutage) return;
    var s = document.createElement('script');
    s.src = '/assets/outage.js?v=126';
    s.defer = true;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* баннер — не главное, страница работает и без него */ }
})();

// pack-v673: подсказка «Установите приложение» для iPhone/iPad в Safari
// (заказчик 18.10). Apple не даёт сайту самому предложить установку —
// показываем, как это сделать: «Поделиться» → «На экран Домой».
// Только Safari (во встроенных окнах Instagram/VK/Telegram установка
// невозможна), не в установленном приложении, не на /app (там инструкция),
// не на страницах покупки, кабинета и оплаты, не поверх cookie-баннера и
// плашки «Купить билет». Закрыли — не показываем 60 дней.
(function () {
  try {
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    if (!/Safari\//.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Instagram|FBAN|FBAV|VKClient|Telegram|Line\/|MicroMessenger|YaApp|AelitaApp/.test(ua)) return;
    if (navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) return;
    var path = location.pathname.replace(/^\/en(?=\/|$)/, '');
    if (/^\/(app|tickets-buy|ticket|tickets-scan|events-scan|account|admin|ticket-refund|gift-card|book-space\/[^/]+\/pay|programs)(\/|$)/.test(path)) return;
    var KEY = 'aelita_ios_hint_closed';
    var closed = 0;
    try { closed = +localStorage.getItem(KEY) || 0; } catch (e) { return; }
    if (closed && Date.now() - closed < 60 * 24 * 3600 * 1000) return;
    var en = window.AELITA_isEn && window.AELITA_isEn();
    var SHARE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="vertical-align:-2px"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>';
    function show() {
      if (document.getElementById('ios-hint')) return;
      if (typeof isCookieBannerOpen === 'function' && isCookieBannerOpen()) return;
      if (document.getElementById('mob-cta')) return; // своя плашка «Купить билет» внизу — не перекрываем
      var st = document.createElement('style');
      st.textContent = '#ios-hint{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9000;background:#16161a;border:1px solid rgba(214,181,122,.45);color:#E8E6E1;padding:14px 44px 14px 16px;font-size:0.875rem;line-height:1.5;box-shadow:0 8px 30px rgba(0,0,0,.5)}'
        + '#ios-hint b{color:#D6B57A;font-weight:500}#ios-hint a{color:#D6B57A}'
        + '#ios-hint button{position:absolute;top:6px;right:6px;width:36px;height:36px;background:none;border:0;color:#C9B8A3;font-size:1.25rem;line-height:1;cursor:pointer}'
        + 'html.ios-hint-on #tg-widget,html.ios-hint-on #back-to-top{visibility:hidden}';
      document.head.appendChild(st);
      var el = document.createElement('div');
      el.id = 'ios-hint';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', en ? 'Install the app' : 'Установить приложение');
      el.innerHTML = en
        ? '<b>AELITA app</b> — tap “Share” ' + SHARE + ' and choose “Add to Home Screen”. <a href="/en/app">How</a>'
        : '<b>Приложение АЭЛИТА</b> — нажмите «Поделиться» ' + SHARE + ' и выберите «На экран Домой». <a href="/app">Как</a>';
      var x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('aria-label', en ? 'Close' : 'Закрыть');
      x.textContent = '×';
      x.onclick = function () {
        try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* приватный режим */ }
        el.remove();
        document.documentElement.classList.remove('ios-hint-on');
      };
      el.appendChild(x);
      document.body.appendChild(el);
      document.documentElement.classList.add('ios-hint-on');
    }
    setTimeout(show, 12000);
  } catch (e) { /* подсказка — не главное */ }
})();

// pack-v689: запись в одно касание. Кнопка «Записаться» в первом экране ведёт к
// блоку #join; если там кнопка виджета Timepad — сразу открываем и окно записи
// (переход к #join остаётся: если виджет не загрузился, человек видит прямую ссылку).
(function(){
  document.querySelectorAll('a[href="#join"]').forEach(function(a){
    a.addEventListener('click',function(){
      var b=document.querySelector('#join [id^="timepad_twf_register"]');
      if(b) setTimeout(function(){ b.click(); }, 350);
    });
  });
})();
