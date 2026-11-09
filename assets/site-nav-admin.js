/* AELITA PRODUCTION · меню, подвал, контакты и подборки главной (pack-v754) — админка /admin/site-nav/.
   Сервер — POST /admin/site-edit, действия nav_* и home_* (_tools/Admin/site-nav). Вход — сессия
   основной админки в этой вкладке. После публикации меню страница сама раскладывает его по сайту
   пачками (nav_sync), показывая ход; повтор безопасен. */
(function () {
  'use strict';
  const API = 'https://api.aelita-production.ru/admin/site-edit';
  const $ = (id) => document.getElementById(id);
  const ERR = {
    invalid_media_view:'Проверьте положение кадра (0–100%) и мобильное изображение.',invalid_cover_base:'Шаблон карточки изменён. Обновите страницу редактора и проверьте актуальный образ сайта.',
    editor_reload_required: 'Редактор обновлён. Скачайте черновик и перезагрузите страницу перед продолжением.',
    not_authenticated: 'Войдите в админку снова.', site_nav_disabled: 'Раздел ещё не включён на сервере (нужен SITE_EDITOR_ENABLED=1 или PAGE_BUILDER_ENABLED=1 у aelita-admin-site-edit).',
    editor_not_configured: 'Не настроено подключение к репозиторию сайта.', invalid_field: 'Проверьте отмеченное поле.',
    linked_page_missing: 'Ссылка ведёт на страницу, которой нет на сайте.', linked_page_no_en: 'У этой страницы нет английской версии — в меню её поставить нельзя (на английских страницах ссылка вела бы в никуда).',
    draft_changed: 'Черновик изменён во время проверки. Новая правка сохранена в форме — проверьте макет ещё раз.',
    cover_slot_missing: 'Этой карточки сейчас нет в выбранном назначении RU/EN. Выберите актуальную карточку из списка.',
    cover_slot_ambiguous: 'Карточки неоднозначны, различаются в RU/EN или используют неподдерживаемую разметку фото. Публикация остановлена; нужна сверка карточек.',
    afisha_layout_missing: 'Нет полной пары страниц афиши RU/EN. Изменение обложек остановлено; прежняя версия сохранена.',
    image_missing: 'Фото не найдено на сайте — выберите из списка или загрузите.', unused_image: 'Загруженное фото не используется — выберите его заново.',
    site_nav_missing: 'На сайте ещё нет файла меню — выложите пак v754 или новее.', home_missing: 'На сайте ещё нет файла подборок главной — выложите пак v754 или новее.',
    invalid_nav_file: 'Файл меню на сайте повреждён или изменён вручную — нужна сверка.', invalid_home_file: 'Файл подборок главной на сайте повреждён или изменён вручную — нужна сверка.',
    layout_changed: 'Разметка главной изменена вручную — публикация остановлена, нужна сверка.',
    content_conflict: 'Сайт изменился после проверки. Черновик сохранён; проверьте макет ещё раз — новые изменения будут сверены.', preview_required: 'Сначала проверьте свежий макет.', preview_expired: 'Проверка устарела (10 минут). Проверьте макет ещё раз.',
    publication_unknown: 'Ответ на публикацию потерян. Обновите страницу и проверьте, сохранилась ли правка.', github_unreachable: 'Нет связи с сервером публикации. Проверьте интернет и повторите.',
    github_rejected: 'Сервис публикации отклонил запрос. Проверьте настройки репозитория.', github_limited: 'Сервис публикации временно ограничил запросы. Повторите через минуту.',
    bad_image: 'Подойдёт JPG, PNG или WebP до 20 МБ.', image_too_large: 'Не удалось уменьшить фото до 512 КБ — выберите другое.', too_many_images: 'За одну публикацию — до трёх новых фото.', item_not_in_revision: 'В этой версии файла ещё нет.',
  };
  // Схемы строк: поля и подписи. k — путь в объекте («ru.title»).
  const ROWS = {
    menu: { max: 9, min: 2, fields: [['href', 'Адрес', '/tickets'], ['ru', 'Название RU'], ['en', 'Label EN']] },
    mobile: { max: 12, min: 2, fields: [['href', 'Адрес', '/faq'], ['ru', 'Название RU'], ['en', 'Label EN']] },
    socials: { max: 8, min: 0, fields: [['url', 'Адрес', 'https://…'], ['ru', 'Название RU'], ['en', 'Label EN']] },
    links: { max: 8, min: 1, fields: [['href', 'Адрес', '/team'], ['ru', 'Название RU'], ['en', 'Label EN']] },
    projects: { max: 8, min: 1, fields: [['href', 'Ссылка', '/iov'], ['image', 'Фото', '/images/…', 'image'], ['position', 'Кадрирование', '50% 50%'], ['ru.title', 'Название RU'], ['ru.kicker', 'Жанр RU'], ['ru.alt', 'Описание фото RU'], ['en.title', 'Title EN'], ['en.kicker', 'Genre EN'], ['en.alt', 'Photo description EN']] },
    team: { max: 12, min: 1, fields: [['href', 'Ссылка', '/katya-abdulova'], ['image', 'Фото', '/images/…', 'image'], ['ru.name', 'Имя RU'], ['en.name', 'Name EN']] },
    covers: { max: 8, min: 0, fields: [['href', 'Событие в ближайших показах', '', 'slot'], ['image', 'Изображение только этой карточки', '/images/…', 'image'], ['altRu', 'Описание изображения RU'], ['altEn', 'Photo description EN']] },
    afishaCovers: { max: 8, min: 0, fields: [['slot', 'Карточка афиши', '', 'afisha-slot'], ['image', 'Изображение только в афише', '/images/…', 'image'], ['altRu', 'Описание изображения RU'], ['altEn', 'Photo description EN']] },
    partners: { max: 16, min: 1, fields: [['href', 'Ссылка (необязательно)', '/byl или https://…'], ['ru.name', 'Название RU'], ['ru.note', 'Подпись RU (необязательно)'], ['en.name', 'Name EN'], ['en.note', 'Note EN']] },
  };
  const S = { head: '', baseHeads: { nav: '', home: '' }, edit: 0, coverSlots: [], afishaSlots: [], previewPage: 'home', previewWidth: 390, merging: null, nav: null, home: null, tab: 'nav', preview: null, previewLang: 'ru', busy: false, assets: new Map(), batch: 25 };

  const token = () => { try { return localStorage.getItem('aelita_admin_token'); } catch { return null; } };
  const status = (t, bad) => { const s = $('sn-status'); s.textContent = t || ''; s.className = bad ? 'ed-error' : ''; };
  function gate() { $('sn-gate').hidden = false; $('sn-tabs').hidden = true; $('sn-nav').hidden = true; $('sn-home').hidden = true; }
  async function api(body) {
    body = { ...body, reviewVersion: body.action?.startsWith('home_') ? 4 : 3 };
    const t = token(); if (!t) { gate(); throw { code: 'not_authenticated' }; }
    let r; try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t }, cache: 'no-store', body: JSON.stringify(body) }); } catch { throw { code: 'github_unreachable' }; }
    let d; try { d = await r.json(); } catch { throw { code: 'github_unreachable' }; }
    if (r.status === 401) gate();
    if (!r.ok || d.error) throw { code: d.error || 'site_nav_failed', field: d.field };
    return d;
  }
  const msg = (e) => window.AelitaMediaOriginals?.message(e) || ERR[e && e.code] || 'Не получилось: ' + ((e && e.code) || 'неизвестная ошибка');
  const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
  function set(o, k, v) { const ps = k.split('.'); let x = o; for (const p of ps.slice(0, -1)) x = x[p] = x[p] || {}; x[ps.at(-1)] = v; }

  // ── редактор списков
  function imageSource(value){const a=S.images?.get(String(value).replace(/^asset:/,''))||S.assets?.get(String(value).replace(/^asset:/,''));return a?'data:'+a.type+';base64,'+a.data:value||'';}
  function assignmentView(item) {
    return {mode:item.mode||'cover',...(!item.image?{position:'50% 50%'}:{}),...Object.fromEntries(['mode','position','mobileImage','mobileMode','mobilePosition'].filter(k=>item[k]!==undefined).map(k=>[k,item[k]]))};
  }
  function row(kind, item, box) {
    const div = document.createElement('div'); div.className = 'sn-row sn-' + kind;
    const assignment = ['covers','afishaCovers'].includes(kind);
    div.assignmentHref = item.href || '';
    const slots = () => kind === 'afishaCovers' ? S.afishaSlots : S.coverSlots;
    for (const [k, label, ph, type] of ROWS[kind].fields) {
      const l = document.createElement('label'); l.textContent = label;
      const isSlot = type === 'slot' || type === 'afisha-slot';
      const inp = document.createElement(type === 'mode' || isSlot ? 'select' : 'input'); inp.className = 'ym-disable-keys'; inp.dataset.k = k; inp.maxLength = k === 'href' || k === 'url' ? 300 : k.startsWith('alt') ? 500 : 160; if (ph) inp.placeholder = ph;
      if (type === 'mode') { inp.add(new Option('Показать целиком', 'whole')); inp.add(new Option('Заполнить рамку', 'cover')); }
      if (isSlot) {
        inp.add(new Option('Выберите событие', ''));
        for (const x of slots()) { const option = new Option(x.title + (x.ambiguous ? ' — неоднозначная карточка' : x.unsupported ? ' — неподдерживаемая разметка фото' : ''), x.slot || x.href); option.disabled = !!(x.ambiguous||x.unsupported); inp.add(option); }
        const matching = slots().filter(x=>!x.ambiguous && !x.unsupported && x.href===item.href);
        const value = item.slot || (matching.length===1 ? matching[0].slot || item.href : item.href) || '';
        if(value && !slots().some(x=>(x.slot||x.href)===value)) inp.add(new Option('Сейчас отсутствует: ' + (item.href || value),value));
        inp.value = value;
        inp.onchange = () => {
          const slot = slots().find(x=>(x.slot||x.href)===inp.value);
          const image = div.querySelector('[data-k="image"]');
          if(slot && image && !image.value && slot.image.startsWith('/images/')) { image.value=slot.image; image.dispatchEvent(new Event('input',{bubbles:true})); }
          if(slot) div.assignmentHref = slot.href;
          changed(); quality?.update();
        };
      }
      if(!isSlot) inp.value = get(item, k) || (type === 'mode' ? 'whole' : '');
      if (type === 'image') {
        inp.setAttribute('list', 'sn-images'); const wrap = document.createElement('span'); wrap.className = 'sn-img'; wrap.appendChild(inp);
        const up = document.createElement('label'); up.className = 'ed-upload ed-quiet'; up.textContent = 'Загрузить';
        const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/jpeg,image/png,image/webp'; f.onchange = () => upload(f, inp); up.appendChild(f); wrap.appendChild(up);
        l.appendChild(wrap);
        const originalHolder=document.createElement('div');l.append(originalHolder);
        const refresh=()=>{originalHolder.replaceChildren();const value=inp.value;window.AelitaMediaOriginals.controls(originalHolder,{api,value,resolve:imageSource,progress:status,isCurrent:()=>inp.isConnected&&inp.value===value,onChoose:async file=>{const next=await preparePhoto(file,()=>inp.isConnected);inp.value=next;inp.dispatchEvent(new Event('input',{bubbles:true}));}});};
        inp.addEventListener('input',refresh);refresh();

      } else l.appendChild(inp);
      div.appendChild(l);
    }
    let quality;
    if(assignment||['projects','team'].includes(kind)){
      const view=assignment?assignmentView(item):item.view;
      const matching=assignment?slots().filter(x=>item.slot?x.slot===item.slot:x.href===item.href):[];
      div.mediaControl=window.AelitaMediaView.mount(div,view,{resolve:imageSource,forceMode:assignment,defaultPosition:item.position||(matching.length===1?matching[0].position:undefined),onChange:()=>{changed();quality?.update();},imageList:'sn-images',api,progress:status,isCurrent:()=>div.isConnected,
        onMobileFile:async file=>{const result=await preparePhoto(file,()=>div.isConnected);return result;},onError:e=>status(msg(e),true)});
    }
    if((assignment||['projects','team'].includes(kind))&&window.AelitaImageQuality){
      const source=()=>div.querySelector('[data-k="image"]').value.trim();
      const resolve=value=>{const a=S.assets.get(String(value).replace(/^asset:/,''));return a?'data:'+a.type+';base64,'+a.data:value;};
      const usage=()=>{if(!assignment)return kind==='team'?'homeTeam':'homeProject';const value=div.querySelector('select[data-k]')?.value;const selected=slots().find(x=>(x.slot||x.href)===value);return kind==='afishaCovers'?(selected?.single?'afishaSingle':'afishaCard'):(selected?.single?'homeUpcomingSingle':'homeUpcoming');};
      quality=window.AelitaImageQuality.mountVariants(div,{usage,target:'desktop',source:()=>resolve(source()),resolve,view:()=>div.mediaControl?.get()||{},isCurrent:()=>div.isConnected});
      div.querySelector('[data-k="image"]').addEventListener('input',()=>quality.update());
    }
    const tools = document.createElement('div'); tools.className = 'sn-tools';
    for (const [t, title, fn] of [['↑', 'Выше', () => div.previousElementSibling && box.insertBefore(div, div.previousElementSibling)], ['↓', 'Ниже', () => div.nextElementSibling && box.insertBefore(div.nextElementSibling, div)], ['Убрать', 'Убрать', () => { if (box.children.length > ROWS[kind].min) div.remove(); else status('Здесь нужен хотя бы один пункт.', true); }]]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ed-quiet'; b.textContent = t; b.title = title; b.setAttribute('aria-label', title); b.onclick = () => { fn(); changed(); }; tools.appendChild(b);
    }
    if(assignment) {
      const restore=document.createElement('button');restore.type='button';restore.className='ed-quiet';restore.dataset.historyAssignment='true';restore.textContent='История этой обложки';
      restore.onclick=()=>{const value=div.querySelector('select[data-k]')?.value,selected=slots().find(x=>(x.slot||x.href)===value);if(!value)return status('Сначала выберите карточку.',true);history('home',{field:kind,slot:selected?.slot||item.slot||null,href:selected?.href||div.assignmentHref});};
      tools.appendChild(restore);
    }
    div.appendChild(tools); box.appendChild(div);quality?.update();
  }
  function list(box, kind, items) { box.innerHTML = ''; box.dataset.kind = kind; (items || []).forEach((x) => row(kind, x, box)); }
  function read(box) {
    const kind = box.dataset.kind;
    return [...box.children].map((div) => {
      const o = {};
      for (const inp of div.querySelectorAll('input[data-k], select[data-k]')) { const v = inp.value.trim(); if (v) set(o, inp.dataset.k, v); }
      if(div.mediaControl){const view=div.mediaControl.get();if(['covers','afishaCovers'].includes(kind))Object.assign(o,view||{mode:'cover'});else if(view)o.view=view;}
      if(['covers','afishaCovers'].includes(kind)) {
        const selected=kind==='covers'?o.href:o.slot;
        const slots=kind==='covers'?S.coverSlots:S.afishaSlots;
        const matches=slots.filter(x=>(x.slot||x.href)===selected);
        if(matches.length===1) { o.href=matches[0].href; if(matches[0].slot)o.slot=matches[0].slot; }
        else if(kind==='afishaCovers')o.href=div.assignmentHref;
        else if(selected?.startsWith('event:')||selected?.startsWith('performance:')||selected?.startsWith('page:')){o.slot=selected;o.href=div.assignmentHref;}
      }
      if (kind === 'partners') { o.ru = o.ru || {}; o.en = o.en || {}; }
      if (['projects', 'team'].includes(kind)) { o.ru = o.ru || {}; o.en = o.en || {}; }
      return o;
    }).filter((o) => JSON.stringify(o) !== '{"ru":{},"en":{}}' && JSON.stringify(o) !== '{}');
  }
  function add(box) { const kind = box.dataset.kind; if (box.children.length >= ROWS[kind].max) return status('Больше нельзя: до ' + ROWS[kind].max + '.', true); row(kind, {}, box); changed(); }

  // ── колонки подвала
  function col(c) {
    const sec = document.createElement('div'); sec.className = 'sn-col';
    sec.innerHTML = '<div class="pb-two"><label>Заголовок RU<input class="ym-disable-keys" data-c="ru" maxlength="40"></label><label>Title EN<input class="ym-disable-keys" data-c="en" maxlength="40"></label></div><label class="sn-check"><input type="checkbox" data-c="home"> Первой ссылкой — «Главная»</label><div class="sn-links"></div><div class="ed-actions"><button type="button" class="ed-quiet" data-a="add">Добавить ссылку</button><button type="button" class="ed-quiet" data-a="up">Колонку левее</button><button type="button" class="ed-quiet" data-a="rm">Убрать колонку</button></div>';
    sec.querySelector('[data-c=ru]').value = c.ru || ''; sec.querySelector('[data-c=en]').value = c.en || ''; sec.querySelector('[data-c=home]').checked = !!c.home;
    const links = sec.querySelector('.sn-links'); list(links, 'links', c.links || [{}]);
    sec.querySelector('[data-a=add]').onclick = () => add(links);
    sec.querySelector('[data-a=up]').onclick = () => { if (sec.previousElementSibling) $('sn-cols').insertBefore(sec, sec.previousElementSibling); changed(); };
    sec.querySelector('[data-a=rm]').onclick = () => { if ($('sn-cols').children.length > 1) { sec.remove(); changed(); } };
    sec.querySelector('[data-c=home]').onchange = () => { if (sec.querySelector('[data-c=home]').checked) document.querySelectorAll('#sn-cols [data-c=home]').forEach((x) => { if (!sec.contains(x)) x.checked = false; }); changed(); };
    $('sn-cols').appendChild(sec);
  }

  // ── форма ↔ данные
  const box = (name) => document.querySelector('[data-list="' + name + '"]');
  function fillNav(n) {
    list(box('menu'), 'menu', n.menu); list(box('mobile'), 'mobile', n.mobile); list(box('socials'), 'socials', n.contacts.socials);
    $('sn-account-ru').value = n.account.ru; $('sn-account-en').value = n.account.en;
    $('sn-phone').value = n.contacts.phone; $('sn-email').value = n.contacts.email;
    $('sn-cols').innerHTML = ''; n.footer.forEach(col);
  }
  function collectNav() {
    return {
      schema: S.nav.schema, revision: S.nav.revision,
      menu: read(box('menu')), mobile: read(box('mobile')),
      account: { href: S.nav.account.href, ru: $('sn-account-ru').value.trim(), en: $('sn-account-en').value.trim() },
      contacts: { phone: $('sn-phone').value.trim(), email: $('sn-email').value.trim(), socials: read(box('socials')) },
      footer: [...$('sn-cols').children].map((sec) => ({ ru: sec.querySelector('[data-c=ru]').value.trim(), en: sec.querySelector('[data-c=en]').value.trim(), ...(sec.querySelector('[data-c=home]').checked ? { home: true } : {}), links: read(sec.querySelector('.sn-links')) })),
    };
  }
  const FEAT = ['label', 'title', 'text', 'dates', 'place', 'button', 'alt'];
  function fillHome(h) {
    list(box('covers'), 'covers', h.covers || []);
    list(box('afishaCovers'), 'afishaCovers', h.afishaCovers || []);
    $('sn-f-href').value = h.feature.href; $('sn-f-image').value = h.feature.image;
    $('sn-feature-view')?.remove();const holder=document.createElement('div');holder.id='sn-feature-view';$('sn-f-image').closest('label').after(holder);
    const featureInput=$('sn-f-image'),originalHolder=document.createElement('div');holder.append(originalHolder);const refreshOriginal=()=>{originalHolder.replaceChildren();const value=featureInput.value;window.AelitaMediaOriginals.controls(originalHolder,{api,value,resolve:imageSource,progress:status,isCurrent:()=>holder.isConnected&&featureInput.value===value,onChoose:async file=>{const next=await preparePhoto(file,()=>holder.isConnected);featureInput.value=next;featureInput.dispatchEvent(new Event('input',{bubbles:true}));changed();}});};featureInput.oninput=refreshOriginal;refreshOriginal();
    let featureQuality;
    S.featureView=window.AelitaMediaView.mount(holder,h.feature.view,{resolve:imageSource,onChange:()=>{changed();featureQuality?.update();},imageList:'sn-images',api,progress:status,isCurrent:()=>holder.isConnected,onMobileFile:file=>preparePhoto(file,()=>holder.isConnected),onError:e=>status(msg(e),true)});

    if(window.AelitaImageQuality){
      const resolve=value=>{const a=S.assets.get(String(value).replace(/^asset:/,''));return a?'data:'+a.type+';base64,'+a.data:value;};
      featureQuality=window.AelitaImageQuality.mountVariants(holder,{usage:'homeFeature',target:'desktop',source:()=>resolve(featureInput.value.trim()),resolve,view:()=>S.featureView?.get()||{},isCurrent:()=>holder.isConnected});
      featureInput.oninput=()=>{refreshOriginal();featureQuality.update();};
    }

    for (const L of ['ru', 'en']) for (const k of FEAT) $('sn-f-' + L + '-' + k).value = h.feature[L][k] || '';
    list(box('projects'), 'projects', h.projects); list(box('team'), 'team', h.team); list(box('partners'), 'partners', h.partners);
  }
  function collectHome() {
    const t = (L) => Object.fromEntries(FEAT.map((k) => [k, $('sn-f-' + L + '-' + k).value.trim()]));
    const covers = read(box('covers'));
    const afishaCovers = read(box('afishaCovers'));
    return { schema: S.home.schema, revision: S.home.revision, ...(covers.length || 'covers' in S.home ? { covers } : {}), ...(afishaCovers.length || 'afishaCovers' in S.home ? {afishaCovers} : {}), feature: { href: $('sn-f-href').value.trim(), image: $('sn-f-image').value.trim(), ...(S.featureView?.get()?{view:S.featureView.get()}:{}), ru: t('ru'), en: t('en') }, projects: read(box('projects')), team: read(box('team')), partners: read(box('partners')) };
  }
  /** Загруженные фото: в форме — «asset:<hash>», на сервер уходят только используемые. */
  function homeBody(action, home = collectHome()) {
    const used=new Set(),uses=x=>{if(!x)return;for(const key of ['image','mobileImage'])if(typeof x[key]==='string'&&x[key].startsWith('asset:'))used.add(x[key].slice(6));if(x.view)uses(x.view);};
    uses(home.feature);home.projects.forEach(uses);home.team.forEach(uses);(home.covers||[]).forEach(uses);(home.afishaCovers||[]).forEach(uses);
    const assets = [...used].map((h) => S.assets.get(h)).filter(Boolean).map(({ type, data }) => ({ type, data }));
    return { action, home, revision: home.revision, ...(assets.length ? { assets } : {}) };
  }
  let dirty = false;
  function changed() { S.preview = null; S.edit++; dirty = true; }

  // ── фото
  async function sha256(b64) { const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const h = await crypto.subtle.digest('SHA-256', bin); return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join(''); }
  async function compress(file) {
    if (!file || file.size > 20 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw { code: 'bad_image' };
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej({ code: 'bad_image' }); im.src = url; });
      if(img.width>20000||img.height>20000||img.width*img.height>40000000)throw{code:'image_dimensions'};
      let side = 1800, q = 0.86, blob;
      for (let j = 0; j < 8; j++) {
        const c = document.createElement('canvas'), k = Math.min(1, side / Math.max(img.width, img.height));
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
        if (blob && blob.size <= 512 * 1024) break;
        side = Math.floor(side * 0.78); q = Math.max(0.55, q - 0.08);
      }
      if (!blob || blob.size > 512 * 1024) throw { code: 'image_too_large' };
      const bytes = new Uint8Array(await blob.arrayBuffer()); let raw = '';
      for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { type: 'image/jpeg', data: btoa(raw) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function preparePhoto(file,isCurrent=()=>true){
    S.uploading=(S.uploading||0)+1;changed();status('Готовим фото и сохраняем исходник…');
    try{const a=await compress(file);if(!isCurrent())throw{code:'superseded'};await window.AelitaMediaOriginals.save(file,a,api,status,isCurrent);if(!isCurrent())throw{code:'superseded'};const h=await sha256(a.data);S.assets.set(h,a);status('Исходник сохранён. Подготовленное фото — в черновике.');return 'asset:'+h;}
    finally{S.uploading--;}
  }
  async function upload(fileInput,target){
    const f=fileInput.files[0];fileInput.value='';if(!f)return;
    try{const value=await preparePhoto(f,()=>target.isConnected);target.value=value;target.dispatchEvent(new Event('input',{bubbles:true}));changed();status('Фото готово. Исходник сохранён отдельно.');}
    catch(e){if(e.code!=='superseded')status(msg(e),true);}
  }

  // ── загрузка
  async function load() {
    status('Загружаем…');
    const d = await api({ action: 'nav_get' });
    S.coverSlots = d.coverSlots || []; S.afishaSlots = d.afishaSlots || []; S.batch = d.batch || 25; S.head = d.head || ''; S.baseHeads.nav = S.head; S.baseHeads.home = S.head; $('sn-draft-tools').hidden = false;
    $('sn-images').innerHTML = ''; for (const src of d.images || []) { const o = document.createElement('option'); o.value = src; $('sn-images').appendChild(o); }
    $('sn-gate').hidden = true; $('sn-tabs').hidden = false;
    if (!d.nav) status(ERR.site_nav_missing, true); else { S.nav = d.nav; fillNav(d.nav); }
    if (!d.home) status(ERR.home_missing, true); else { S.home = d.home; fillHome(d.home); }
    if (d.nav && d.home) status('');
    dirty = false; tab(S.tab);
  }
  function tab(t) {
    S.tab = t;
    document.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', on); b.classList.toggle('ed-quiet', !on); });
    $('sn-nav').hidden = t !== 'nav' || !S.nav; $('sn-home').hidden = t !== 'home' || !S.home;
  }

  // ── проверка и публикация
  function markField(field) {
    document.querySelectorAll('.pb-bad').forEach((x) => x.classList.remove('pb-bad'));
    if (!field) return;
    const p = field.split('.'); let el = null;
    if (S.tab === 'nav') {
      if (['menu', 'mobile'].includes(p[0])) el = box(p[0]).children[+p[1]]?.querySelector('[data-k="' + p[2] + '"]');
      else if (p[0] === 'account') el = $('sn-account-' + (p[1] === 'en' ? 'en' : 'ru'));
      else if (p[0] === 'contacts') el = p[1] === 'socials' ? box('socials').children[+p[2]]?.querySelector('[data-k="' + p[3] + '"]') : $('sn-' + p[1]);
      else if (p[0] === 'footer') { const sec = $('sn-cols').children[+p[1]]; el = sec && (p[2] === 'links' ? sec.querySelector('.sn-links').children[+p[3]]?.querySelector('[data-k="' + p[4] + '"]') : sec.querySelector('[data-c="' + (p[2] || 'ru') + '"]')); }
    } else if (p[0] === 'feature') el = $(p.length === 2 ? 'sn-f-' + p[1] : 'sn-f-' + p[1] + '-' + p[2]);
    else if (['projects', 'team', 'partners','covers','afishaCovers'].includes(p[0])) el = box(p[0]).children[+p[1]]?.querySelector('[data-k="' + p.slice(2).join('.') + '"]');
    if (el) { el.classList.add('pb-bad'); el.focus(); }
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const content = (x) => { const out = clone(x); delete out.revision; return out; };
  function fill(kind, data) { if (kind === 'nav') fillNav(data); else fillHome(data); }
  function downloadDraft() {
    const kind = S.tab;
    if (!S[kind]) return;
    const mine = kind === 'nav' ? collectNav() : collectHome();
    const draft = { format: 'aelita-shared-draft/v1', kind, base: S[kind], mine, baseCommit: S.baseHeads[kind], assets: [...S.assets.values()].map(a => ({ type: a.type, data: a.data })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'aelita-' + kind + '-draft.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importDraft(file) {
    if (!file) return;
    let previous = null; const edit = S.edit;
    try {
      if (file.size > 4 * 1024 * 1024) throw 0;
      const d = JSON.parse(await file.text());
      AelitaContentReconcile.validate(d);
      if (d.format !== 'aelita-shared-draft/v1' || !['nav', 'home'].includes(d.kind) || !d.base || !d.mine || !Number.isSafeInteger(d.base.revision) || d.base.revision < 0 || d.base.schema !== S[d.kind]?.schema || d.mine.schema !== d.base.schema || !Array.isArray(d.assets) || d.assets.length > 3) throw 0;
      // An AI proposal must be based on an actual exported Git version,
      // not a guessed revision or a seed document from an old pack.
      if (!/^[a-f0-9]{40}$/.test(d.baseCommit || '')) throw 0;
      const original = await api({ action: 'nav_revision', kind: d.kind, commit: d.baseCommit });
      if (!AelitaContentReconcile.equal(original[d.kind], d.base)) throw 0;
      const assets = new Map();
      for (const a of d.assets) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(a.type) || typeof a.data !== 'string' || a.data.length > 700000) throw 0;
        assets.set(await sha256(a.data), { type: a.type, data: a.data });
      }
      if (edit !== S.edit) throw 0;
      previous = { kind: d.kind, data: d.kind === 'nav' ? collectNav() : collectHome(), assets: S.assets, base: S[d.kind], baseHead: S.baseHeads[d.kind] };
      S.assets = assets; fill(d.kind, d.mine); S[d.kind] = clone(d.base);
      S.baseHeads[d.kind] = /^[a-f0-9]{40}$/.test(d.baseCommit || '') ? d.baseCommit : '';
      tab(d.kind); changed(); status('Черновик загружен с исходной версией. «Проверить макет» сверит его с текущим сайтом.');
    } catch { if (previous) { S.assets=previous.assets; S[previous.kind]=previous.base; S.baseHeads[previous.kind]=previous.baseHead; fill(previous.kind, previous.data); } status('Не удалось загрузить черновик: файл не подходит или форма уже изменилась. Текущая форма сохранена.', true); }
  }
  function conflictText(v, present) {
    if (!present) return 'Поле отсутствует';
    const t = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    return t.length > 6000 ? t.slice(0, 6000) + '\n… Полный вариант есть в черновике.' : t;
  }
  function showConflicts(kind, fresh, result, baseCommit) {
    S.preview = null; S.merging = { kind, fresh: clone(fresh), baseCommit, result, selected: new Set() };
    const box = $('sn-conflict-list'); box.replaceChildren(); $('sn-conflict-apply').disabled = true;
    for (const [i, c] of result.conflicts.entries()) {
      const card = document.createElement('section'); card.className = 'ed-card';
      const title = document.createElement('h3'); title.textContent = c.path.join(' → ') || 'Весь раздел'; card.appendChild(title);
      const columns = document.createElement('div'); columns.className = 'sn-conflict-columns';
      for (const [side, label] of [['current', 'На сайте сейчас'], ['mine', 'Мой черновик']]) {
        const col = document.createElement('div'), heading = document.createElement('h4'), pre = document.createElement('pre'), button = document.createElement('button');
        heading.textContent = label; pre.textContent = conflictText(c[side], c[side + 'Present']);
        button.type = 'button'; button.className = 'ed-quiet'; button.textContent = side === 'mine' ? 'Выбрать мой вариант' : 'Оставить на сайте'; button.setAttribute('aria-pressed', 'false');
        button.onclick = () => {
          const m = S.merging; m.result.value = AelitaContentReconcile.choose(m.result.value, c, side); m.selected.add(i);
          card.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === button ? 'true' : 'false'));
          $('sn-conflict-apply').disabled = m.selected.size !== m.result.conflicts.length;
        };
        col.append(heading, pre, button); columns.appendChild(col);
      }
      card.appendChild(columns); box.appendChild(card);
    }
    $('sn-conflicts').showModal(); status('Одни поля изменены с обеих сторон. Выберите вариант каждого конфликта; публикации не было.', true);
  }
  function acceptConflicts() {
    const m = S.merging;
    if (!m || m.selected.size !== m.result.conflicts.length) return;
    const next = { ...m.result.value, revision: m.fresh.revision };
    fill(m.kind, next); S[m.kind] = m.fresh; S.baseHeads[m.kind] = m.baseCommit || S.baseHeads[m.kind]; S.merging = null;
    $('sn-conflicts').close(); changed(); status('Совместный черновик готов. Проверьте макет — сайт будет сверён ещё раз перед публикацией.');
  }
  async function check(kind, e) {
    e.preventDefault();
    if(S.uploading)return status('Дождитесь сохранения исходника.',true);
    if (S.busy) return; S.busy = true; S.preview = null; markField(null); status('Сверяем черновик с текущим сайтом…');
    try {
      const edit = S.edit;
      const mine = kind === 'nav' ? collectNav() : collectHome();
      const fresh = await api({ action: 'nav_get' });
      if (edit !== S.edit) throw { code: 'draft_changed' };
      const current = fresh[kind];
      if (!current) throw { code: kind === 'nav' ? 'site_nav_missing' : 'home_missing' };
      if (current.schema !== S[kind].schema) throw { code: 'content_conflict' };
      const result = AelitaContentReconcile.merge(content(S[kind]), content(mine), content(current));
      if (result.conflicts.length) { showConflicts(kind, current, result, fresh.head); return; }
      const merged = { ...result.value, revision: current.revision };
      const body = kind === 'nav' ? { action: 'nav_preview', nav: merged, revision: current.revision } : homeBody('home_preview', merged);
      const d = await api(body);
      if (edit !== S.edit) throw { code: 'draft_changed' };
      // Only an actually reconciled draft may adopt a new baseline. A fresh
      // revision number alone must never make an old form current.
      S.coverSlots = fresh.coverSlots || S.coverSlots; S.afishaSlots = fresh.afishaSlots || S.afishaSlots; S[kind] = clone(current); S.baseHeads[kind] = fresh.head || S.baseHeads[kind]; fill(kind, merged);
      S.previewPage = kind==='home' && !AelitaContentReconcile.equal(merged.afishaCovers,current.afishaCovers) && d.afisha ? 'afisha' : 'home';
      S.preview = { kind, body, ...d }; S.previewLang = 'ru'; showPreview();
      $('sn-affected').textContent = (kind === 'nav' ? 'Меню, подвал и контакты обновятся на всех страницах сайта (' + (d.pages || 'все') + ') — после публикации раскладка займёт пару минут. Макет — страница «О компании».' : 'Обновятся выбранные назначения главной и афиши RU/EN. Проверьте обе страницы и мобильные кадры. Фото события, OG, видео и настройки продажи этой формой не меняются.') + ' Проверка действует 10 минут.';
      $('sn-review-error').textContent = ''; $('sn-publish').disabled = false; $('sn-review').showModal(); sizePreview(); status('Непересекающиеся изменения объединены. Проверьте совместный результат.');
    } catch (err) { status(msg(err), true); markField(err.field); }
    finally { S.busy = false; }
  }
  function showPreview() {
    const afisha = S.preview.kind==='home' && S.preview.afisha;
    $('sn-preview-pages').hidden = S.preview.kind!=='home';
    document.querySelectorAll('[data-preview-page]').forEach(b=>{const on=b.dataset.previewPage===(S.previewPage||'home');b.disabled=b.dataset.previewPage==='afisha'&&!afisha;b.setAttribute('aria-pressed',String(on));b.classList.toggle('ed-quiet',!on);});
    const page = S.previewPage==='afisha' && afisha ? afisha : S.preview;
    const html = page[S.previewLang];
    $('sn-frame').srcdoc = html || '<p style="font-family:sans-serif;color:#ccc">Английской версии этой страницы нет.</p>';
    document.querySelectorAll('[data-preview]').forEach((b) => b.classList.toggle('ed-quiet', b.dataset.preview !== S.previewLang));
    sizePreview();
  }
  function sizePreview() {
    const frame = $('sn-frame'), wrap = $('sn-frame-wrap');
    const width = S.previewWidth, scale = Math.min(1, wrap.clientWidth / width);
    frame.style.width = width + 'px'; frame.style.height = '820px'; frame.style.transform = 'scale(' + scale + ')'; wrap.style.height = (820 * scale) + 'px';
    document.querySelectorAll('[data-viewport]').forEach(b => { const on = Number(b.dataset.viewport) === width; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('ed-quiet', !on); });
  }
  async function publish() {
    if (!S.preview || S.busy) return; S.busy = true; $('sn-publish').disabled = true; $('sn-review-error').textContent = 'Публикуем…';
    const kind = S.preview.kind;
    try {
      const body = { ...S.preview.body, action: kind === 'nav' ? 'nav_publish' : 'home_publish', previewToken: S.preview.previewToken };
      const d = await api(body);
      $('sn-review').close(); S.preview = null; dirty = false;
      S[kind] = { ...(kind === 'nav' ? body.nav : body.home), revision: d.revision };
      if (kind === 'home') { await load(); status('Подборки и обложки обновлены (RU/EN). Сайт покажет изменения через 1–2 минуты.'); }
      else await sync();
    } catch (err) {
      const unknown = ['publication_unknown','github_unreachable'].includes(err.code);
      $('sn-review-error').textContent = unknown ? ERR.publication_unknown + ' Черновик сохранён; закройте макет и перечитайте сайт перед новой проверкой.' : msg(err);
      $('sn-publish').disabled = err.code !== 'github_limited';
      if (unknown || ['content_conflict', 'preview_expired', 'preview_required'].includes(err.code)) S.preview = null;
    } finally { S.busy = false; }
  }
  /** Раскладка меню по страницам: пачками, с повтором при сбое связи. */
  async function sync() {
    $('sn-sync').hidden = false; $('sn-nav').hidden = true; $('sn-tabs').hidden = true;
    let cursor = 0, changedPages = 0, fails = 0, total = 0;
    while (cursor !== null) {
      try {
        const d = await api({ action: 'nav_sync', cursor });
        total = d.total; changedPages += d.changed.length; cursor = d.next; fails = 0;
        $('sn-sync-bar').max = total; $('sn-sync-bar').value = cursor === null ? total : cursor;
        $('sn-sync-text').textContent = 'Готово ' + (cursor === null ? total : cursor) + ' из ' + total + ' страниц · обновлено ' + changedPages;
      } catch (e) {
        if (++fails >= 4 || !['github_unreachable', 'github_limited', 'content_conflict'].includes(e.code)) { $('sn-sync-text').textContent = msg(e) + ' Раскладка остановилась — нажмите «Разложить по страницам ещё раз».'; $('sn-tabs').hidden = false; tab('nav'); return; }
        await new Promise((r) => setTimeout(r, 1500 * fails));
      }
    }
    $('sn-sync-text').textContent = 'Меню, подвал и контакты разложены: ' + total + ' страниц, обновлено ' + changedPages + '. Сайт покажет изменения через 1–2 минуты.';
    $('sn-tabs').hidden = false; tab('nav');
  }
  function restoreAssignment(current, historical, target) {
    if(!['covers','afishaCovers'].includes(target.field)) throw {code:'invalid_field'};
    const copy=clone(current),rows=copy[target.field]||[],old=historical[target.field]||[];
    const match=c=>target.slot&&c.slot?c.slot===target.slot:c.href.replace(/^\/en(?=\/)/,'').replace(/\/$/,'')===target.href.replace(/\/$/,'');
    const chosen=old.filter(match);
    if(chosen.length>1||rows.filter(match).length>1)throw{code:'cover_slot_ambiguous'};
    const restored=chosen[0]?{...clone(chosen[0]),...(target.slot?{slot:target.slot}:{})}:null;
    const index=rows.findIndex(match);
    if(index>=0){if(restored)rows[index]=restored;else rows.splice(index,1);}else if(restored)rows.push(restored);
    if(target.field in copy||rows.length)copy[target.field]=rows;
    return copy;
  }
  async function history(kind, target = null) {
    const edit = S.edit;
    $('sn-history-title').textContent=target?'История выбранной обложки':'История всего раздела';
    $('sn-history-note').textContent=target?'Вернётся только эта обложка на выбранной странице, включая мобильный кадр и RU/EN. Другие назначения и тексты сохранятся. Затем нужны новый макет и публикация.':'Откроется весь прежний снимок раздела в форме. Чтобы вернуть только одну обложку, используйте «История этой обложки» у карточки. Публикация требует нового макета.';
    $('sn-history-list').innerHTML = ''; $('sn-history-status').textContent = 'Загружаем…'; $('sn-history-dialog').showModal();
    try {
      const d = await api({ action: 'nav_history', kind });
      $('sn-history-status').textContent = d.history.length ? '' : 'Истории пока нет.';
      for (const h of d.history) {
        const li = document.createElement('li');
        li.innerHTML = '<div><b></b><small></small></div><button type="button" class="ed-quiet">Открыть эту версию</button>';
        li.querySelector('b').textContent = new Date(h.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }); li.querySelector('small').textContent = h.message + (h.publication ? ' · '+h.publication.actor+' (общая сессия, имя сотрудника недоступно) · поля: '+h.publication.fields.join(', ')+' · назначения: '+h.publication.assignments.map(a=>a.surface+'/'+a.id).join(', ') : '');
        li.querySelector('button').onclick = async () => {
          try {
            const r = await api({ action: 'nav_revision', kind, commit: h.sha });
            if(edit!==S.edit)throw{code:'draft_changed'};
            const data = target ? restoreAssignment(collectHome(),r.home,target) : { ...r[kind], revision: S[kind].revision };
            if (kind === 'nav') fillNav(data); else fillHome(data);
            changed(); $('sn-history-dialog').close(); status('Загружена версия от ' + li.querySelector('b').textContent + '. Проверьте макет и опубликуйте, чтобы вернуть её.');
          } catch (e) { $('sn-history-status').textContent = msg(e); }
        };
        $('sn-history-list').appendChild(li);
      }
    } catch (e) { $('sn-history-status').textContent = msg(e); }
  }

  function start() {
    if (!token()) return gate();
    document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => tab(b.dataset.tab); });
    document.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => add(box(b.dataset.add)); });
    document.querySelectorAll('[data-history]').forEach((b) => { b.onclick = () => history(b.dataset.history); });
    document.querySelectorAll('[data-upload]').forEach((f) => { f.onchange = () => upload(f, $(f.dataset.upload)); });
    $('sn-team-founders').onclick = () => { const team=read(box('team')).filter(x=>['/katya-abdulova','/konstantin-moshnikov'].includes((x.href||'').replace(/\/$/,''))); if(team.length!==2)return status('Не найдены обе карточки основателей. Выберите их в списке.',true);list(box('team'),'team',team);changed();status('Остались Катя и Константин. Проверьте макет RU/EN и опубликуйте главную.'); };
    $('sn-menu-v760').onclick = () => {list(box('menu'),'menu',read(box('menu')).filter(x=>(x.href||'').replace(/\/$/,'')!=='/tochkacuire'));list(box('mobile'),'mobile',read(box('mobile')).filter(x=>!['/tochkacuire','/faq'].includes((x.href||'').replace(/\/$/,''))));changed();status('Меню подготовлено. Проверьте макет RU/EN и опубликуйте. Подвал и главный проект сохранены.');};
    $('sn-copy-menu').onclick = () => { list(box('mobile'), 'mobile', read(box('menu'))); changed(); };
    $('sn-col-add').onclick = () => { if ($('sn-cols').children.length < 4) { col({ ru: '', en: '', links: [{}] }); changed(); } };
    $('sn-resync').onclick = () => { if (!S.busy) sync(); };
    $('sn-nav').addEventListener('input', changed); $('sn-home').addEventListener('input', changed);
    $('sn-nav').addEventListener('submit', (e) => check('nav', e));
    $('sn-home').addEventListener('submit', (e) => check('home', e));
    $('sn-review-close').onclick = () => $('sn-review').close();
    $('sn-history-close').onclick = () => $('sn-history-dialog').close();
    document.querySelectorAll('[data-viewport]').forEach(b => { b.onclick = () => { S.previewWidth = Number(b.dataset.viewport); sizePreview(); }; });
    if (window.ResizeObserver) new ResizeObserver(sizePreview).observe($('sn-frame-wrap'));
    $('sn-publish').onclick = publish;
    $('sn-draft-download').onclick = downloadDraft;
    $('sn-draft-file').onchange = (e) => { const file = e.target.files[0]; e.target.value = ''; if (!S.busy) importDraft(file); };
    $('sn-conflict-close').onclick = () => { $('sn-conflicts').close(); S.merging = null; };
    $('sn-conflict-download').onclick = downloadDraft;
    $('sn-conflict-apply').onclick = acceptConflicts;
    document.querySelectorAll('[data-preview]').forEach((b) => { b.onclick = () => { S.previewLang = b.dataset.preview; showPreview(); }; });
    document.querySelectorAll('[data-preview-page]').forEach(b=>{b.onclick=()=>{S.previewPage=b.dataset.previewPage;showPreview();};});
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    load().catch((e) => status(msg(e), true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
