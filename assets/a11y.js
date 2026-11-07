/* СГЕНЕРИРОВАНО _tools/DesignSystem/a11y/build_a11y_standalone.py из assets/main.js —
   руками не править: правка — в main.js, затем пересобрать. Подключают автономные страницы
   (покупка, электронный билет, отмена записи), у которых нет общего main.js. */
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
    // без общего style.css (страница /app) режиму нечем рисоваться — не включаем;
    // pack-v715: у автономных страниц (покупка, билет, отмена записи) — assets/a11y.css
    if(!document.querySelector('link[href*="/assets/style.css"],link[href*="/assets/a11y.css"]')){ st.on=0; cls(); return; }
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
    // pack-v715: страница без шапки, меню и подвала (покупка, билет, отмена записи) — ссылка
    // «Версия для слабовидящих» первой строкой страницы, иначе режим там не включить
    if(!nav&&!ml&&!rq&&document.body){ var sp=document.createElement('p'); sp.className='a11y-solo'; var sa=document.createElement('a'); sa.href='#'; sa.className='a11y-foot-link'; sa.textContent=T.link; sa.addEventListener('click',toggle); sp.appendChild(sa); document.body.insertBefore(sp,document.body.firstChild); }
    apply('',1);
    window.addEventListener('load',function(){ if(st.on) fixPx(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
 } catch(e) { /* режим для слабовидящих не должен ломать остальной main.js */ }
})();
