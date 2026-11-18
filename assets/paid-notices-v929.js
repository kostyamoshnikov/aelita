(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaPaidNotices=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const HEX=/^[a-f0-9]{64}$/,ID=/^evt-[a-f0-9]{32}$/,REQ=/^[A-Za-z0-9_-]{16,80}$/,PREFIX='aelita_paid_notices_v929:';
const ACTIONS={prepare:'event_transition_notice_prepare',resolve:'event_transition_notice_resolve'};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x),copy=x=>JSON.parse(JSON.stringify(x)),integer=x=>Number.isSafeInteger(x)&&x>=0;
const fail=code=>{throw Object.assign(Error(code),{code});};
const DEFINITE=new Set(['not_authenticated','event_master_disabled','event_transitions_disabled','paid_notices_disabled','transition_confirmation_required','paid_notice_evidence_required','paid_notice_resolution_conflict','paid_notice_job_not_found','paid_notice_transition_unavailable','paid_notice_history_full','paid_mail_busy','event_in_past']);
function view(x,c){
 if(!object(x)||x.eventId!==c.id||x.operationId!==c.operationId||typeof x.enabled!=='boolean'||typeof x.prepared!=='boolean'||typeof x.complete!=='boolean'||x.deliveryProven!==false||
  !integer(x.recipients)||!integer(x.invalidRecipients)||!integer(x.unresolvedCount)||!object(x.counts)||
  !['pending','sending','accepted','rejected','unknown','unindexed'].every(k=>integer(x.counts[k]))||
  Object.values(x.counts).reduce((n,v)=>n+v,0)!==x.recipients||!Array.isArray(x.unresolved)||x.unresolved.length>50||x.unresolvedCount<x.unresolved.length||
  x.unresolved.some(j=>!object(j)||!HEX.test(j.id||'')||!['sending','rejected','unknown'].includes(j.state)||j.messageId!=='<aelita-postpone-'+j.id+'@aelita-production.ru>'||typeof j.currentRecipient!=='boolean')||
  x.complete&&(!x.prepared||x.counts.accepted!==x.recipients||x.invalidRecipients!==0||x.unresolvedCount!==0||!Number.isFinite(Date.parse(x.completeAsOf))))fail('notice_status_invalid');
 return copy(x);
}
function createController({api,context,isCurrent,journal,onChange=()=>{},requestId=()=> 'n929_'+crypto.randomUUID().replaceAll('-',''),timeoutMs=20000}){
 let ctx=null,generation=0,busy=false,snapshot=null,pending=null,error=null,journalError=false,attempt=0,disposed=false;
 const key=c=>PREFIX+c.scope+':'+c.id+':'+c.operationId;
 function selected(){const c=context();return object(c)&&ID.test(c.id||'')&&HEX.test(c.scope||'')&&HEX.test(c.operationId||'')&&integer(c.epoch)&&typeof c.title==='string'&&c.title.trim()?copy(c):null;}
 const current=(c=ctx,g=generation)=>!disposed&&c&&g===generation&&ctx?.scope===c.scope&&ctx?.id===c.id&&ctx?.operationId===c.operationId&&ctx?.epoch===c.epoch&&isCurrent(c);
 function state(){return copy({context:ctx,busy,snapshot,pending,error,journalError,attempt});}
 const emit=()=>onChange(state());
 function validBody(b,c){
  if(!object(b)||b.id!==c.id||b.operationId!==c.operationId||b.confirm!==true||!REQ.test(b.request_id||'')||!Object.values(ACTIONS).includes(b.action))return false;
  const base=['action','id','operationId','confirm','request_id'];
  if(b.action===ACTIONS.resolve){base.push('jobId','decision','evidence');if(!HEX.test(b.jobId||'')||!['accepted','not_sent'].includes(b.decision)||! /^[A-Za-z0-9_.:@/-]{8,160}$/.test(b.evidence||''))return false;}
  return Object.keys(b).length===base.length&&Object.keys(b).every(k=>base.includes(k));
 }
 function save(c,body){try{if(!journal?.setItem)fail('notice_journal_unavailable');journal.setItem(key(c),JSON.stringify({schema:1,eventId:c.id,scope:c.scope,operationId:c.operationId,pending:body}));}
  catch(_){fail('notice_journal_unavailable');}}
 async function call(body,c){let timer;try{return await Promise.race([Promise.resolve().then(()=>api(copy(body),c.epoch)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('notice_response_unknown'),{code:'notice_response_unknown'})),timeoutMs);})]);}finally{clearTimeout(timer);}}
 async function read(keepError=false){const c=ctx,g=generation;if(!current(c,g)||busy)return false;busy=true;if(!keepError&&!error?.startsWith('notice_journal_'))error=null;emit();
  try{const raw=await call({action:'event_transition_notice_status',id:c.id,operationId:c.operationId},c);if(!current(c,g))return false;snapshot=view(raw,c);return true;}
  catch(e){if(current(c,g)){snapshot=null;if(!journalError)error=e.code||'notice_status_unavailable';}return false;}
  finally{if(current(c,g)){busy=false;emit();}}
 }
 async function sync(){generation++;ctx=selected();busy=false;snapshot=null;pending=null;error=null;journalError=false;attempt=0;
  if(ctx)try{const raw=journal?.getItem(key(ctx));if(raw){if(raw.length>4000)fail('notice_journal_invalid');const d=JSON.parse(raw);
   if(d.schema!==1||d.eventId!==ctx.id||d.scope!==ctx.scope||d.operationId!==ctx.operationId||d.pending!==null&&!validBody(d.pending,ctx))fail('notice_journal_invalid');pending=d.pending;}}
   catch(e){error=e.code||'notice_journal_invalid';journalError=true;}
  emit();return ctx?read(true):false;
 }
 function syncIfChanged(){const c=selected(),sig=x=>x?JSON.stringify([x.id,x.scope,x.operationId,x.epoch]):'';return sig(c)!==sig(ctx)?sync():Promise.resolve(false);}
 async function run(kind,ack){
  if(!current()||busy||!['prepare','resolve','retry'].includes(kind)||kind!=='retry'&&pending||journalError)fail('notice_action_locked');
  if(!object(ack)||ack.title!==ctx.title||ack.confirmed!==true)fail('confirmation_required');
  let body;
  if(kind==='retry'){if(!pending)fail('notice_action_locked');body=copy(pending);}
  else{
   if(!snapshot?.enabled||kind==='prepare'&&snapshot.prepared)fail('notice_action_locked');
   body={action:ACTIONS[kind],id:ctx.id,operationId:ctx.operationId,confirm:true,request_id:requestId()};
   if(kind==='resolve'){
    if(!snapshot.unresolved.some(x=>x.id===ack.jobId&&['unknown','rejected'].includes(x.state)))fail('notice_action_locked');
    Object.assign(body,{jobId:ack.jobId,decision:ack.decision,evidence:ack.evidence});
   }
   if(!validBody(body,ctx))fail('paid_notice_evidence_required');
  }
  const c=ctx,g=generation;try{save(c,body);}catch(e){error=e.code;journalError=true;emit();return false;}
  pending=body;busy=true;error=null;attempt++;emit();let accepted=false;
  try{const raw=await call(body,c);if(!current(c,g))return false;snapshot=view(raw,c);save(c,null);pending=null;accepted=true;}
  catch(e){if(current(c,g)){error=e.code||'notice_response_unknown';if(error==='notice_journal_unavailable')journalError=true;if(DEFINITE.has(error))try{save(c,null);pending=null;}catch(_){error='notice_journal_unavailable';journalError=true;}}}
  finally{if(current(c,g)){busy=false;emit();}}
  if(current(c,g))await read(true);return accepted;
 }
 return {state,sync,syncIfChanged,read,run,dispose(){disposed=true;generation++;ctx=null;}};
}
const MESSAGES={notice_journal_unavailable:'Не удалось сохранить действие в этой вкладке. Сверьте результат на сервере перед продолжением.',notice_journal_invalid:'Сохранённое действие повреждено. Нужна сверка с ответственным сотрудником.',confirmation_required:'Введите точное название события и подтвердите действие.',paid_notice_evidence_required:'Укажите решение и ссылочный номер записи SMTP-провайдера (8–160 знаков).',notice_action_locked:'Обновите статус и завершите предыдущее действие.',paid_notices_disabled:'Отправка уведомлений пока выключена на сервере.',paid_mail_busy:'Сейчас выполняется другое почтовое действие события. Обновите статус позже.',paid_notice_resolution_conflict:'Состояние письма изменилось; обновите статус.',paid_notice_inventory_changed:'Владельцы изменились во время сверки. Обновите статус.',notice_status_invalid:'Ответ сервера не соответствует текущему событию. Действия недоступны.'};
const errorText=code=>MESSAGES[code]||'Результат действия не подтверждён. Обновите статус; для повтора используйте тот же сохранённый запрос.';
function mount(root,options){
 const $=name=>root.querySelector('[data-notice-'+name+']'),nodes={};
 for(const name of ['message','facts','read','prepare','retry','title','confirm','jobs','decision','evidence','resolve']){nodes[name]=$(name);if(!nodes[name])fail('notice_integration_missing');}
 let marker='';const controller=createController({...options,onChange:render});
 function render(s){root.hidden=!s.context;options.onChange?.(s);if(!s.context)return;
  const x=s.snapshot,k=JSON.stringify([s.context.id,s.context.scope,s.context.epoch,s.context.operationId,s.attempt,s.pending?.request_id,x?.unresolved]);
  if(marker!==k){marker=k;nodes.title.value='';nodes.confirm.checked=false;nodes.evidence.value='';}
  nodes.message.textContent=s.busy?'Сверяем уведомления…':s.error?errorText(s.error):s.pending?'Предыдущее действие не подтверждено. Можно обновить статус и повторить тот же запрос.':!x?'Статус недоступен.':!x.enabled?'Отправка уведомлений пока выключена на сервере.':x.complete?'SMTP подтвердил приём писем текущим получателям на момент сверки. Доставка в ящики этим не подтверждается.':'Письма отправляет таймер после отдельной подготовки рассылки. Неопределённые результаты требуют сверки журнала SMTP.';
  nodes.facts.textContent=x?`Получателей: ${x.recipients}. Принято SMTP: ${x.counts.accepted}. В очереди: ${x.counts.pending+x.counts.unindexed}. Отправляется: ${x.counts.sending}. Требуют сверки: ${x.unresolvedCount}. Некорректных адресов: ${x.invalidRecipients}.`:'';
  const selected=nodes.jobs.value;nodes.jobs.replaceChildren();
  for(const j of x?.unresolved||[]){const o=root.ownerDocument.createElement('option');o.value=j.id;o.textContent=(j.state==='unknown'?'Исход неизвестен':j.state==='rejected'?'SMTP отказал':'Отправка начата')+' · '+j.messageId;nodes.jobs.append(o);}
  if(x?.unresolved.some(j=>j.id===selected))nodes.jobs.value=selected;
  nodes.prepare.hidden=!!x?.prepared;nodes.retry.hidden=!s.pending;nodes.read.disabled=s.busy;
  nodes.prepare.disabled=s.busy||!!s.pending||!x?.enabled||s.journalError;nodes.retry.disabled=s.busy||s.journalError;
  const chosen=x?.unresolved.find(j=>j.id===nodes.jobs.value);nodes.resolve.disabled=s.busy||!!s.pending||!x?.enabled||!chosen||chosen.state==='sending'||s.journalError;
 }
 const invoke=fn=>Promise.resolve().then(fn).catch(e=>{nodes.message.textContent=errorText(e.code);});
 const ack=()=>({title:nodes.title.value,confirmed:nodes.confirm.checked,jobId:nodes.jobs.value,decision:nodes.decision.value,evidence:nodes.evidence.value.trim()});
 nodes.read.addEventListener('click',()=>invoke(()=>controller.read()));
 for(const kind of ['prepare','resolve','retry'])nodes[kind].addEventListener('click',()=>invoke(()=>controller.run(kind,ack())));
 nodes.jobs.addEventListener('change',()=>{nodes.title.value='';nodes.confirm.checked=false;nodes.evidence.value='';render(controller.state());});
 nodes.decision.addEventListener('change',()=>{nodes.confirm.checked=false;nodes.evidence.value='';});
 return controller;
}
return {PREFIX,ACTIONS,createController,mount,view,errorText};
});
