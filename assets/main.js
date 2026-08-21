/* ============================================================
   Общие мобильные виджеты AELITA PRODUCTION
   (cookie-баннер, кнопка «наверх», CTA-бар, Telegram-виджет)
   Подключается на всех страницах сайта — правки здесь применяются
   сразу везде, без необходимости редактировать каждую страницу.
   ============================================================ */

// Cookie-баннер
var YM_ID = 104681911;
var ymLoaded = false;

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

(function(){
  if(localStorage.getItem('cookies_accepted')){
    var b=document.getElementById('cookie-banner');
    if(b) b.style.display='none';
    loadMetrika();
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
  const targets = document.querySelectorAll('.hero, #afisha, #subscribe, #contacts, .contact-sec');
  if(!targets.length) return;
  const obs = new IntersectionObserver(es=>{
    ctaNearOwn = es.some(e=>e.isIntersecting);
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
