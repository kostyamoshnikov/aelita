/* AELITA PRODUCTION · конструктор новых страниц P1 (pack-v753; снятие с сайта — pack-v754) — админка /admin/pages/.
   Сервер — POST /admin/site-edit, действия page_* (_tools/Admin/pages). Вход — сессия основной
   админки в этой вкладке. Черновик — в sessionStorage вкладки и файлом JSON. */
(function () {
  'use strict';
  const API = 'https://api.aelita-production.ru/admin/site-edit', DRAFT = 'aelita_page_builder_draft_v1';
  const $ = (id) => document.getElementById(id);
  const KIND = { person: 'Человек', venue: 'Площадка', project: 'Проект', article: 'Статья' };
  const SUB = { person: ['Роль или профессия', 'Role'], venue: ['Адрес', 'Address'], project: ['Годы, формат', 'Years, format'], article: ['Автор', 'Author'] };
  const FIELDS = ['title', 'subtitle', 'lead', 'body', 'seoTitle', 'seoDescription', 'imageAlt'];
  const ERR = {
    editor_reload_required: 'Редактор обновлён. Скачайте черновик и перезагрузите страницу перед продолжением.',
    not_authenticated: 'Войдите в админку снова.', page_builder_disabled: 'Конструктор страниц ещё не включён на сервере (нужен SITE_EDITOR_ENABLED=1 или PAGE_BUILDER_ENABLED=1 у aelita-admin-site-edit).',
    editor_not_configured: 'Не настроено подключение к репозиторию сайта.', invalid_field: 'Проверьте отмеченное поле.', slug_taken: 'Такой адрес уже занят на сайте. Выберите другой.',
    address_locked: 'Адрес и тип опубликованной страницы не меняются.', image_missing: 'Фотография не найдена — выберите файл заново.', linked_page_missing: 'Кнопка ведёт на страницу, которой нет на сайте.',
    managed_page_changed: 'Эту страницу после публикации правили не конструктором (вручную или редактором). Конструктор её не перезапишет — правьте в «Редакторе страниц».',
    content_conflict: 'Каталог изменился после открытия страницы. Скачайте черновик, откройте актуальную страницу и сопоставьте правки. Старая форма не будет опубликована поверх новой.', draft_base_missing: 'У старого черновика нет исходной версии. Скачайте его и сопоставьте с актуальной страницей перед новой правкой.', preview_required: 'Сначала проверьте свежий макет.', preview_expired: 'Проверка устарела (10 минут). Проверьте макет ещё раз.',
    publication_unknown: 'Ответ на публикацию потерян. Нажмите «Опубликовать» ещё раз — конструктор проверит, успела ли она сохраниться.', github_unreachable: 'Нет связи с сервером публикации. Проверьте интернет и повторите.',
    github_rejected: 'Сервис публикации отклонил запрос. Проверьте настройки репозитория.', github_limited: 'Сервис публикации временно ограничил запросы. Повторите через минуту.', no_change: 'Изменений нет — публиковать нечего.',
    catalog_too_large: 'Достигнут предел каталога страниц (200).', invalid_catalog: 'Каталог страниц на сайте повреждён или изменён вручную — нужна сверка.', bad_image: 'Подойдёт JPG, PNG или WebP до 20 МБ.', image_too_large: 'Не удалось уменьшить фото до 512 КБ — выберите другое.',
    item_not_in_revision: 'В этой версии страницы ещё нет.', confirm_required: 'Адрес введён не так — проверьте.', page_not_found: 'Такой страницы в каталоге уже нет.',
    page_in_use: 'На страницу ещё ведут ссылки — сначала уберите их.', too_many_images: 'Можно одну фотографию.', unused_image: 'Фотография не используется — выберите её заново.', layout_changed: 'Карта сайта изменена вручную — публикация остановлена.',
  };
  const FIELD_NAME = { slug: 'pb-slug', date: 'pb-date', image: 'pb-image-file', links: 'pb-links' };
  const S = { pages: [], revision: 0, page: null, existing: false, asset: null, imageURL: '', preview: null, busy: false, lang: 'ru', previewLang: 'ru' };

  const token = () => { try { return localStorage.getItem('aelita_admin_token'); } catch { return null; } };
  const status = (t, bad) => { const s = $('pb-status'); s.textContent = t || ''; s.className = bad ? 'ed-error' : ''; };
  function gate() { $('pb-gate').hidden = false; $('pb-list-box').hidden = true; $('pb-form').hidden = true; }
  async function api(body) {
    body = { ...body, reviewVersion: 3 };
    const t = token(); if (!t) { gate(); throw { code: 'not_authenticated' }; }
    let r; try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t }, cache: 'no-store', body: JSON.stringify(body) }); } catch { throw { code: 'github_unreachable' }; }
    let d; try { d = await r.json(); } catch { throw { code: 'github_unreachable' }; }
    if (r.status === 401) gate();
    if (!r.ok || d.error) throw { code: d.error || 'page_builder_failed', field: d.field, usedBy: d.usedBy };
    return d;
  }
  const msg = (e) => ERR[e && e.code] || 'Не получилось: ' + ((e && e.code) || 'неизвестная ошибка');
  const rid = () => 'pg-' + Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
  function translit(s) {
    const m = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(s).toLowerCase().split('').map((c) => (m[c] !== undefined ? m[c] : c)).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  }

  // ── форма ↔ страница
  function blank(kind) { return { id: rid(), kind: kind || 'person', slug: '', image: '', date: '', links: [], ru: Object.fromEntries(FIELDS.map((f) => [f, ''])), en: Object.fromEntries(FIELDS.map((f) => [f, ''])) }; }
  function collect() {
    const p = S.page;
    p.kind = $('pb-kind').value; p.slug = $('pb-slug').value.trim(); p.date = p.kind === 'article' ? $('pb-date').value : '';
    for (const l of ['ru', 'en']) for (const f of FIELDS) p[l][f] = $('pb-' + l + '-' + f).value;
    p.links = [...document.querySelectorAll('.pb-link')].map((row) => ({ url: row.querySelector('[data-k=url]').value.trim(), ru: row.querySelector('[data-k=ru]').value.trim(), en: row.querySelector('[data-k=en]').value.trim() })).filter((x) => x.url || x.ru || x.en);
    return p;
  }
  function linkRow(l = { url: '', ru: '', en: '' }) {
    const row = document.createElement('div'); row.className = 'pb-link';
    row.innerHTML = '<label>Куда<input class="ym-disable-keys" data-k="url" maxlength="500" placeholder="/team/ или https://…"></label><label>Надпись RU<input class="ym-disable-keys" data-k="ru" maxlength="60"></label><label>Label EN<input class="ym-disable-keys" data-k="en" maxlength="60"></label><button type="button" class="ed-quiet" data-remove>Убрать</button>';
    row.querySelector('[data-k=url]').value = l.url; row.querySelector('[data-k=ru]').value = l.ru; row.querySelector('[data-k=en]').value = l.en;
    row.querySelector('[data-remove]').onclick = () => { row.remove(); changed(); };
    $('pb-links').appendChild(row);
  }
  function fill(p) {
    $('pb-kind').value = p.kind; $('pb-slug').value = p.slug; $('pb-date').value = p.date || '';
    for (const l of ['ru', 'en']) for (const f of FIELDS) $('pb-' + l + '-' + f).value = (p[l] && p[l][f]) || '';
    $('pb-links').innerHTML = ''; (p.links || []).forEach(linkRow);
    $('pb-kind').disabled = S.existing; $('pb-slug').readOnly = S.existing;
    $('pb-form-title').textContent = S.existing ? 'Правка: ' + (p.ru.title || p.slug) : 'Новая страница';
    $('pb-history').hidden = !S.existing; $('pb-unpublish').hidden = !S.existing;
    kindChanged(); showImage(); counts();
  }
  function kindChanged() {
    const k = $('pb-kind').value;
    $('pb-date-box').hidden = k !== 'article';
    $('pb-ru-subtitle-label').textContent = SUB[k][0]; $('pb-en-subtitle-label').textContent = SUB[k][1];
  }
  function showImage() {
    const img = $('pb-image-preview'), src = S.asset ? 'data:' + S.asset.type + ';base64,' + S.asset.data : (S.page.image ? S.page.image : '');
    img.hidden = !src; if (src) img.src = src; $('pb-image-clear').hidden = !src;
  }
  function counts() { document.querySelectorAll('[data-count]').forEach((el) => { const f = $(el.dataset.count); el.textContent = f.value.length + '/' + f.maxLength; }); }

  // ── черновик (sessionStorage вкладки) и файл
  function saveDraft() {
    try { sessionStorage.setItem(DRAFT, JSON.stringify({ page: collect(), existing: S.existing, revision: S.revision, asset: S.asset, savedAt: Date.now() })); $('pb-draft-state').textContent = 'Черновик сохранён в этой вкладке · ' + new Date().toLocaleTimeString('ru-RU'); }
    catch { $('pb-draft-state').textContent = 'Черновик не сохраняется во вкладке (мало места или приватный режим) — скачайте его файлом.'; }
  }
  let timer = null;
  function changed() { S.preview = null; clearTimeout(timer); timer = setTimeout(saveDraft, 600); counts(); }
  function readDraft() { try { return JSON.parse(sessionStorage.getItem(DRAFT) || 'null'); } catch { return null; } }
  function download() {
    const blob = new Blob([JSON.stringify({ format: 'aelita-page-draft/v1', page: collect(), existing: S.existing, revision: S.revision }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'page-' + (S.page.slug || 'draft') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  async function importDraft(file) {
    try {
      const d = JSON.parse(await file.text());
      if (!d || d.format !== 'aelita-page-draft/v1' || !d.page || !/^pg-[a-f0-9]{32}$/.test(d.page.id || '')) throw 0;
      S.existing = S.pages.some((p) => p.id === d.page.id); S.revision = Number.isSafeInteger(d.revision) && d.revision >= 0 ? d.revision : (S.existing ? null : S.revision); S.page = { ...blank(), ...d.page, ru: { ...blank().ru, ...d.page.ru }, en: { ...blank().en, ...d.page.en } }; S.asset = null;
      fill(S.page); changed(); status('Черновик загружен из файла. Фотографию, если она была новой, выберите заново.');
    } catch { status('Это не черновик страницы.', true); }
  }

  // ── список
  async function load() {
    status('Загружаем страницы…');
    const d = await api({ action: 'page_list' });
    S.pages = d.pages; S.revision = d.revision;
    const ul = $('pb-list'); ul.innerHTML = '';
    if (!d.pages.length) ul.innerHTML = '<li class="ed-note">Пока ни одной — нажмите «Новая страница».</li>';
    for (const p of d.pages) {
      const li = document.createElement('li');
      li.innerHTML = '<div><b></b><small></small></div><div class="ed-actions"><a target="_blank" rel="noopener">На сайте</a><button type="button" class="ed-quiet">Изменить</button></div>';
      li.querySelector('b').textContent = p.title; li.querySelector('small').textContent = KIND[p.kind] + ' · /' + p.slug + '/ · ' + new Date(p.updatedAt).toLocaleDateString('ru-RU');
      li.querySelector('a').href = 'https://aelita-production.ru/' + p.slug + '/';
      li.querySelector('button').onclick = () => edit(p.id);
      ul.appendChild(li);
    }
    $('pb-gate').hidden = true; $('pb-list-box').hidden = false; status('');
  }
  async function edit(id) {
    status('Открываем страницу…');
    try {
      // Полные данные опубликованной версии — из последнего коммита каталога.
      const h = await api({ action: 'page_history' });
      const last = h.history[0]; if (!last) throw { code: 'item_not_in_revision' };
      const d = await api({ action: 'page_revision', commit: last.sha, id, full: true });
      S.existing = true; S.revision = d.revision; S.page = d.page; S.asset = null; openForm(); status('');
    } catch (e) { status(msg(e), true); }
  }
  function openForm() { $('pb-list-box').hidden = true; $('pb-result').hidden = true; $('pb-form').hidden = false; fill(S.page); tab('ru'); window.scrollTo(0, 0); }

  // ── фото: уменьшаем в браузере до 512 КБ (как в мастере событий)
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

  // ── проверка и публикация
  function body(action) {
    const p = collect(), page = JSON.parse(JSON.stringify(p));
    if (S.asset) page.image = 'asset:upload';
    if (page.kind !== 'article') page.date = '';
    return { action, page, revision: S.revision, ...(S.asset ? { assets: [S.asset] } : {}) };
  }
  function markField(field) {
    document.querySelectorAll('.pb-bad').forEach((x) => x.classList.remove('pb-bad'));
    if (!field) return;
    const m = /^(ru|en)\.(\w+)$/.exec(field), id = m ? 'pb-' + m[1] + '-' + m[2] : FIELD_NAME[field.split('.')[0]];
    if (m) tab(m[1]);
    const el = id && $(id); if (el) { el.classList.add('pb-bad'); el.focus(); }
  }
  async function check(e) {
    e.preventDefault(); if (S.busy) return; S.busy = true; $('pb-check').disabled = true; markField(null); saveDraft(); status('Собираем макет…');
    try {
      const l = await api({ action: 'page_list' });
      if (S.existing && S.revision === null) throw { code: 'draft_base_missing' };
      if (S.existing && l.revision !== S.revision) throw { code: 'content_conflict' };
      if (!S.existing) S.revision = l.revision; // A new id does not replace an existing page.
      S.pages = l.pages;
      const d = await api(body('page_preview'));
      S.preview = d; S.previewLang = 'ru'; showPreview();
      $('pb-affected').textContent = (d.isNew ? 'Новая страница: ' : 'Обновится: ') + d.affected.join(', ') + '. Проверка действует 10 минут.';
      $('pb-review-error').textContent = ''; $('pb-publish').disabled = false; $('pb-review').showModal(); status('');
    } catch (err) { status(msg(err), true); markField(err.field); }
    finally { S.busy = false; $('pb-check').disabled = false; }
  }
  function showPreview() {
    $('pb-frame').srcdoc = S.preview[S.previewLang];
    document.querySelectorAll('[data-preview]').forEach((b) => b.classList.toggle('ed-quiet', b.dataset.preview !== S.previewLang));
  }
  async function publish() {
    if (!S.preview || S.busy) return; S.busy = true; $('pb-publish').disabled = true; $('pb-review-error').textContent = 'Публикуем…';
    try {
      const d = await api({ ...body('page_publish'), previewToken: S.preview.previewToken });
      $('pb-review').close(); try { sessionStorage.removeItem(DRAFT); } catch { /* нет хранилища */ }
      $('pb-form').hidden = true; $('pb-result').hidden = false;
      $('pb-result-ru').href = d.pageURL; $('pb-result-en').href = d.pageURLEn || d.pageURL.replace('aelita-production.ru/', 'aelita-production.ru/en/');
      S.preview = null; S.asset = null; status(d.alreadyPublished ? 'Публикация уже была сохранена.' : '');
    } catch (err) {
      $('pb-review-error').textContent = msg(err);
      $('pb-publish').disabled = err.code !== 'publication_unknown' && err.code !== 'github_unreachable' && err.code !== 'github_limited';
      if (err.code === 'content_conflict' || err.code === 'preview_expired' || err.code === 'preview_required') S.preview = null;
    } finally { S.busy = false; }
  }

  // ── снять с сайта (pack-v754)
  const USED = { nav: 'меню или подвал («Меню, подвал и главная»)', home: 'подборки главной («Меню, подвал и главная»)' };
  function unpublishOpen() {
    $('pb-unpublish-slug').textContent = S.page.slug; $('pb-unpublish-confirm').value = ''; $('pb-unpublish-error').textContent = ''; $('pb-unpublish-go').disabled = true;
    $('pb-unpublish-dialog').showModal(); $('pb-unpublish-confirm').focus();
  }
  async function unpublish() {
    if (S.busy) return; S.busy = true; $('pb-unpublish-go').disabled = true; $('pb-unpublish-error').textContent = 'Снимаем…';
    try {
      const l = await api({ action: 'page_list' });
      if (S.revision === null) throw { code: 'draft_base_missing' };
      if (l.revision !== S.revision) throw { code: 'content_conflict' };
      await api({ action: 'page_unpublish', id: S.page.id, revision: S.revision, confirm: $('pb-unpublish-confirm').value.trim() });
      $('pb-unpublish-dialog').close(); try { sessionStorage.removeItem(DRAFT); } catch { /* нет хранилища */ }
      $('pb-form').hidden = true; await load(); status('Страница /' + S.page.slug + '/ снята с сайта. Сайт обновится через 1–2 минуты.');
    } catch (err) {
      let t = msg(err);
      if (err.code === 'page_in_use' && err.usedBy) t += ' Ссылки: ' + err.usedBy.map((u) => USED[u] || ('страница /' + u.replace(/^page:/, '') + '/')).join(', ') + '.';
      $('pb-unpublish-error').textContent = t; $('pb-unpublish-go').disabled = false;
    } finally { S.busy = false; }
  }

  // ── история
  async function history() {
    $('pb-history-list').innerHTML = ''; $('pb-history-status').textContent = 'Загружаем…'; $('pb-history-dialog').showModal();
    try {
      const d = await api({ action: 'page_history' });
      $('pb-history-status').textContent = d.history.length ? '' : 'Истории пока нет.';
      for (const h of d.history) {
        const li = document.createElement('li');
        li.innerHTML = '<div><b></b><small></small></div><button type="button" class="ed-quiet">Открыть эту версию</button>';
        li.querySelector('b').textContent = new Date(h.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }); li.querySelector('small').textContent = h.message;
        li.querySelector('button').onclick = async () => {
          try { const r = await api({ action: 'page_revision', commit: h.sha, id: S.page.id, full: true }); S.page = r.page; S.asset = null; fill(S.page); changed(); $('pb-history-dialog').close(); status('Загружена версия от ' + li.querySelector('b').textContent + '. Проверьте и опубликуйте, если нужно вернуть её.'); }
          catch (e) { $('pb-history-status').textContent = msg(e); }
        };
        $('pb-history-list').appendChild(li);
      }
    } catch (e) { $('pb-history-status').textContent = msg(e); }
  }
  function tab(lang) {
    S.lang = lang;
    document.querySelectorAll('[data-lang]').forEach((b) => { const on = b.dataset.lang === lang; b.setAttribute('aria-selected', on); b.classList.toggle('ed-quiet', !on); });
    document.querySelectorAll('[data-lang-panel]').forEach((p) => { p.hidden = p.dataset.langPanel !== lang; });
  }

  // ── события
  function start() {
    if (!token()) return gate();
    $('pb-new').onclick = () => { S.existing = false; S.page = blank(); S.asset = null; openForm(); saveDraft(); };
    $('pb-cancel').onclick = () => { $('pb-form').hidden = true; load().catch((e) => status(msg(e), true)); };
    $('pb-result-back').onclick = () => { $('pb-result').hidden = true; load().catch((e) => status(msg(e), true)); };
    $('pb-kind').onchange = () => { kindChanged(); changed(); };
    $('pb-ru-title').addEventListener('blur', () => { if (!S.existing && !$('pb-slug').value.trim()) { $('pb-slug').value = translit($('pb-ru-title').value); changed(); } });
    $('pb-form').addEventListener('input', changed);
    $('pb-form').addEventListener('submit', check);
    $('pb-link-add').onclick = () => { if (document.querySelectorAll('.pb-link').length < 6) linkRow(); };
    $('pb-image-file').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; status('Уменьшаем фото…'); try { S.asset = await compress(f); showImage(); changed(); status(''); } catch (err) { status(msg(err), true); } };
    $('pb-image-clear').onclick = () => { S.asset = null; S.page.image = ''; showImage(); changed(); };
    $('pb-download').onclick = download;
    $('pb-import').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importDraft(f); };
    $('pb-unpublish').onclick = unpublishOpen; $('pb-unpublish-close').onclick = () => $('pb-unpublish-dialog').close();
    $('pb-unpublish-confirm').oninput = () => { $('pb-unpublish-go').disabled = $('pb-unpublish-confirm').value.trim() !== S.page.slug; };
    $('pb-unpublish-go').onclick = unpublish; $('pb-unpublish-download').onclick = download;
    $('pb-history').onclick = history; $('pb-history-close').onclick = () => $('pb-history-dialog').close();
    $('pb-review-close').onclick = () => $('pb-review').close();
    $('pb-publish').onclick = publish;
    document.querySelectorAll('[data-preview]').forEach((b) => { b.onclick = () => { S.previewLang = b.dataset.preview; showPreview(); }; });
    document.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => tab(b.dataset.lang); });
    load().then(() => {
      const d = readDraft();
      if (d && d.page && /^pg-[a-f0-9]{32}$/.test(d.page.id || '')) {
        S.existing = !!d.existing; S.revision = Number.isSafeInteger(d.revision) && d.revision >= 0 ? d.revision : (S.existing ? null : S.revision); S.page = d.page; S.asset = d.asset || null; openForm();
        status('Восстановлен несохранённый черновик из этой вкладки.');
      }
    }).catch((e) => { status(msg(e), true); if (e.code !== 'not_authenticated') $('pb-list-box').hidden = false; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
