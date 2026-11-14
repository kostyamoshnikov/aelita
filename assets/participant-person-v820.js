/* Person details stay in memory. Tickets and delivery are not changed here. */
(function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parts=['lastName','firstName','middleName'];
 const when=value=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(value))+' МСК';
 function create(hooks){
  let dialog,current=null,contexts={},baselines={},saving=false,returnFocus,focusError=false,generation=0;
  const form=kind=>dialog.querySelector('[data-person-form='+kind+']'),forms=()=>dialog.querySelectorAll('form');
  function clean(el){window.AelitaWorkForms?.clean(el);}
  function message(text,bad=false){const el=dialog.querySelector('[data-person-message]');el.textContent=text;el.classList.toggle('error',bad);}
  function rowValue(row,kind){return JSON.stringify(kind==='identity'?row.identity:row.response);}
  function fill(row,kind){const f=form(kind);if(kind==='identity')for(const p of parts)f.elements.namedItem(p).value=row.identity?.[p]||'';else f.elements.namedItem('response').value=row.response||'unknown';baselines[kind]=rowValue(row,kind);clean(f);}
  function heading(row){
   dialog.querySelector('h2').textContent=row.name;
   dialog.querySelector('[data-person-original]').textContent='В исходных документах: '+row.originalNames.join('; ');
   dialog.querySelector('[data-person-source]').innerHTML=row.sources.map(s=>'<li>'+esc(s.label)+(s.mode?' · '+esc(window.AelitaParticipantsView.modeLabel[s.mode]||'Формат не указан'):'')+(s.seatKey?' · место '+esc(s.seatKey):'')+(s.price!==undefined?' · '+esc(s.price)+' ₽':'')+(s.orderId?'<button type="button" class="mini-btn" data-person-order="'+esc(s.orderId)+'">Открыть заказ и билеты</button>':'')+'</li>').join('');
   dialog.querySelector('[data-person-history]').innerHTML=row.history.length?row.history.slice().reverse().map(h=>'<li>'+esc(when(h.at))+' · '+esc(h.actor)+' · '+esc(h.action)+(h.value?' — '+esc(h.value):'')+'</li>').join(''):'<li>Ручных изменений пока нет.</li>';
  }
  function close(){if(!dialog?.open)return true;if(saving||window.AelitaWorkForms&&!AelitaWorkForms.canClose(dialog))return false;forms().forEach(clean);dialog.close();const focus=returnFocus?.isConnected?returnFocus:document.querySelector('[data-participant-person="'+current?.id+'"]')||document.getElementById('participants-status');focus?.focus?.({preventScroll:true});return true;}
  function setup(){
   if(dialog)return;
   dialog=document.createElement('dialog');dialog.id='participants-person-dialog';dialog.setAttribute('data-work-managed-close','');dialog.setAttribute('aria-labelledby','participants-person-title');
   dialog.innerHTML='<div class="participant-person-head"><h2 id="participants-person-title"></h2><button type="button" data-person-close aria-label="Закрыть карточку участника">×</button></div><p data-person-message role="status" aria-live="polite"></p><p class="hint" data-person-original></p><h3>Билеты и приглашения</h3><ul data-person-source></ul><form data-person-form="identity"><h3>Имя в списке участников</h3><p class="hint">Заполняйте только известные части имени. Фамилия не определяется автоматически; исходные документы сохраняются.</p><label>Фамилия<input class="ym-disable-keys" name="lastName" autocomplete="off" maxlength="80"></label><label>Имя<input class="ym-disable-keys" name="firstName" autocomplete="off" maxlength="80"></label><label>Отчество — если известно<input class="ym-disable-keys" name="middleName" autocomplete="off" maxlength="80"></label><div class="participants-actions"><button type="submit" class="mini-btn">Сохранить имя</button><button type="button" class="mini-btn" data-person-reset="identity">Вернуть имя из документов</button></div></form><form data-person-form="response"><h3>Ответ об участии</h3><p class="hint">Отмечайте ответ, который человек сообщил вам. Отказ исключает его из ожидаемых зрителей и сохраняет билет или приглашение.</p><label>Ответ участника<select name="response"><option value="unknown">Пока не подтвердил</option><option value="confirmed">Подтвердил участие</option><option value="declined">Отказался</option><option value="conflict" disabled>Ответы требуют сверки</option></select></label><div class="participants-actions"><button type="submit" class="mini-btn">Записать ответ</button><button type="button" class="mini-btn" data-person-reset="response">Вернуть ответ из источника</button></div></form><details><summary>История имени и ответов</summary><ol data-person-history></ol></details>';
   document.body.append(dialog);
   dialog.querySelector('[data-person-close]').onclick=close;
   dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
   for(const kind of ['identity','response'])form(kind).onsubmit=e=>{e.preventDefault();save(kind,false);};
   dialog.querySelectorAll('[data-person-reset]').forEach(b=>b.onclick=()=>save(b.dataset.personReset,true));
   dialog.addEventListener('click',e=>{const b=e.target.closest('[data-person-order]');if(b&&close())window.openWorkOrder?.(b.dataset.personOrder);});
  }
  async function save(kind,reset){
   if(saving||!current||!hooks.canEdit())return;const f=form(kind),id=current.id,epoch=generation;
   const input=kind==='identity'?{identity:Object.fromEntries(parts.map(p=>[p,f.elements.namedItem(p).value]))}:{response:f.elements.namedItem('response').value};
   if(!reset&&kind==='identity'&&!input.identity.lastName.trim()&&!input.identity.firstName.trim()){message('Укажите известное имя или фамилию.',true);f.elements.namedItem('firstName').focus();return;}
   if(!reset&&kind==='response'&&input.response==='conflict'){message('Уточните ответ и выберите один из вариантов.',true);return;}
   if(reset&&!confirm('Вернуть '+(kind==='identity'?'имя из документов':'ответ из источника')+' для «'+current.name+'»?'))return;
   saving=true;forms().forEach(x=>x.dataset.workBusy='1');dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);message('Сохраняем…');
   try{
    const next=await hooks.save(kind+(reset?'_reset':''),input,id,contexts[kind]);
    if(epoch!==generation)return;
    const row=next.rows.find(x=>x.id===id);if(!row)throw Error('Состав изменился. Обновите список участников.');
    const other=kind==='identity'?'response':'identity',ctx={ref:next.event.ref,snapshot:next.snapshot,revision:next.revision};
    contexts[kind]=ctx;if(rowValue(row,other)===baselines[other])contexts[other]=ctx;
    current=row;heading(row);fill(row,kind);message(kind==='identity'?'Имя сохранено. Документы остались прежними.':'Ответ сохранён. Список и количество обновлены.');
   }catch(e){if(epoch!==generation)return;message(e.message,true);if(e.code==='participants_bad_identity')focusError=true;}
   finally{if(epoch!==generation)return;saving=false;forms().forEach(x=>delete x.dataset.workBusy);dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=false);dialog.querySelector('option[value=conflict]').disabled=true;window.AelitaWorkForms?.refresh();if(focusError){focusError=false;form('identity').elements.namedItem('lastName').focus();}}
  }
  function open(id,trigger){
   setup();if(dialog.open&&!close())return false;
   const row=hooks.row(id);if(!row)return false;current=row;returnFocus=trigger;
   const ctx=hooks.context();contexts={identity:ctx,response:ctx};heading(row);fill(row,'identity');fill(row,'response');message(hooks.canEdit()?'Изменения относятся только к списку этого события.':'Источники загружены не полностью. Просмотр доступен; для правки обновите участников.');dialog.querySelectorAll('form input,form select,form button').forEach(x=>x.disabled=!hooks.canEdit());dialog.showModal();dialog.querySelector('[data-person-close]').focus();return true;
  }
  function reset(){++generation;current=null;contexts={};baselines={};returnFocus=null;saving=false;focusError=false;if(dialog){forms().forEach(clean);dialog.querySelectorAll('input,select').forEach(x=>x.value='');if(dialog.open)dialog.close();dialog.remove();dialog=null;}}
  return{open,close,reset,active:()=>!!dialog?.open};
 }
 window.AelitaParticipantPerson={create};
})();
