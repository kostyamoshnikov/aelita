(function () {
 'use strict';
 window.AelitaCrmProduction = function ({
  state, esc, input, select, options, link, date, money, who, api, mutate,
  canRead, canWrite, openDialog, dialog, notice, stages, stageNames
 }) {
  const orgTypes = {venue:'Площадка',theatre:'Театр',culture:'Учреждение культуры',authority:'Орган власти',partner:'Партнёр',sponsor:'Спонсор',foundation:'Фонд / грантодатель',ticket_partner:'Билетный партнёр',company:'Компания',press:'СМИ и медиа',supplier:'Подрядчик',other:'Другое'};
  const contactFunctions = {director:'Руководство',programming:'Репертуар / программирование',press:'Пресс-служба / PR',technical:'Техническая служба',ticketing:'Билетная служба',production:'Продюсирование / организация',finance:'Финансы / договоры',other:'Другая роль'};
  const projectFunctions = {venue:'Площадка',coproducer:'Сопродюсер',partner:'Партнёр',sponsor:'Спонсор',media:'Информационный партнёр',ticket_partner:'Билетный партнёр',funder:'Грантодатель',rights_holder:'Правообладатель',supplier:'Подрядчик',other:'Другая роль'};
  const commitments = {sponsor:'Спонсорское',rights:'Авторские и лицензионные права',other:'Другое'};
  const interactions = {call:'Звонок',meeting:'Встреча',email:'Письмо',message:'Сообщение',other:'Другое'};
  const models = {fixed:'Фиксированный гонорар',rent:'Аренда',share:'Процент от сборов'};
  const socials = {
   vk:'ВКонтакте · VK',instagram:'Instagram',telegram:'Telegram',youtube:'YouTube',
   dzen:'Дзен',rutube:'Rutube',ok:'Одноклассники · OK',tiktok:'TikTok',facebook:'Facebook',
   linkedin:'LinkedIn',x:'X · Twitter',threads:'Threads',vimeo:'Vimeo',max:'MAX',pinterest:'Pinterest',
   behance:'Behance',whatsapp:'WhatsApp',vkvideo:'VK Видео',other:'Другая соцсеть'
  };
  const aliases = {instagram:'инстаграм',telegram:'телеграм tg тг',youtube:'ютуб ютьюб',dzen:'dzen',rutube:'рутуб',ok:'одноклассники ок',tiktok:'тикток',facebook:'фейсбук',linkedin:'линкедин',x:'твиттер',max:'макс',whatsapp:'ватсап',pinterest:'пинтерест'};
  const quick = ['vk','instagram','telegram','youtube'];
  const roleLabels = type => type === 'contacts' ? contactFunctions : projectFunctions;
  const orgs = () => state.lookups.organizations || [];
  const isVenue = x => !!(x?.type === 'venue' || x?.type === 'theatre' || x?.venueEligible || x?.venueDetails);
  const urlLink = (url, label) => /^https:\/\//i.test(url || '') ?
   '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>' : '';
  const list = rows => rows.length ? '<ul class="production-list">'+rows.map(row=>'<li>'+row+'</li>').join('')+'</ul>' : '';
  const dataRows = rows => {
   const filled=rows.filter(([,value])=>value!==''&&value!=null);
   return filled.length ? '<dl>'+filled.map(([label,value])=>'<dt>'+label+'</dt><dd>'+value+'</dd>').join('')+'</dl>' : '';
  };
  const button = (attribute,label) => '<button type="button" '+attribute+'>'+label+'</button>';
  const socialButton = key => button('data-social-platform="'+key+'"',socials[key]);
  const socialRow = ({platform,url='',label=''}) => '<div class="production-edit-row" data-social-row="'+platform+'">'+
   input('','Ссылка · '+socials[platform],url,'url',true)+
   (platform==='other'?input('','Название соцсети',label,'text',true):'')+
   button('data-production-remove aria-label="Удалить ссылку · '+socials[platform]+'"','Удалить')+'</div>';
  const selectRelated = (name,label,values,id,empty) => select(name,label,
   '<option value="">'+empty+'</option>'+values.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===id?'selected':'')+'>'+esc(x.label)+(x.archived?' · архив':'')+'</option>').join('')+
   (id&&!values.some(x=>x.id===id)?'<option value="'+esc(id)+'" selected>Связь вне вашего доступа</option>':''));
  const roleRow = (type,row={}) => '<div class="production-edit-row" data-production-role>'+
   selectRelated('','Организация',orgs().filter(x=>!x.archived||x.id===row.organizationId),row.organizationId,'Выберите организацию')+
   select('','Роль','<option value="">Выберите роль</option>'+options(roleLabels(type),row.role))+
   button('data-production-remove','Удалить роль')+'</div>';
  const fieldset = (name,label,contents,active) => '<div class="full production-editor" data-production-block="'+name+'">'+
   '<button type="button" data-production-add-block '+(active?'hidden':'')+'>+ Добавить '+label+'</button>'+
   '<fieldset '+(active?'':'hidden disabled')+'><legend>'+label.charAt(0).toUpperCase()+label.slice(1)+'</legend><div class="form-grid">'+contents+'</div>'+
   button('data-production-clear','Убрать блок')+'</fieldset></div>';

  function editor(type,x) {
   if(type==='organizations'){
    const v=x.venueDetails||{};
    const social='<div class="full production-editor" data-social-editor><div data-social-rows>'+((x.socialLinks||[]).map(socialRow).join(''))+'</div>'+
     button('data-social-toggle aria-expanded="false"','+ Добавить соцсеть')+
     '<div class="production-picker" data-social-picker hidden><div class="actions">'+quick.map(socialButton).join('')+'</div>'+
     '<label class="field"><span>Поиск соцсети</span><input class="ym-disable-keys" type="search" placeholder="Например, Дзен или Rutube" data-social-search></label><div class="actions" data-social-matches></div></div></div>';
    const venue=fieldset('venue','данные площадки',input('v_capacity','Вместимость, мест',v.capacity,'number')+
     input('v_width','Ширина сцены, м',v.width)+input('v_depth','Глубина сцены, м',v.depth)+input('v_height','Высота сцены, м',v.height)+
     selectRelated('v_technicalContactId','Технический контакт',state.lookups.contacts||[],v.technicalContactId,'Контакт не выбран')+
     input('v_riderUrl','Ссылка на технический райдер',v.riderUrl,'url',true)+input('v_stage','Особенности сцены и площадки',v.stage,'textarea',true),!!x.venueDetails);
    return {social,fields:venue};
   }
   if(type==='contacts'||type==='projects')return {fields:'<div class="full production-editor" data-role-editor><div data-role-rows>'+
    (x.organizationRoles||[]).map(row=>roleRow(type,row)).join('')+'</div>'+
    button('data-role-add',type==='contacts'?'+ Добавить роль в организации':'+ Добавить роль организации в проекте')+'</div>'};
   if(type==='tasks')return {fields:select('commitment','Обязательство',options({'':'Обычная задача',...commitments},x.commitment||''),true)+
    '<p class="hint full" data-commitment-hint '+(x.commitment?'':'hidden')+'>Для обязательства укажите срок и проект. Можно выбрать сделку с привязанным проектом.</p>'};
   if(type==='deals'){
    const s=x.show||{};
    const terms=select('s_model','Условия',options({'':'Модель обсуждается',...models},s.model||''))+
     input('s_agreedFeeRub','Гонорар / аренда, ₽',s.agreedFeeMinor==null?'':s.agreedFeeMinor/100)+input('s_sharePercent','Доля от сборов, %',s.sharePercent)+
     input('s_travel','Кто организует и оплачивает проезд',s.travel)+input('s_lodging','Кто организует и оплачивает проживание',s.lodging)+
     input('s_ticketing','Кто ведёт продажу билетов',s.ticketing)+input('s_contractUrl','Ссылка на договор',s.contractUrl,'url',true)+
     input('s_riderUrl','Ссылка на райдер',s.riderUrl,'url',true)+input('s_pressKitUrl','Ссылка на пресс-кит',s.pressKitUrl,'url',true);
    return {fields:fieldset('show','потенциальный показ',input('s_city','Город показа',s.city)+
     selectRelated('s_venueOrganizationId','Площадка показа',orgs().filter(y=>!y.archived||y.id===s.venueOrganizationId),s.venueOrganizationId,'Площадка обсуждается')+
     input('s_dateFrom','Окно дат · начало',s.dateFrom,'date')+input('s_dateTo','Окно дат · конец',s.dateTo,'date')+terms+(state.showEventsReady?window.AelitaCrmShowEvents.editor(x,input,state.calendarReady):''),!!x.show)};
   }
   return {fields:''};
  }

  function wireEditor(form,type) {
   form.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    if(b.hasAttribute('data-production-remove')){const row=b.closest('.production-edit-row'),after=row.nextElementSibling||row.previousElementSibling;row.remove();(after?.querySelector('input,select')||form.querySelector('[data-social-toggle],[data-role-add]'))?.focus();}
    if(b.hasAttribute('data-role-add')){
     const target=form.querySelector('[data-role-rows]');
     if(target.children.length>=40){notice('Можно сохранить до 40 ролей',true);return;}
     target.insertAdjacentHTML('beforeend',roleRow(type));target.lastElementChild.querySelector('select').focus();
    }
    if(b.hasAttribute('data-social-toggle')){
     const picker=form.querySelector('[data-social-picker]');picker.hidden=!picker.hidden;b.setAttribute('aria-expanded',String(!picker.hidden));
     if(!picker.hidden)picker.querySelector('[data-social-search]').focus();
    }
    if(b.hasAttribute('data-social-platform')){
     const target=form.querySelector('[data-social-rows]');
     if(target.children.length>=24){notice('Можно сохранить до 24 ссылок',true);return;}
     target.insertAdjacentHTML('beforeend',socialRow({platform:b.dataset.socialPlatform}));
     const picker=form.querySelector('[data-social-picker]');picker.hidden=true;form.querySelector('[data-social-toggle]').setAttribute('aria-expanded','false');
     target.lastElementChild.querySelector('input').focus();
    }
    if(b.hasAttribute('data-production-add-block')||b.hasAttribute('data-production-clear')){
     const parent=b.closest('[data-production-block]'),block=parent.querySelector('fieldset'),add=parent.querySelector('[data-production-add-block]'),hide=b.hasAttribute('data-production-clear');
     block.hidden=hide;block.disabled=hide;add.hidden=!hide;
     if(hide){for(const el of block.querySelectorAll('input,textarea,select'))el.value='';add.focus();}
     else {updateModel();block.querySelector('input,select')?.focus();}
    }
   });
   const search=form.querySelector('[data-social-search]');
   if(search)search.addEventListener('input',()=>{
    const q=search.value.trim().toLocaleLowerCase('ru'),matches=form.querySelector('[data-social-matches]');
    matches.innerHTML=q?Object.keys(socials).filter(k=>!quick.includes(k)&&[k,socials[k],aliases[k]].join(' ').toLocaleLowerCase('ru').includes(q)).map(socialButton).join('')||'<p class="hint">Совпадений нет. Можно добавить свою ссылку.</p>'+socialButton('other'):'';
   });
   const model=form.elements.namedItem('s_model'),percent=form.elements.namedItem('s_sharePercent');
   function updateModel(){if(percent){percent.disabled=model.value!=='share';percent.closest('label').hidden=percent.disabled;}}
   if(model){updateModel();model.addEventListener('change',updateModel);}
   const commitment=form.elements.namedItem('commitment');
   if(commitment)commitment.addEventListener('change',()=>{form.querySelector('[data-commitment-hint]').hidden=!commitment.value;});
  }

  function collect(form,type,data) {
   const value=key=>String(data[key]??'').trim();
   const numeric=key=>{
    if(!value(key))return null;
    if(!/^\d+(?:[.,]\d{1,2})?$/.test(value(key)))throw Error('Укажите число с точностью до двух знаков после запятой');
    return Number(value(key).replace(',','.'));
   };
   const enabled=name=>!form.querySelector('[data-production-block="'+name+'"] fieldset').disabled;
   if(type==='organizations'){
    data.socialLinks=[...form.querySelectorAll('[data-social-row]')].flatMap(row=>{
     const [url,label]=[...row.querySelectorAll('input')].map(el=>el.value.trim());
     return url?[{platform:row.dataset.socialRow,url,...(label?{label}:{})}]:[];
    });
    data.venueDetails=enabled('venue')?{
     capacity:numeric('v_capacity'),width:numeric('v_width'),depth:numeric('v_depth'),height:numeric('v_height'),
     technicalContactId:value('v_technicalContactId'),riderUrl:value('v_riderUrl'),stage:value('v_stage')
    }:null;
   }
   if(type==='contacts'||type==='projects'){
    data.organizationRoles=[...form.querySelectorAll('[data-production-role]')].flatMap(row=>{
     const [organizationId,role]=[...row.querySelectorAll('select')].map(el=>el.value);
     if(!organizationId&&!role)return [];
     if(!organizationId||!role)throw Error('Выберите организацию и роль или удалите незаполненную строку');
     return [{organizationId,role}];
    });
    data.organizationIds=[...new Set([...data.organizationIds,...data.organizationRoles.map(row=>row.organizationId)])];
   }
   if(type==='deals'){
    const fee=numeric('s_agreedFeeRub');
    data.show=enabled('show')?{
     city:value('s_city'),venueOrganizationId:value('s_venueOrganizationId'),dateFrom:value('s_dateFrom'),dateTo:value('s_dateTo'),
     model:value('s_model'),agreedFeeMinor:fee==null?null:Math.round(fee*100),sharePercent:numeric('s_sharePercent'),
     travel:value('s_travel'),lodging:value('s_lodging'),ticketing:value('s_ticketing'),
     contractUrl:value('s_contractUrl'),riderUrl:value('s_riderUrl'),pressKitUrl:value('s_pressKitUrl')
    }:null;
   }
   for(const key of Object.keys(data))if(key===''||/^[vs]_/.test(key))delete data[key];
  }

  function rolesPanel(type,x) {
   const rows=(x.organizationRoles||[]).map(row=>link('organizations',row.organizationId)+' · '+esc(roleLabels(type)[row.role]));
   return rows.length?'<section class="panel production-panel"><h2>'+(type==='contacts'?'Роли в организациях':'Роли организаций в проекте')+'</h2>'+list(rows)+'</section>':'';
  }
  function badges(type,x) {
   if(type==='deals'&&x.show)return '<p class="eyebrow">Потенциальный показ'+(state.showEventsReady?(x.showEvent?' · событие связано':x.showDraft?' · черновик события':''):'')+'</p><p>'+esc([x.show.city,stageNames[x.stage]||stages[x.stage],[x.show.dateFrom,x.show.dateTo].filter(Boolean).join(' — ')].filter(Boolean).join(' · '))+'</p>';
   if(type==='tasks'&&x.commitment)return '<p class="eyebrow">Обязательство · '+esc(commitments[x.commitment])+'</p>';
   return '';
  }
  function showPanel(x) {
   const s=x.show;
   if(!s)return '';
   return '<section class="panel production-panel"><h2>Потенциальный показ</h2>'+dataRows([
    ['Этап',esc(stageNames[x.stage]||stages[x.stage])],['Город',esc(s.city)],['Площадка',s.venueOrganizationId?link('organizations',s.venueOrganizationId):''],
    ['Окно дат',esc([s.dateFrom,s.dateTo].filter(Boolean).join(' — '))],['Модель',esc(models[s.model])],
    ['Гонорар / аренда',s.agreedFeeMinor==null?'':esc(money(s.agreedFeeMinor))],['Доля от сборов',s.sharePercent==null?'':esc(s.sharePercent)+'%'],
    ['Проезд',esc(s.travel)],['Проживание',esc(s.lodging)],['Билеты',esc(s.ticketing)],
    ['Договор',urlLink(s.contractUrl,'Открыть договор')],['Райдер',urlLink(s.riderUrl,'Открыть райдер')],['Пресс-кит',urlLink(s.pressKitUrl,'Открыть пресс-кит')]
   ])+'</section>';
  }
  function orgOverview(x,summary={}) {
   const v=x.venueDetails,n=summary.nextTask;
   const links=(x.socialLinks||[]).map(s=>urlLink(s.url,s.label||socials[s.platform])).filter(Boolean);
   const people=(summary.contacts||[]).map(c=>link('contacts',c.id)+(c.roles.length?' · '+esc(c.roles.map(r=>contactFunctions[r]).join(', ')):''));
   return (links.length?'<section class="panel production-panel"><h2>Соцсети</h2>'+list(links)+'</section>':'')+
    (v?'<details class="panel production-panel"><summary>Данные площадки</summary>'+dataRows([
     ['Вместимость',v.capacity?esc(v.capacity)+' мест':''],
     ['Сцена',esc([[v.width,'ширина'],[v.depth,'глубина'],[v.height,'высота']].filter(([value])=>value).map(([value,label])=>label+' '+value+' м').join(' · '))],
     ['Особенности',esc(v.stage)],['Технический контакт',v.technicalContactId?link('contacts',v.technicalContactId):''],['Райдер',urlLink(v.riderUrl,'Открыть райдер')]
    ])+'</details>':'')+
    (people.length?'<section class="panel production-panel"><h2>Контактные лица</h2>'+list(people)+'</section>':'')+
    (canRead('tasks')?'<section class="panel production-panel"><h2>Ближайшая задача</h2>'+(n?
     '<p><button type="button" class="name-link" data-open="'+esc(n.id)+'" data-type="tasks">'+esc(n.title)+'</button></p>'+
     '<p class="hint">'+esc(date(n.dueAt))+' · МСК · '+esc(who(n.ownerId))+'</p>'+(n.projectId?'<p>'+link('projects',n.projectId)+'</p>':''):
     '<p class="hint">Открытых задач со сроком пока нет.</p>')+'</section>':'');
  }

  function orgHistory(view,x,job,mailOnly=false) {
   const canAdd=!x.archivedAt&&canWrite('organizations',x);
   const showMail=state.mailEnabled&&state.externalAllowed&&canRead('contacts');
   const block=(key,title,action)=>'<section class="panel production-panel"><div class="row between"><h2>'+title+'</h2>'+
    (canAdd&&action?button('data-log-add="'+key+'"',action):'')+'</div><div data-log="'+key+'" aria-live="polite"></div></section>';
   const area=view.querySelector('[data-production-history]');
   area.innerHTML=(mailOnly?'':block('notes','Заметки','+ Добавить заметку')+block('interactions','История общения','+ Записать общение'))+
    (showMail?block('mail','Письма из CRM'):'');
   const active=()=>state.viewJob===job&&state.token===job.token&&area.isConnected;
   const keys=[...(mailOnly?[]:['notes','interactions']),...(showMail?['mail']:[])];
   const versions={};
   async function load(key,offset=0) {
    const box=area.querySelector('[data-log="'+key+'"]');
    const seq=versions[key]=(versions[key]||0)+1;
    box.innerHTML='<p class="hint">Загружаем…</p>';
    try {
     const result=await api({action:key==='mail'?'organization_mail':'organization_history',id:x.id,kind:key,offset});
     if(!active()||seq!==versions[key])return;
     const mail=key==='mail',items=result.items.map(row=>{
      const title=mail?esc(row.subject):esc(row.note);
      const prefix=key==='interactions'?esc(interactions[row.kind.replace('interaction_','')])+' · ':'';
      const person=mail?' · <button type="button" class="name-link" data-open="'+esc(row.contactId)+'" data-type="contacts">'+esc(row.contactName)+'</button>':'';
      return '<p class="production-entry">'+title+'</p><p class="hint">'+prefix+esc(date(row.at))+' · '+esc(row.actorName||'CRM')+person+
       (mail&&row.legacy?' · по текущей связи':'')+'</p>';
     });
     box.innerHTML=(list(items)||'<p class="hint">Записей пока нет.</p>')+
      (mail&&result.older?'<p class="hint">Более ранние письма доступны в карточках контактов.</p>':'')+
      (result.incomplete?'<p class="error">Часть писем недоступна. Попробуйте обновить историю.</p>'+button('data-log-page="'+offset+'"','Обновить'):'')+
      '<div class="actions">'+(offset?button('data-log-page="'+Math.max(0,offset-(mail?8:30))+'"','Назад'):'')+
      (result.next!=null?button('data-log-page="'+result.next+'"',mail?'Следующие контакты':'Дальше'):'')+'</div>';
    } catch(err) {
     if(active()&&seq===versions[key])box.innerHTML='<p class="error">'+esc(err.message)+'</p>'+button('data-log-page="'+offset+'"','Повторить');
    }
   }
   area.addEventListener('click',e=>{
    const page=e.target.closest('[data-log-page]');
    if(page)return load(page.closest('[data-log]').dataset.log,Number(page.dataset.logPage));
    const add=e.target.closest('[data-log-add]');
    if(!add)return;
    const key=add.dataset.logAdd,note=key==='notes';
    openDialog(note?'Новая заметка':'Записать общение','<form data-production-log-form><div class="form-grid">'+
     (note?'':select('interaction','Канал',options(interactions,'call'),true))+
     input('text',note?'Заметка':'Что обсудили','','textarea',true,true)+'</div><p class="form-error" role="alert"></p><div class="actions">'+
     '<button type="submit" class="primary">Сохранить</button>'+button('data-dialog-close','Отмена')+'</div></form>');
    const form=dialog.querySelector('[data-production-log-form]');
    form.onsubmit=async ev=>{
     ev.preventDefault();
     const submit=form.querySelector('[type="submit"]'),fields=new FormData(form);
     submit.disabled=true;
     try {
      await mutate('note_add',{type:'organizations',id:x.id,text:fields.get('text'),...(note?{}:{interaction:fields.get('interaction')})});
      if(dialog.open&&form.isConnected)dialog.close();
      if(active()){await load(key);notice(note?'Заметка сохранена':'Общение записано');}
     } catch(err) {form.querySelector('.form-error').textContent=err.message;}
     finally {submit.disabled=false;}
    };
   });
   for(const key of keys)load(key);
  }
  return {orgTypes,isVenue,editor,wireEditor,collect,rolesPanel,badges,showPanel,orgOverview,orgHistory,stageNames};
 };
})();
