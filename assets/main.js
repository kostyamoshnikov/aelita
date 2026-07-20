/* ============================================================
   Общие мобильные виджеты AELITA PRODUCTION
   (cookie-баннер, кнопка «наверх», CTA-бар, Telegram-виджет)
   Подключается на всех страницах сайта — правки здесь применяются
   сразу везде, без необходимости редактировать каждую страницу.
   ============================================================ */

// Cookie-баннер
(function(){
  if(localStorage.getItem('cookies_accepted')){
    var b=document.getElementById('cookie-banner');
    if(b) b.style.display='none';
  }
})();
function acceptCookies(){
  localStorage.setItem('cookies_accepted','1');
  var b=document.getElementById('cookie-banner');
  if(b){b.classList.add('hidden');setTimeout(function(){b.style.display='none'},400);}
  var bar=document.getElementById('mob-cta');
  if(bar) bar.classList.remove('hidden');
}

// Кнопка «наверх»
window.addEventListener('scroll',()=>{
  const btn=document.getElementById('back-to-top');
  if(btn) btn.classList.toggle('visible', window.scrollY > 400);
});

// Мобильный CTA-бар — прячем, пока cookies не приняты, и когда рядом афиша/форма/контакты
(function(){
  const bar = document.getElementById('mob-cta');
  if(!bar) return;
  if(!localStorage.getItem('cookies_accepted')) bar.classList.add('hidden');
  const targets = document.querySelectorAll('.hero, #afisha, #subscribe, #contacts, .contact-sec');
  if(!targets.length) return;
  const obs = new IntersectionObserver(es=>{
    const visible = es.some(e=>e.isIntersecting);
    bar.classList.toggle('hidden', visible || !localStorage.getItem('cookies_accepted'));
  }, {threshold:0.1});
  targets.forEach(t=>obs.observe(t));
})();

// Telegram-виджет — показываем после прокрутки 400px
window.addEventListener('scroll', function(){
  const widget = document.getElementById('tg-widget');
  if(!widget) return;
  if(window.scrollY > 400){
    widget.classList.add('visible');
    const bubble = document.getElementById('tg-bubble');
    if(bubble && !bubble.dataset.shown){
      bubble.dataset.shown = '1';
      setTimeout(function(){
        bubble.classList.add('visible');
        setTimeout(function(){ bubble.classList.remove('visible'); }, 4000);
      }, 1000);
    }
  } else {
    widget.classList.remove('visible');
  }
});

// Мобильное меню
function handleOverlayClick(e){
  if(!e.target.closest('.m-menu-links')&&!e.target.closest('.m-menu-contacts')){
    toggleMenu();
  }
}
function toggleMenu(){
  const btn = document.querySelector('.burger');
  const menu = document.getElementById('mMenu');
  const close = document.getElementById('close-btn');
  if(!btn||!menu) return;
  const isOpen = menu.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if(close) close.classList.toggle('visible', isOpen);
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    const menu = document.getElementById('mMenu');
    const btn = document.querySelector('.burger');
    if(menu&&menu.classList.contains('open')){
      menu.classList.remove('open');
      btn&&btn.classList.remove('open');
      document.body.style.overflow='';
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
