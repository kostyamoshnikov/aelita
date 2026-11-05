/* AELITA PRODUCTION · меню, подвал, контакты и подборки главной (pack-v754) — админка /admin/site-nav/.
   Сервер — POST /admin/site-edit, действия nav_* и home_* (_tools/Admin/site-nav). Вход — сессия
   основной админки в этой вкладке. После публикации меню страница сама раскладывает его по сайту
   пачками (nav_sync), показывая ход; повтор безопасен. */
(function () {
  'use strict';
  const API = 'https://api.aelita-production.ru/admin/site-edit';
  const $ = (id) => document.getElementById(id);
  const ERR = {
    not_authenticated: 'Войдите в админку снова.', site_nav_disabled: 'Раздел ещё не включён на сервере (нужен SITE_EDITOR_ENABLED=1 или PAGE_BUILDER_ENABLED=1 у aelita-admin-site-edit).',
    editor_not_configured: 'Не настроено подключение к репозиторию сайта.', invalid_field: 'Проверьте отмеченное поле.',
    linked_page_missing: 'Ссылка ведёт на страницу, которой нет на сайте.', linked_page_no_en: 'У этой страницы нет английской версии — в меню её поставить нельзя (на английских страницах ссылка вела бы в никуда).',
    image_missing: 'Фото не найдено на сайте — выберите из списка или загрузите.', unused_image: 'Загруженное фото не используется — выберите его заново.',
    site_nav_missing: 'На сайте ещё нет файла меню — выложите пак v754 или новее.', home_missing: 'На сайте ещё нет файла подборок главной — выложите пак v754 или новее.',
    invalid_nav_file: 'Файл меню на сайте повреждён или изменён вручную — нужна сверка.', invalid_home_file: 'Файл подборок главной на сайте повреждён или изменён вручную — нужна сверка.',
    layout_changed: 'Разметка главной изменена вручную — публикация остановлена, нужна сверка.',
    content_conflict: 'Сайт изменился, пока вы работали. Нажмите «Проверить макет» ещё раз.', preview_required: 'Сначала проверьте свежий макет.', preview_expired: 'Проверка устарела (10 минут). Проверьте макет ещё раз.',
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
    partners: { max: 16, min: 1, fields: [['href', 'Ссылка (необязательно)', '/byl или https://…'], ['ru.name', 'Название RU'], ['ru.note', 'Подпись RU (необязательно)'], ['en.name', 'Name EN'], ['en.note', 'Note EN']] },
  };
  const S = { nav: null, home: null, tab: 'nav', preview: null, previewLang: 'ru', busy: false, assets: new Map(), batch: 25 };

  const token = () => { try { return sessionStorage.getItem('aelita_admin_token'); } catch { return null; } };
  const status = (t, bad) => { const s = $('sn-status'); s.textContent = t || ''; s.className = bad ? 'ed-error' : ''; };
  function gate() { $('sn-gate').hidden = false; $('sn-tabs').hidden = true; $('sn-nav').hidden = true; $('sn-home').hidden = true; }
  async function api(body) {
    const t = token(); if (!t) { gate(); throw { code: 'not_authenticated' }; }
    let r; try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t }, cache: 'no-store', body: JSON.stringify(body) }); } catch { throw { code: 'github_unreachable' }; }
    let d; try { d = await r.json(); } catch { throw { code: 'github_unreachable' }; }
    if (r.status === 401) gate();
    if (!r.ok || d.error) throw { code: d.error || 'site_nav_failed', field: d.field };
    return d;
  }
  const msg = (e) => ERR[e && e.code] || 'Не получилось: ' + ((e && e.code) || 'неизвестная ошибка');
  const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
  function set(o, k, v) { const ps = k.split('.'); let x = o; for (const p of ps.slice(0, -1)) x = x[p] = x[p] || {}; x[ps.at(-1)] = v; }

  // ── редактор списков
  function row(kind, item, box) {
    const div = document.createElement('div'); div.className = 'sn-row sn-' + kind;
    for (const [k, label, ph, type] of ROWS[kind].fields) {
      const l = document.createElement('label'); l.textContent = label;
      const inp = document.createElement('input'); inp.className = 'ym-disable-keys'; inp.dataset.k = k; inp.maxLength = k === 'href' || k === 'url' ? 300 : 160; if (ph) inp.placeholder = ph;
      inp.value = get(item, k) || '';
      if (type === 'image') {
        inp.setAttribute('list', 'sn-images'); const wrap = document.createElement('span'); wrap.className = 'sn-img'; wrap.appendChild(inp);
        const up = document.createElement('label'); up.className = 'ed-upload ed-quiet'; up.textContent = 'Загрузить';
        const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/jpeg,image/png,image/webp'; f.onchange = () => upload(f, inp); up.appendChild(f); wrap.appendChild(up);
        l.appendChild(wrap);
      } else l.appendChild(inp);
      div.appendChild(l);
    }
    const tools = document.createElement('div'); tools.className = 'sn-tools';
    for (const [t, title, fn] of [['↑', 'Выше', () => div.previousElementSibling && box.insertBefore(div, div.previousElementSibling)], ['↓', 'Ниже', () => div.nextElementSibling && box.insertBefore(div.nextElementSibling, div)], ['Убрать', 'Убрать', () => { if (box.children.length > ROWS[kind].min) div.remove(); else status('Здесь нужен хотя бы один пункт.', true); }]]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ed-quiet'; b.textContent = t; b.title = title; b.setAttribute('aria-label', title); b.onclick = () => { fn(); changed(); }; tools.appendChild(b);
    }
    div.appendChild(tools); box.appendChild(div);
  }
  function list(box, kind, items) { box.innerHTML = ''; box.dataset.kind = kind; (items || []).forEach((x) => row(kind, x, box)); }
  function read(box) {
    const kind = box.dataset.kind;
    return [...box.children].map((div) => {
      const o = {};
      for (const inp of div.querySelectorAll('input[data-k]')) { const v = inp.value.trim(); if (v) set(o, inp.dataset.k, v); }
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
    $('sn-f-href').value = h.feature.href; $('sn-f-image').value = h.feature.image;
    for (const L of ['ru', 'en']) for (const k of FEAT) $('sn-f-' + L + '-' + k).value = h.feature[L][k] || '';
    list(box('projects'), 'projects', h.projects); list(box('team'), 'team', h.team); list(box('partners'), 'partners', h.partners);
  }
  function collectHome() {
    const t = (L) => Object.fromEntries(FEAT.map((k) => [k, $('sn-f-' + L + '-' + k).value.trim()]));
    return { schema: S.home.schema, revision: S.home.revision, feature: { href: $('sn-f-href').value.trim(), image: $('sn-f-image').value.trim(), ru: t('ru'), en: t('en') }, projects: read(box('projects')), team: read(box('team')), partners: read(box('partners')) };
  }
  /** Загруженные фото: в форме — «asset:<hash>», на сервер уходят только используемые. */
  function homeBody(action) {
    const home = collectHome(), used = new Set(), uses = (x) => { if (x && typeof x.image === 'string' && x.image.startsWith('asset:')) used.add(x.image.slice(6)); };
    uses(home.feature); home.projects.forEach(uses); home.team.forEach(uses);
    const assets = [...used].map((h) => S.assets.get(h)).filter(Boolean).map(({ type, data }) => ({ type, data }));
    return { action, home, revision: S.home.revision, ...(assets.length ? { assets } : {}) };
  }
  let dirty = false;
  function changed() { S.preview = null; dirty = true; }

  // ── фото
  async function sha256(b64) { const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const h = await crypto.subtle.digest('SHA-256', bin); return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, '0')).join(''); }
  async function compress(file) {
    if (!file || file.size > 20 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw { code: 'bad_image' };
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej({ code: 'bad_image' }); im.src = url; });
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
  async function upload(fileInput, target) {
    const f = fileInput.files[0]; fileInput.value = ''; if (!f) return;
    status('Уменьшаем фото…');
    try { const a = await compress(f), h = await sha256(a.data); S.assets.set(h, a); target.value = 'asset:' + h; changed(); status('Фото готово — оно уйдёт на сайт вместе с публикацией.'); }
    catch (e) { status(msg(e), true); }
  }

  // ── загрузка
  async function load() {
    status('Загружаем…');
    const d = await api({ action: 'nav_get' });
    S.batch = d.batch || 25;
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
    else if (['projects', 'team', 'partners'].includes(p[0])) el = box(p[0]).children[+p[1]]?.querySelector('[data-k="' + p.slice(2).join('.') + '"]');
    if (el) { el.classList.add('pb-bad'); el.focus(); }
  }
  async function check(kind, e) {
    e.preventDefault(); if (S.busy) return; S.busy = true; markField(null); status('Собираем макет…');
    try {
      const fresh = await api({ action: 'nav_get' }); // свежая ревизия
      if (fresh[kind] && fresh[kind].revision !== S[kind].revision) { S[kind] = { ...S[kind], revision: fresh[kind].revision }; }
      const body = kind === 'nav' ? { action: 'nav_preview', nav: collectNav(), revision: S.nav.revision } : homeBody('home_preview');
      const d = await api(body);
      S.preview = { kind, body, ...d }; S.previewLang = 'ru'; showPreview();
      $('sn-affected').textContent = (kind === 'nav' ? 'Меню, подвал и контакты обновятся на всех страницах сайта (' + (d.pages || 'все') + ') — после публикации раскладка займёт пару минут. Макет — страница «О компании».' : 'Обновятся подборки на главной (русской и английской); остальной текст главной не меняется.') + ' Проверка действует 10 минут.';
      $('sn-review-error').textContent = ''; $('sn-publish').disabled = false; $('sn-review').showModal(); status('');
    } catch (err) { status(msg(err), true); markField(err.field); }
    finally { S.busy = false; }
  }
  function showPreview() {
    const html = S.preview[S.previewLang];
    $('sn-frame').srcdoc = html || '<p style="font-family:sans-serif;color:#ccc">Английской версии этой страницы нет.</p>';
    document.querySelectorAll('[data-preview]').forEach((b) => b.classList.toggle('ed-quiet', b.dataset.preview !== S.previewLang));
  }
  async function publish() {
    if (!S.preview || S.busy) return; S.busy = true; $('sn-publish').disabled = true; $('sn-review-error').textContent = 'Публикуем…';
    const kind = S.preview.kind;
    try {
      const body = { ...S.preview.body, action: kind === 'nav' ? 'nav_publish' : 'home_publish', previewToken: S.preview.previewToken };
      const d = await api(body);
      $('sn-review').close(); S.preview = null; dirty = false;
      S[kind] = { ...(kind === 'nav' ? body.nav : body.home), revision: d.revision };
      if (kind === 'home') { await load(); status('Главная обновлена. Сайт покажет изменения через 1–2 минуты.'); }
      else await sync();
    } catch (err) {
      $('sn-review-error').textContent = msg(err);
      $('sn-publish').disabled = !['publication_unknown', 'github_unreachable', 'github_limited'].includes(err.code) ? true : false;
      if (['content_conflict', 'preview_expired', 'preview_required'].includes(err.code)) S.preview = null;
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
  async function history(kind) {
    $('sn-history-list').innerHTML = ''; $('sn-history-status').textContent = 'Загружаем…'; $('sn-history-dialog').showModal();
    try {
      const d = await api({ action: 'nav_history', kind });
      $('sn-history-status').textContent = d.history.length ? '' : 'Истории пока нет.';
      for (const h of d.history) {
        const li = document.createElement('li');
        li.innerHTML = '<div><b></b><small></small></div><button type="button" class="ed-quiet">Открыть эту версию</button>';
        li.querySelector('b').textContent = new Date(h.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }); li.querySelector('small').textContent = h.message;
        li.querySelector('button').onclick = async () => {
          try {
            const r = await api({ action: 'nav_revision', kind, commit: h.sha });
            const data = { ...r[kind], revision: S[kind].revision };
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
    $('sn-copy-menu').onclick = () => { list(box('mobile'), 'mobile', read(box('menu'))); changed(); };
    $('sn-col-add').onclick = () => { if ($('sn-cols').children.length < 4) { col({ ru: '', en: '', links: [{}] }); changed(); } };
    $('sn-resync').onclick = () => { if (!S.busy) sync(); };
    $('sn-nav').addEventListener('input', changed); $('sn-home').addEventListener('input', changed);
    $('sn-nav').addEventListener('submit', (e) => check('nav', e));
    $('sn-home').addEventListener('submit', (e) => check('home', e));
    $('sn-review-close').onclick = () => $('sn-review').close();
    $('sn-history-close').onclick = () => $('sn-history-dialog').close();
    $('sn-publish').onclick = publish;
    document.querySelectorAll('[data-preview]').forEach((b) => { b.onclick = () => { S.previewLang = b.dataset.preview; showPreview(); }; });
    window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    load().catch((e) => status(msg(e), true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
