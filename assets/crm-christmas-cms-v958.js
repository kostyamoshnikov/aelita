(function (global) {
 'use strict';
 const action = name => 'christmas_cms_' + name;
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
   '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
 }[c]));
 const locked = id => ['price', 'booking'].includes(id);
 const describe = { seed: 'Начальная редакция', edit: 'Изменение', restore: 'Восстановление' };

 const cardsHtml = cards => cards.length ? '<div class="cards">'+cards.map(([title, text]) =>
   '<article><h3>'+escape(title)+'</h3><p>'+escape(text)+'</p></article>').join('')+'</div>' : '';

 function previewDocument(content, lang, translationState = {}) {
   const en = lang === 'en';
   const seo = content.editorial?.seo[lang];
   const sections = content.sections.filter(section => section.visible).map(section => {
     const entry = en ? content.editorial?.en[section.id] : section;
     const stale = en && translationState[section.id] === 'stale';
     const heading = section.id === 'hero' ? 'h1' : 'h2';
     return '<section id="'+escape(section.id)+'"><'+heading+'>'+
       escape(entry?.title || (en ? 'Translation pending' : section.title))+'</'+heading+'>'+
       (stale ? '<p class="notice">The Russian text has changed. Review this translation.</p>' : '')+
       (entry ? entry.text.map(text => '<p>'+escape(text)+'</p>').join('')+cardsHtml(entry.cards) :
         '<p class="notice">This section has no English draft yet.</p>')+'</section>';
   });
   const seoDescription = seo ? '<meta name="description" content="'+escape(seo.description)+'">' : '';
   return '<!doctype html><html lang="'+(en?'en':'ru')+'"><meta charset="utf-8">'+
      '<meta name="viewport" content="width=device-width, initial-scale=1">'+
      '<meta name="robots" content="noindex,nofollow">'+
      '<meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;; form-action &apos;none&apos;; base-uri &apos;none&apos;">'+
      '<title>'+escape(seo?.title || (en?'Christmas draft':'Рождественский черновик'))+'</title>'+seoDescription+
      '<style>*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#30292a;font:1rem/1.6 system-ui,sans-serif;overflow-wrap:anywhere}main{max-width:70rem;margin:auto}section{padding:clamp(1.25rem,5vw,3rem);border-bottom:1px solid #c6a365}section:first-child{background:#651326;color:#fff7e8}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(2rem,6vw,4rem)}h2{font-size:clamp(1.5rem,4vw,2.5rem)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:1rem}.cards article{border-top:1px solid #a17751}.notice{font-size:.9rem}</style>'+
      '<main>'+sections.join('')+'</main></html>';
 }

 async function mount(host, { api, mutate, active, requestId, editorial = false }) {
   let view, busy = false, previous = null, lang = 'ru', lastSection;
   host.classList.add('ym-hide-content');
   host.innerHTML = '<h2>Рождество · редакции</h2><p role="status" aria-live="polite">Загрузка редакций…</p><div data-cms-body></div>';
   const body = host.querySelector('[data-cms-body]');
   const status = host.querySelector('[role=status]');
   const visible = () => active() && host.isConnected;

   async function load(version) {
     view = await api({ action: action('view'), ...(version ? { version } : {}) });
     if (visible()) render();
   }

   function render() {
     if (!view.initialized) {
       body.innerHTML = '<p>Создайте первую редакцию из черновика сезона.</p><button type="button" data-cms-seed>Создать редакцию</button>';
       body.querySelector('[data-cms-seed]').onclick = () => save('seed', {});
       return;
     }
     const selected = view.selected;
     const editing = selected.version === view.head;
     body.innerHTML = '<p>Текущая редакция '+view.head+' · для новых заказов '+(view.approvedVersion ?? 'не выбрана')+'.</p>'+
       '<label>История редакций<select data-cms-version>'+view.versions.map(entry =>
         '<option value="'+entry.version+'"'+(entry.version===selected.version?' selected':'')+'>'+
         entry.version+' · '+escape(describe[entry.operation])+' · '+escape(new Date(entry.at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}))+'</option>').join('')+
       '</select></label>'+
       (editorial ? '<label>Язык черновика<select data-cms-lang><option value="ru">Русский</option><option value="en">English</option></select></label>' : '')+
       '<label>Раздел<select data-cms-section>'+selected.content.sections.map(section =>
         '<option value="'+escape(section.id)+'">'+escape(section.title)+'</option>').join('')+
         (editorial ? '<option value="seo">Заголовок и описание страницы</option>' : '')+'</select></label>'+
       '<p data-cms-translation-state class="hint"></p>'+
       '<form data-cms-edit><label>Заголовок<input name="title" class="ym-disable-keys" required maxlength="200"></label>'+
       '<label><span data-cms-text-label>Текст абзацев</span><textarea class="ym-disable-keys" name="text" rows="6" maxlength="36012"></textarea></label>'+
       '<div data-cms-cards></div><button type="submit">Сохранить новую редакцию</button></form>'+
       (editorial ? '<details data-cms-preview><summary>Предпросмотр сохранённой редакции</summary>'+
         '<label>Ширина<select data-cms-preview-width><option value="full">По ширине окна</option><option value="mobile">Мобильная · 390 px</option></select></label>'+
         '<iframe sandbox="" referrerpolicy="no-referrer" title="Рождество · закрытый предпросмотр" width="100%" height="560"></iframe></details>' : '')+
       '<div class="actions">'+(editing
         ? '<button type="button" data-cms-approve'+(view.approvedVersion===view.head?' disabled':'')+'>Выбрать для новых заказов</button>'
         : '<button type="button" data-cms-restore>Восстановить как черновик</button>')+'</div>';
     const version = body.querySelector('[data-cms-version]');
     const section = body.querySelector('[data-cms-section]');
     const form = body.querySelector('form');
     const title = form.elements.title, blocks = form.elements.text;
     const language = body.querySelector('[data-cms-lang]');
     const cardFields = body.querySelector('[data-cms-cards]');
     const translation = body.querySelector('[data-cms-translation-state]');
     const frame = body.querySelector('iframe');
     const previewWidth = body.querySelector('[data-cms-preview-width]');
     const textLabel = body.querySelector('[data-cms-text-label]');
     if (lastSection && [...section.options].some(option => option.value === lastSection)) section.value = lastSection;
     if (language) language.value = lang;
     let opened = section.value, original;
     const currentCards = () => [...cardFields.querySelectorAll('fieldset')].map(fieldset => [
       fieldset.querySelector('input').value, fieldset.querySelector('textarea').value,
     ]);
     const current = () => ({ title: title.value, text: blocks.value, cards: currentCards() });
     const dirty = () => JSON.stringify(current()) !== original;
     const confirmDiscard = () => !dirty() || global.confirm('Отказаться от изменений этого раздела?');

     function updateFrame() {
       if (frame) frame.srcdoc = previewDocument(selected.content, lang, view.translationState);
     }
     if (previewWidth) previewWidth.onchange = () => {
       frame.style.width = previewWidth.value === 'mobile' ? 'min(100%, 390px)' : '100%';
     };

     function loadFields() {
       const seo = opened === 'seo';
       const source = selected.content.sections.find(item => item.id === opened);
       const entry = seo ? selected.content.editorial?.seo[lang] :
         lang === 'en' ? selected.content.editorial?.en[opened] : source;
       const editable = editing && (seo || lang === 'en' || !locked(opened));
       const state = view.translationState?.[opened];
       translation.textContent = lang === 'en' && !seo ? ({
         missing: 'Перевода ещё нет.',
         stale: 'Русский текст изменился. Проверьте и сохраните перевод заново.',
         draft: 'Черновик перевода для согласования.',
       }[state] || '') : '';
       title.value = entry?.title || '';
       title.maxLength = seo ? 140 : 200;
       textLabel.textContent = seo ? 'Описание страницы' : 'Текст абзацев';
       blocks.value = seo ? (entry?.description || '') : (entry?.text.join('\n') || '');
       blocks.maxLength = seo ? 320 : 36012;
       blocks.required = seo;
       title.readOnly = blocks.readOnly = !editable;
       const cards = editorial && source ? (entry?.cards || source.cards.map(() => ['', ''])) : [];
       cardFields.innerHTML = cards.map(([cardTitle, cardText], index) =>
         '<fieldset><legend>Карточка '+(index+1)+'</legend><label>Заголовок<input class="ym-disable-keys" maxlength="200" required value="'+escape(cardTitle)+'"></label>'+
         '<label>Текст<textarea class="ym-disable-keys" maxlength="2000" required rows="2">'+escape(cardText)+'</textarea></label></fieldset>').join('');
       cardFields.querySelectorAll('input, textarea').forEach(control => { control.readOnly = !editable; });
       form.querySelector('button').disabled = !editable;
       original = JSON.stringify(current());
     }
     loadFields();
     updateFrame();
     host.crmCmsDirty = dirty;
     host.crmCmsBeforeLeave = () => !busy && confirmDiscard();
     version.onchange = async () => {
       if (busy || !visible() || !confirmDiscard()) { version.value = selected.version; return; }
       busy = true;
       status.textContent = 'Загрузка редакции…';
       try { await load(Number(version.value)); if (visible()) status.textContent = ''; }
       catch (error) { if (visible()) { version.value = selected.version; status.textContent = error.message; } }
       finally { busy = false; }
     };
     section.onchange = () => {
       if (busy || !visible() || !confirmDiscard()) { section.value = opened; return; }
       opened = lastSection = section.value;
       loadFields();
     };
     if (language) language.onchange = () => {
       if (busy || !visible() || !confirmDiscard()) { language.value = lang; return; }
       lang = language.value;
       loadFields();
       updateFrame();
     };
     form.onsubmit = event => {
       event.preventDefault();
       if (busy || !visible() || title.readOnly || (!dirty() && !(lang === 'en' && view.translationState?.[opened] === 'stale'))) return;
       const payload = { base_revision: view.head };
       if (editorial) payload.lang = lang;
       if (opened === 'seo') {
         payload.seo = { title: title.value, description: blocks.value.trim().replace(/\s+/g, ' ') };
       } else {
         payload.section = { id: opened, title: title.value, text: blocks.value.split('\n').filter(line => line.trim()) };
         if (editorial) payload.section.cards = currentCards().map(([cardTitle, text]) => [cardTitle, text.trim().replace(/\s+/g, ' ')]);
       }
       lastSection = opened;
       save('edit', payload);
     };
     const approve = body.querySelector('[data-cms-approve]');
     if (approve) approve.onclick = () => {
       if (dirty()) { status.textContent = 'Сначала сохраните изменения раздела.'; return; }
       save('approve', { base_revision: view.head });
     };
     const restore = body.querySelector('[data-cms-restore]');
     if (restore) restore.onclick = () => save('restore', { base_revision: view.head, version: selected.version });
   }

   async function save(name, payload) {
     if (busy || !visible()) return;
     const fingerprint = JSON.stringify([name, payload]);
     if (previous?.fingerprint !== fingerprint) previous = { fingerprint, id: requestId() };
     const controls = [...body.querySelectorAll('button, input, textarea, select')].filter(control => !control.disabled);
     busy = true;
     controls.forEach(control => { control.disabled = true; });
     status.textContent = 'Сохраняем…';
     try {
       await mutate(action(name), payload, previous.id);
       if (!visible()) return;
       await load();
       previous = null;
       if (visible()) status.textContent = name === 'approve' ? 'Редакция выбрана для новых заказов.' : 'Редакция сохранена.';
     } catch (error) {
       if (visible()) status.textContent = error.message;
     } finally {
       busy = false;
       controls.forEach(control => { control.disabled = false; });
     }
   }

   try { await load(); if (visible()) status.textContent = ''; }
   catch (error) { if (visible()) status.textContent = error.message; }
 }

 global.AelitaChristmasCms = { mount };
 if (typeof module === 'object' && module.exports) module.exports = { previewDocument };
 })(typeof window !== 'undefined' ? window : globalThis);
