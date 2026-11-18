/* Paid offline event workflow. Uses the existing authenticated master API.
   No credentials, customer records, PSP calls or SMTP are handled here. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaPaidTransition=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const ID=/^evt-[a-f0-9]{32}$/,HEX=/^[a-f0-9]{64}$/,REQUEST=/^[A-Za-z0-9_-]{16,80}$/;
const PREFIX='aelita_paid_flow_v928:';
const ACTIONS={freeze:'event_transition_freeze',record:'event_transition_settlement_record',apply:'event_transition_paid_apply',publish:'event_transition_paid_publish',confirm:'event_transition_paid_confirm_publication',release:'event_transition_paid_release',abort:'event_transition_release_freeze'};
const BEFORE_WRITE=new Set(['not_authenticated','event_master_disabled','event_transitions_disabled','event_paid_postpone_disabled','event_settlement_disabled','event_freeze_disabled','transition_confirmation_required','transition_checkpoint_required','invalid_new_datetime','paid_transition_unsupported']);
// These are definite rejections/superseded stages, not transport failures.
// An error is still shown; fresh status determines what another action can do.
const REJECTED={freeze:['transition_freeze_locked','transition_freeze_conflict','transition_freeze_unsupported','transition_history_full','event_in_past'],record:['transition_checkpoint_conflict','transition_freeze_required','transition_payments_pending','transition_reservations_pending','transition_checkpoint_history_full','paid_transition_in_progress'],apply:['paid_transition_conflict','paid_transition_in_progress','paid_transition_checkpoint_changed','paid_transition_history_full','transition_payments_pending','transition_reservations_pending','event_in_past','event_updating'],publish:['paid_transition_phase_conflict','paid_transition_conflict','paid_transition_not_found'],confirm:['paid_transition_phase_conflict','paid_transition_conflict','paid_transition_not_found'],release:['paid_transition_phase_conflict','paid_transition_conflict','paid_transition_not_found'],abort:['transition_freeze_conflict','transition_freeze_not_found','paid_transition_release_required']};
function fail(code){throw Object.assign(new Error(code),{code});}
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x),integer=x=>Number.isSafeInteger(x)&&x>=0;
function date(value){return typeof value==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:00\+03:00$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)+10800000).toISOString().slice(0,19)===value.slice(0,19);}
function inputDate(value){const out=typeof value==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(value)?value+':00+03:00':value;if(!date(out))fail('invalid_new_datetime');return out;}
const copy=x=>JSON.parse(JSON.stringify(x));
function freezeView(x,id){
 if(!object(x)||x.eventId!==id||!['none','freezing','frozen','released'].includes(x.state)||!integer(x.freezeRevision))fail('untrusted_status');
 if(x.state==='none'){if(x.freezeRevision!==0)fail('untrusted_status');return copy(x);}
 if(!HEX.test(x.operationId||'')||x.freezeRevision<1||!date(x.from)||!date(x.newDatetime)||x.transitionAction!=='postpone'||typeof x.datesChanged!=='boolean')fail('untrusted_status');
 return copy(x);
}
function paidView(x,id){
 if(!object(x)||x.eventId!==id||!['none','pending_publish','pending_confirmation','active'].includes(x.state)||typeof x.datesChanged!=='boolean')fail('untrusted_status');
 if(x.state==='none'&&x.freezeRevision===undefined){if(x.datesChanged!==false||x.salesFrozen!==undefined)fail('untrusted_status');return {...x,freezeRevision:0};}
 if(!integer(x.freezeRevision)||x.freezeRevision<1||typeof x.salesFrozen!=='boolean'||!HEX.test(x.freezeOperationId||''))fail('untrusted_status');
 if(x.state!=='none'&&(!HEX.test(x.operationId||'')||!date(x.from)||!date(x.newDatetime)||x.datesChanged!==true))fail('untrusted_status');
 if(x.history!==undefined&&(!Array.isArray(x.history)||x.history.length>21))fail('untrusted_status');
 return copy(x);
}
function checkpointView(x,id){
 if(!object(x)||x.eventId!==id||!HEX.test(x.checkpointId||'')||!HEX.test(x.operationId||'')||!integer(x.freezeRevision)||x.freezeRevision<1||typeof x.checkpointMatches!=='boolean'||!['matches','expired','changed','superseded','clock_invalid'].includes(x.checkpointState)||!Number.isFinite(Date.parse(x.recordedAt))||!Number.isFinite(Date.parse(x.expiresAt))||Date.parse(x.expiresAt)<=Date.parse(x.recordedAt))fail('untrusted_checkpoint');
 if(x.checkpointMatches!==(x.checkpointState==='matches'))fail('untrusted_checkpoint');return copy(x);
}
function createController({api,context,isCurrent,journal,now=Date.now,requestId=()=> 'p928_'+crypto.randomUUID().replaceAll('-',''),onChange=()=>{},timeoutMs=20000}={}){
 if(typeof api!=='function'||typeof context!=='function'||typeof isCurrent!=='function')fail('integration_contract_missing');
 let generation=0,ctx=null,busy=false,snapshot=null,plan=null,assessment=null,checkpoint=null,pending=null,error=null,journalError=false,newDatetime='',attempt=0,disposed=false;
 function selected(){const c=context();return object(c)&&ID.test(c.id||'')&&HEX.test(c.scope||'')&&typeof c.title==='string'&&c.title.trim()&&integer(c.epoch)?{id:c.id,scope:c.scope,epoch:c.epoch,title:c.title}:null;}
 function current(c=ctx,g=generation){return !disposed&&c&&g===generation&&ctx?.id===c.id&&ctx?.scope===c.scope&&ctx?.epoch===c.epoch&&isCurrent(c);}
 const key=c=>PREFIX+c.scope+':'+c.id;
 function checkpointReady(){return !!checkpoint&&checkpoint.checkpointMatches&&Date.parse(checkpoint.expiresAt)>now()&&snapshot?.freeze.state==='frozen'&&snapshot.paid.state==='none'&&checkpoint.operationId===snapshot.freeze.operationId&&checkpoint.freezeRevision===snapshot.freeze.freezeRevision;}
 function available(){
  const a={read:!!ctx&&!!current()};if(!a.read||busy||journalError)return a;
  if(pending){a.retry=true;return a;}
  if(!snapshot)return a;
  const f=snapshot.freeze,p=snapshot.paid;
  if(f.state==='none'||f.state==='released'){a.preview=true;a.freeze=!!plan&&plan.freezeRevision===f.freezeRevision&&plan.newDatetime===newDatetime;return a;}
  if(p.state==='none'){
   a.abort=true;
   if(f.state==='frozen'){a.assess=true;a.record=!!assessment&&assessment.canRecordCheckpoint===true&&assessment.freezeRevision===f.freezeRevision&&assessment.operationId===f.operationId;a.apply=checkpointReady();}
  }else if(f.state==='frozen'){
   a.publish=p.state==='pending_publish';a.confirm=p.state==='pending_confirmation';a.release=p.state==='active';
  }
  return a;
 }
 function state(){return copy({context:ctx,busy,snapshot,plan,assessment,checkpoint,pending,error,journalError,newDatetime,attempt,available:available()});}
 const emit=()=>{if(!disposed)onChange(state());};
 function envelope(c,p=pending,cp=checkpoint){return {schema:1,scope:c.scope,eventId:c.id,pending:p,checkpoint:cp?{checkpointId:cp.checkpointId}:null};}
 function save(c,p,cp){
  if(!journal||typeof journal.setItem!=='function')fail('journal_unavailable');
  try{journal.setItem(key(c),JSON.stringify(envelope(c,p,cp)));}catch(_){fail('journal_unavailable');}
 }
 function validPending(p,c){
  if(!object(p)||!Object.keys(ACTIONS).includes(p.kind)||!object(p.body)||p.body.action!==ACTIONS[p.kind]||p.body.id!==c.id||p.body.confirm!==true||!REQUEST.test(p.body.request_id||'')||!integer(p.body.freezeRevision))return false;
  const allowed={freeze:['planId','transitionAction','newDatetime'],record:['checkpointPlanId'],apply:['operationId','checkpointId','transitionAction','newDatetime'],publish:['operationId'],confirm:['operationId'],release:['operationId'],abort:['operationId']}[p.kind];
  if(Object.keys(p.body).some(k=>!['action','id','confirm','request_id','freezeRevision',...allowed].includes(k)))return false;
  if(allowed.some(k=>/Id$/.test(k)&&!HEX.test(p.body[k]||'')))return false;
  if(['freeze','apply'].includes(p.kind)&&(p.body.transitionAction!=='postpone'||!date(p.body.newDatetime)))return false;
  return true;
 }
 function restore(c){
  if(!journal||typeof journal.getItem!=='function')return;
  let raw;try{raw=journal.getItem(key(c));}catch(_){journalError=true;error='journal_unavailable';return;}
  if(!raw)return;
  try{
   if(raw.length>12000)fail('journal_invalid');const x=JSON.parse(raw);
   if(!object(x)||x.schema!==1||x.scope!==c.scope||x.eventId!==c.id||x.pending!==null&&!validPending(x.pending,c)||x.checkpoint!==null&&(!object(x.checkpoint)||!HEX.test(x.checkpoint.checkpointId||'')))fail('journal_invalid');
   pending=x.pending;checkpoint=x.checkpoint;
  }catch(_){journalError=true;error='journal_invalid';}
 }
 async function call(body,c){
  let timer;
  try{return await Promise.race([Promise.resolve().then(()=>api(copy(body),c.epoch)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('response_unknown'),{code:'response_unknown'})),timeoutMs);})]);}
  finally{clearTimeout(timer);}
 }
 async function read({keepError=false}={}){
  const c=ctx,g=generation;if(!current(c,g)||busy)return false;busy=true;if(!keepError&&!journalError)error=null;emit();
  try{
   let pair;
   for(let n=0;n<2;n++){
    const raw=await Promise.all([call({action:'event_transition_freeze_status',id:c.id},c),call({action:'event_transition_paid_status',id:c.id},c)]);
    if(!current(c,g))return false;
    const f=freezeView(raw[0],c.id),p=paidView(raw[1],c.id);
    if(f.state!=='none'&&(p.salesFrozen!==(f.state!=='released')||f.datesChanged!==p.datesChanged||(p.state==='none'?f.paidTransitionState!==null:f.paidTransitionState!==p.state)))fail('untrusted_status');
    if(f.freezeRevision===p.freezeRevision&&(f.state==='none'||f.operationId===p.freezeOperationId)){pair={freeze:f,paid:p};break;}
   }
   if(!pair)fail('status_changed');snapshot=pair;
   const f=pair.freeze;if(f.state==='frozen'||f.state==='freezing')newDatetime=f.newDatetime;
   if(plan&&plan.freezeRevision!==f.freezeRevision)plan=null;if(assessment&&assessment.freezeRevision!==f.freezeRevision)assessment=null;
   if(checkpoint&&pair.paid.state==='none'&&f.state==='frozen'){
    const raw=await call({action:'event_transition_settlement_verify',id:c.id,checkpointId:checkpoint.checkpointId},c);
    if(!current(c,g))return false;checkpoint=checkpointView(raw,c.id);
   }else checkpoint=null;
   return true;
  }catch(e){if(current(c,g)){snapshot=null;plan=null;assessment=null;error=e.code||'status_unavailable';}return false;}
  finally{if(current(c,g)){busy=false;emit();}}
 }
 function sync(){
  generation++;ctx=selected();busy=false;snapshot=null;plan=null;assessment=null;checkpoint=null;pending=null;error=null;journalError=false;newDatetime='';attempt=0;
  if(ctx)restore(ctx);emit();return ctx?read({keepError:journalError}):Promise.resolve(false);
 }
 function setDate(value){
  if(!current()||busy||pending||snapshot&&!['none','released'].includes(snapshot.freeze.state))fail('workflow_locked');
  plan=null;assessment=null;newDatetime='';error=null;
  try{newDatetime=value?inputDate(value):'';}catch(e){error=e.code;emit();throw e;}emit();
 }
 async function preview(){
  if(!available().preview)fail('workflow_locked');const c=ctx,g=generation,d=inputDate(newDatetime);if(Date.parse(d)<=now()+60000)fail('event_in_past');busy=true;error=null;emit();
  try{
   const x=await call({action:'event_transition_preview',id:c.id,transitionAction:'postpone',newDatetime:d},c);
   if(!current(c,g))return false;
   if(!object(x)||x.eventId!==c.id||x.format!=='offline'||x.accessKind!=='paid'||x.action!=='postpone'||x.newDatetime!==d||!date(x.currentDatetime)||!HEX.test(x.planId||'')||!integer(x.freezeRevision)||x.canPrepareFreeze!==true||x.safeForAutomaticCommit!==false||x.reservationsVerified!==true||!['activePaid','pendingPaid','activeFree'].every(k=>integer(x[k]))||!Array.isArray(x.variants)||x.variants.length!==1||x.variants[0].id!==c.id+'-offline'||!integer(x.variants[0].heldSeats))fail('unsupported_plan');
   if(x.freezeRevision!==snapshot.freeze.freezeRevision)fail('status_changed');plan=copy(x);return true;
  }catch(e){if(current(c,g)){plan=null;error=e.code||'plan_unavailable';}return false;}
  finally{if(current(c,g)){busy=false;emit();}}
 }
 async function assess(){
  if(!available().assess)fail('workflow_locked');const c=ctx,g=generation;busy=true;error=null;emit();
  try{
   const x=await call({action:'event_transition_settlement_preview',id:c.id},c);if(!current(c,g))return false;
   if(!object(x)||x.eventId!==c.id||!HEX.test(x.checkpointPlanId||'')||x.operationId!==snapshot.freeze.operationId||x.freezeRevision!==snapshot.freeze.freezeRevision||typeof x.canRecordCheckpoint!=='boolean'||!Array.isArray(x.blockers)||x.blockers.some(s=>typeof s!=='string')||x.canRecordCheckpoint!==(x.blockers.length===0)||!['activePaid','pendingPaid','activeFree'].every(k=>integer(x[k])))fail('untrusted_checkpoint');
   assessment=copy(x);return true;
  }catch(e){if(current(c,g)){assessment=null;error=e.code||'checkpoint_unavailable';}return false;}
  finally{if(current(c,g)){busy=false;emit();}}
 }
 function confirmation(ack,kind){if(!object(ack)||ack.confirmed!==true||ack.title!==ctx?.title)fail('confirmation_required');if(kind==='release'&&ack.noticesChecked!==true)fail('notices_confirmation_required');}
 function bodyFor(kind){
  const f=snapshot.freeze,p=snapshot.paid;let args;
  if(kind==='freeze')args={planId:plan.planId,freezeRevision:plan.freezeRevision,transitionAction:'postpone',newDatetime:plan.newDatetime};
  else if(kind==='record')args={checkpointPlanId:assessment.checkpointPlanId,freezeRevision:assessment.freezeRevision};
  else if(kind==='apply')args={operationId:f.operationId,checkpointId:checkpoint.checkpointId,freezeRevision:checkpoint.freezeRevision,transitionAction:'postpone',newDatetime:f.newDatetime};
  else args={operationId:kind==='abort'?f.operationId:p.operationId,freezeRevision:f.freezeRevision};
  const id=requestId();if(!REQUEST.test(id||''))fail('request_id_unavailable');return {action:ACTIONS[kind],id:ctx.id,...args,confirm:true,request_id:id};
 }
 async function run(kind,ack){
  const retry=kind==='retry';if(!available()[kind])fail('workflow_locked');const chosen=retry?pending.kind:kind;confirmation(ack,chosen);
  if(chosen==='apply'&&!retry){
   const c=ctx,g=generation;busy=true;emit();
   try{const x=await call({action:'event_transition_settlement_verify',id:c.id,checkpointId:checkpoint.checkpointId},c);if(!current(c,g))return false;checkpoint=checkpointView(x,c.id);}
   finally{if(current(c,g)){busy=false;emit();}}
   if(!checkpointReady())fail('checkpoint_expired');
  }
  const c=ctx,g=generation,operation=retry?copy(pending):{kind:chosen,body:bodyFor(chosen)};
  try{save(c,operation,checkpoint);}catch(e){error=e.code;journalError=true;emit();return false;}
  pending=operation;busy=true;error=null;attempt++;emit();let accepted=false;
  try{
   const x=await call(operation.body,c);if(!current(c,g))return false;
   let nextCheckpoint=checkpoint;
   if(chosen==='record')nextCheckpoint=checkpointView(x,c.id);
   else if(chosen==='freeze'||chosen==='abort'){freezeView(x,c.id);nextCheckpoint=null;}
   else {paidView(x,c.id);nextCheckpoint=null;}
   if(x.publicationUnknown===true)fail('response_unknown');
   save(c,null,nextCheckpoint);pending=null;checkpoint=nextCheckpoint;plan=null;assessment=null;accepted=true;
  }catch(e){
   if(current(c,g)){
    error=e.code||'response_unknown';
    if(BEFORE_WRITE.has(error)||REJECTED[chosen]?.includes(error)){try{save(c,null,checkpoint);pending=null;}catch(_){journalError=true;}}
   }
  }finally{if(current(c,g)){busy=false;emit();}}
  if(current(c,g))await read({keepError:true});return accepted;
 }
 return {state,sync,read,setDate,preview,assess,run,dispose(){generation++;disposed=true;ctx=null;}};
}
const LABELS={freeze:'Закрыть новые продажи и удержания',record:'Записать контрольную точку',apply:'Применить новую дату',publish:'Опубликовать изменения',confirm:'Проверить публикацию RU/EN и сканер',release:'Снять блокировку переноса',abort:'Отменить подготовку без изменения даты'};
const MESSAGES={
 journal_unavailable:'Не удалось сохранить сведения о действии в этой вкладке. Сверьте состояние сервера. Проверьте хранилище браузера и обновите страницу перед продолжением.',
 journal_invalid:'Сведения о незавершённом действии повреждены. Продолжение требует сверки с ответственным сотрудником; новый запрос не отправлен.',
 response_unknown:'Ответ на действие не подтверждён. Сверьте состояние сервера и при необходимости повторите то же действие.',
 status_changed:'Состояние изменилось во время чтения. Обновите его перед следующим действием.',status_unavailable:'Не получилось прочитать согласованное состояние сервера. Действия изменения недоступны.',
 untrusted_status:'Ответ сервера не соответствует выбранному событию или содержит противоречивое состояние. Обновите статус; изменения не начинаются.',untrusted_checkpoint:'Сервер не подтвердил контрольную точку. Повторите сверку.',
 invalid_new_datetime:'Укажите существующую дату и время по Москве.',event_in_past:'Новая дата должна быть в будущем, позже чем через минуту.',unsupported_plan:'Этот формат или серверный план не поддерживает данный путь переноса.',
 confirmation_required:'Введите точное название выбранного события и подтвердите действие.',notices_confirmation_required:'Перед снятием блокировки подтвердите проверку уведомлений и рабочих устройств.',
 checkpoint_expired:'Контрольная точка устарела или состояние изменилось. Выполните сверку заново.',workflow_locked:'Сначала обновите состояние и завершите текущую стадию.',
 not_authenticated:'Войдите в админку заново.',event_master_disabled:'Мастер выключен на сервере.',event_transitions_disabled:'Перенос ещё не включён на сервере.',event_paid_postpone_disabled:'Платный очный перенос ещё не включён на сервере.',event_settlement_disabled:'Серверная контрольная сверка пока выключена.',event_freeze_disabled:'Подготовительная блокировка пока выключена на сервере.',
 transition_payments_pending:'Есть незавершённые оплаты. Дождитесь их итогового состояния и повторите сверку.',transition_reservations_pending:'Есть действующие удержания мест. Дождитесь их завершения и повторите сверку.',
 paid_transition_unsupported:'Для этого события данный путь платного очного переноса не поддерживается.',paid_transition_checkpoint_changed:'Контрольная точка больше не совпадает с состоянием. Сначала сверьте исход предыдущего запроса.',
 transition_publication_pending:'Фактическая публикация ещё не подтвердилась. Проверьте статус и повторите то же действие после обновления сайта.',
 paid_transition_conflict:'Состояние изменил другой запрос. Сверьте серверный статус; новое действие не подменяет прежний запрос.',transition_freeze_conflict:'Подготовка изменилась. Сверьте серверный статус.',
 transition_checkpoint_conflict:'Сверка изменилась. Сначала проверьте результат прежнего запроса.',transition_request_conflict:'Сервер не принял повтор как прежнее действие. Нужна сверка журнала ответственным сотрудником.',
 event_updating:'Событие сейчас изменяется другим действием. Обновите статус позже.',github_unreachable:'Связь прервалась. Исход действия не установлен; перед повтором обновите статус.',
};
function errorText(code){return MESSAGES[code]||'Действие не подтверждено. Обновите статус и проверьте результат перед продолжением.';}
function mount(root,options){
 const doc=root?.ownerDocument;if(!doc)fail('integration_contract_missing');
 const find=s=>root.querySelector(s),message=find('[data-flow-message]'),facts=find('[data-flow-facts]'),dateInput=find('[data-flow-date]'),titleInput=find('[data-flow-title]'),confirm=find('[data-flow-confirm]'),notices=find('[data-flow-notices]'),noticeWrap=find('[data-flow-notices-wrap]'),previewButton=find('[data-flow-preview]'),assessButton=find('[data-flow-assess]'),readButton=find('[data-flow-read]');
 if([message,facts,dateInput,titleInput,confirm,notices,noticeWrap,previewButton,assessButton,readButton].some(x=>!x))fail('integration_contract_missing');
 let marker='',timer;const controls=[...root.querySelectorAll('[data-flow-action]')],format=value=>value?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'—';
 const controller=createController({...options,onChange:render});
 function report(error){message.textContent=errorText(error.code);}
 function render(s){
  root.hidden=!s.context;options.onChange?.(s);if(!s.context)return;
  const f=s.snapshot?.freeze,p=s.snapshot?.paid,a=s.available;
  const nextMarker=[s.context.scope,s.context.id,s.context.epoch,f?.freezeRevision,s.pending?.body.request_id,s.attempt,s.newDatetime,s.plan?.planId,s.assessment?.checkpointPlanId,s.checkpoint?.checkpointId].join(':');
  if(marker!==nextMarker){marker=nextMarker;titleInput.value='';confirm.checked=false;notices.checked=false;}
  const currentValue=s.newDatetime?s.newDatetime.slice(0,16):'';if(dateInput.value!==currentValue)dateInput.value=currentValue;
  dateInput.disabled=s.busy||!!s.pending||!!f&&!['none','released'].includes(f.state);
  readButton.disabled=s.busy;previewButton.disabled=s.busy||!a.preview;assessButton.disabled=s.busy||!a.assess;
  titleInput.disabled=confirm.disabled=notices.disabled=s.busy;
  controls.forEach(button=>{const kind=button.getAttribute('data-flow-action');button.hidden=!a[kind];button.disabled=s.busy;button.textContent=kind==='retry'?'Повторить то же действие: '+LABELS[s.pending?.kind]:LABELS[kind];});
  noticeWrap.hidden=!(a.release||s.pending?.kind==='release');
  facts.replaceChildren();
  const items=[['Событие',s.context.title],['Дата до переноса',format(f?.from||s.plan?.currentDatetime)],['Новая дата по Москве',format(p?.newDatetime||f?.newDatetime||s.plan?.newDatetime)],['Стадия',!f?'Не прочитана':f.state==='none'?'Подготовка не начата':p?.state==='pending_publish'?'Дата применена, публикация ожидается':p?.state==='pending_confirmation'?'Публикация требует проверки':p?.state==='active'?(p.salesFrozen?'Публикация подтверждена, блокировка сохраняется':'Перенос подтверждён, его блокировка снята'):f.state==='freezing'?'Подготовительная блокировка устанавливается':f.state==='frozen'?'Подготовительная блокировка установлена':'Подготовительная блокировка снята'],['Ревизия состояния',f?String(f.freezeRevision):'—']];
  if(s.plan)items.push(['Учтено в плане','Оплаченные билеты: '+s.plan.activePaid+'; незавершённые оплаты: '+s.plan.pendingPaid+'; удержания мест: '+s.plan.variants[0].heldSeats+'.']);
  if(s.assessment)items.push(['Контрольная сверка',s.assessment.canRecordCheckpoint?'Можно записать контрольную точку.':s.assessment.blockers.map(errorText).join(' ')]);
  if(s.checkpoint?.expiresAt)items.push(['Контрольная точка',s.checkpoint.checkpointMatches&&Date.parse(s.checkpoint.expiresAt)>Date.now()?'Действует до '+format(s.checkpoint.expiresAt):'Устарела или требует новой сверки.']);
  items.forEach(([label,value])=>{const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=value;facts.append(dt,dd);});
  message.textContent=s.busy?'Выполняем действие, дождитесь результата…':s.error?errorText(s.error):s.pending?'Исход предыдущего действия не подтверждён. Можно обновить статус и повторить тот же запрос. Другие изменения недоступны.':p?.state==='active'&&!p.salesFrozen?'Блокировка переноса снята. Ручное закрытие кассы управляется отдельно в «Показах». Перед редактированием карточки обновите каталог.':'Каждая стадия выполняется отдельным подтверждённым действием.';
 }
 function invoke(method){Promise.resolve().then(method).catch(report);}
 dateInput.addEventListener('change',()=>{try{controller.setDate(dateInput.value);}catch(e){report(e);}});
 readButton.addEventListener('click',()=>invoke(()=>controller.read()));previewButton.addEventListener('click',()=>invoke(()=>controller.preview()));assessButton.addEventListener('click',()=>invoke(()=>controller.assess()));
 controls.forEach(button=>button.addEventListener('click',()=>invoke(()=>controller.run(button.getAttribute('data-flow-action'),{title:titleInput.value,confirmed:confirm.checked,noticesChecked:notices.checked}))));
 // Expiry changes availability; it never sends a request or changes a date.
 timer=setInterval(()=>{const s=controller.state();if(s.context&&s.checkpoint)render(s);},1000);
 return {sync:controller.sync,clear:controller.sync,dispose(){clearInterval(timer);controller.dispose();}};
}
return {createController,mount,inputDate,freezeView,paidView,checkpointView,errorText,PREFIX,ACTIONS};
});
