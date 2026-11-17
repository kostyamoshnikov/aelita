/* AELITA ADDON v880 — opt-in, read-only staff status panel. Not deployed.
   This code never sends transition commands; only injected authenticated api({action:'event_transition_paid_status',id}).
   It neither reads credentials nor persists customer or operation data. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.AelitaPaidStatusReadOnly=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const ID=/^evt-[a-f0-9]{32}$/;
 const ALLOWED=new Set(['none','pending_publish','pending_confirmation','active']);
 const STRINGS={
  none:'Платный перенос не начат или приватное состояние отсутствует.',
  pending_publish:'Новая дата в приватном состоянии. Публикация ещё не подтверждена; продажи закрыты.',
  pending_confirmation:'Изменения опубликованы. Требуется проверка фактических страниц RU/EN и сканеров.',
  active:'Публикация подтверждена. Отдельно проверьте статус продаж и ручное закрытие кассы.'
 };
 function command(id){if(typeof id!=='string'||!ID.test(id))throw Error('invalid_event_id');return {action:'event_transition_paid_status',id};}
 function interpret(data,expectedId){
  if(!data||typeof data!=='object'||Array.isArray(data)||!ALLOWED.has(data.state))throw Error('untrusted_status');
  // Real v852 status() returns {eventId,state:'none',datesChanged:false} when
  // the private freeze record does not exist. It intentionally omits salesFrozen.
  const absent = data.state==='none' && data.datesChanged===false && data.salesFrozen===undefined;
  if(typeof data.salesFrozen!=='boolean' && !absent)throw Error('untrusted_status');
  if(expectedId!==undefined && data.eventId!==expectedId)throw Error('wrong_event_status');
  if(data.state!=='none' && !ID.test(data.eventId||''))throw Error('untrusted_event_id');
  if(data.history!==undefined && (!Array.isArray(data.history)||data.history.length>100))throw Error('untrusted_history');
  const history=Array.isArray(data.history)&&data.history.length<=100?data.history.length:null;
  return {state:data.state,text:STRINGS[data.state],salesFrozen:absent?null:data.salesFrozen,
    historyCount:history,
    // This is NOT an approval for a production release; it only reflects one response.
    verifiedProduction:false,
    label:absent?'Приватная запись о переносе не найдена. Состояние продаж не установлено.':(data.salesFrozen?'По состоянию сервера продажи заморожены.':'Сервер сообщает о снятой блокировке. Проверить ручное закрытие кассы.')};
 }
 function mount(container,{api,selection,isCurrent}={}){
  if(!container||typeof container.append!=='function'||typeof api!=='function'||typeof selection!=='function'||typeof isCurrent!=='function')throw Error('integration_contract_missing');
  const doc=container.ownerDocument;
  const btn=doc.createElement('button');btn.type='button';btn.textContent='Проверить статус переноса';
  const msg=doc.createElement('p');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
  container.append(btn,msg);
  let seq=0,disposed=false;
  function clear(){seq++;msg.textContent='';btn.disabled=false;}
  async function read(){
   if(disposed)return;
   const selected=selection();
   if(!selected||!ID.test(selected.id||'')){msg.textContent='Выберите мероприятие из каталога.';return;}
   const current=++seq;btn.disabled=true;msg.textContent='Читаем приватный статус…';
   try{
    const response=await api(command(selected.id),selected.epoch);
    if(disposed||current!==seq)return;
    if(!isCurrent(selected)){clear();return;}
    const view=interpret(response,selected.id);
    msg.textContent=view.text+' '+view.label+(view.historyCount===null?'':' История переносов: '+view.historyCount+'.');
   }catch(e){
    if(disposed||current!==seq)return;
    if(!isCurrent(selected)){clear();return;}
    msg.textContent='Статус не подтверждён. Проверить авторизацию, сеть и ответ сервера; никаких изменений не внесено.';
   }finally{if(!disposed&&current===seq)btn.disabled=false;}
  }
  btn.addEventListener('click',read);
  return {read,clear, sync:clear,dispose(){disposed=true;clear();btn.disabled=true;}};
 }
 return {command,interpret,mount};
});
