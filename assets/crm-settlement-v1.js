(function(){
 'use strict';
 const statuses={draft:'Черновик',approved:'Согласован',reopened:'Переоткрыт',void:'Аннулирован'};
 const metricRows=[['orders','Завершённые заказы'],['tickets','Билеты в заказах'],['capacity','Вместимость'],['soldSeats','Занято мест'],['moneyMinor','Подтверждённые оплаты',true],['giftMinor','Подарочные карты',true],['refundConfirmedMinor','Возвраты провайдера',true],['refundManualMinor','Возвраты по ручной отметке',true],['refundProcessing','Возвраты в обработке'],['unknownMoney','Заказы без денежной разбивки']];
 const quality={ordersWithoutPaidAt:'Есть заказы без даты оплаты',refundsWithoutDecisionDate:'Есть возвраты без даты решения',refundsWithoutAmount:'Есть возвраты без суммы',refundsUnverified:'Есть возвраты без подтверждения',externalSalesEvents:'Отчёт охватывает только данные, доступные своей кассе'};
 const action=(key,label)=>'<button type="button" data-settlement="'+key+'">'+label+'</button>';
 const today=()=>new Date(Date.now()+10800000).toISOString().slice(0,10);
 function currencyFormat(currency){
  const code=String(currency||'RUB').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(code))throw Error('Укажите код валюты, например RUB.');
  const fmt=new Intl.NumberFormat('ru-RU',{style:'currency',currency:code});
  return {fmt,digits:fmt.resolvedOptions().maximumFractionDigits};
 }
 function minor(v,currency){
  const s=String(v??'').trim().replace(',','.');
  if(!s)return null;
  const {digits}=currencyFormat(currency);
  if(!/^\d{1,12}(?:\.\d{1,4})?$/.test(s))throw Error('Проверьте сумму.');
  const [a,b='']=s.split('.');
  if(b.length>digits)throw Error('Слишком много знаков после запятой для выбранной валюты.');
  return Number(a)*10**digits+Number(b.padEnd(digits,'0'));
 }
 function count(v){
  if(v==='')return null;
  if(!/^\d{1,12}$/.test(v))throw Error('Введите целое количество билетов.');
  return Number(v);
 }
 function mount(root,x,{api,mutate,esc,date,money,input,openDialog,dialog,refresh,active,admin,owner}){
  const e=x.showEvent,ref=e?.sourceRef||'',performance=ref.startsWith('tickets:')?ref.slice(8):'',registration=ref.startsWith('events:')?ref.slice(7):'';
  const nav=admin&&performance?'<a href="/admin/?crmOrders='+encodeURIComponent(performance)+'#orders">Заказы по показу ↗</a>':admin&&registration?'<a href="/admin/?crmRegistration='+encodeURIComponent(registration)+'#events">Регистрации ↗</a>':'';
  const title='<h2>Билеты и итог</h2>';
  root.innerHTML=title+(nav?'<p>'+nav+'</p>':'')+(owner?'<p>Загрузка сведений…</p>':'');
  if(!owner)return;
  const q=new URLSearchParams(location.search),runId=q.get('show')===x.id&&/^ar-[a-f0-9]{24}$/.test(q.get('run')||'')?q.get('run'):'';
  let view;
  const value=(n,currency)=>{if(n==null)return 'Нет данных';const {fmt,digits}=currencyFormat(currency);return fmt.format(n/10**digits);};
  const amount=(n,currency)=>n==null?'':String(n/10**currencyFormat(currency).digits);
  const info=(rows)=>'<dl>'+rows.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v??'Нет данных')+'</dd>').join('')+'</dl>';
  const fact=r=>r?'<p>'+esc(r.sourceCoverage)+' · '+esc(date(r.completedAt))+' · МСК</p>'+
   '<p class="hint">Период '+esc(r.from||'с начала')+' — '+esc(r.to||'по текущую дату')+'</p>'+
   info(metricRows.map(([k,label,cash])=>[label,cash?(r[k]==null?'Нет данных':money(r[k])):r[k]]))+
   Object.entries(quality).filter(([k])=>r.quality[k]>0).map(([,msg])=>'<p class="hint">'+msg+'</p>').join(''):'<p class="hint">Срез отчёта пока не прикреплён.</p>';
  function sources(data){
   return data?.sources.length?'<h4>Внешние источники</h4><ul class="production-list">'+data.sources.map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+'</a> · '+esc(s.seller)+
    ' · '+esc(s.from)+' — '+esc(s.to)+'<p class="hint">Выгрузка '+esc(s.reportedOn)+' · Билеты '+esc(s.tickets??'нет данных')+' · Оплаты '+esc(value(s.paidMinor,s.currency))+' · Возвраты '+esc(value(s.refundMinor,s.currency))+'</p>'+
    (s.comment?'<p>'+esc(s.comment)+'</p>':'')+'</li>').join('')+'</ul><p class="hint">Каждый канал показан отдельно. Суммы по источникам не складываются автоматически.</p>':'';
  }
  function version(v){
   const d=v.data;
   return '<p>'+esc(date(v.at))+' · '+esc(v.by)+' · '+esc(d.sourceRef)+(v.reason?' · '+esc(v.reason):'')+'</p>'+
    info([['К расчёту с партнёром',value(d.agreedMinor,d.currency)],['База расчёта',d.basis||'—'],['Сторона',d.basisSide||'—']])+sources(d)+fact(d.report);
  }
  function render(){
   const s=view.settlement,latest=s.approved?.data||s.draft;
   const params=new URLSearchParams({settlementShow:x.id,performance:view.performanceId});
   if(latest?.sourceRef===ref){params.set('from',latest.from);params.set('to',latest.to);}
   const current=latest?.sourceRef===ref?latest:null;
   const stored=view.report||current?.report;
   root.innerHTML=title+'<p>'+esc(e?.title||'Показ без привязки к событию')+'</p>'+
    '<div class="actions">'+(nav?nav:'')+(view.canReport?'<a href="/admin/crm/?'+esc(params.toString())+'#analytics">Открыть отчёт по показу ↗</a>':'')+'</div>'+
    (view.reportIssue?'<p class="password-note">'+esc(view.reportIssue)+'</p>':'')+
    (view.changed?'<p class="password-note">Показатели обновились после согласования. Сравните версии и переоткройте итог при необходимости.</p>':'')+
    '<h3>Факт своей кассы</h3>'+fact(stored)+
    '<h3>Итог по партнёру · '+statuses[s.state]+'</h3>'+
    (s.approved?version(s.approved):s.draft?info([['Период',s.draft.from+' — '+s.draft.to],['К расчёту с партнёром',value(s.draft.agreedMinor,s.draft.currency)]])+sources(s.draft):'')+
    (latest&&latest.sourceRef!==ref?'<p class="password-note">Сверка относится к предыдущему событию.</p>':'')+
    (ref&&!x.archivedAt?'<div class="actions">'+(s.state==='approved'?action('reopen','Переоткрыть')+action('void','Аннулировать итог'):
     action('edit',s.draft?'Редактировать сверку':'Записать сверку')+(s.draft?action('delete','Удалить черновик'):''))+'</div>':'')+
    (s.history.length?'<details><summary>Предыдущие итоги</summary>'+s.history.slice().reverse().map(version).join('')+'</details>':'');
  }
  function form(title,body,buttons,run){
   openDialog(title,'<form data-settlement-form class="form-grid">'+body+'<p class="full form-error" role="alert"></p><div class="full actions">'+buttons+
    '<button type="button" data-dialog-close>Отмена</button></div></form>');
   const f=dialog.querySelector('[data-settlement-form]');
   f.onsubmit=async ev=>{
    ev.preventDefault();const submit=ev.submitter||f.querySelector('button[type=submit]');submit.disabled=true;
    try{await run(f,submit.value);if(f.isConnected&&dialog.open)dialog.close();if(active())await refresh();}
    catch(err){if(f.isConnected)f.querySelector('.form-error').textContent=err.message;}
    finally{submit.disabled=false;}
   };
   return f;
  }
  const save=(key,fields)=>mutate('show_settlement_'+key,{id:x.id,base_revision:x.revision,...fields});
  function edit(){
   const d=view.settlement.draft?.sourceRef===ref?view.settlement.draft:{};
   const r=view.report,row=s=>'<fieldset class="full form-grid" data-cash-source><legend>Внешняя касса</legend>'+
    input('label','Канал',s.label)+input('seller','Продавец',s.seller)+input('from','Начало периода',s.from,'date')+
    input('to','Конец периода',s.to,'date')+input('reportedOn','Дата выгрузки',s.reportedOn,'date')+
    input('currency','Валюта',s.currency||'RUB')+input('tickets','Билеты',s.tickets)+input('paid','Оплаты',amount(s.paidMinor,s.currency))+
    input('refund','Возвраты',amount(s.refundMinor,s.currency))+input('url','Документ',s.url,'url',true)+input('comment','Примечание',s.comment,'textarea',true)+
    '<button type="button" data-cash-remove>Убрать источник</button></fieldset>';
   const html=input('from','Начало периода',r?.from||d.from||today(),'date',false,true)+input('to','Конец периода',r?.to||d.to||today(),'date',false,true)+
    input('agreed','Согласовано к расчёту',amount(d.agreedMinor,d.currency))+input('currency','Валюта',d.currency||'RUB')+
    input('basis','База для доли',d.basis)+input('basisSide','Кому относится доля',d.basisSide)+input('comment','Примечание',d.comment,'textarea',true)+
    (r?'<label class="full"><input type="checkbox" name="attach" checked> Прикрепить проверенный отчёт</label>':'')+
    '<div class="full" data-cash-rows>'+(d.sources||[]).map(row).join('')+'</div><button type="button" data-cash-add>Добавить внешний источник</button>';
   const f=form('Сверка по показу',html,
    '<button type="submit" value="save">Сохранить черновик</button><button type="submit" class="primary" value="confirm">Согласовать итог</button>',
    (el,key)=>{
     const data=new FormData(el),sources=[...el.querySelectorAll('[data-cash-source]')].map(box=>{
      const src=Object.fromEntries([...box.querySelectorAll('[name]')].map(i=>[i.name,i.value]));
      const {paid,refund,...out}=src;return {...out,tickets:count(src.tickets),paidMinor:minor(paid,src.currency),refundMinor:minor(refund,src.currency)};
     });
     return save(key,{...(data.has('attach')?{runId}:{}),data:{from:data.get('from'),to:data.get('to'),sources,
      currency:data.get('currency'),agreedMinor:minor(data.get('agreed'),data.get('currency')),basis:data.get('basis'),basisSide:data.get('basisSide'),comment:data.get('comment')}});
    });
   f.addEventListener('click',ev=>{
    const holder=f.querySelector('[data-cash-rows]');
    if(ev.target.closest('[data-cash-add]')&&holder.children.length<12){
     holder.insertAdjacentHTML('beforeend',row({from:f.querySelector('[name=from]').value,to:f.querySelector('[name=to]').value,reportedOn:today()}));
     holder.lastElementChild.querySelector('input')?.focus();
    }
    if(ev.target.closest('[data-cash-remove]'))ev.target.closest('[data-cash-source]').remove();
   });
  }
  root.addEventListener('click',ev=>{
   const k=ev.target.closest('[data-settlement]')?.dataset.settlement;
   if(k==='edit')edit();
   if(['reopen','void','delete'].includes(k)){
    const label={reopen:'Переоткрыть итог',void:'Аннулировать итог',delete:'Удалить черновик'}[k];
    form(label,k==='delete'?'<p class="full">Согласованные ранее версии остаются в истории.</p>':input('reason','Причина','','textarea',true,true),
     '<button type="submit" class="primary">'+label+'</button>',f=>save(k,{reason:new FormData(f).get('reason')||''}));
   }
  });
  api({action:'show_settlement_view',id:x.id,...(runId?{runId}:{})}).then(r=>{if(active()){view=r;render();}}).catch(err=>{
   if(active())root.innerHTML=title+'<p class="error">'+esc(err.message)+'</p>';
  });
 }
 window.AelitaCrmSettlement={mount};
})();
