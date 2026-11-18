(function (global) {
 'use strict';
 const action = name => 'christmas_cms_' + name;
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
   '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
 }[c]));
 const locked = id => ['price', 'booking'].includes(id);
 const describe = { seed: 'Начальная редакция', edit: 'Изменение', restore: 'Восстановление' };

 async function mount(host, { api, mutate, active, requestId }) {
   let view, busy = false, previous = null;
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
       '<label>Раздел<select data-cms-section>'+selected.content.sections.map(section =>
         '<option value="'+escape(section.id)+'">'+escape(section.title)+'</option>').join('')+'</select></label>'+
       '<form data-cms-edit><label>Заголовок<input name="title" class="ym-disable-keys" required maxlength="200"></label>'+
       '<label>Текст абзацев<textarea class="ym-disable-keys" name="text" rows="6" maxlength="36012"></textarea></label>'+
       '<button type="submit">Сохранить новую редакцию</button></form>'+
       '<div class="actions">'+(editing
         ? '<button type="button" data-cms-approve'+(view.approvedVersion===view.head?' disabled':'')+'>Выбрать для новых заказов</button>'
         : '<button type="button" data-cms-restore>Восстановить как черновик</button>')+'</div>';
     const version = body.querySelector('[data-cms-version]');
     const section = body.querySelector('[data-cms-section]');
     const form = body.querySelector('form');
     const title = form.elements.title, blocks = form.elements.text;
     let opened = section.value, original;
     const dirty = () => title.value !== original.title || blocks.value !== original.text;
     const confirmDiscard = () => !dirty() || global.confirm('Отказаться от изменений этого раздела?');
     const preview = () => {
       const entry = selected.content.sections.find(item => item.id === opened);
       original = { title: entry.title, text: entry.text.join('\n') };
       title.value = original.title;
       blocks.value = original.text;
       const editable = editing && !locked(opened);
       title.readOnly = blocks.readOnly = !editable;
       form.querySelector('button').disabled = !editable;
     };
     preview();
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
       opened = section.value;
       preview();
     };
     form.onsubmit = event => {
       event.preventDefault();
       if (busy || !visible() || title.readOnly || !dirty()) return;
       save('edit', { base_revision: view.head, section: { id: opened, title: title.value, text: blocks.value.split('\n').filter(line => line.trim()) } });
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
})(window);
