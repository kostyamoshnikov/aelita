(function(global){
 'use strict';
 const statuses={prepared:'Дата согласуется',confirmed:'Дата подтверждена',completed:'Проведён',canceled:'Отменён'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const local=v=>v?new Date(Date.parse(v)+10800000).toISOString().slice(0,16):'';
 const rub=v=>(Number(v)/100).toLocaleString('ru-RU')+' ₽';
 const minor=value=>{const m=/^(\d{1,8})(?:[.,](\d{1,2}))?$/.exec(String(value).trim());if(!m)throw Error('Введите сумму в рублях, не более двух знаков после запятой.');return Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));};
 const option=(rows,selected)=>'<option value="">Выберите</option>'+rows.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===selected?' selected':'')+'>'+esc(x.label)+'</option>').join('');
 const field=(name,label,type,value,extra='')=>'<label>'+label+'<input class="ym-disable-keys" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
 async function mount(host,type,entity,ctx){
  const {api,mutate,active,open,lookups,canWrite}=ctx;
  host.classList?.add('ym-hide-content');
  host.innerHTML='<h2>Рождественский заказ</h2><p role="status">Проверяем заявку…</p>';
  let response;
  try{response=await api({action:'christmas_order_view',...(type==='tasks'?{taskId:entity.id}:{id:entity.id})});}
  catch(e){if(active())host.innerHTML='<h2>Рождественский заказ</h2><p role="alert">'+esc(e.message)+'</p>';return;}
  if(!active())return;
  if(!response.eligible){host.remove();return;}
  if(response.exists&&!response.order){host.innerHTML='<h2>Рождественский заказ</h2><p>Заказ уже создан. Доступ к нему ограничен.</p>';return;}
  const row=response.order;
  if(row&&type==='tasks'){
   host.innerHTML='<h2>Рождественский заказ</h2><p>'+esc(statuses[row.christmas.status])+'</p><button type="button" data-open-order>Открыть заказ</button>';
   host.querySelector('[data-open-order]').onclick=()=>{if(active())open(row.id);};return;
  }
  if(!row){
   if(!canWrite){host.innerHTML='<h2>Рождественский заказ</h2><p>Заказ ещё не подготовлен.</p>';return;}
   host.innerHTML='<h2>Подготовить закрытый вечер</h2><p>Дата из заявки пока не занимает площадку. Выберите проект для заказа.</p><form data-christmas-form><label>Проект<select class="ym-disable-keys" name="projectId" required>'+option(lookups.projects.filter(x=>!x.archived),entity.projectId)+'</select></label><p role="alert" aria-live="polite"></p><button type="submit">Подготовить заказ</button></form>';
   bind(host.querySelector('form'),'christmas_order_prepare',()=>({taskId:entity.id,projectId:host.querySelector('[name=projectId]').value}));return;
  }
  const order=row.christmas,p=row.showPlan||{},terms=order.termsSnapshot;
  const summary='<h2>Рождественский заказ</h2><p><strong>'+esc(statuses[order.status])+'</strong> · до25 гостей · заявлено '+esc(order.guests)+'</p><p>Закрытый вечер: '+rub(terms?.closedMinor??row.amountMinor)+'. Аванс: '+rub(terms?.advanceMinor??row.amountMinor/2)+', остаток: '+rub(terms?.balanceMinor??row.amountMinor/2)+'.</p>'+
   (order.contractRef?'<p>Договор: '+esc(order.contractRef)+'. Условия зафиксированы при подтверждении '+esc(local(order.confirmedAt).replace('T',' '))+' МСК.</p>':'')+
   (order.contentRevision?'<p>Редакция предложения: '+esc(order.contentRevision.version)+'.</p>':'')+
   '<p class="hint">Подтверждение даты не отмечает получение оплаты. Площадка резервируется целиком, включая подготовку и демонтаж.</p>';
  if(!canWrite||['completed','canceled'].includes(order.status)){host.innerHTML=summary;mountReference();mountQr();return;}
  const venues=lookups.organizations.filter(x=>!x.archived&&(x.venueEligible||['venue','theatre'].includes(x.type)));
  host.innerHTML=summary+'<form data-christmas-form><h3>'+(order.status==='confirmed'?'Перенести вечер':'Подтвердить дату и условия')+'</h3><label>Площадка<select class="ym-disable-keys" name="venueOrganizationId" required>'+option(venues,row.show.venueOrganizationId)+'</select></label><div class="form-grid">'+
   field('startLocal','Начало · Москва','datetime-local',local(p.confirmedAt),'required min="2026-12-01T00:00" max="2027-01-31T23:59"')+
   field('endLocal','Окончание · Москва','datetime-local',local(p.confirmedEndAt),'required')+
   field('setupMinutes','Подготовка, минут','number',p.confirmedAt?(Date.parse(p.confirmedAt)-Date.parse(p.occupiedAt||p.confirmedAt))/60000:60,'required min="0" max="1440" step="1"')+
   field('teardownMinutes','Демонтаж, минут','number',p.confirmedEndAt?(Date.parse(p.occupiedEndAt||p.confirmedEndAt)-Date.parse(p.confirmedEndAt))/60000:30,'required min="0" max="1440" step="1"')+'</div>'+
   field('guests','Согласованное число гостей','number',order.guests,'required min="1" max="25" step="1"')+
   field('contractRef','Номер / обозначение согласованного договора','text',order.contractRef,'required maxlength="240"'+(order.contractRef?' readonly':''))+
   '<label>Основание согласования / переноса<textarea class="ym-disable-keys" name="reason" required maxlength="400"></textarea></label><p role="alert" aria-live="polite"></p><button type="submit">'+(order.status==='confirmed'?'Проверить и перенести':'Проверить и подтвердить')+'</button></form>'+
   '<details><summary>Отмена'+(order.status==='confirmed'?' или завершение':'')+'</summary><form data-close-form><label>Основание<textarea class="ym-disable-keys" name="reason" required maxlength="400"></textarea></label><label>Действие<select class="ym-disable-keys" name="operation" required><option value="">Выберите действие</option><option value="christmas_order_cancel">Отменить заказ</option>'+(order.status==='confirmed'?'<option value="christmas_order_complete">Отметить проведённым после демонтажа</option>':'')+'</select></label><p>Отмена не запускает возврат денег. Финансовые решения оформляются отдельно.</p><p role="alert" aria-live="polite"></p><button type="submit">Сохранить решение</button></form></details>';
  const form=host.querySelector('[data-christmas-form]');
  bind(form,'christmas_order_confirm',()=>{const f=form.elements;return {id:row.id,base_revision:row.revision,venueOrganizationId:f.venueOrganizationId.value,startLocal:f.startLocal.value,endLocal:f.endLocal.value,
   setupMinutes:Number(f.setupMinutes.value),teardownMinutes:Number(f.teardownMinutes.value),guests:Number(f.guests.value),contractRef:f.contractRef.value,reason:f.reason.value};});
  const close=host.querySelector('[data-close-form]');
  bind(close,()=>close.elements.operation.value,()=>({id:row.id,base_revision:row.revision,reason:close.elements.reason.value}));
  mountReference();
  mountQr();

  function mountQr(){
   if(!ctx.qrReady||!ctx.isOwner||!global.AelitaChristmasQR||!['confirmed','completed'].includes(order.status))return;
   const panel=document.createElement('section');panel.className='crm-christmas-qr';host.append(panel);
   global.AelitaChristmasQR.mount(panel,row,{api,mutate,active});
  }

  function mountReference(){
   if(!ctx.isOwner||!terms)return;
   const area=document.createElement('details');
   area.innerHTML='<summary>Справочный расчёт отмены</summary><p>Число дней до начала проверяет ответственный по договору. Расчёт не запускает возврат и не отмечает оплату.</p><form><label>Проверенное число дней до начала<input class="ym-disable-keys" name="daysBefore" type="number" min="0" max="366" step="1" required></label><label>Фактически внесено, ₽<input class="ym-disable-keys" name="paidMinor" inputmode="decimal" required></label><label>Из них аванс, ₽<input class="ym-disable-keys" name="advancePaidMinor" inputmode="decimal" required></label><p role="status" aria-live="polite"></p><button type="submit">Рассчитать по условиям договора</button></form>';
   host.append(area);const f=area.querySelector('form'),message=f.querySelector('[role=status]');
   let pending=false,editVersion=0;
   f.addEventListener('input',()=>{editVersion++;message.textContent='Данные изменились. Повторите расчёт.';});
   const values=()=>{const days=String(f.elements.daysBefore.value).trim();if(!/^\d{1,3}$/.test(days)||Number(days)>366)throw Error('Укажите целое число дней от 0 до 366.');return {id:row.id,base_revision:row.revision,daysBefore:Number(days),paidMinor:minor(f.elements.paidMinor.value),advancePaidMinor:minor(f.elements.advancePaidMinor.value)};};
   f.onsubmit=async ev=>{ev.preventDefault();if(pending||!active())return;const button=f.querySelector('button');pending=true;button.disabled=true;message.textContent='Проверяем расчёт…';
    const version=editVersion;try{const payload=values(),key=JSON.stringify(payload),result=await api({action:'christmas_order_refund_reference',...payload});
     if(!active())return;if(version!==editVersion||key!==JSON.stringify(values())||result.orderRevision!==payload.base_revision){message.textContent='Данные или редакция заказа изменились. Обновите карточку и повторите расчёт.';return;}
     message.textContent='По выбранной редакции условий: '+rub(result.reference.amountMinor)+'. Требуется решение ответственного за финансы; деньги не возвращались.';
    }catch(e){if(active()&&version===editVersion)message.textContent=e.message;}finally{pending=false;if(active())button.disabled=false;}
   };
  }

  function bind(form,action,payload){
   let pending=false,retry=null;
   form.onsubmit=async ev=>{
    ev.preventDefault();if(pending||!active())return;
    const name=typeof action==='function'?action():action,body=payload(),fingerprint=JSON.stringify([name,body]);
    if(!retry||retry.fingerprint!==fingerprint)retry={fingerprint,id:global.crypto.randomUUID()};
    pending=true;const button=form.querySelector('button[type=submit]'),message=form.querySelector('[role=alert]');button.disabled=true;message.textContent='Проверяем и сохраняем…';
    try{const result=await mutate(name,body,retry.id);if(active())open(result.id);}
    catch(e){if(active()){message.textContent=e.message;if(e.code==='conflict')message.textContent+=' Обновите карточку, чтобы увидеть актуальное состояние.';}}
    finally{pending=false;if(active())button.disabled=false;}
   };
  }
 }
 const api={mount,local,minor,statuses};
 if(typeof module==='object'&&module.exports)module.exports=api;
 global.AelitaChristmasBookings=api;
})(typeof window!=='undefined'?window:globalThis);
