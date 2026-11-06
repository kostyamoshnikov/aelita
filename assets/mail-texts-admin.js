/* AELITA PRODUCTION · «Тексты писем» (pack-v757) — админка /admin/mail-texts/.
   Сервер — POST /admin/site-edit, действия mail_texts_* (_tools/Admin/mail-texts). Пустое поле —
   стандартный текст письма. Все письма и оба языка сохраняются одним документом. */
(function () {
  'use strict';
  const API = 'https://api.aelita-production.ru/admin/site-edit';
  const $ = (id) => document.getElementById(id);
  const ERR = {
    not_authenticated: 'Войдите в админку снова.', mail_texts_disabled: 'Раздел ещё не включён на сервере (нужен SITE_EDITOR_ENABLED=1 или PAGE_BUILDER_ENABLED=1 у aelita-admin-site-edit).',
    invalid_field: 'Проверьте отмеченное поле: слишком длинно или есть недопустимые знаки (< >, перенос строки в теме).',
    unknown_placeholder: 'В поле есть подстановка, которой у этого письма нет. Можно: ', content_conflict: 'Тексты только что сохранил кто-то другой. Обновите страницу — ваши правки останутся в полях только до перезагрузки, скопируйте их.',
    invalid_mail_texts_file: 'Файл текстов в хранилище повреждён — нужна сверка.', test_mail_unavailable: 'Почта команды (MAIL_TO) не настроена у функции — пример отправить некуда.',
    github_unreachable: 'Нет связи с сервером. Проверьте интернет и повторите.', item_not_in_revision: 'Эта версия не найдена.',
  };
  const S = { doc: null, catalog: null, id: null, lang: 'ru', dirty: false, busy: false };
  const token = () => { try { return localStorage.getItem('aelita_admin_token'); } catch { return null; } };
  const status = (t, bad) => { const s = $('mt-status'); s.textContent = t || ''; s.className = bad ? 'ed-error' : ''; };
  function gate() { $('mt-gate').hidden = false; $('mt-app').hidden = true; }
  async function api(body) {
    const t = token(); if (!t) { gate(); throw { code: 'not_authenticated' }; }
    let r; try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + t }, cache: 'no-store', body: JSON.stringify(body) }); } catch { throw { code: 'github_unreachable' }; }
    let d; try { d = await r.json(); } catch { throw { code: 'github_unreachable' }; }
    if (r.status === 401) gate();
    if (!r.ok || d.error) throw { code: d.error || 'mail_texts_failed', field: d.field };
    return d;
  }
  const msg = (e) => (ERR[e && e.code] || 'Не получилось: ' + ((e && e.code) || 'неизвестная ошибка')) + (e && e.code === 'unknown_placeholder' ? varsHint(e.field) : '');
  function varsHint(field) {
    const [id, , f] = String(field || '').split('.'); const v = S.catalog && S.catalog[id] && S.catalog[id].fields[f] && S.catalog[id].fields[f].vars;
    return v && v.length ? v.map((x) => '{' + x + '}').join(', ') + '.' : 'подстановок нет.';
  }
  const mine = () => ((S.doc.letters[S.id] || {})[S.lang]) || {};
  function setField(f, v) {
    const L = S.doc.letters; L[S.id] = L[S.id] || {}; L[S.id][S.lang] = L[S.id][S.lang] || {};
    if (v.trim()) L[S.id][S.lang][f] = v; else delete L[S.id][S.lang][f];
    if (!Object.keys(L[S.id][S.lang]).length) delete L[S.id][S.lang];
    if (!Object.keys(L[S.id]).length) delete L[S.id];
    S.dirty = true; $('mt-save').disabled = false; $('mt-state').textContent = 'Есть несохранённые изменения'; $('mt-sample').hidden = true;
  }
  function render() {
    const c = S.catalog[S.id];
    $('mt-title').textContent = c.label; $('mt-where').textContent = 'Где в коде: ' + c.where;
    const box = $('mt-fields'); box.innerHTML = '';
    for (const [f, spec] of Object.entries(c.fields)) {
      const wrap = document.createElement('div'); wrap.className = 'mt-field';
      const label = document.createElement('label'); label.textContent = spec.label + ' ';
      const small = document.createElement('small'); label.appendChild(small);
      const long = spec.max > 160;
      const inp = document.createElement(long ? 'textarea' : 'input'); inp.className = 'ym-disable-keys'; inp.id = 'mt-f-' + f; inp.maxLength = spec.max; if (long) inp.rows = 4;
      inp.placeholder = spec.defaults[S.lang]; inp.value = mine()[f] || '';
      const count = () => { small.textContent = (inp.value.length ? inp.value.length + '/' + spec.max : 'стандартный текст'); };
      inp.addEventListener('input', () => { setField(f, inp.value); count(); });
      label.appendChild(inp); wrap.appendChild(label);
      const hint = document.createElement('p'); hint.className = 'ed-note';
      hint.textContent = (spec.vars.length ? 'Подстановки: ' + spec.vars.map((x) => '{' + x + '}').join(', ') + '. ' : '') + 'Стандартный текст: «' + spec.defaults[S.lang] + '»';
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'ed-quiet'; reset.textContent = 'Вернуть стандартный текст';
      reset.onclick = () => { inp.value = ''; setField(f, ''); count(); };
      wrap.appendChild(hint); wrap.appendChild(reset); box.appendChild(wrap); count();
    }
    document.querySelectorAll('[data-lang]').forEach((b) => { const on = b.dataset.lang === S.lang; b.setAttribute('aria-selected', on); b.classList.toggle('ed-quiet', !on); });
    $('mt-sample').hidden = true;
  }
  function mark(field) {
    document.querySelectorAll('.pb-bad').forEach((x) => x.classList.remove('pb-bad'));
    const [id, lang, f] = String(field || '').split('.');
    if (!f || !S.catalog[id]) return;
    S.id = id; S.lang = lang; $('mt-letter').value = id; render();
    const el = $('mt-f-' + f); if (el) { el.classList.add('pb-bad'); el.focus(); }
  }
  async function load() {
    status('Загружаем…');
    const d = await api({ action: 'mail_texts_get' });
    S.doc = d.doc; S.catalog = d.catalog; S.id = S.id || Object.keys(d.catalog)[0];
    const sel = $('mt-letter'); sel.innerHTML = '';
    for (const [id, c] of Object.entries(d.catalog)) { const o = document.createElement('option'); o.value = id; o.textContent = c.label; sel.appendChild(o); }
    sel.value = S.id; $('mt-test').hidden = !d.testTo;
    $('mt-gate').hidden = true; $('mt-app').hidden = false; S.dirty = false; $('mt-save').disabled = true; $('mt-state').textContent = 'Изменений нет'; render(); status('');
  }
  async function preview(test) {
    if (S.busy) return; S.busy = true; mark(null);
    try {
      const d = await api({ action: test ? 'mail_texts_test' : 'mail_texts_preview', doc: S.doc, id: S.id, lang: S.lang });
      if (test) status('Пример ушёл на почту команды.');
      else { $('mt-sample').hidden = false; $('mt-sample').querySelector('.mt-subj').textContent = 'Тема: ' + d.subject; $('mt-sample').querySelector('pre').textContent = d.text; status(''); }
    } catch (e) { status(msg(e), true); mark(e.field); } finally { S.busy = false; }
  }
  async function save() {
    if (S.busy) return; S.busy = true; $('mt-save').disabled = true; mark(null); status('Сохраняем…');
    try { const d = await api({ action: 'mail_texts_save', doc: S.doc }); S.doc.revision = d.revision; S.dirty = false; $('mt-state').textContent = 'Сохранено · ревизия ' + d.revision; status('Сохранено. Письма начнут уходить с новым текстом в течение минуты.'); }
    catch (e) { status(msg(e), true); mark(e.field); $('mt-save').disabled = false; } finally { S.busy = false; }
  }
  async function history() {
    $('mt-history-list').innerHTML = ''; $('mt-history-status').textContent = 'Загружаем…'; $('mt-history-dialog').showModal();
    try {
      const d = await api({ action: 'mail_texts_history' });
      $('mt-history-status').textContent = d.history.length ? '' : 'Истории пока нет.';
      for (const h of d.history) {
        const li = document.createElement('li'); li.innerHTML = '<div><b></b></div><button type="button" class="ed-quiet">Открыть эту версию</button>';
        li.querySelector('b').textContent = h.label;
        li.querySelector('button').onclick = async () => {
          try { const r = await api({ action: 'mail_texts_revision', key: h.key }); const rev = S.doc.revision; S.doc = { ...r.doc, revision: rev }; S.dirty = true; $('mt-save').disabled = false; $('mt-state').textContent = 'Загружена прежняя версия — сохраните, чтобы вернуть её'; render(); $('mt-history-dialog').close(); }
          catch (e) { $('mt-history-status').textContent = msg(e); }
        };
        $('mt-history-list').appendChild(li);
      }
    } catch (e) { $('mt-history-status').textContent = msg(e); }
  }
  function start() {
    if (!token()) return gate();
    $('mt-letter').onchange = () => { S.id = $('mt-letter').value; render(); };
    document.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => { S.lang = b.dataset.lang; render(); }; });
    $('mt-preview').onclick = () => preview(false); $('mt-test').onclick = () => preview(true);
    $('mt-save').onclick = save; $('mt-history').onclick = history; $('mt-history-close').onclick = () => $('mt-history-dialog').close();
    window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
    load().catch((e) => status(msg(e), true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
