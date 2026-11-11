'use strict';

window.AelitaCrmMail = function mountMail(root, {api, contact, canSend, context=null, contextLabel='', draftDelete=false, autoOpen=false, onSent=null, focusMail='', onTask=null}) {
  const request = (action, fields = {}) => api({action, contactId: contact.id, ...(context?{context}:{}), ...fields});
  const active = () => root.isConnected;
  const status = {accepted: 'Принято почтовым сервером', unknown: 'Исход неизвестен', rejected: 'Отклонено сервером', received: 'Получено'};
  root.innerHTML = '<h2>Личная почта</h2><div class="actions"></div><div class="crm-mail-compose"></div><p role="status" aria-live="polite"></p><div class="crm-mail-history"></div>';
  const actions = root.querySelector('.actions');
  const compose = root.querySelector('.crm-mail-compose');
  const notice = root.querySelector('[role=status]');
  const history = root.querySelector('.crm-mail-history');
  let busy = false;
  const button = (parent, label, run) => {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = label;
    control.onclick = () => operation(run);
    parent.append(control);
    return control;
  };
  async function operation(run) {
    if (busy || !active()) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    try { await run(); }
    catch (error) { if (active()) notice.textContent = error.message; }
    finally { busy = false; root.removeAttribute('aria-busy'); }
  }
  function paragraph(parent, text) {
    const node = document.createElement('p');
    node.textContent = text;
    parent.append(node);
  }
  async function load(cursor = null) {
    const result = await request('mail_list', {cursor});
    if (!active()) return;
    if (!cursor) history.replaceChildren();
    history.querySelector('[data-mail-more]')?.remove();
    if (!result.items.length && !cursor) paragraph(history, 'Писем пока нет.');
    for(const item of result.items)renderItem(item);
    if (result.next) button(history, 'Ещё письма', () => load(result.next)).dataset.mailMore = '';
  }
  function renderItem(item,open=false){
      const details = document.createElement('details');
      details.className = 'record';
      const heading = document.createElement('summary');
      heading.textContent = item.subject || 'Без темы';
      details.append(heading);
      paragraph(details, [item.at && new Date(item.at).toLocaleString('ru-RU'), status[item.status], item.actorName].filter(Boolean).join(' · '));
      paragraph(details, 'От: ' + item.from + ' · Кому: ' + item.to);
      const text = document.createElement('div');
      text.className = 'crm-mail-text';
      text.textContent = item.text;
      details.append(text);
      if (item.attachments?.length) paragraph(details, 'Вложения: ' + item.attachments.map(file => file.name).join(', '));
      if (item.hasAttachments) paragraph(details, 'Вложения доступны в рабочем почтовом ящике.');
      if(onTask&&['accepted','received'].includes(item.status))button(details,'Поставить задачу',()=>onTask(item));
      details.open=open;history.append(details);
  }
  async function encodeFiles(files) {
    if (files.length > 3 || Array.from(files).reduce((sum, file) => sum + file.size, 0) > 48 * 1024) {
      throw Error('Можно прикрепить до трёх файлов, суммарно до 48 КБ.');
    }
    return Promise.all(Array.from(files, async file => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return {name: file.name, data: btoa(String.fromCharCode(...bytes))};
    }));
  }
  async function open() {
    if (compose.firstChild) { compose.querySelector('select')?.focus(); return; }
    const saved = await request('mail_draft_get'),draft=saved.draft;
    if (!active()) return;
    let revision = saved.revision||draft?.revision||0;
    const form = document.createElement('form');
    form.className = 'inline-form';
    form.innerHTML = '<label>Кому<select name="to" required></select></label><label>Тема<input name="subject" maxlength="200" required></label><label>Текст<textarea name="body" class="ym-disable-keys" maxlength="16000" rows="7" required></textarea></label><label>Вложения до 48 КБ<input name="files" type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" multiple></label><div class="actions"></div><div class="crm-mail-preview" aria-live="polite"></div>';
    if(contextLabel)paragraph(compose,'Контекст письма · '+contextLabel);
    compose.append(form);
    const {to, subject, body, files} = form.elements;
    contact.emails.forEach(email => to.add(new Option(email, email)));
    if (contact.emails.length > 1) to.add(new Option('Выберите адрес', ''), 0);
    to.selectedIndex = 0;
    if (draft) {
      if (contact.emails.includes(draft.to)) to.value = draft.to;
      subject.value = draft.subject;
      body.value = draft.text;
    }
    const toolbar = form.querySelector('.actions');
    const previewBox = form.querySelector('.crm-mail-preview');
    const fields = () => ({to: to.value, subject: subject.value, text: body.value});
    const template = (name, text) => button(toolbar, name, () => {
      if (body.value.trim() && !confirm('Заменить текущий текст шаблоном?')) return;
      subject.value = name;
      body.value = text;
      previewBox.replaceChildren();
    });
    template('Ответ на обращение', 'Здравствуйте!\n\nСпасибо за ваше обращение. ');
    template('Предложение сотрудничества', 'Здравствуйте!\n\nХотим обсудить с вами возможность сотрудничества. ');
    button(toolbar, 'Сохранить черновик', async () => {
      const result = await request('mail_draft_save', {...fields(), revision});
      if (!active()) return;
      revision = result.draft.revision;
      notice.textContent = files.files.length ? 'Черновик сохранён. Вложения добавляются при отправке.' : 'Черновик сохранён.';
    });
    if(draftDelete)button(toolbar,'Удалить черновик',async()=>{
      if(!confirm('Удалить черновик письма?'))return;
      await request('mail_draft_delete',{revision});
      if(active()){compose.replaceChildren();notice.textContent='Черновик удалён.';}
    });
    const submit = document.createElement('button');
    submit.className = 'primary';
    submit.type = 'submit';
    submit.textContent = 'Предпросмотр';
    toolbar.append(submit);
    form.oninput = () => previewBox.replaceChildren();
    form.onsubmit = event => {
      event.preventDefault();
      operation(async () => {
        previewBox.replaceChildren();
        const sentFields = fields();
        const selected = Array.from(files.files);
        const payload = {...sentFields, attachments: await encodeFiles(selected)};
        const {preview, token} = await request('mail_preview', payload);
        if (!active() || JSON.stringify(sentFields) !== JSON.stringify(fields()) ||
            selected.length !== files.files.length || selected.some((file, index) => file !== files.files[index])) return;
        if(contextLabel)paragraph(previewBox,'Контекст · '+contextLabel);
        paragraph(previewBox, 'От: ' + preview.from + ' · Кому: ' + preview.to);
        paragraph(previewBox, preview.subject);
        const text = document.createElement('div');
        text.className = 'crm-mail-text';
        text.textContent = preview.text;
        previewBox.append(text);
        if (preview.attachments.length) paragraph(previewBox, 'Вложения: ' + preview.attachments.map(file => file.name).join(', '));
        button(previewBox, 'Отправить письмо', async () => {
          notice.textContent = 'Отправляем…';
          const {message} = await request('mail_send', {...payload, id: preview.id, token});
          if (!active()) return;
          notice.textContent = status[message.status] + (message.status === 'unknown' ? '. Проверьте историю и рабочий ящик.' : '.');
          previewBox.replaceChildren();
          await load();
          if(message.status==='accepted'&&onSent)onSent();
        }).className = 'primary';
      });
    };
    to.focus();
  }
  if (canSend && contact.emails.length) button(actions, 'Написать письмо', open).className = 'primary';
  if(!context)button(actions, 'Загрузить историю писем', () => load());
  if(autoOpen&&canSend&&contact.emails.length)operation(open);
  if(focusMail)operation(async()=>{
    const {message}=await request('mail_read',{id:focusMail});
    if(active()){history.replaceChildren();renderItem(message,true);history.scrollIntoView({block:'nearest'});}
  });
};
