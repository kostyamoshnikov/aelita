(function(){
 'use strict';
 const eventPattern=/^(tickets|events):([a-zA-Z0-9_-]{1,120})$/;
 const masterPattern=/^evt-[a-f0-9]{32}$/;
 const showPattern=/^d_[a-f0-9]{24}$/;
 const statuses={published:'Опубликовано',on_sale:'В продаже',closed:'Закрыто',open:'Регистрация открыта',postponed:'Перенесено',canceled:'Отменено',draft:'Черновик'};
 const format=(v,zone='Europe/Moscow')=>v?new Intl.DateTimeFormat('ru-RU',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
 const moscow=v=>v?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' ','T'):'';
 const draftUrl=(showId,eventId)=>'/admin/events/?crmShow='+encodeURIComponent(showId)+'&event='+encodeURIComponent(eventId);
 const adminUrl=ref=>{
  const match=eventPattern.exec(ref||'');if(!match)return '';
  if(masterPattern.test(match[2]))return '/admin/events/?event='+encodeURIComponent(match[2]);
  return match[1]==='tickets'?'/admin/?crmPerformance='+encodeURIComponent(match[2])+'#shows':'/admin/?crmRegistration='+encodeURIComponent(match[2])+'#events';
 };
 const crmUrl=id=>'/admin/crm/?show='+encodeURIComponent(id);
 const requestId=()=>crypto.randomUUID();
 function staffToken(){try{return window.AelitaStaffSession?.read()?.crmToken||localStorage.getItem('aelita_crm_session_v1')||'';}catch{return '';}}
 async function staffApi(body){
  const token=staffToken();if(!token)throw Error('Войдите в CRM с персональной учётной записью.');
  const response=await fetch('https://api.aelita-production.ru/crm',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  if(staffToken()!==token)throw Error('Сеанс изменился. Войдите снова.');
  const result=await response.json();
  if(!response.ok)throw Object.assign(Error(result.message||'CRM временно недоступна.'),{code:result.error});
  return result;
 }
 function reverse(root,sourceRef,guard=()=>true){
  if(!root||!eventPattern.test(sourceRef))return;
  let job=0;
  function openLink(id,label){const a=document.createElement('a');a.href=crmUrl(id);a.textContent=label;return a;}
  async function load(search=''){
   const current=++job;
   root.textContent='Проверяем связь с CRM…';
   try{
    const r=await staffApi({action:'show_event_lookup',sourceRef,search});
    if(current!==job||!guard()||!root.isConnected)return;
    root.replaceChildren();
    if(r.id){root.append(openLink(r.id,'Открыть показ в CRM'));return;}
    if(r.linked){root.textContent='Событие уже связано с показом.';return;}
    const form=document.createElement('form'),field=document.createElement('input'),submit=document.createElement('button');
    field.type='search';field.placeholder='Название или город';field.setAttribute('aria-label','Найти показ в CRM');field.value=search;
    submit.textContent='Найти показ в CRM';form.append(field,submit);
    form.onsubmit=e=>{e.preventDefault();load(field.value.trim());};
    root.append(form);
    if(!search)return;
    for(const row of r.candidates){
     const line=document.createElement('p'),button=document.createElement('button'),reason=document.createElement('input');
     line.append(openLink(row.id,[row.title,row.city].filter(Boolean).join(' · ')),' ');
     reason.placeholder='Причина при расхождении';reason.setAttribute('aria-label','Причина привязки');
     button.type='button';button.textContent='Привязать этот показ';
     button.onclick=async()=>{
      if(!guard()||job!==current)return;
      button.disabled=true;
      try{await staffApi({action:'show_event_link',id:row.id,sourceRef,base_revision:row.revision,reason:reason.value,request_id:requestId()});if(guard()&&job===current)await load();}
      catch(err){if(guard()&&job===current)button.insertAdjacentText('afterend',' '+err.message);}
      finally{button.disabled=false;}
     };
     line.append(reason,button);root.append(line);
    }
    if(!r.candidates.length)root.append(document.createTextNode('Подходящих показов нет.'));
   }catch(err){if(current===job&&guard()&&root.isConnected)root.textContent=err.message;}
  }
  load();
 }
 function editor(x,input,calendarReady){
  const p=x.showPlan||{};
  return '<div class="full form-grid production-editor"><h3 class="full">Даты и ресурс показа</h3>'+
   input('sh_plannedAt','Плановое начало · МСК',moscow(p.plannedAt),'datetime-local')+
   input('sh_plannedEndAt','Плановое окончание · МСК',moscow(p.plannedEndAt),'datetime-local')+
   input('sh_confirmedAt','Подтверждённое начало · МСК',moscow(p.confirmedAt),'datetime-local')+
   input('sh_confirmedEndAt','Подтверждённое окончание · МСК',moscow(p.confirmedEndAt),'datetime-local')+
   input('sh_timeZone','Местный часовой пояс IANA',p.timeZone||'Europe/Moscow')+
   input('sh_hall','Зал или ресурс',p.hall)+(calendarReady?
   input('sh_hallId','Единый код зала',p.hallId)+input('sh_occupiedAt','Монтаж с · МСК',moscow(p.occupiedAt),'datetime-local')+
   input('sh_occupiedEndAt','Занято до · МСК',moscow(p.occupiedEndAt),'datetime-local'):'')+input('sh_reason','Решение при пересечении',undefined,'text',true)+'</div>';
 }
 function collect(data,enabled,calendarReady){
  const plan={};
  for(const key of ['plannedAt','plannedEndAt','confirmedAt','confirmedEndAt',...(calendarReady?['occupiedAt','occupiedEndAt']:[])]){
   const raw=data['sh_'+key];
   plan[key]=raw?new Date(raw+':00+03:00').toISOString():null;
  }
  plan.timeZone=data.sh_timeZone||'Europe/Moscow';plan.hall=data.sh_hall||'';if(calendarReady)plan.hallId=data.sh_hallId||'';
  data.showPlan=enabled?plan:null;
  data.showConflictReason=data.sh_reason||'';
  for(const key of Object.keys(data))if(key.startsWith('sh_'))delete data[key];
 }
 function mount(root,x,{api,mutate,openDialog,dialog,esc,input,canWrite,canAdmin,isOwner,active,refresh,notice,relatedOrg,venues}){
  let seq=0,view;
  const button=(act,label)=>'<button type="button" data-show-action="'+act+'">'+label+'</button>';
  const row=(title,value)=>'<dt>'+title+'</dt><dd>'+esc(value||'—')+'</dd>';
  const summary=e=>e?'<dl>'+row('Событие',e.title)+row('Источник',e.sourceRef)+row('Дата · МСК',format(e.datetime))+
   row('Площадка',[e.venueName,e.venueAddress,e.city].filter(Boolean).join(' · '))+row('Статус',statuses[e.status]||e.status)+row('Сверено · МСК',format(e.checkedAt))+'</dl>':'';
  function render(){
   const p=x.showPlan||{},c=view.current,d=view.differences||{},draft=view.draft,zone=p.timeZone||'Europe/Moscow';
   const dateLine=(v)=>format(v)+(v&&zone!=='Europe/Moscow'?' · '+format(v,zone)+' '+zone:'');
   const publicPath=c?.publicPath&&/^\/[a-z0-9-]+\/$/.test(c.publicPath)?c.publicPath:'';
   const diffLabels={date:'дата',city:'город',venue:'площадка',status:'отмена'};
   const diffs=Object.keys(d).filter(key=>d[key]).map(key=>diffLabels[key]);
   const route=canAdmin?adminUrl(c?.sourceRef):'';
   const changed=view.link&&c&&['datetime','venueName','city','status'].some(k=>view.link[k]!==c[k]);
   root.innerHTML='<h2>Событие и билеты</h2><h3>Внутренний план</h3><dl>'+
    row('Плановое начало',dateLine(p.plannedAt))+row('Плановое окончание',dateLine(p.plannedEndAt))+
    row('Подтверждённое начало',dateLine(p.confirmedAt))+row('Подтверждённое окончание',dateLine(p.confirmedEndAt))+
    row('Город и площадка',[x.show.city,relatedOrg,p.hall].filter(Boolean).join(' · '))+'</dl>'+
    '<h3>Сведения источника</h3>'+(c?summary(c):'<p class="hint">Событие ещё не связано.</p>')+
    (view.message?'<p class="password-note">'+esc(view.message)+'</p>':'')+
    (diffs.length?'<p class="password-note">Требуется сверка · '+esc(diffs.join(', '))+'</p>':'')+
    (changed?'<details><summary>Предыдущая сверка</summary>'+summary(view.link)+'</details>':'')+
    (view.conflicts?.length?'<p class="password-note">Пересечения по площадке · '+esc(view.conflicts.map(t=>[({confirmed:'Пересечение',time:'Проверьте время',possible:'Возможное пересечение'})[t.severity],t.title||'ресурс занят'].filter(Boolean).join(' · ')).join(', '))+'</p>':'')+
    (draft?'<p class="hint">Подготовлен черновик. После публикации проверьте связь с событием.</p>':'')+
    '<div class="actions">'+(route?'<a href="'+esc(route)+'">Открыть в админке ↗</a>':'')+
    (publicPath?'<a href="'+esc(publicPath)+'" target="_blank" rel="noopener">Открыть в афише ↗</a>':'')+
    button('reload','Проверить сейчас')+(canWrite&&view.link?button('sync','Сверить с внутренним планом'):'')+
    (canWrite&&canAdmin&&!draft&&(!view.link||isOwner)?button('choose',view.link?'Заменить событие':'Привязать существующее событие'):'')+
    (canWrite&&canAdmin&&!view.link&&!draft&&['agreement','won'].includes(x.stage)?button('draft','Подготовить черновик в админке'):'')+
    (canWrite&&canAdmin&&draft?button('draft','Открыть черновик')+button('reconcile','Проверить публикацию')+button('close','Закрыть черновик'):'')+
    (canWrite&&isOwner&&view.link?button('unlink','Снять связь'):'')+'</div>';
  }
  async function load(){
   const job=++seq;
   root.setAttribute('aria-busy','true');
   try{const result=await api({action:'show_event_view',id:x.id});if(active()&&job===seq){view=result;render();}}
   catch(err){if(active()&&job===seq)root.innerHTML='<h2>Событие и билеты</h2><p class="error">'+esc(err.message)+'</p>'+button('reload','Повторить');}
   finally{if(active()&&job===seq)root.removeAttribute('aria-busy');}
  }
  const save=(action,data={})=>mutate(action,{id:x.id,base_revision:x.revision,...data});
  function form(title,html,label,onSubmit){
   openDialog(title,'<form data-show-form><div class="form-grid">'+html+'</div><p role="alert" class="form-error"></p><div class="actions"><button class="primary" type="submit">'+label+'</button><button type="button" data-dialog-close>Отмена</button></div></form>');
   const el=dialog.querySelector('[data-show-form]');
   el.onsubmit=async e=>{
    e.preventDefault();const submit=el.querySelector('[type=submit]');submit.disabled=true;
    try{await onSubmit(new FormData(el));if(el.isConnected&&dialog.open)dialog.close();if(active())await refresh();}
    catch(err){if(el.isConnected)el.querySelector('.form-error').textContent=err.message;}
    finally{submit.disabled=false;}
   };
  }
  function choose(){
   openDialog(view.link?'Заменить событие':'Привязать существующее событие',
    '<form data-show-search><div class="form-grid">'+input('search','Название события','','search',true)+input('city','Город',x.show.city)+
    input('venue','Площадка',relatedOrg)+input('from','Дата от','','date')+input('to','Дата до','','date')+
    '<label class="field"><span>Статус</span><select name="status"><option value="">Все статусы</option>'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+
    '</select></label><label class="row"><input type="checkbox" name="archived">Показывать отменённые и архивные</label></div><button>Найти</button></form><div data-show-results aria-live="polite"></div>');
   const search=dialog.querySelector('[data-show-search]'),results=dialog.querySelector('[data-show-results]');
   let request=0;
   async function lookup(offset=0){
    const version=++request,filters=Object.fromEntries(new FormData(search));results.textContent='Ищем события…';
    try{
     const r=await api({action:'show_event_candidates',id:x.id,...filters,offset});
     if(!search.isConnected||version!==request)return;
     results.innerHTML=(r.catalogStatus?.state!=='ready'?'<p class="hint">'+esc(r.catalogStatus?.message)+'</p>':'')+
      (r.items.length?r.items.map((item,index)=>'<div class="record">'+summary(item)+'<button type="button" data-choose-index="'+index+'">Выбрать</button></div>').join(''):'<p class="hint">По этим условиям событий нет.</p>')+
      (offset?'<button type="button" data-search-page="'+Math.max(0,offset-25)+'">Назад</button>':'')+
      (r.next!=null?'<button type="button" data-search-page="'+r.next+'">Дальше</button>':'');
     results.onclick=e=>{
      const page=e.target.closest('[data-search-page]');
      if(page)return lookup(Number(page.dataset.searchPage));
      const b=e.target.closest('[data-choose-index]');if(!b)return;
      const item=r.items[Number(b.dataset.chooseIndex)];
      form('Подтвердить связь',summary(item)+
       '<p class="full hint">Сравните город, площадку и дату с внутренним планом. При замене или расхождении укажите причину.</p>'+
       input('reason','Причина или комментарий','','textarea',true),'Привязать событие',d=>save('show_event_link',{sourceRef:item.sourceRef,reason:d.get('reason')}));
     };
    }catch(err){if(search.isConnected&&version===request)results.textContent=err.message;}
   }
   search.onsubmit=e=>{e.preventDefault();lookup();};lookup();
  }
  root.addEventListener('click',async e=>{
   const b=e.target.closest('[data-show-action]');if(!b)return;
   const act=b.dataset.showAction;
   if(act==='reload')return load();
   if(act==='choose')return choose();
   if(act==='unlink'||act==='close')return form(act==='unlink'?'Снять связь':'Закрыть черновик',
    '<p class="full hint">'+(act==='unlink'?'Событие и его заказы сохраняются в админке.':'CRM сверит публикацию перед закрытием.')+'</p>'+
    input('reason','Причина','','textarea',true,true),act==='unlink'?'Снять связь':'Закрыть черновик',
    d=>save(act==='unlink'?'show_event_unlink':'show_event_draft_close',{reason:d.get('reason')}));
   const sameVenue=venues.filter(v=>v.id!==x.show.venueOrganizationId&&v.label.trim().toLocaleLowerCase('ru')===view.current?.venueName?.trim().toLocaleLowerCase('ru'));
   if(act==='sync')return form('Сверить внутренний план',summary(view.current)+
    (sameVenue.length?'<label class="field full"><span>Принять площадку события</span><select name="venue"><option value="">Оставить текущую</option>'+sameVenue.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.label)+'</option>').join('')+'</select></label>':'')+
    (view.current?.datetime&&view.current.status!=='canceled'?'<label class="full row"><input type="checkbox" name="date">Принять дату события</label>':'')+
    (view.current?.city?'<label class="full row"><input type="checkbox" name="city">Принять город события</label>':'')+
    (view.current?.status==='canceled'?'<label class="full row"><input type="checkbox" name="cancel">Закрыть показ в CRM как несостоявшийся</label>':'')+
    (view.tasks?.length?'<p class="full hint">Открытые задачи показа</p><ul class="full production-list">'+view.tasks.map(t=>'<li>'+esc(t.title)+' · '+esc(format(t.dueAt))+'</li>').join('')+'</ul>':'')+
    input('reason','Причина или решение при пересечении','','textarea',true),'Сохранить сверку',
    d=>save('show_event_sync',{applyDate:d.has('date'),applyCity:d.has('city'),applyCancel:d.has('cancel'),venueId:d.get('venue'),reason:d.get('reason')}));
   b.disabled=true;
   try{
    if(act==='draft'){const r=await save('show_event_draft_start');if(active())location.assign(draftUrl(x.id,r.eventId));}
    if(act==='reconcile'){await save('show_event_draft_reconcile');if(active())await refresh();}
   }catch(err){if(active())notice(err.message,true);}
   finally{b.disabled=false;}
  });
  load();
 }
 window.AelitaCrmShowEvents={editor,collect,mount,reverse,staffApi,requestId,crmUrl,draftUrl,masterPattern,showPattern};
})();
