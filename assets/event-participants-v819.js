(function(){
 'use strict';
 const V=window.AelitaParticipantsView,root=document.getElementById('eventParticipants');if(!root||!V)return;
 const T=window.AelitaWorkEventTime;
 const $=s=>root.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let data=null,job=0,busy=false,ready=false,selected=new Set(),limit=200,url=null,wantedRef=null,controller=null,loading=null,dataToken='',retryWrite=null;
 let catalogEvents=[],eventGroup='current',pickerSignature='';
 const filterDefaults={
  'participants-basis':'all',
  'participants-mode':'all',
  'participants-status':'expected',
  'participants-search':'',
  'participants-sort':'name'
 };
 const filterIds=Object.keys(filterDefaults),resetFilters=$('#participants-reset-filters');
 const validRef=ref=>/^(tickets|events|invites):[A-Za-z0-9_-]{1,120}$/.test(ref||'');
 const modes=V.modeLabel,filters=()=>({...(data?.basisVersion===1?{basis:$('#participants-basis')?.value||'all'}:{}),mode:$('#participants-mode').value,status:$('#participants-status').value,search:$('#participants-search').value.trim().slice(0,200),sort:$('#participants-sort').value});
 const errors={participants_changed:'Данные изменились у другого сотрудника или в источнике. Обновите список.',participants_source_unavailable:'Один из источников недоступен. Решение не сохранено.',not_authenticated:'Сеанс завершён. Войдите в админку снова.',participants_bad_selection:'Проверьте выбранные строки.',participants_bad_identity:'Проверьте имя и фамилию: до 80 символов в каждом поле, без ссылок и служебных знаков.',participants_bad_response:'Выберите ответ участника.',participants_unknown_person:'Участник больше не найден. Обновите список.',participants_bad_filter:'Сервер пока не поддерживает эти условия. Обновите данные.'};
 function stale(){return Object.assign(Error('Данные больше не относятся к открытому показу или сеансу.'),{code:'participants_obsolete'});}
 function current(ctx){
  if(ctx.job!==job)return false;
  if(!ctx.token||ctx.token!==getToken()){reset('Сеанс изменился. Войдите снова и обновите участников.');return false;}
  return true;
 }
 function ensure(ctx){if(!current(ctx))throw stale();}
 function retryable(){return !!(retryWrite&&data&&dataToken&&dataToken===getToken()&&retryWrite.job===job&&retryWrite.token===dataToken&&!busy&&data.canEdit===true);}
 function usable(){if(dataToken&&dataToken!==getToken())reset('Сеанс изменился. Обновите участников.');return !!(data&&ready&&!busy&&dataToken);}
 async function request(endpoint,options={},ctx){
  ensure(ctx);
  const r=await fetch(endpoint,{...options,headers:{Authorization:'Bearer '+ctx.token,...(options.body?{'Content-Type':'application/json'}:{})},cache:'no-store',referrerPolicy:'no-referrer'});
  ensure(ctx);
  if(!r.ok){let d={};try{d=await r.json();}catch{}ensure(ctx);throw Object.assign(Error(errors[d.error]||d.message||'Не удалось загрузить участников. Повторите запрос.'),{code:d.error,status:r.status});}return r;
 }
 async function json(endpoint,options,ctx){const r=await request(endpoint,options,ctx),next=await r.json();ensure(ctx);return next;}
 function failed(e,ctx){
  if(!current(ctx)||e.code==='participants_obsolete')return;
  if(e.status===401||e.status===403||e.code==='not_authenticated'){reset(e.message);return;}
  ready=false;status(e.name==='AbortError'?'Сервер не ответил вовремя. Нажмите «Обновить участников».':e.name==='TypeError'?'Нет связи. Проверьте подключение и обновите участников.':e.message,true);
 }
 function clearArtifacts(){
  if(url)URL.revokeObjectURL(url);url=null;
  exportStatus('');
  const link=$('#participants-download');link.hidden=true;link.removeAttribute('href');link.removeAttribute('download');link.textContent='';
  const dialog=document.getElementById('participants-copy-dialog');if(dialog){dialog.querySelector('textarea').value='';if(dialog.open)dialog.close();}
 }
 function reset(message=''){
  ++job;if(controller)controller.abort();controller=null;ready=false;dataToken='';busy=false;wantedRef=null;loading=null;
  retryWrite=null;catalogEvents=[];eventGroup='current';pickerSignature='';person?.reset();clearArtifacts();$('#participants-event').replaceChildren();clearView('Выберите событие, чтобы увидеть участников.');if($('#participants-timing'))$('#participants-timing').hidden=true;lock(false);status(message,!!message);
 }
 function status(message,bad=false){$('#participants-message').textContent=message;$('#participants-message').classList.toggle('error',bad);}
 function exportStatus(message,bad=false){const el=$('#participants-export-message');el.textContent=message;el.classList.toggle('error',bad);}
 function lock(value){busy=value;root.classList.toggle('participants-stale',!ready);for(const b of root.querySelectorAll('[data-participant-operation],#participants-reload,#participants-event,#participants-list input,#participants-list button,[data-event-group],#participants-basis,#participants-mode,#participants-status,#participants-search,#participants-sort,#participants-more,[data-participant-mode],[data-participant-review]'))b.disabled=value;renderActions();}
 function renderActions(rows=data?V.select(data,filters()):[]){
  if($('#participants-basis'))$('#participants-basis').disabled=busy||!ready||data?.basisVersion!==1;
  for(const id of ['participants-copy','participants-csv','participants-pdf'])$('#'+id).disabled=busy||!ready||!rows.length;
  if(resetFilters)resetFilters.disabled=busy||!ready||filterIds.every(id=>!$('#'+id)||$('#'+id).value===filterDefaults[id]);
  const n=selected.size,offscreen=n-rows.slice(0,limit).filter(row=>selected.has(row.id)).length;
  $('#participants-selected').textContent=n?'Выбрано для решения: '+n+(offscreen?' · вне показанного списка: '+offscreen:''):'';
  $('#participants-unselect').hidden=!n;
  $('#participants-unselect').disabled=busy;
  for(const input of root.querySelectorAll('[data-participant-id]'))input.disabled=busy||!ready;
  for(const b of root.querySelectorAll('[data-participant-operation]'))b.disabled=busy||!ready||!data?.canEdit||n<(b.dataset.participantOperation==='merge'||b.dataset.participantOperation==='distinct'?2:1);
  for(const b of root.querySelectorAll('[data-participant-person]'))b.disabled=busy||!ready||data?.detailsVersion!==820;
 }
 function paintEvent(event){
  const title=$('#participants-context'), details=$('#participants-event-details');
  title.textContent=event?.title||'';
  if(!details)return;
  details.hidden=!event;
  const state=event&&T?.status(event,Date.now());
  $('#participants-event-state').textContent=state?.label||'';
  $('#participants-date').textContent=event?(T?.when(event)||event.when||'Дата уточняется'):'';
  $('#participants-venue').textContent=event?.venue||'';
  $('#participants-updated').textContent=data?.generatedLabel?'Данные обновлены '+data.generatedLabel:'';
  $('#participants-ended').hidden=!(eventGroup==='current'&&state?.label==='Состоялось');
 }
 function render(appendFrom=0){
  if(!data)return;
  const f=filters(),rows=V.select(data,f),t=data.totals;
  paintEvent(data.event);
  const count=n=>typeof n==='number'?n:'—';
  $('#participants-totals').innerHTML=[['all','Всего ожидается',t.total],['offline','В зале',t.offline],['online','Онлайн',t.online],['unknown','Формат не указан',t.unknown]].map(([key,label,n])=>'<button type="button" class="mini-btn" aria-pressed="'+(f.status==='expected'&&f.mode===key)+'" data-participant-mode="'+key+'"><span>'+label+'</span><strong>'+count(n)+'</strong></button>').join('');
  $('#participants-attendance').innerHTML=[['Подтвердили участие',t.confirmed],['Отказались',t.declined],['Вход по QR отмечен',t.enteredOffline],['Ожидают оплаты',t.pending]].map(([label,n])=>'<div><dt>'+label+'</dt><dd>'+count(n)+'</dd></div>').join('');
  const warnings=V.warnings(data,f);
  if(data.partial&&!warnings.length)warnings.push('Сводка составлена по доступным источникам.');
  if(t.unnamed)warnings.push('Участники без имени: '+t.unnamed+'.');
  if(t.unknown)warnings.push('Формат участия не указан: '+t.unknown+'.');
  if(data.detailsVersion!==820)warnings.push('Чтобы править имя и ответ, обновите серверные функции.');
  if(data.basisVersion!==1)warnings.push('Чтобы фильтровать по основаниям, обновите серверные функции.');
  $('#participants-warnings').innerHTML=warnings.length?'<ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'+(t.possibleDuplicates||t.identityConflicts||t.responseConflicts?'<button type="button" class="mini-btn" data-participant-review>Сверить</button>':''):'';
  $('#participants-warnings').hidden=!warnings.length;
  const shown=rows.length>limit?' Показано '+limit+'.':'';
  $('#participants-scope').textContent='По фильтрам: '+V.people(rows.length)+'.'+shown+' '+V.scope(f)+'.';
  const list=$('#participants-list'),more=$('#participants-more');
  const cards=rows.slice(appendFrom,limit).map(r=>{
   const tags=V.basisTags(r).map(tag=>'<span class="participant-basis'+(!tag.active?' participant-basis-inactive':'')+'">'+esc(tag.label)+(tag.notes.length?' <small>'+esc((tag.active?'Есть действующее основание. ':'')+tag.notes.join('; '))+'</small>':'')+'</span>').join('');
   return '<article class="participant-card"><div class="participant-row-head"><label class="participant-pick"><input type="checkbox" aria-label="Выбрать: '+esc(r.name)+'" data-participant-id="'+r.id+'" '+(selected.has(r.id)?'checked':'')+'></label><button type="button" class="participant-name" data-participant-person="'+r.id+'" aria-label="Открыть участника: '+esc(r.name)+'">'+esc(r.name)+'</button></div><div class="participant-badges">'+tags+'</div><p><strong>'+modes[r.mode]+'</strong> · '+esc(V.stateLabel(r,f))+'</p>'+(r.possibleDuplicate?'<p class="participant-issue">Возможное совпадение. Сравните основания.</p>':'')+(r.modeConflict?'<p class="participant-issue">В источниках указаны разные форматы участия.</p>':'')+(r.identityConflict?'<p class="participant-issue">Уточнённые имена расходятся.</p>':'')+'<p class="hint">'+esc(r.arrivalLabel)+'</p>'+(r.declined&&r.arrivalLabel==='Вошёл по QR'?'<p class="participant-issue">Есть и отказ, и отметка входа. Сверьте участие.</p>':'')+'<details><summary>Основания · '+r.sources.length+'</summary><ul>'+r.sources.map(s=>'<li>'+esc(V.sourceLabel(s))+'</li>').join('')+'</ul></details></article>';
  }).join('');
  if(appendFrom)list.insertAdjacentHTML('beforeend',cards);
  else list.innerHTML=cards||'<p class="empty-state">'+(data.partial?'Доступных данных для этого списка недостаточно. Проверьте предупреждения.':f.search||f.basis&&f.basis!=='all'||f.mode!=='all'||f.status!=='expected'?'По этим условиям участников нет. Измените фильтры.':'Действующих участников пока нет.')+'</p>';
  const focusNext=appendFrom&&document.activeElement===more;
  more.hidden=rows.length<=limit;renderActions(rows);
  if(focusNext&&rows[appendFrom])list.querySelector('[data-participant-person="'+rows[appendFrom].id+'"]')?.focus();
 }
 function clearView(message){
  data=null;selected.clear();$('#participants-list').textContent=message;paintEvent(null);
  $('#participants-totals').replaceChildren();$('#participants-attendance').textContent='';$('#participants-scope').textContent='';$('#participants-warnings').hidden=true;$('#participants-warnings').textContent='';$('#participants-more').hidden=true;
 }
 function periodOf(event,now=Date.now()){return T?.status(event,now).group||'current';}
 function displayPicker(keep){
  const pick=$('#participants-event'), now=Date.now();
  const events=catalogEvents.filter(e=>periodOf(e,now)===eventGroup);
  const retained=catalogEvents.find(e=>e.ref===keep&&periodOf(e,now)!==eventGroup);
  const choices=(T?T.sorted(events,now):events).map(e=>[e.ref,T?T.label(e,now):e.title+' · '+(e.when||'Дата уточняется')]);
  if(retained)choices.unshift([retained.ref,'Открытое событие · '+T.label(retained,now)]);
  const placeholder=choices.length?'Выберите событие':eventGroup==='past'?'Прошедших событий пока нет':'Актуальных событий пока нет';
  const signature=JSON.stringify([eventGroup,choices]);
  if(signature!==pickerSignature){
   const prompt=document.createElement('option');prompt.value='';prompt.textContent=placeholder;prompt.disabled=true;
   pick.replaceChildren(prompt);pickerSignature=signature;
   for(const [ref,text] of choices){const option=document.createElement('option');option.value=ref;option.textContent=text;pick.append(option);}
   for(const button of root.querySelectorAll('[data-event-group]'))button.setAttribute('aria-pressed',String(button.dataset.eventGroup===eventGroup));
  }
  const selection=choices.some(([ref])=>ref===keep)?keep:'';
  if(pick.value!==selection)pick.value=selection;
 }
 function updateUrl(ref){
  const u=new URL(location.href);if(ref)u.searchParams.set('workEvent',ref);else u.searchParams.delete('workEvent');
  history.replaceState(history.state,'',u.pathname+u.search+u.hash);
 }
 function refreshClock(){if(!T||busy||!catalogEvents.length)return;displayPicker($('#participants-event').value);paintEvent(data?.event);}
 function load(preferred,requestedGroup){
  if(person?.active()&&!person.close())return Promise.resolve(false);
  const owner=getToken();if(!owner){reset('Войдите в админку.');return Promise.resolve(false);}
  const explicit=typeof preferred==='string'?preferred:requestedGroup?null:wantedRef||new URLSearchParams(location.search).get('workEvent');
  const prior=data?.event.ref||$('#participants-event').value;
  retryWrite=null;if(controller)controller.abort();controller=new AbortController();const signal=controller.signal,n=++job,ctx={job:n,token:owner};ready=false;clearArtifacts();lock(true);status('Загружаем участников…');if(requestedGroup||explicit&&data?.event.ref!==explicit)clearView('Загружаем участников выбранного события…');
  const timer=setTimeout(()=>{if(n===job)controller.abort();},20000);
  loading=(async()=>{try{
   const catalog=await json(ADMIN_ORDERS_URL+'?view=participant_events',{signal},ctx);if(n!==job)return false;
   if(catalog.protocol!=='aelita.participants/v1')throw Error('Единый список ещё не подключён на сервере. Обновите сайт и функции.');
   catalogEvents=catalog.events||[];
   if($('#participants-timing')){const warning=$('#participants-timing');warning.hidden=catalog.timingVersion===1;warning.textContent='На старом сервере время окончания может быть недоступно.';}
   const byRef=ref=>catalogEvents.find(e=>e.ref===ref),explicitEvent=byRef(explicit),priorEvent=byRef(prior),remembered=byRef(AelitaWork.read('participants:event'));
   if(explicit&&(!validRef(explicit)||!explicitEvent)){
    displayPicker('');clearView('Выберите другое событие.');throw Error('Запрошенное событие отсутствует в доступном списке.');
   }
   if(requestedGroup)eventGroup=requestedGroup;
   else if(explicitEvent&&explicitEvent.ref!==prior)eventGroup=periodOf(explicitEvent);
   const available=catalogEvents.filter(e=>periodOf(e)===eventGroup),ordered=T?T.sorted(available,Date.now()):available;
   const chosen=explicitEvent||[priorEvent,remembered].find(e=>e&&periodOf(e)===eventGroup)||ordered[0];
   const ref=chosen?.ref||'';
   displayPicker(ref);
   if(requestedGroup)updateUrl(ref);
   if(!ref){
    clearView(eventGroup==='past'?'Прошедших событий пока нет.':'Актуальных событий пока нет.');
    if(eventGroup==='current'&&catalogEvents.some(e=>periodOf(e)==='past'))$('#participants-list').innerHTML+='<p><button type="button" class="mini-btn" data-event-group="past">Показать прошедшие</button></p>';
    status('');wantedRef=null;return true;
   }
   if(prior!==ref)clearView('');
   paintEvent(chosen);
   const next=await json(ADMIN_ORDERS_URL+'?view=participants&ref='+encodeURIComponent(ref),{signal},ctx);if(n!==job)return false;
   if(next.protocol!=='aelita.participants/v1'||next.event?.ref!==ref)throw Error('Получен несовместимый ответ сервера. Обновите сайт и функции.');
   data=next;dataToken=owner;ready=true;selected.clear();limit=200;wantedRef=null;AelitaWork.write('participants:event',ref);render();status(data.partial?'Список собран частично. Проверьте предупреждения.':'Участники обновлены.',data.partial);return true;
  }catch(e){failed(e,ctx);return false;}
  finally{clearTimeout(timer);if(current(ctx))lock(false);}})();return loading;
 }
 async function write(op,extra,ids,context){
  if(context.ref!==data?.event.ref)throw stale();
  if(!usable()&&!(retryable()&&retryWrite.op===op&&JSON.stringify(retryWrite.ids)===JSON.stringify(ids)&&retryWrite.ref===context.ref&&retryWrite.snapshot===context.snapshot&&retryWrite.revision===context.revision))throw Error('Сначала обновите список участников.');
  const ctx={job,token:dataToken};lock(true);clearArtifacts();status('Сохраняем решение…');
  try{
   const next=await json(ADMIN_INVITES_URL,{method:'POST',body:JSON.stringify({action:'participants_decide',...context,op,ids,...extra,request_id:crypto.randomUUID().replace(/-/g,'')})},ctx);
   if(next.protocol!=='aelita.participants/v1'||next.event?.ref!==context.ref)throw Error('Получен несовместимый ответ сервера. Обновите сайт и функции.');
   retryWrite=null;data=next;ready=true;selected.clear();render();status(op.startsWith('identity')||op.startsWith('response')?'':'Решение сохранено.');return next;
  }catch(e){failed(e,ctx);retryWrite=current(ctx)&&(e.status>=500||e.name==='TypeError'||e.name==='AbortError'||['participants_bad_identity','participants_bad_response','participants_bad_selection'].includes(e.code))?{...ctx,...context,op,ids:[...ids]}:null;throw e;}finally{if(current(ctx))lock(false);}
 }
 async function loadContacts(id,signal){
  if(!usable()||data.contactsVersion!==1)return null;
  const ctx={job,token:dataToken},snapshot=data.snapshot,ref=data.event.ref;
  const q=new URLSearchParams({view:'participant_contacts',ref,person:id,snapshot});
  try{
   const result=await json(ADMIN_ORDERS_URL+'?'+q,{signal},ctx);
   if(result.contactsVersion!==1||result.ref!==ref||result.personId!==id||result.snapshot!==snapshot||snapshot!==data?.snapshot)return null;
   return result;
  }catch(e){if(e.status===401||e.status===403)failed(e,ctx);throw e;}
 }
 const person=window.AelitaParticipantPerson?.create({contacts:loadContacts,sessionCurrent:usable,hasContacts:()=>data?.contactsVersion===1,row:id=>usable()?data.rows.find(r=>r.id===id):null,canEdit:()=>usable()&&data?.canEdit===true||retryable(),context:()=>({ref:data.event.ref,snapshot:data.snapshot,revision:data.revision}),save:(op,input,id,ctx)=>write(op,input,[id],ctx)});
 async function decide(op){
  if(!usable())return;const rows=data.rows.filter(r=>selected.has(r.id)),labels=rows.map(r=>r.name).join('\n');
  const title={merge:'Считать одним человеком и объединить основания?',distinct:'Подтвердить, что это разные люди?',exclude:'Убрать из ожидаемых зрителей в группу «Ведущий / команда»?',include:'Вернуть в ожидаемых зрителей?',mode:'Уточнить формат участия только в этом списке?',reset:'Сбросить все решения, уточнённые имена и ответы по выбранным строкам?'}[op];
  if(!confirm(title+'\n\n'+labels+'\n\nБилеты, приглашения и оплаты при этом не меняются.'))return;
  try{await write(op,{mode:$('#participants-resolve-mode').value},[...selected],{ref:data.event.ref,snapshot:data.snapshot,revision:data.revision});}catch{}
 }
 function open(ref){
  if(!validRef(ref))return Promise.resolve(false);if(person?.active()&&!person.close())return Promise.resolve(false);
  const before=job;wantedRef=ref;
  if(window.AELITA_adminTab&&window.AELITA_adminTab('participants',true)===false){wantedRef=null;return Promise.resolve(false);}
  const u=new URL(location.href);u.searchParams.set('workEvent',ref);u.hash='participants';history.replaceState({aelitaAdmin:'participants'},'',u.pathname+u.search+u.hash);
  $('#participants-mode').value='all';$('#participants-status').value='expected';$('#participants-search').value='';if($('#participants-basis'))$('#participants-basis').value='all';
  return job===before?load(ref):loading;
 }
 function download(blob,name){if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);const a=$('#participants-download');a.href=url;a.download=name;a.hidden=false;a.textContent='Файл готов: '+name;a.click();}
 $('#participants-event').onchange=()=>{
  if(busy)return;const pick=$('#participants-event'),ref=pick.value;
  if(person?.active()&&!person.close()){pick.value=data?.event.ref||'';return;}
  if(ref){updateUrl(ref);load(ref);}
 };
 $('#participants-reload').onclick=()=>load($('#participants-event').value||undefined);
 for(const id of filterIds)$('#'+id)?.addEventListener(id==='participants-search'?'input':'change',()=>{clearArtifacts();limit=200;render();});
 resetFilters?.addEventListener('click',()=>{
  if(!usable())return;
  for(const id of filterIds){
   const input=$('#'+id);
   if(input)input.value=filterDefaults[id];
  }
  clearArtifacts();limit=200;render();
  $('#participants-search').focus();
 });
 root.addEventListener('click',e=>{
  const group=e.target.closest('[data-event-group]');if(group){if(!busy&&group.dataset.eventGroup!==eventGroup)load(undefined,group.dataset.eventGroup);return;}
  if(e.target.closest('[data-participant-review]')){if(usable()){$('#participants-status').value='review';$('#participants-mode').value='all';if($('#participants-basis'))$('#participants-basis').value='all';$('#participants-search').value='';clearArtifacts();limit=200;render();$('#participants-status').focus();}return;}
  const button=e.target.closest('[data-participant-person]');
  if(button&&!button.disabled){person?.open(button.dataset.participantPerson,button);return;}
  const mode=e.target.closest('[data-participant-mode]');
  if(mode&&!mode.disabled){
   const key=mode.dataset.participantMode,restoreFocus=document.activeElement===mode;
   clearArtifacts();$('#participants-mode').value=key;$('#participants-status').value='expected';limit=200;render();
   if(restoreFocus)$('[data-participant-mode="'+key+'"]')?.focus({preventScroll:true});
  }
  const op=e.target.closest('[data-participant-operation]');if(op)decide(op.dataset.participantOperation);
 });
 $('#participants-list').onchange=e=>{const id=e.target.dataset.participantId;if(id){e.target.checked?selected.add(id):selected.delete(id);renderActions();}};
 $('#participants-unselect').onclick=()=>{
  selected.clear();
  for(const input of $('#participants-list').querySelectorAll('[data-participant-id]:checked'))input.checked=false;
  renderActions();
  ($('#participants-list').querySelector('[data-participant-id]')||$('#participants-search')).focus();
 };
 $('#participants-more').onclick=()=>{
  if(!usable()||$('#participants-more').hidden)return;
  const shown=limit;limit+=200;render(shown);
 };
 $('#participants-copy').onclick=async()=>{
  if(!usable())return;
  const ctx={job,token:dataToken},f=filters(),text=V.copy(data,f),count=V.select(data,f).length;
  try{await navigator.clipboard.writeText(text);if(current(ctx))exportStatus('Скопирован список: '+V.people(count)+' · '+V.scope(f)+'.');}
  catch{if(!current(ctx))return;let dialog=document.getElementById('participants-copy-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='participants-copy-dialog';dialog.setAttribute('aria-labelledby','participants-copy-title');dialog.setAttribute('data-work-untracked','');dialog.innerHTML='<h2 id="participants-copy-title">Скопировать список</h2><p>Выделите текст и скопируйте его.</p><textarea readonly class="ym-disable-keys" aria-label="Список участников" rows="14"></textarea><button type="button" class="mini-btn">Закрыть</button>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();}dialog.querySelector('textarea').value=text;dialog.showModal();dialog.querySelector('textarea').select();}
 };
 $('#participants-csv').onclick=()=>{if(usable()){download(new Blob([V.csv(data,filters())],{type:'text/csv;charset=utf-8'}),'aelita-participants.csv');exportStatus('CSV подготовлен.');}};
 $('#participants-pdf').onclick=async()=>{
  if(!usable())return;
  const ctx={job,token:dataToken},f=filters(),ref=data.event.ref;
  lock(true);clearArtifacts();exportStatus('Готовим PDF…');
  const abort=new AbortController();controller=abort;const timer=setTimeout(()=>abort.abort(),20000);
  try{
   const q=new URLSearchParams({view:'participants',ref,format:'pdf',snapshot:data.snapshot,...f}),r=await request(ADMIN_ORDERS_URL+'?'+q,{signal:abort.signal},ctx),blob=await r.blob();
   ensure(ctx);download(blob,'aelita-participants.pdf');exportStatus('PDF подготовлен: '+V.scope(f)+' · '+V.people(V.select(data,f).length)+'.');
  }catch(e){
   if(!current(ctx))return;
   if(e.status===401||e.status===403||e.code==='not_authenticated'){failed(e,ctx);return;}
   if(e.status===409||e.code==='participants_changed'){
    ready=false;exportStatus('Состав изменился. Обновите участников перед выгрузкой.',true);
   }else if(e.name==='AbortError'||e.name==='TypeError')exportStatus('Не удалось подключиться. Повторите выгрузку PDF.',true);
   else exportStatus(e.status>=500?'Не удалось подготовить PDF. Повторите выгрузку.':e.message,true);
  }finally{clearTimeout(timer);if(current(ctx))lock(false);}
 };
 window.addEventListener('aelita-staff-session-changed',()=>reset('Сеанс изменился. Обновите участников.'));
 window.addEventListener('storage',e=>{if(e.key===null||e.key==='aelita_admin_token'||e.key==='aelita_staff_session_v1')reset('Сеанс изменился. Обновите участников.');});
 window.addEventListener('focus',refreshClock);
 window.setInterval?.(refreshClock,15000);
 window.addEventListener('popstate',()=>{const ref=new URLSearchParams(location.search).get('workEvent');if(location.hash==='#participants'&&ref)load(ref);});
 window.AelitaEventParticipants={load,open,reset};
})();
