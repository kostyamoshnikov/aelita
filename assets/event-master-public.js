(function(){'use strict';
  var en=document.documentElement.lang==='en',cards=Array.from(document.querySelectorAll('[data-master-event]')),id=document.body.dataset.eventId;
  var filters=document.querySelector('.filters');
  if(filters&&typeof window.filterCity==='function'){
    var keys=new Set(['kaluga','spb']);
    cards.forEach(function(card){var key=card.dataset.city;if(!keys.has(key)){keys.add(key);var b=document.createElement('button');b.className='filter-btn';b.textContent=card.dataset.masterCity;b.onclick=function(){window.filterCity(key,b);};filters.append(b);}});
  }
  if(!id&&!cards.length)return;
  if(id){var css=document.createElement('link');css.rel='stylesheet';css.href='/assets/directory-public.css?v=152';document.head.append(css);var directory=document.createElement('script');directory.src='/assets/directory-public.js?v=152';document.head.append(directory);}
  var button=document.getElementById('em-buy'),state=document.getElementById('em-sale-state');
  function date(value){return new Intl.DateTimeFormat(en?'en-GB':'ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(value));}
  function closed(text){if(!button)return;button.removeAttribute('href');button.setAttribute('aria-disabled','true');state.textContent=text;}
  async function refresh(){
    try{
      var response=await fetch('https://api.aelita-production.ru/tickets/performances-list?catalog=1',{cache:'no-store'});if(!response.ok)throw Error();
      var data=await response.json();if(data.schema!=='aelita.public-event-list/v1'||!Array.isArray(data.events))throw Error();
      cards.forEach(function(card){var e=data.events.find(function(x){return x.id===card.dataset.masterEvent;});if(!e){card.hidden=true;return;}card.hidden=Date.now()>Date.parse(e.endsAt);var when=card.querySelector('[data-master-when]');if(when)when.textContent=e.status==='canceled'?(en?'Event cancelled':'Событие отменено'):date(e.datetime)+' · '+card.dataset.masterCity;});
      if(!id)return;
      var e=data.events.find(function(x){return x.id===id;});
      if(!e){closed(en?'Ticket sales are closed':'Продажа билетов закрыта');return;}
      var time=document.querySelector('[data-master-datetime]');if(time)time.textContent=(e.postponed?(en?'New date: ':'Новая дата: '):'')+date(e.datetime)+(en?' · Moscow time':' · МСК');
      if(e.status==='canceled'){closed(en?'Event cancelled. Ticket holders will receive information by email.':'Событие отменено. Информация для владельцев билетов придёт на почту.');return;}
      if(!e.salesOpen){closed(en?'Ticket sales are closed':'Продажа билетов закрыта');return;}
      button.href=(en?'/en':'')+'/tickets-buy/?performance='+encodeURIComponent(id);button.setAttribute('aria-disabled','false');state.textContent=en?'Tickets available':'Билеты доступны';
    }catch(_){
      closed(en?'Unable to check sales. Please try again later.':'Не удалось проверить продажу. Повторите чуть позже.');
      cards.forEach(function(card){var when=card.querySelector('[data-master-when]');if(when)when.textContent=en?'Date and status on the event page':'Дата и состояние — на странице события';});
    }
  }
  refresh();document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
})();
