(function(){
 'use strict';
 const channels={call:'Звонок',meeting:'Встреча',email:'Письмо вне CRM',message:'Сообщение',other:'Другое'};
 const refs={organizationId:['organizations','Организация'],contactId:['contacts','Контакт'],projectId:['projects','Проект'],dealId:['deals','Показ']};
 const primary={organizations:'organizationId',contacts:'contactId',projects:'projectId',deals:'dealId'};
 const dateInput=v=>v?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' ','T'):'';
 const fromInput=v=>v?new Date(v+':00+03:00').toISOString():null;
 const button=(name,label)=>'<button type="button" data-entry-action="'+name+'">'+label+'</button>';
 const mailLink=(contactId,id,organizationId)=>'/admin/crm/?'+(organizationId?'organization='+encodeURIComponent(organizationId):'contact='+encodeURIComponent(contactId))+'&mail='+encodeURIComponent(id);
 const linkFor=r=>r.mail?mailLink(r.contactId,r.id,r.organizationId):'/admin/crm/?entry='+encodeURIComponent(r.id)+'&entryType='+encodeURIComponent(r.type)+'&entryEntity='+encodeURIComponent(r.entityId);
 function mount(root,type,x,{state,active,api,mutate,esc,input,select,options,date,openDialog,dialog,edit,notice,canWrite,canWriteTasks,focus}){
  const groups=['notes',...((type!=='tasks'&&(type!=='deals'||x.show))?['interactions']:[])];
  const view=Object.fromEntries(groups.map(k=>[k,{deleted:false,offset:0,seq:0,items:[],filters:{}}]));
  root.innerHTML=groups.map(k=>'<section class="panel production-panel" data-entry-group="'+k+'"><h2>'+
   (k==='notes'?'Заметки':'История общения')+'</h2><div class="actions">'+
   (canWrite?button('add',k==='notes'?'+ Добавить заметку':'+ Записать общение')+button('trash','Удалённые'):'')+
   (k==='interactions'?button('filters','Фильтры'):'')+'</div><div data-entry-filters hidden></div><div data-entry-list aria-live="polite"></div></section>').join('');
  const scope=key=>root.querySelector('[data-entry-group="'+key+'"]');
  const option=(items,selected,empty)=>'<option value="">'+empty+'</option>'+items.map(o=>'<option value="'+esc(o.id)+'" '+(o.id===selected?'selected':'')+'>'+esc(o.label)+'</option>').join('');
  function itemMarkup(k,item){
   const m=item.entry||{},ctx=m.context||{},tasks=item.tasks||[],open=tasks.filter(t=>['open','in_progress'].includes(t.status));
   const related=Object.entries(ctx).map(([key,id])=>{
    const t=refs[key]?.[0],label=state.lookups[t]?.find(o=>o.id===id)?.label;
    return label&&id!==x.id?'<button class="name-link" type="button" data-open="'+esc(id)+'" data-type="'+t+'">'+esc(label)+'</button>':'';
   }).filter(Boolean).join(' ');
   const taskRows=tasks.map(t=>'<button class="name-link" type="button" data-open="'+esc(t.id)+'" data-type="tasks">'+esc(t.title)+' · '+esc(date(t.dueAt))+'</button>').join('');
   const actions=item.canEdit?(m.deletedAt?button('restore','Восстановить'):button('edit','Редактировать')+button('delete','Удалить')):'';
   const taskButton=k==='interactions'&&!m.deletedAt&&canWriteTasks?button(open.length?'task_extra':'task',open.length?'Добавить ещё задачу':'Поставить задачу'):'';
   return '<li data-entry-id="'+esc(item.id)+'"><p class="production-entry">'+esc(item.note)+'</p><p class="hint">'+
    (k==='interactions'?esc(channels[item.kind.replace('interaction_','')])+' · ':'')+
    esc(date(m.occurredAt||item.at))+' · '+esc(item.actorName)+(m.occurredAt&&m.occurredAt!==item.at?' · записано '+esc(date(item.at)):'')+
    (m.editedAt?' · Изменено '+esc(date(m.editedAt))+' · '+esc(m.editedBy):'')+
    (m.deletedAt?' · Удалено '+esc(date(m.deletedAt)):'')+'</p>'+
    (related?'<div class="actions">'+related+'</div>':'')+(taskRows?'<div class="actions">'+taskRows+'</div>':'')+
    (actions||taskButton?'<details class="production-entry-actions"><summary aria-label="Действия с записью">Действия ⋯</summary><div class="actions">'+actions+taskButton+'</div></details>':'')+'</li>';
  }
  async function load(k){
   const v=view[k],job=++v.seq,area=scope(k),body=area.querySelector('[data-entry-list]');
   const toggle=area.querySelector('[data-entry-action=trash]');
   if(toggle)toggle.textContent=v.deleted?'К рабочим записям':'Удалённые';
   body.textContent='Загружаем…';
   try{
    const result=await api({action:'entry_list',id:x.id,type,kind:k,deleted:v.deleted,offset:v.offset,...v.filters,...(focus&&k==='interactions'&&v.focus!==false?{entryId:focus}:{})});
    if(!active()||job!==v.seq)return;
    v.items=result.items;
    body.innerHTML=(v.items.length?'<ul class="production-list">'+v.items.map(r=>itemMarkup(k,r)).join('')+'</ul>':
     '<p class="hint">'+(v.deleted?'В удалённых пока пусто.':'Записей пока нет.')+'</p>')+
     '<div class="actions">'+(v.offset?button('previous','Назад'):'')+(result.next!=null?button('next','Дальше'):'')+
     (focus&&k==='interactions'&&v.focus!==false?button('all','Вся история'):'')+'</div>';
    if(focus&&k==='interactions'&&v.focus!==false&&v.items.length)body.querySelector('[data-entry-id]')?.scrollIntoView({block:'nearest'});
   }catch(err){if(active()&&job===v.seq)body.innerHTML='<p class="error">'+esc(err.message)+'</p>'+button('retry','Повторить');}
  }
  function modal(title,fields,label,run,after){
   openDialog(title,'<form data-entry-form><div class="form-grid">'+fields+'</div><p class="form-error" role="alert"></p><div class="actions"><button class="primary" type="submit">'+label+'</button><button type="button" data-dialog-close>Отмена</button></div></form>');
   const el=dialog.querySelector('[data-entry-form]');
   el.onsubmit=async e=>{
    e.preventDefault();const submit=el.querySelector('[type=submit]');submit.disabled=true;
    try{await run(new FormData(el));if(el.isConnected&&dialog.open)dialog.close();if(active())await after();}
    catch(err){if(el.isConnected)el.querySelector('.form-error').textContent=err.message;}
    finally{submit.disabled=false;}
   };
   return el;
  }
  function editEntry(k,item){
   const notes=k==='notes',prior=item?.entry||{},context={...(prior.context||{})},base=primary[type];
   if(!item&&base)context[base]=x.id;
   if(type==='deals'&&!item&&x.projectId)context.projectId=x.projectId;
   if(item&&primary[item.entityType])context[primary[item.entityType]]=item.entityId;
   const own=item?primary[item.entityType]:base;
   let fields=input('text',notes?'Заметка':'Что обсудили',item?.note,'textarea',true,true);
   if(!notes)fields=select('interaction','Канал',options(channels,item?item.kind.replace('interaction_',''):'call'))+
    input('occurredAt','Время общения · МСК',dateInput(prior.occurredAt||item?.at||new Date().toISOString()),'datetime-local')+
    Object.entries(refs).map(([key,[section,label]])=>key===own?'':
     select(key,label,option((state.lookups[section]||[]).filter(o=>!o.archived&&(key!=='dealId'||o.show)),context[key],'Не выбрано'))).join('')+fields;
   const el=modal(item?(notes?'Редактировать заметку':'Редактировать общение'):(notes?'Новая заметка':'Записать общение'),fields,'Сохранить',d=>{
    const payload={text:d.get('text')};
    if(!notes){
     payload.interaction=d.get('interaction');payload.occurredAt=fromInput(d.get('occurredAt'));payload.context={};
     for(const key of Object.keys(refs)){
      const value=key===own?context[key]:d.get(key);
      if(value)payload.context[key]=value;
     }
    }
    return item?mutate('entry_edit',{entryId:item.id,base_revision:item.revision,...payload}):mutate('note_add',{type,id:x.id,...payload});
   },async()=>{await load(k);notice('Запись сохранена');});
   if(!notes){
    const project=el.elements.namedItem('projectId'),deal=el.elements.namedItem('dealId');
    const filter=()=>{
     if(!deal)return;
     const keep=deal.value||context.dealId,pid=project?.value||(own==='projectId'?context.projectId:'');
     deal.innerHTML=option((state.lookups.deals||[]).filter(o=>o.show&&!o.archived&&(!pid||o.projectId===pid)),keep,'Не выбрано');
    };
    if(project)project.onchange=filter;
    if(deal)deal.onchange=()=>{const d=state.lookups.deals.find(x=>x.id===deal.value);if(d&&project)project.value=d.projectId;};
    filter();
   }
  }
  function changeState(k,item,restore){
   const foreign=item.actorId!==state.user.id;
   modal(restore?'Восстановить запись':'Удалить запись',
    '<p class="full production-entry">'+esc(item.note.slice(0,240))+'</p>'+
    '<p class="full hint">'+(restore?'Запись снова будет видна в рабочих карточках.':'Запись исчезнет из истории. Её можно вернуть из удалённых в течение 30 дней.')+'</p>'+
    (foreign?input('reason','Причина','','textarea',true,true):''),restore?'Восстановить':'Удалить',
    d=>mutate(restore?'entry_restore':'entry_delete',{entryId:item.id,base_revision:item.revision,reason:d.get('reason')||''}),
    async()=>{await load(k);notice(restore?'Запись восстановлена':'Запись перемещена в удалённые');});
  }
  function task(item,additional){
   const c=item.entry?.context||{};
   const run=()=>edit('tasks',{organizationId:c.organizationId||(item.entityType==='organizations'?item.entityId:null),
    contactId:c.contactId||(item.entityType==='contacts'?item.entityId:null),projectId:c.projectId||(item.entityType==='projects'?item.entityId:null),
    dealId:c.dealId||(item.entityType==='deals'?item.entityId:null),interactionSource:{id:item.id,additional}});
   if(!additional)return run();
   openDialog('Добавить ещё задачу','<p>У записи уже есть открытые задачи. Подтвердите создание дополнительной.</p><div class="actions">'+
    button('confirm-extra','Открыть форму задачи')+'<button type="button" data-dialog-close>Отмена</button></div>');
   dialog.querySelector('[data-entry-action=confirm-extra]').onclick=run;
  }
  function filters(k){
   const v=view[k],area=scope(k).querySelector('[data-entry-filters]');
   if(!area.hidden){area.hidden=true;return;}
   area.hidden=false;
   area.innerHTML='<form class="form-grid">'+
    select('channel','Канал',options({'':'Все',...channels},v.filters.channel||''))+
    input('from','С даты',v.filters.from,'date')+input('to','По дату',v.filters.to,'date')+
    (type==='projects'?select('dealId','Показ',option((state.lookups.deals||[]).filter(d=>d.show&&d.projectId===x.id),v.filters.dealId,'Все показы')):'')+
    '<button>Применить</button></form>';
   area.querySelector('form').onsubmit=e=>{
    e.preventDefault();v.filters=Object.fromEntries(new FormData(e.currentTarget));v.offset=0;v.focus=false;load(k);
   };
  }
  root.addEventListener('click',e=>{
   const b=e.target.closest('[data-entry-action]');if(!b)return;
   const section=b.closest('[data-entry-group]');if(!section)return;
   const k=section.dataset.entryGroup,v=view[k],id=b.closest('[data-entry-id]')?.dataset.entryId,item=v.items.find(r=>r.id===id);
   switch(b.dataset.entryAction){
    case 'add':return editEntry(k,null);
    case 'edit':return editEntry(k,item);
    case 'delete':return changeState(k,item,false);
    case 'restore':return changeState(k,item,true);
    case 'task':return task(item,false);
    case 'task_extra':return task(item,true);
    case 'trash':v.deleted=!v.deleted;v.focus=false;v.offset=0;break;
    case 'all':v.focus=false;v.offset=0;break;
    case 'next':v.offset+=30;break;
    case 'previous':v.offset=Math.max(0,v.offset-30);break;
    case 'filters':return filters(k);
   }
   load(k);
  });
  for(const k of groups)load(k);
 }
 function contextMail(root,type,x,{state,active,api,esc,date,canWriteContact,canSend,canWriteTasks,edit,related={}}){
  const primaryKey=primary[type];
  if(!primaryKey||!['organizations','projects','deals'].includes(type)||type==='deals'&&!x.show)return;
  const option=(items,empty)=>'<option value="">'+empty+'</option>'+items.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.label)+'</option>').join('');
  const own=type==='organizations'&&x.email?{id:x.id,label:'Почта организации · '+x.email}:null;
  const people=type==='organizations'?(related.contacts||[]):(state.lookups.contacts||[]).filter(y=>!y.archived);
  const recipients=own?[own,...people]:people;
  const orgs=(state.lookups.organizations||[]).filter(y=>!y.archived);
  const showIds=new Set((related.deals||[]).map(y=>y.id));
  const shows=(state.lookups.deals||[]).filter(y=>y.show&&!y.archived&&
    (type==='organizations'?showIds.has(y.id):y.projectId===x.id));
  root.innerHTML='<h2>Письма по карточке</h2><div data-context-mail-history aria-live="polite"></div>'+
   (canSend&&recipients.length?'<form class="form-grid" data-mail-choose>'+
   '<label class="field"><span>Кому</span><select name="recipientId">'+option(recipients,'Выберите получателя')+'</select></label>'+
   (type!=='organizations'?'<label class="field"><span>Организация</span><select name="organizationId">'+option(orgs,'Не выбрана')+'</select></label>':'')+
   (shows.length?'<label class="field"><span>Показ</span><select name="dealId">'+option(shows,type==='organizations'?'Без привязки к показу':'Весь проект')+'</select></label>':'')+
   '<button class="primary">Написать письмо</button></form>':'')+'<div data-context-mail-compose></div>';
  const history=root.querySelector('[data-context-mail-history]');
  const editMailTask=row=>edit('tasks',{...row.context,title:'Проверить ответ на письмо «'+row.subject.slice(0,130)+'»',
    mailSource:{...(row.organizationId?{organizationId:row.organizationId}:{contactId:row.contactId}),id:row.id}});
  function readOrganizationMail(id){
   if(compose.querySelector('form')&&!confirm('Открыть историю вместо текущего письма?'))return;
   window.AelitaCrmMail(compose,{api,contact:{...x,emails:x.email?[x.email]:[]},organization:true,canSend:canSend&&!!x.email,focusMail:id,
     recipientLabel:x.name,
     context:{organizationId:x.id},onTask:canWriteTasks?item=>editMailTask({...item,organizationId:x.id,context:{organizationId:x.id}}):null});
   compose.scrollIntoView({block:'start'});
  }
  let seq=0;
  async function load(cursor=null){
   const job=++seq;
   if(!cursor)history.textContent='Загружаем письма…';
   try{
    const r=await api({action:'mail_context_history',type,id:x.id,cursor});
    if(!active()||job!==seq)return;
    if(!cursor)history.replaceChildren();
    history.querySelector('[data-mail-next]')?.remove();
    for(const row of r.items){
     const p=document.createElement('p'),a=document.createElement('a');
     a.href=mailLink(row.contactId||'',row.id);a.textContent=row.subject||'Без темы';
     if(row.organizationId){
      const open=document.createElement('button');open.type='button';open.className='name-link';open.textContent=a.textContent;
      open.onclick=()=>readOrganizationMail(row.id);
      p.append(open);
     }else p.append(a);
     p.append(' · '+date(row.at)+' · '+(row.direction==='in'?'Ответ':'Отправлено')+(row.actorName?' · '+row.actorName:''));
     if(canWriteTasks){
      const next=document.createElement('button');next.type='button';next.textContent='Поставить задачу';
      next.onclick=()=>editMailTask(row);
      p.append(' ',next);
     }
     history.append(p);
    }
    if(!r.items.length&&!cursor)history.textContent='Писем с этим контекстом пока нет.';
    if(r.next){
     const next=document.createElement('button');next.type='button';next.dataset.mailNext='';next.textContent='Ещё письма';next.onclick=()=>load(r.next);history.append(next);
    }
   }catch(err){if(active()&&job===seq)history.textContent=err.message;}
  }
  const form=root.querySelector('[data-mail-choose]'),compose=root.querySelector('[data-context-mail-compose]');
  if(form){
   const recipient=form.elements.namedItem('recipientId');
   if(own)recipient.value=own.id;
   else if(recipients.length===1)recipient.value=recipients[0].id;
   window.AelitaCrmUsability?.selectMenu(recipient,'Получатель письма');
   window.AelitaCrmUsability?.longMenus(form);
  }
  let mountedSelection='';
  if(form)form.onsubmit=async e=>{
   e.preventDefault();const submit=form.querySelector('button'),fields=Object.fromEntries(new FormData(form));
   const {recipientId,...links}=fields;
   if(!recipientId){compose.textContent='Выберите получателя письма.';return;}
   const organization=!!own&&recipientId===own.id;
   const context=Object.fromEntries(Object.entries({...links,...(organization?{}:{contactId:recipientId}),[primaryKey]:x.id,...(type==='deals'?{projectId:x.projectId}:{})}).filter(([,v])=>v));
   const selection=JSON.stringify([recipientId,context]);
   if(compose.querySelector('form')){
    if(selection===mountedSelection){compose.scrollIntoView({block:'start'});return;}
    if(!confirm('Открыть письмо для другого получателя или показа?'))return;
   }
   submit.disabled=true;compose.textContent='Открываем письмо…';
   try{
    const entity=organization?{...x,emails:[x.email]}:(await api({action:'get',type:'contacts',id:recipientId})).entity;
    if(!active())return;
    if(!organization&&!canWriteContact(entity)||entity.archivedAt||!entity.emails?.length){compose.textContent='У этого контакта нет доступного адреса для отправки.';return;}
    const label=Object.entries(context).filter(([k])=>k!=='contactId').map(([k,id])=>state.lookups[refs[k][0]].find(y=>y.id===id)?.label).filter(Boolean).join(' · ');
    const sourceType=context.dealId?'deals':type,sourceId=context.dealId||x.id;
    const materials=await Promise.allSettled([
      sourceId!==x.id?api({action:'get',type:'deals',id:sourceId}):Promise.resolve({entity:x}),
      api({action:'obligation_workspace',type:sourceType,id:sourceId}),
    ]);
    if(!active())return;
    const show=materials[0].value?.entity||x;
    const documents=show.documentLinks||[];
    const projectTitle=context.projectId?state.lookups.projects?.find(row=>row.id===context.projectId)?.label:
      state.lookups.projects?.find(row=>row.id===show.projectId)?.label;
    const templateData={production:projectTitle||(type==='projects'?x.title:show.show?show.title:''),city:show.show?.city||show.city||entity.city,
     period:[show.show?.dateFrom,show.show?.dateTo].filter(Boolean).filter((value,index,values)=>values.indexOf(value)===index).join(' — '),
     venue:state.lookups.organizations.find(row=>row.id===show.show?.venueOrganizationId)?.label||'',greeting:'Здравствуйте!'};
    const obligations=materials[1].value?.items||[];
    mountedSelection=selection;
    window.AelitaCrmMail(compose,{api,contact:entity,organization,canSend:true,context,contextLabel:label,draftDelete:true,autoOpen:true,onSent:()=>load(),
     recipientLabel:entity.name,templateData,documentLinks:[...documents,...obligations.flatMap(row=>(row.documents||[]).map(d=>d.url))],
     onTask:canWriteTasks?item=>editMailTask({...item,context,...(organization?{organizationId:entity.id}:{contactId:entity.id})}):null});
   }catch(err){if(active())compose.textContent=err.message;}
   finally{submit.disabled=false;}
  };
  load();
  if(type==='organizations'&&state.focusMail?.organizationId===x.id)readOrganizationMail(state.focusMail.id);
 }
 window.AelitaCrmEntries={mount,linkFor,contextMail};
})();
