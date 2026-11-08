/* Read-only D-01 view; no content editor, send or recovery actions. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),dialog=$('ba-diag-dialog');if(!dialog)return;
 const API='https://api.aelita-production.ru/admin/inbox';
 const token=()=>{try{return localStorage.getItem('aelita_admin_token')||'';}catch{return '';}};
 const labels={observed:'Данные прочитаны',default:'Исходный каталог',confirmed:'Таймер прочитал эту ревизию',pending:'Таймер ещё не подтвердил новую ревизию',not_observed:'Нет сохранённого наблюдения',unavailable:'Не удалось проверить',error:'Ошибка данных или операции',not_configured:'Не настроено',stale:'Сохранённые данные устарели',historical:'Сохранённый отчёт',partial:'Часть данных не удалось проверить',empty:'Реестр активной работы пуст',changed:'Состав реестра изменился — обновите с первой страницы'};
 const statuses={scheduled:'По расписанию',sending:'Выполняется',pausing:'Останавливается на паузу',paused:'На паузе',stopped:'Остановлена',done:'Обработка завершена',cancelled:'Расписание отменено'};
 const errorLabels={not_configured:'неполные настройки',storage:'не удалось обратиться к хранилищу уведомлений',telegram_rate_limit:'Telegram ограничил частоту запросов',telegram_server:'ошибка сервиса Telegram',telegram_network:'не удалось связаться с Telegram',telegram_rejected:'Telegram отклонил запрос',unknown:'причина не распознана, нужен служебный журнал'};
 const missing={OUTBOX_BUCKET:'Хранилище уведомлений',OUTBOX_S3_KEY_ID:'Доступ к хранилищу',OUTBOX_S3_SECRET:'Секрет доступа к хранилищу',BOT_TOKEN:'Доступ к боту',NOTIFY_CHAT_ID:'Чат уведомлений'};
 let controller=null,epoch=0,next=null,registry=null,auth='';
 function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;}
 function time(v){if(!v||!Number.isFinite(Date.parse(v)))return 'нет данных';return new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Moscow'}).format(new Date(v))+' МСК';}
 function line(root,name,value){root.append(el('p',name+': '+value));}
 function card(title,data){const root=el('section',undefined,'ed-card ba-diag-card');root.append(el('h3',title),el('p',labels[data?.state]||'Не проверено','ba-diag-state'));$('ba-diag-results').append(root);return root;}
 function reset(){++epoch;controller?.abort();controller=null;next=null;registry=null;auth='';$('ba-diag-results').replaceChildren();$('ba-diag-next').hidden=true;$('ba-diag-note').textContent='';}
 function entry(){const current=token();$('ba-diag-entry').hidden=!current;if(dialog.open&&current!==auth){dialog.close();reset();}}
 function render(d){
  $('ba-diag-results').replaceChildren();
  const p=d.publication,r=card('Публикация бота',p);if(p?.version!==undefined){line(r,'Версия содержания',p.version);line(r,'Опубликовано',time(p.at));line(r,'Требуемая версия редактора сообщений',p.minRuntime);}
  const w=d.worker,c=card('Бот и уведомления в Telegram',w);
  if(w?.configured!==undefined){line(c,'Версия бота',w.version||'не сообщена');line(c,'Поддерживаемая версия сообщений',w.contentRuntime);line(c,'Настройки уведомлений',w.configured?'есть':'неполные');if(w.missing?.length)line(c,'Отсутствует',w.missing.map(x=>missing[x]||'Неизвестная настройка').join(', '));line(c,'Хранилище наблюдений',w.kv?'подключено':'не подключено');if(w.last){line(c,'Последний сохранённый проход',time(w.last.at));line(c,'За этот проход',`принято Telegram: ${w.last.sent}; дубликаты: ${w.last.duplicates}; ошибки: ${w.last.failed}; ожидало: ${w.last.waiting}`);if(w.last.error)line(c,'Сбой сохранённого прохода',errorLabels[w.last.errorCode]||errorLabels.unknown);if(w.last.more)line(c,'Очередь','после прохода могла остаться работа');}else line(c,'Проход очереди','нет сохранённого наблюдения');}
  c.append(el('p','Сохраняется последний непустой проход или ошибка. Это не пульс бота и не текущий размер очереди.','ed-note'));
  const m=d.reminders,a=card('Напоминания об офлайн-билетах',m);if(m?.expectedRevision!==undefined){line(a,'Правило',m.mode==='legacy'?'исходное, за 24 часа':m.enabled?'включено':'выключено');line(a,'Ожидаемая / прочитанная ревизия',m.expectedRevision+' / '+(m.observedRevision??'нет данных'));line(a,'Таймер наблюдал правило',time(m.observedAt));}a.append(el('p','Подтверждение ревизии означает чтение правила таймером. Отправка и получение письма этим не подтверждаются.','ed-note'));
  const cloud=d.cloud,h=card('Последняя сверка облака',cloud);if(cloud?.at){line(h,'Отчёт создан',time(cloud.at));line(h,'Архив в отчёте',cloud.archiveVersion||'не указан');line(h,'Выкладка в отчёте',cloud.reportedDeployedVersion||'не указана');line(h,'Функции в манифесте / облаке',cloud.summary.inManifest+' / '+cloud.summary.inCloud);line(h,'Замечания отчёта',`исправить: ${cloud.summary.fix}; небольшие: ${cloud.summary.minor}; ожидаемые: ${cloud.summary.expected}`);}h.append(el('p','Это исторический отчёт. Просмотр не запускает новую сверку и не подтверждает активные версии функций сейчас.','ed-note'));
  const n=d.newsletters,k=card('Активные и запланированные рассылки v2',n);
  if(n?.registeredTotal!==undefined)line(k,'Реестр / показано на странице',n.registeredTotal+' / '+n.rows.length);
  for(const row of n?.rows||[]){const item=el('section',undefined,'ba-diag-campaign');item.append(el('h4',row.id));if(row.state!=='observed')line(item,'Проверка',labels[row.state]||'Не проверено');else{
   line(item,'Состояние',statuses[row.status]||'Неизвестно');line(item,'Состояние записано',time(row.statusAt));if(row.runAt)line(item,'Запланировано',time(row.runAt));
   for(const [key,ch]of Object.entries(row.channels)){const box=el('div');box.append(el('h5',key==='email'?'Почта':'Telegram'));for(const [field,title]of Object.entries({total:'Получателей',accepted:'Принято сервисом',skipped:'Пропущено',failed:'Ошибка обработки',unknown:'Результат неизвестен',inFlight:'В работе',queued:'Осталось обработать',leased:'В выданной пачке',retryWaiting:'Ждёт предусмотренного повтора'}))line(box,title,ch[field]);if(ch.nextRetryAt)line(box,'Ближайший предусмотренный повтор',time(ch.nextRetryAt));if(ch.hold)line(box,'Ограничение канала',ch.hold.active?'действует'+(ch.hold.manual?' до ручного снятия':ch.hold.until?' до '+time(ch.hold.until):''):'записано ранее, сейчас не действует');item.append(box);}
  }k.append(item);}
  k.append(el('p','Только реестр активной работы v2, не история всех рассылок. «Принято сервисом» не означает «доставлено». Пачки и повторы входят в оставшуюся работу, их нельзя складывать с ней. Неизвестный результат здесь не повторяется.','ed-note'));
  next=n?.nextCursor??null;registry=n?.registryVersion||null;$('ba-diag-next').hidden=next===null;
 }
 async function load(cursor=0){
  const t=token();if(!t){dialog.close();entry();return;}controller?.abort();controller=new AbortController();const request=controller,seq=++epoch;auth=t;next=null;$('ba-diag-next').hidden=true;$('ba-diag-results').replaceChildren();$('ba-diag-note').textContent='Читаю данные…';$('ba-diag-refresh').disabled=true;
  const timeout=setTimeout(()=>request.abort(),15000);
  try{
   const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+t},cache:'no-store',body:JSON.stringify({action:'bot_admin_diagnostics',cursor,...(cursor?{registryVersion:registry}:{})}),signal:controller.signal});
   const d=await response.json();if(seq!==epoch||!dialog.open)return;if(token()!==t){entry();return;}
   if(!response.ok||d.error||d.schema!=='aelita.diagnostics/v1')throw Error(response.status===401||response.status===403?'auth':'unavailable');
   render(d);$('ba-diag-note').textContent='Снимок прочитан: '+time(d.checkedAt)+'. Компоненты проверены независимо.';
  }catch(e){if(seq!==epoch||!dialog.open)return;if(token()!==t){entry();return;}$('ba-diag-results').replaceChildren();$('ba-diag-note').textContent=e.message==='auth'?'Нет доступа. Войдите в админку заново.':'Не удалось проверить. При старой версии сервера сначала обновите функции. Предыдущий снимок не считается текущим.';}
  finally{clearTimeout(timeout);if(seq===epoch){controller=null;$('ba-diag-refresh').disabled=false;}}
 }
 $('ba-diagnostics').onclick=()=>{reset();auth=token();if(!auth)return;dialog.showModal();return load();};
 $('ba-diag-close').onclick=()=>dialog.close();dialog.onclose=()=>{reset();$('ba-diag-refresh').disabled=false;$('ba-diagnostics').focus();};
 $('ba-diag-refresh').onclick=()=>load(0);$('ba-diag-next').onclick=()=>{if(next!==null)return load(next);};
 window.addEventListener('storage',entry);window.addEventListener('focus',entry);entry();
})();
