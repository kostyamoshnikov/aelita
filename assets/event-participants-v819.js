(function(){
 'use strict';
 const V=window.AelitaParticipantsView,root=document.getElementById('eventParticipants');if(!root||!V)return;
 const $=s=>root.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let data=null,job=0,busy=false,ready=false,selected=new Set(),limit=200,url=null,wantedRef=null,controller=null,loading=null,dataToken='';
 const validRef=ref=>/^(tickets|events|invites):[A-Za-z0-9_-]{1,120}$/.test(ref||'');
 const modes=V.modeLabel,filters=()=>({mode:$('#participants-mode').value,status:$('#participants-status').value,search:$('#participants-search').value.trim().slice(0,200),sort:$('#participants-sort').value});
 const errors={participants_changed:'Данные изменились у другого сотрудника или в источнике. Обновите список.',participants_source_unavailable:'Один из источников недоступен. Решение не сохранено.',not_authenticated:'Сеанс завершён. Войдите в админку снова.',participants_bad_selection:'Проверьте выбранные строки.',participants_bad_identity:'Проверьте имя и фамилию: до 80 символов в каждом поле, без ссылок и служебных знаков.',participants_bad_response:'Выберите ответ участника.'};
 function stale(){return Object.assign(Error('Данные больше не относятся к открытому показу или сеансу.'),{code:'participants_obsolete'});}
 function current(ctx){
  if(ctx.job!==job)return false;
  if(!ctx.token||ctx.token!==getToken()){reset('Сеанс изменился. Войдите снова и обновите участников.');return false;}
  return true;
 }
 function ensure(ctx){if(!current(ctx))throw stale();}
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
  ready=false;status(e.name==='AbortError'?'Не удалось дождаться данных. Нажмите «Обновить участников».':e.message,true);
 }
 function clearArtifacts(){
  if(url)URL.revokeObjectURL(url);url=null;
  const link=$('#participants-download');link.hidden=true;link.removeAttribute('href');link.removeAttribute('download');link.textContent='';
  const dialog=document.getElementById('participants-copy-dialog');if(dialog){dialog.querySelector('textarea').value='';if(dialog.open)dialog.close();}
 }
 function reset(message=''){
  ++job;if(controller)controller.abort();controller=null;ready=false;dataToken='';busy=false;wantedRef=null;loading=null;
  person?.reset();clearArtifacts();$('#participants-event').replaceChildren();clearView('Обновите участников выбранного показа.');lock(false);status(message,!!message);
 }
 function status(message,bad=false){$('#participants-message').textContent=message;$('#participants-message').classList.toggle('error',bad);}
 function lock(value){busy=value;root.classList.toggle('participants-stale',!ready);for(const b of root.querySelectorAll('[data-participant-operation],#participants-reload,#participants-event,#participants-list input,#participants-list button,#participants-mode,#participants-status,#participants-search,#participants-sort,#participants-more,[data-participant-mode]'))b.disabled=value;renderActions();}
 function renderActions(){
  for(const id of ['participants-copy','participants-csv','participants-pdf'])$('#'+id).disabled=busy||!ready||!data||!V.select(data,filters()).length;
  const n=selected.size;$('#participants-selected').textContent='Выбрано для решения: '+n;
  for(const b of root.querySelectorAll('[data-participant-operation]'))b.disabled=busy||!ready||!data?.canEdit||n<(b.dataset.participantOperation==='merge'||b.dataset.participantOperation==='distinct'?2:1);
  for(const b of root.querySelectorAll('[data-participant-person]'))b.disabled=busy||!ready||data?.detailsVersion!==820;
 }
 function render(){
  if(!data)return;const f=filters(),rows=V.select(data,f),t=data.totals;
  $('#participants-context').textContent=[data.event.title,data.event.when,data.event.venue,'Обновлено '+data.generatedLabel].filter(Boolean).join(' · ');
  $('#participants-totals').innerHTML=[['all','Всего ожидается',t.total],['offline','В зале',t.offline],['online','Онлайн',t.online],['unknown','Формат не указан',t.unknown]].map(([key,label,n])=>'<button type="button" class="mini-btn" aria-pressed="'+(f.status==='expected'&&f.mode===key)+'" data-participant-mode="'+key+'"><span>'+label+'</span><strong>'+n+'</strong></button>').join('');
  $('#participants-attendance').textContent='Подтвердили участие: '+t.confirmed+' · отказались: '+(t.declined||0)+' · поимённо отмечен вход в зал: '+t.enteredOffline+' · ожидают оплаты: '+t.pending+'. Фактическое подключение онлайн не отслеживается.';
  const warnings=V.warnings(data,f);if(t.unnamed)warnings.push('Без указанных имён: '+t.unnamed+'. Они учтены отдельными людьми.');if(t.unknown)warnings.push('Участие '+t.unknown+' человек требует уточнения формата.');if(data.detailsVersion!==820)warnings.push('Редактирование имени и ответа требует обновления серверных функций.');
  $('#participants-warnings').textContent=warnings.join(' ');$('#participants-warnings').hidden=!warnings.length;
  $('#participants-scope').textContent=V.scope(f)+' · '+rows.length+' человек из '+(f.status==='expected'?t.total:data.rows.length)+'. На экране '+Math.min(limit,rows.length)+' из '+rows.length+'.';
  $('#participants-list').innerHTML=rows.slice(0,limit).map(r=>'<article class="participant-card"><div class="participant-row-head"><label class="participant-pick"><input type="checkbox" aria-label="Выбрать: '+esc(r.name)+'" data-participant-id="'+r.id+'" '+(selected.has(r.id)?'checked':'')+'></label><button type="button" class="participant-name" data-participant-person="'+r.id+'" aria-label="Открыть участника: '+esc(r.name)+'">'+esc(r.name)+'</button></div><p><strong>'+modes[r.mode]+'</strong> · '+esc(V.stateLabel(r))+'</p>'+(r.possibleDuplicate?'<p class="participant-issue">Возможное совпадение — сравните основания.</p>':'')+(r.modeConflict?'<p class="participant-issue">В источниках разные форматы участия.</p>':'')+(r.identityConflict?'<p class="participant-issue">Уточнённые имена противоречат друг другу.</p>':'')+'<p class="hint">'+esc(r.arrivalLabel)+'</p>'+(r.declined&&r.arrivalLabel==='Вошёл по QR'?'<p class="participant-issue">Есть и отказ, и отметка входа. Сверьте фактическое участие.</p>':'')+(r.mode==='online'&&r.sources.some(s=>s.kind==='invite')?'<p class="hint">'+(r.hasEmail?'Почта для приглашения указана.':'Почта для приглашения не указана.')+'</p>':'')+'<details><summary>Основания · '+r.sources.length+'</summary><ul>'+r.sources.map(s=>'<li>'+esc(s.label)+'</li>').join('')+'</ul></details></article>').join('')||'<p class="empty-state">'+(f.search||f.mode!=='all'||f.status!=='expected'?'По этим условиям участников нет. Измените фильтры.':'Действующих участников в доступных источниках пока нет.')+'</p>';
  $('#participants-more').hidden=rows.length<=limit;renderActions();
 }
 function clearView(message){data=null;selected.clear();$('#participants-list').textContent=message;$('#participants-context').textContent='';$('#participants-totals').replaceChildren();$('#participants-attendance').textContent='';$('#participants-scope').textContent='';$('#participants-warnings').hidden=true;$('#participants-warnings').textContent='';}
 function load(preferred){
  if(person?.active()&&!person.close())return Promise.resolve(false);
  const owner=getToken();if(!owner){reset('Войдите в админку.');return Promise.resolve(false);}
  const explicit=typeof preferred==='string'?preferred:wantedRef||new URLSearchParams(location.search).get('workEvent'),prior=$('#participants-event').value;
  if(controller)controller.abort();controller=new AbortController();const signal=controller.signal,n=++job,ctx={job:n,token:owner};ready=false;clearArtifacts();lock(true);status('Собираем участников…');if(explicit&&data?.event.ref!==explicit)clearView('Загружаем участников выбранного показа…');
  const timer=setTimeout(()=>{if(n===job)controller.abort();},20000);
  loading=(async()=>{try{
   const catalog=await json(ADMIN_ORDERS_URL+'?view=participant_events',{signal},ctx);if(n!==job)return false;
   if(catalog.protocol!=='aelita.participants/v1')throw Error('Единый список ещё не подключён на сервере. Обновите сайт и функции.');
   const events=catalog.events||[],remembered=AelitaWork.read('participants:event');
   const pick=$('#participants-event');pick.replaceChildren();for(const e of events){const opt=document.createElement('option');opt.value=e.ref;opt.textContent=e.title+' · '+(e.when||'Дата уточняется')+(e.cancelled?' · отменено':'');pick.append(opt);}
   if(!events.length){clearView('Нет доступных событий.');status('События не найдены. Выбранный показ недоступен.',!!explicit);return true;}
   if(explicit&&(!validRef(explicit)||!events.some(e=>e.ref===explicit))){pick.value='';clearView('Выбранный показ недоступен. Выберите другой показ из списка.');throw Error('Выбранный показ недоступен в списке участников. Проверьте обновление функций.');}
   const ref=explicit||[prior,remembered,events[0]?.ref].find(x=>events.some(e=>e.ref===x));pick.value=ref||'';
   if(!ref){clearView('Нет доступных событий.');status('События не найдены.');return true;}
   const next=await json(ADMIN_ORDERS_URL+'?view=participants&ref='+encodeURIComponent(ref),{signal},ctx);if(n!==job)return false;
   if(next.protocol!=='aelita.participants/v1'||next.event?.ref!==ref)throw Error('Получен несовместимый ответ сервера. Обновите сайт и функции.');
   data=next;dataToken=owner;ready=true;selected.clear();limit=200;wantedRef=null;AelitaWork.write('participants:event',ref);render();status(data.partial?'Список собран частично. Проверьте предупреждения.':'Участники обновлены.',data.partial);return true;
  }catch(e){failed(e,ctx);return false;}
  finally{clearTimeout(timer);if(current(ctx))lock(false);}})();return loading;
 }
 async function write(op,extra,ids,context){
  if(!usable())throw Error('Сначала обновите список участников.');
  const ctx={job,token:dataToken};lock(true);clearArtifacts();status('Сохраняем решение…');
  try{
   const next=await json(ADMIN_INVITES_URL,{method:'POST',body:JSON.stringify({action:'participants_decide',...context,op,ids,...extra,request_id:crypto.randomUUID().replace(/-/g,'')})},ctx);
   if(next.protocol!=='aelita.participants/v1'||next.event?.ref!==context.ref)throw Error('Получен несовместимый ответ сервера. Обновите сайт и функции.');
   data=next;ready=true;selected.clear();render();status('Решение сохранено. Список и количество обновлены.');return next;
  }catch(e){failed(e,ctx);throw e;}finally{if(current(ctx))lock(false);}
 }
 const person=window.AelitaParticipantPerson?.create({row:id=>usable()?data.rows.find(r=>r.id===id):null,canEdit:()=>usable()&&data?.canEdit===true,context:()=>({ref:data.event.ref,snapshot:data.snapshot,revision:data.revision}),save:(op,input,id,ctx)=>write(op,input,[id],ctx)});
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
  $('#participants-mode').value='all';$('#participants-status').value='expected';$('#participants-search').value='';
  return job===before?load(ref):loading;
 }
 function download(blob,name){if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);const a=$('#participants-download');a.href=url;a.download=name;a.hidden=false;a.textContent='Файл готов: '+name;a.click();}
 $('#participants-event').onchange=()=>{if(!busy){const ref=$('#participants-event').value;const u=new URL(location.href);u.searchParams.set('workEvent',ref);history.replaceState(history.state,'',u.pathname+u.search+u.hash);load(ref);}};
 $('#participants-reload').onclick=()=>load($('#participants-event').value||undefined);
 for(const id of ['participants-mode','participants-status','participants-search','participants-sort'])$('#'+id).addEventListener(id==='participants-search'?'input':'change',()=>{clearArtifacts();limit=200;render();});
 root.addEventListener('click',e=>{const button=e.target.closest('[data-participant-person]');if(button&&!button.disabled){person?.open(button.dataset.participantPerson,button);return;}const mode=e.target.closest('[data-participant-mode]');if(mode&&!mode.disabled){clearArtifacts();$('#participants-mode').value=mode.dataset.participantMode;$('#participants-status').value='expected';limit=200;render();}const op=e.target.closest('[data-participant-operation]');if(op)decide(op.dataset.participantOperation);});
 $('#participants-list').onchange=e=>{const id=e.target.dataset.participantId;if(id){e.target.checked?selected.add(id):selected.delete(id);renderActions();}};
 $('#participants-more').onclick=()=>{limit+=200;render();};
 $('#participants-copy').onclick=async()=>{
  if(!usable())return;
  const ctx={job,token:dataToken},f=filters(),text=V.copy(data,f),count=V.select(data,f).length;
  try{await navigator.clipboard.writeText(text);if(current(ctx))status('Скопирован список: '+count+' человек · '+V.scope(f)+'.');}
  catch{if(!current(ctx))return;let dialog=document.getElementById('participants-copy-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='participants-copy-dialog';dialog.setAttribute('data-work-untracked','');dialog.innerHTML='<h2>Скопировать список</h2><p>Выделите текст и скопируйте его.</p><textarea readonly class="ym-disable-keys" aria-label="Список участников" rows="14"></textarea><button type="button">Закрыть</button>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();}dialog.querySelector('textarea').value=text;dialog.showModal();dialog.querySelector('textarea').select();}
 };
 $('#participants-csv').onclick=()=>{if(usable())download(new Blob([V.csv(data,filters())],{type:'text/csv;charset=utf-8'}),'aelita-participants.csv');};
 $('#participants-pdf').onclick=async()=>{
  if(!usable())return;
  const ctx={job,token:dataToken},f=filters(),ref=data.event.ref;
  lock(true);clearArtifacts();status('Готовим PDF…');
  const abort=new AbortController();controller=abort;const timer=setTimeout(()=>abort.abort(),20000);
  try{
   const q=new URLSearchParams({view:'participants',ref,format:'pdf',snapshot:data.snapshot,...f}),r=await request(ADMIN_ORDERS_URL+'?'+q,{signal:abort.signal},ctx),blob=await r.blob();
   ensure(ctx);download(blob,'aelita-participants.pdf');status('PDF подготовлен: '+V.scope(f)+' · '+V.select(data,f).length+' человек.');
  }catch(e){failed(e,ctx);}finally{clearTimeout(timer);if(current(ctx))lock(false);}
 };
 window.addEventListener('aelita-staff-session-changed',()=>reset('Сеанс изменился. Обновите участников.'));
 window.addEventListener('storage',e=>{if(e.key===null||e.key==='aelita_admin_token'||e.key==='aelita_staff_session_v1')reset('Сеанс изменился. Обновите участников.');});
 window.addEventListener('popstate',()=>{const ref=new URLSearchParams(location.search).get('workEvent');if(location.hash==='#participants'&&ref)load(ref);});
 window.AelitaEventParticipants={load,open,reset};
})();
