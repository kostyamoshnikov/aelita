(function(){'use strict';
  var en=document.documentElement.lang==='en',id=document.body.dataset.eventId,button=document.getElementById('em-buy'),state=document.getElementById('em-sale-state');
  if(!/^evt-[a-f0-9]{32}$/.test(id||'')||!button||!state)return;
  function closed(t){button.removeAttribute('href');button.setAttribute('aria-disabled','true');state.textContent=t;}
  function unknownDate(){var time=document.querySelector('[data-master-datetime]');if(time)time.textContent=en?'Date temporarily unavailable':'Не удалось проверить дату';}
  async function refresh(){try{
    var [list,probe]=await Promise.all([
      fetch('https://api.aelita-production.ru/tickets/performances-list?catalog=1',{cache:'no-store'}),
      fetch('https://api.aelita-production.ru/events/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:id,probe:true}),cache:'no-store'})]);
    if(!list.ok||!probe.ok)throw Error('unavailable');
    var doc=await list.json(),available=await probe.json();
    var e=doc.schema==='aelita.public-event-list/v1'&&Array.isArray(doc.events)?doc.events.find(x=>x.id===id):null;
    if(available.eventStatus==='cancelled'||(e&&e.accessKind==='free'&&e.status==='canceled')){closed(en?'Event cancelled':'Событие отменено');return;}
    if(available.eventStatus==='unavailable'){unknownDate();closed(en?'Could not check event status. Try again later.':'Не удалось проверить статус события. Попробуйте позже.');return;}
    if(!e||e.accessKind!=='free'){closed(en?'Registration is closed':'Регистрация закрыта');return;}
    var time=document.querySelector('[data-master-datetime]'),when=available.datetime||e.datetime;
    if(time&&Number.isFinite(Date.parse(when)))time.textContent=new Intl.DateTimeFormat(en?'en-GB':'ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(when))+(en?' · Moscow time':' · МСК')+(e.ageRating?' · '+e.ageRating:'');
    if(available.eventStatus==='updating'){closed(en?'The new date is being updated. Please check back.':'Новая дата уточняется на сайте. Проверьте чуть позже.');return;}
    if(!e.salesOpen||available.open!==true){closed(en?'Registration is closed':'Регистрация закрыта');return;}
    button.href=(en?'/en':'')+'/event-registration/?event='+encodeURIComponent(id);button.setAttribute('aria-disabled','false');state.textContent=available.postponed?(en?'Event rescheduled · Registration is open':'Событие перенесено · Регистрация открыта'):(en?'Registration is open':'Регистрация открыта');
  }catch(_){unknownDate();closed(en?'Could not check registration. Try again later.':'Не удалось проверить регистрацию. Попробуйте позже.');}}
  refresh();document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
})();
