(function(){'use strict';
const $=id=>document.getElementById(id),API='https://api.aelita-production.ru/admin/performance-action';
const S={running:false,stop:false,items:[],groups:new Map(),issues:[],shown:50,done:0,total:0,failures:0,problem:'',version:'',token:''};
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==null&&text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x;};
const rub=k=>(Number(k||0)/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽';
const when=s=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' МСК':'время не сохранено';
const messages={not_authenticated:'Войдите в админку.',promo_admin_disabled:'Управление промокодами пока выключено.',stale:'Каталог изменился во время проверки. Сформируйте сводку заново.',usage_changed:'Использования кода изменились во время чтения. Повторите сводку.',payment_not_known:'Укажите ID платежа из ЮKassa.',payment_not_verified:'ЮKassa не подтвердила платёж. Резерв сохранён.',payment_mismatch:'Платёж не соответствует этому заказу и коду.',payment_not_canceled:'Отмена платежа не подтверждена. Резерв сохранён.',reservation_not_found:'Резерв уже отсутствует. Обновите сводку.'};
async function req(body){
 const token=sessionStorage.getItem('aelita_admin_token');if(!token||token!==S.token)throw Object.assign(Error('Войдите в админку.'),{code:'not_authenticated'});
 const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});let d={};try{d=await r.json();}catch(_){}
 if(!r.ok)throw Object.assign(Error(messages[d.error]||'Не удалось получить данные.'),{code:d.error});return d;
}
function groupOf(r){const key=r.campaign||'';if(!S.groups.has(key))S.groups.set(key,{name:key,created:0,used:0,reserved:0,issues:0,orders:0,tickets:0,refundedTickets:0,moneyKop:0,giftKop:0,discountKop:0,unknownOrders:0,unreadableOrders:0,inconsistent:0,unscanned:0});return S.groups.get(key);}
function resultRender(){const root=$('ins-results');root.replaceChildren();
 if(!S.groups.size){root.append(el('p','Нет кодов по выбранным условиям.','ed-note'));return;}
 const incomplete=S.running||S.stop||S.failures>0;
 for(const g of S.groups.values()){
  const box=el('article',null,'pr-row');box.append(el('h3',g.name||'Без названия акции'));
  box.append(el('p','Создано кодов: '+g.created+' · Подтверждённых применений: '+g.used+' · В резерве: '+g.reserved));
  box.append(el('p','Сохранённых оплаченных заказов: '+g.orders+' · Билетов: '+g.tickets+' · Отмечено возвращённых: '+g.refundedTickets));
  box.append(el('p','Деньгами: '+rub(g.moneyKop)+' · Подарочными картами: '+rub(g.giftKop)+' · Скидки: '+rub(g.discountKop)));
  box.append(el('p','Суммы по сохранённым оплаченным заказам до учёта возвратов; фактические возвраты здесь не вычитаются.','ed-note'));
  if(incomplete||g.unreadableOrders||g.unknownOrders||g.inconsistent||g.unscanned)box.append(el('p','Данные неполные: не проверено кодов '+g.unscanned+'; недоступных или несовпавших заказов '+g.unreadableOrders+'; заказов без точной суммы '+g.unknownOrders+'; расхождений счётчика '+g.inconsistent+'.','pr-error'));
  root.append(box);
 }
}
function issueRender(){const root=$('ins-issues');root.replaceChildren();root.append(el('h3','Резервы требуют внимания · '+S.issues.length));
 if(!S.issues.length){root.append(el('p',S.running?'Проверка продолжается.':'По проверенным кодам старых резервов не найдено.','ed-note'));$('ins-more').hidden=true;return;}
 root.append(el('p','Показаны резервы старше 30 минут или без сохранённого времени. Это не означает отмену оплаты. Для освобождения нужна подтверждённая отмена ЮKassa.','ed-note'));
 S.issues.slice(0,S.shown).forEach(x=>{
  const box=el('article',null,'pr-row');box.append(el('h3',x.code+(x.campaign?' · '+x.campaign:'')));box.append(el('p','Заказ: '+x.orderId));box.append(el('p','Создан: '+when(x.createdAt),'ed-note'));
  const input=el('input');input.type='text';input.placeholder='ID платежа ЮKassa';input.value=x.paymentId||'';input.disabled=!!x.paymentId;box.append(input);
  const button=el('button','Проверить отмену и освободить','ed-quiet'),note=el('p','','ed-note');button.type='button';button.disabled=S.running;
  button.onclick=async()=>{if(!confirm('Проверить платёж? Резерв снимется только после подтверждённой ЮKassa отмены.'))return;button.disabled=true;try{const r=await req({action:'promo_reconcile',code:x.code,orderId:x.orderId,paymentId:input.value.trim()});note.textContent=r.message+' Обновите сводку.';}catch(e){note.textContent=e.message;}finally{button.disabled=false;}};box.append(button,note);root.append(box);
 });$('ins-more').hidden=S.shown>=S.issues.length;
}
function status(){const t=$('ins-status');t.textContent=(S.running?'Проверяем: ':S.stop?'Остановлено. ':S.failures?'Сводка неполная. ':'Проверка завершена. ')+'Кодов проверено: '+S.done+' из '+S.total+'.'+(S.failures?' Не удалось проверить кодов: '+S.failures+'.':'')+(S.problem?' '+S.problem:'');t.className=S.failures?'pr-error':'ed-note';}
async function one(rule){
 let ro=0,io=0,etag=null,asOf=null,continuing=false,first=null,problems=[],money={orders:0,tickets:0,refundedTickets:0,moneyKop:0,giftKop:0,discountKop:0,unknownOrders:0,unreadableOrders:0};
 do{
  if(S.stop)throw Object.assign(Error('Остановлено'),{code:'stopped'});
  const page=await req({action:'promo_scan_code',code:rule.code,version:S.version,redemptionOffset:ro,issueOffset:io,continuing,expectedEtag:etag,asOf});
  if(!first)first=page;else if(page.etag!==etag||page.asOf!==asOf)throw Object.assign(Error('Данные изменились'),{code:'usage_changed'});
  for(const [k,v] of Object.entries(page.totals||{}))if(Object.hasOwn(money,k))money[k]+=Number(v)||0;
  problems.push(...page.problems.map(x=>({...x,code:rule.code,campaign:rule.campaign||''})));
  ro=page.nextRedemption===null?page.orderTotal:page.nextRedemption;io=page.nextIssue===null?page.problemCount:page.nextIssue;
  etag=page.etag;asOf=page.asOf;continuing=true;
  if(page.nextRedemption===null&&page.nextIssue===null)break;
 }while(true);
 return {first,problems,money};
}
$('ins-start').onclick=async()=>{
 if(S.running)return;S.token=sessionStorage.getItem('aelita_admin_token');S.stop=false;S.running=true;S.done=0;S.failures=0;S.problem='';S.shown=50;S.issues=[];S.groups=new Map();S.total=0;$('ins-start').disabled=true;$('ins-stop').hidden=false;$('ins-status').textContent='Загружаем каталог…';
 try{
  const list=await req({action:'promo_list'});if(!list.enabled)throw Object.assign(Error(messages.promo_admin_disabled),{code:'promo_admin_disabled'});S.version=list.version;
  const q=$('ins-filter').value.trim().toLocaleLowerCase('ru-RU'),test=$('ins-mode').value==='test';
  S.items=(list.codes||[]).filter(x=>!!x.testOnly===test&&(!q||String(x.campaign||'').toLocaleLowerCase('ru-RU').includes(q)));S.total=S.items.length;
  for(const r of S.items){const g=groupOf(r);g.created++;g.unscanned++;}resultRender();issueRender();status();let next=0;
  async function worker(){while(!S.stop){const i=next++;if(i>=S.items.length)return;const r=S.items[i],g=groupOf(r);try{const out=await one(r);g.used+=out.first.usedCount;g.reserved+=out.first.activeCount;g.issues+=out.first.problemCount;if(out.first.inconsistent)g.inconsistent++;for(const k of Object.keys(out.money))g[k]+=out.money[k];S.issues.push(...out.problems);g.unscanned--;S.done++;}catch(e){if(e.code==='stopped')return;S.failures++;if(e.code==='stale'||e.code==='not_authenticated'){S.stop=true;S.problem=e.message;}}resultRender();issueRender();status();}}
  await Promise.all(Array.from({length:Math.min(4,S.items.length)},()=>worker()));
 }catch(e){S.failures++;$('ins-status').textContent=e.message;$('ins-status').className='pr-error';}
 finally{S.running=false;$('ins-start').disabled=false;$('ins-stop').hidden=true;if(S.total||!S.failures){resultRender();issueRender();status();}}
};
$('ins-stop').onclick=()=>{S.stop=true;$('ins-status').textContent='Останавливаем после текущих запросов…';};
$('ins-more').onclick=()=>{S.shown+=50;issueRender();};
})();
