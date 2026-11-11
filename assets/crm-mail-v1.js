'use strict';

window.AelitaCrmMail = function mountMail(root, {api, contact, organization=false, recipientLabel='', templateData={}, documentLinks=[], canSend, context=null, contextLabel='', draftDelete=false, autoOpen=false, onSent=null, focusMail='', onTask=null}) {
  let currentContext=context;
  const request = (action, fields = {}) => api({action,[organization?'organizationId':'contactId']:contact.id,
    ...(currentContext?{context:currentContext}:{}),...fields});
  const active = () => root.isConnected;
  const status = {accepted:'Принято почтовым сервером', sending:'Отправка в работе', unknown:'Исход отправки неизвестен',
    rejected:'Письмо отклонено сервером', failed:'Письмо не отправлено', received:'Получено'};
  const msk = new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'medium',timeStyle:'short'});
  root.innerHTML = '<h2>'+(organization?'Почта организации':'Личная почта')+'</h2><div class="actions"></div><div class="crm-mail-compose"></div><p role="status" aria-live="polite"></p><div class="crm-mail-history"></div>';
  const actions = root.querySelector('.actions');
  const compose = root.querySelector('.crm-mail-compose');
  const notice = root.querySelector('[role=status]');
  const history = root.querySelector('.crm-mail-history');
  let busy = false, openReply = null;
  const copyStatus={pending:'Копия ожидает сохранения',saving:'Копия сохраняется',saved:'Копия в «Отправленных» Яндекс Почты',error:'Копию сохранить не удалось',unavailable:'Копия письма недоступна'};
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
    if (!result.items.length && !cursor) paragraph(history,result.next?'На этой странице нет писем в выбранном контексте.':'Писем пока нет.');
    for(const item of result.items)renderItem(item);
    if (result.next) button(history, 'Ещё письма', () => load(result.next)).dataset.mailMore = '';
  }
  function renderItem(item,open=false){
      const details = document.createElement('details');
      details.className = 'record';
      const heading = document.createElement('summary');
      heading.textContent = item.subject || 'Без темы';
      details.append(heading);
      paragraph(details, [item.at && msk.format(new Date(item.at))+' МСК', status[item.status], item.actorName].filter(Boolean).join(' · '));
      paragraph(details, 'От: ' + item.from + ' · Кому: ' + item.to);
      const text = document.createElement('div');
      text.className = 'crm-mail-text';
      text.textContent = item.text;
      details.append(text);
      if(item.direction==='out'&&item.messageId)paragraph(details,'Message-ID · '+item.messageId);
      if(item.deliveryReason==='recipient')paragraph(details,'Проверьте адрес получателя в карточке.');
      if(item.deliveryReason==='smtp_declined')paragraph(details,'Почтовый сервер вернул отказ. Текст письма можно использовать повторно.');
      if(item.deliveryReason==='connection_before_send')paragraph(details,'Проверьте настройки и доступность рабочей почты.');
      if(['sending','unknown'].includes(item.status))button(details,'Проверить статус письма',async()=>{
        const {message}=await request('mail_read',{id:item.id});
        notice.textContent=status[message.status];
        await load();
      });
      if (item.attachments?.length) paragraph(details, 'Вложения: ' + item.attachments.map(file => file.name).join(', '));
      if (item.hasAttachments) paragraph(details, 'Вложения доступны в рабочем почтовом ящике.');
      if(item.sentCopy)paragraph(details,copyStatus[item.sentCopy]);
      if(canSend&&['pending','saving','error'].includes(item.sentCopy))
        button(details,'Сохранить копию в Яндекс Почте',async()=>{
          const {message}=await request('mail_archive_retry',{id:item.id});
          notice.textContent=copyStatus[message.sentCopy]||'Обновите историю писем.';
          await load();
        });
      if(canSend&&item.status==='received'&&contact.emails.includes(item.from))
        button(details,'Ответить',async()=>{
          if(root.crmMailBeforeLeave&&!await root.crmMailBeforeLeave())return;
          if(compose.firstChild&&!confirm('Открыть ответ вместо текущего письма?'))return;
          const result=await request('mail_read',{id:item.id});
          if(!active())return;
          currentContext=result.mailContext||null;
          compose.replaceChildren();
          return open(result.message);
        });
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
  async function open(reply=null) {
    if (compose.firstChild) { compose.querySelector('select')?.focus(); return; }
    openReply=reply;
    const legacy=contact.emails.length>1&&!reply?await request('mail_draft_get'):null;
    let selectedAddress=reply?.from||(contact.emails.includes(legacy?.draft?.to)?legacy.draft.to:contact.emails[0]);
    const scope=()=>({draftTo:selectedAddress,...(reply?{draftReplyId:reply.id}:{})});
    const saved=await request('mail_draft_get',scope()),draft=saved.draft;
    if (!active()) return;
    let revision = saved.revision||draft?.revision||0;
    const form = document.createElement('form');
    form.className = 'inline-form';
    form.innerHTML = '<label>Кому<select name="to" required></select></label><label>Тема<input name="subject" maxlength="200" required></label><label>Текст<textarea name="body" class="ym-disable-keys" maxlength="16000" rows="7" required></textarea></label><label>Подпись<select name="signatureMode"><option value="team" selected>От команды Аэлита Продакшен</option><option value="personal">От моего имени</option></select></label><label>Вложения до 48 КБ<input name="files" type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" multiple></label><div class="actions"></div><div class="crm-mail-preview" aria-live="polite"></div>';
    if(currentContext&&contextLabel)paragraph(compose,'Контекст письма · '+contextLabel);
    if(recipientLabel)paragraph(compose,'Получатель · '+recipientLabel);
    compose.append(form);
    const {to, subject, body, files} = form.elements;
    contact.emails.forEach(email => to.add(new Option(email, email)));
    to.value=selectedAddress;
    if(reply)to.disabled=true;
    const signatureMode=form.elements.namedItem('signatureMode');
    const fillDraft=(stored,answer=null)=>{
      subject.value=stored?.subject|| (answer?(/^Re:/i.test(answer.subject)?answer.subject:'Re: '+answer.subject).slice(0,200):'');
      body.value=stored?.text||'';
      signatureMode.value=stored?(stored.signatureMode||'personal'):'team';
    };
    fillDraft(draft,reply);
    const toolbar = form.querySelector('.actions');
    const previewBox = form.querySelector('.crm-mail-preview');
    const fields = () => ({to:selectedAddress,subject:subject.value,text:body.value,signatureMode:signatureMode.value});
    let baseline=JSON.stringify(fields()),timer=null,saving=Promise.resolve();
    let sending=false,pending=null,repeatOf=null;
    root.crmMailBeforeLeave=async()=>{
      if(!form.isConnected)return true;
      if(sending){notice.textContent='Подождите, пока CRM уточнит результат отправки.';return false;}
      try{await flush();return true;}
      catch(error){notice.textContent=error.message;return confirm('Черновик не сохранён. Закрыть форму?');}
    };
    const flush=()=>{
      clearTimeout(timer);
      saving=saving.catch(()=>{}).then(async()=>{
        if(!active()||!form.isConnected)return;
        const current=fields(),key=JSON.stringify(current);
        if(key===baseline)return;
        const result=await request('mail_draft_save',{...current,...scope(),revision});
        revision=result.revision;
        baseline=key;
        notice.textContent=files.files.length?'Черновик сохранён. Файлы нужно заново выбрать после закрытия формы.':'Черновик сохранён.';
      });
      return saving;
    };
    const schedule=()=>{
      clearTimeout(timer);
      notice.textContent='Ожидает сохранения…';
      timer=setTimeout(()=>flush().catch(error=>{if(active()&&form.isConnected)notice.textContent=error.message;}),650);
    };
    to.onchange=async()=>{
      const next=to.value;
      if(next===selectedAddress)return;
      if(files.files.length&&!confirm('При смене адреса прикреплённые файлы нужно выбрать заново. Продолжить?')){to.value=selectedAddress;return;}
      if(pending||sending){to.value=selectedAddress;return;}
      to.disabled=true;
      try{
        await flush();
        const carry=!!(subject.value.trim()||body.value.trim())&&confirm('Перенести тему и текст в новый черновик? Исходный сохранится.');
        const previous=fields();
        const saved=await request('mail_draft_get',{draftTo:next});
        if(!form.isConnected)return;
        selectedAddress=next;
        revision=saved.revision;
        fillDraft(saved.draft);
        baseline=JSON.stringify(fields());
        if(carry&&(!saved.draft||confirm('У получателя уже есть черновик. Заменить его перенесённым текстом?'))){
          subject.value=previous.subject;
          body.value=previous.text;
          signatureMode.value=previous.signatureMode;
          schedule();
        }
        files.value='';
        files.onchange();
        previewBox.replaceChildren();
      }catch(error){to.value=selectedAddress;notice.textContent=error.message;}
      finally{to.disabled=false;}
    };
    const templates=document.createElement('select');
    templates.setAttribute('aria-label','Шаблон письма');
    templates.add(new Option('Выберите шаблон',''));
    const template=(name,text)=>templates.add(new Option(name,text.replace(/\{(production|city|period|venue)\}/g,(_match,key)=>templateData[key]||'[…]')));
    toolbar.append(templates);
    button(toolbar,'Подставить шаблон',()=>{
      if(!templates.value)return;
      if (body.value.trim() && !confirm('Заменить текущий текст шаблоном?')) return;
      subject.value=templates.selectedOptions[0].textContent;
      body.value=templates.value;
      previewBox.replaceChildren();
      schedule();
    });
    template('Ответ на обращение', 'Здравствуйте!\n\nСпасибо за ваше обращение. ');
    template('Предложение сотрудничества', 'Здравствуйте!\n\nХотим обсудить с вами возможность сотрудничества. ');
    template('Предложение показа','Здравствуйте!\n\nХотим предложить показ спектакля «{production}».\n\nГород: {city}\nПериод: {period}\nФормат и продолжительность: …\nМатериалы для знакомства: …\n\nПодскажите, кому удобнее направить предложение?');
    template('Согласование даты и площадки','Здравствуйте!\n\nПредлагаем сверить даты показа «{production}».\n\nВарианты: {period}\nПлощадка: {venue}\nМонтаж и прогон: …\n\nКакие из дат вы можете подтвердить?');
    template('Технический райдер','Здравствуйте!\n\nНаправляем райдер спектакля «{production}».\n\nСсылка на райдер: …\n\nПросим подтвердить технические возможности площадки и прислать контакт технического специалиста.');
    template('Документы по договору','Здравствуйте!\n\nНаправляем материалы для согласования договора по показу «{production}».\n\nДокументы: …\nПожелания по срокам: …\n\nЖдём ваших комментариев.');
    template('Напоминание о предложении','Здравствуйте!\n\nВозвращаемся к предложению о показе «{production}». Подскажите, удалось ли его посмотреть и когда удобно обсудить следующий шаг?');
    window.AelitaCrmUsability?.selectMenu(templates,'Шаблон письма');
    const urls=[...new Set(documentLinks)].filter(value=>typeof value==='string'&&/^https:\/\/[^\s]+$/.test(value));
    if(urls.length){
      const links=document.createElement('select');
      links.setAttribute('aria-label','Ссылка на документ показа');
      urls.forEach(url=>links.add(new Option(url,url)));
      toolbar.append(links);
      if(urls.length>5)window.AelitaCrmUsability?.selectMenu(links,'Документ для письма');
      button(toolbar,'Вставить ссылку в письмо',()=>{
        const next=body.value+(body.value?'\n\n':'')+links.value;
        if(next.length>16000)throw Error('В письме не осталось места для ссылки.');
        body.value=next;
        previewBox.replaceChildren();
        schedule();
      });
    }
    button(toolbar,'Сохранить черновик',flush);
    if(draftDelete)button(toolbar,'Удалить черновик',async()=>{
      if(!confirm('Удалить черновик письма?'))return;
      clearTimeout(timer);
      await saving.catch(()=>{});
      await request('mail_draft_delete',{...scope(),revision});
      if(active()){compose.replaceChildren();notice.textContent='Черновик удалён.';}
    });
    const fileInfo=document.createElement('p');
    fileInfo.className='hint';
    fileInfo.setAttribute('role','status');
    files.closest('label').after(fileInfo);
    files.onchange=()=>{
      const selected=Array.from(files.files),size=selected.reduce((sum,file)=>sum+file.size,0);
      fileInfo.textContent=selected.length?`${selected.length} из 3 файлов · ${(size/1024).toFixed(1)} из 48 КБ`:'';
      files.setCustomValidity(selected.length>3||size>48*1024?'Сократите число или размер вложений.':'');
    };
    const submit = document.createElement('button');
    submit.className = 'primary';
    submit.type = 'submit';
    submit.textContent = 'Предпросмотр';
    toolbar.append(submit);
    form.oninput = event=>{
      if(![to,subject,body,files,signatureMode].includes(event.target))return;
      previewBox.replaceChildren();
      if(event.target!==to&&event.target!==files)schedule();
    };
    form.onsubmit = event => {
      event.preventDefault();
      if(pending||sending||to.disabled&&!reply)return;
      operation(async () => {
        previewBox.replaceChildren();
        const sentFields = fields();
        const selected = Array.from(files.files);
        const payload = {...sentFields,...(openReply?{replyId:openReply.id}:{}),...(repeatOf?{repeatOf}:{}),attachments:await encodeFiles(selected)};
        const {preview, token} = await request('mail_preview', payload);
        if (!active() || JSON.stringify(sentFields) !== JSON.stringify(fields()) ||
            selected.length !== files.files.length || selected.some((file, index) => file !== files.files[index])) return;
        if(contextLabel)paragraph(previewBox,'Контекст · '+contextLabel);
        paragraph(previewBox,'От: '+preview.from+' · Кому: '+(recipientLabel?recipientLabel+' · ':'')+preview.to);
        paragraph(previewBox, preview.subject);
        const text = document.createElement('div');
        text.className = 'crm-mail-text';
        text.textContent = preview.text;
        previewBox.append(text);
        if (preview.attachments.length) paragraph(previewBox, 'Вложения: ' + preview.attachments.map(file=>file.name+' ('+(file.size/1024).toFixed(1)+' КБ)').join(', '));
        button(previewBox, 'Отправить письмо', async () => {
          if(JSON.stringify(fields())!==JSON.stringify(sentFields)||selected.length!==files.files.length||
            selected.some((file,index)=>file!==files.files[index]))return;
          await transmit({id:preview.id,payload:{...payload,id:preview.id,token},sentFields});
        }).className = 'primary';
      });
    };
    const receipt=document.createElement('div');
    receipt.className='crm-mail-preview';
    receipt.setAttribute('aria-live','polite');
    form.after(receipt);

    async function checkAttempt(attempt){
      try{
        const {message}=await request('mail_read',{id:attempt.id});
        await showOutcome(attempt,message,attempt.repeated===true);
      }catch(error){
        if(error.code!=='not_found')throw error;
        receipt.replaceChildren();
        paragraph(receipt,'CRM пока не видит запись об этой отправке.');
        button(receipt,'Проверить ещё раз',()=>checkAttempt(attempt));
        button(receipt,'Продолжить ту же попытку',()=>transmit(attempt));
      }
    }

    function requireResolution(attempt){
      pending=attempt;
      submit.disabled=true;
      to.disabled=true;
      receipt.replaceChildren();
      button(receipt,'Проверить статус',()=>checkAttempt(attempt));
    }

    async function showOutcome(attempt,message,repeated=false){
      if(!active()||!form.isConnected)return;
      attempt.id=message.id;
      attempt.repeated=repeated;
      notice.textContent=status[message.status]+(message.sentCopy?' · '+copyStatus[message.sentCopy]:'');
      if(repeated)notice.textContent+=' · CRM нашла письмо с тем же содержанием.';
      previewBox.replaceChildren();
      if(['sending','unknown'].includes(message.status)||repeated&&message.status==='accepted'){
        requireResolution(attempt);
        if(message.status!=='sending'){
          paragraph(receipt,message.status==='unknown'?'Сверьте письмо с рабочим ящиком по Message-ID.':'Можно открыть запись предыдущего письма в истории.');
          button(receipt,'Подготовить отдельную отправку',()=>{
            if(!confirm('Подготовить ещё одну отправку этого письма? Получатель может получить его повторно.'))return;
            repeatOf=message.id;
            pending=null;
            submit.disabled=false;
            to.disabled=!!reply;
            receipt.replaceChildren();
            submit.focus();
          });
        }
      }else{
        pending=null;
        repeatOf=null;
        submit.disabled=false;
        to.disabled=!!reply;
        receipt.replaceChildren();
        if(message.status==='accepted'&&JSON.stringify(fields())===JSON.stringify(attempt.sentFields)){
          try{
            clearTimeout(timer);
            await request('mail_draft_delete',{...scope(),revision});
            receipt.remove();
            compose.replaceChildren();
          }catch{notice.textContent+=' · Черновик можно удалить вручную.';}
        }
      }
      onSent?.();
      try{await load();}catch{if(active())notice.textContent+=' · Историю можно обновить отдельно.';}
    }

    async function transmit(attempt){
      const controls=Array.from(form.elements).filter(control=>!control.disabled);
      sending=true;
      controls.forEach(control=>{control.disabled=true;});
      try{
        await flush();
        requireResolution(attempt);
        notice.textContent='Отправляем…';
        let result;
        try{result=await request('mail_send',attempt.payload);}
        catch(error){
          if(error.code&&!['storage_unavailable','mail_busy'].includes(error.code)){
            pending=null;
            receipt.replaceChildren();
            previewBox.replaceChildren();
            notice.textContent=error.message;
          }else notice.textContent='Результат пока не получен. Проверьте статус письма.';
          return;
        }
        await showOutcome(attempt,result.message,result.repeated===true);
      }finally{
        sending=false;
        controls.forEach(control=>{control.disabled=false;});
        submit.disabled=!!pending;
        to.disabled=!!reply||!!pending;
      }
    }
    to.focus();
  }
  if (canSend && contact.emails.length && !autoOpen) button(actions, 'Написать письмо', open).className = 'primary';
  button(actions,'Обновить историю писем',()=>load());
  root.dataset.crmMailEditor='';
  if(autoOpen&&canSend&&contact.emails.length)operation(open);
  if(focusMail)operation(async()=>{
    const {message}=await request('mail_read',{id:focusMail});
    if(active()){history.replaceChildren();renderItem(message,true);history.scrollIntoView({block:'nearest'});}
  });
};
