(function(){
  'use strict';
  var M=window.AelitaCustomerEventsModel;
  function create(options){
    var root=options.root,en=options.lang==='en',generation=0,dialog=null,filter='upcoming',dead=false;
    var names=['orders','regs','invitations'],state={},pending=new Set(),topics=new Map(),openHelp=new Set();
    var T=en?{refresh:'Refresh events',upcoming:'Upcoming',past:'Past',filter:'Show events',loading:'Loading…',empty:'There are no events in this view.',partial:'Some events could not be loaded. The available documents are shown below.',unverified:'Confirm your email to see documents linked to that address.',verify:'Confirm email',unsupported:'Invitations will appear after the server is updated.',source:{orders:'Tickets',regs:'Registrations',invitations:'Invitations'},error:'Could not load this section. Check your connection and retry.',canceled:'Event cancelled',moved:'Date changed',archive:'Past event',ticket:'Ticket order',registration:'Registration',invitation:'Invitation No. ',people:'People: ',online:'Online',offline:'Offline',revoked:'This invitation is no longer active.',unavailable:'Event details are unavailable. Contact the organiser.',qr:'Show QR',download:'Invitation PDF',opening:'Preparing…',openTicket:'Open ticket',stream:'Open stream page',manageTicket:'Manage order',manageReg:'Manage registration',calendar:'Add to calendar (.ics)',endUnknown:'The end time has not been announced.',route:'Directions',help:'Help with this event',topic:'Question',topicOptions:['Payment','Ticket or invitation','Online access','Refund','Other'],mail:'Write an email',copy:'Copy for Telegram',telegram:'Open Telegram',copied:'Copied. Paste the text into your message.',manual:'Copy the text below.',prepared:'The file is ready. If the download did not start, use the download link.',failed:'Could not prepare the file. Retry or contact us.',close:'Close',checked:'Last checked: ',offlineWarning:'You are offline. The status may have changed since the last check.',signin:'Sign in again',session:'Your session changed. Sign in to view your events.',count:'Tickets: ',visited:'Already checked in',later:'Seats will be assigned before entry',general:'General admission'}:
    {refresh:'Обновить события',upcoming:'Предстоящие',past:'Прошедшие',filter:'Показать события',loading:'Загружаем…',empty:'В этой подборке пока нет событий.',partial:'Часть событий не удалось загрузить. Доступные документы показаны ниже.',unverified:'Подтвердите почту, чтобы увидеть документы, связанные с этим адресом.',verify:'Подтвердить почту',unsupported:'Приглашения появятся после обновления сервера.',source:{orders:'Билеты',regs:'Регистрации',invitations:'Приглашения'},error:'Не удалось загрузить раздел. Проверьте соединение и повторите.',canceled:'Событие отменено',moved:'Дата изменена',archive:'Прошедшее событие',ticket:'Заказ билетов',registration:'Регистрация',invitation:'Пригласительный №',people:'Лиц: ',online:'Онлайн',offline:'Офлайн',revoked:'Пригласительный больше не действует.',unavailable:'Данные события недоступны. Обратитесь к организатору.',qr:'Показать QR',download:'Пригласительный PDF',opening:'Готовим…',openTicket:'Открыть билет',stream:'Перейти к трансляции',manageTicket:'Управлять заказом',manageReg:'Управлять регистрацией',calendar:'Добавить в календарь (.ics)',endUnknown:'Время окончания пока не объявлено.',route:'Как добраться',help:'Помощь по этому событию',topic:'Вопрос',topicOptions:['Оплата','Билет или приглашение','Онлайн-доступ','Возврат','Другое'],mail:'Написать на почту',copy:'Скопировать для Telegram',telegram:'Открыть Telegram',copied:'Скопировано. Вставьте текст в сообщение.',manual:'Скопируйте текст ниже.',prepared:'Файл подготовлен. Если загрузка не началась, воспользуйтесь ссылкой скачивания.',failed:'Не удалось подготовить файл. Повторите или напишите нам.',close:'Закрыть',checked:'Последняя проверка: ',offlineWarning:'Нет связи. После последней проверки статус мог измениться.',signin:'Войти заново',session:'Сеанс изменился. Войдите, чтобы увидеть свои события.',count:'Билетов: ',visited:'Уже прошли на вход',later:'Места назначат перед входом',general:'Свободная рассадка'};
    function el(tag,text,cls){var n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;}
    function button(text,action){var b=el('button',text);b.type='button';b.addEventListener('click',action);return b;}
    function link(text,href,primary){var a=el('a',text,primary?'primary':'');a.href=href;a.rel='noopener noreferrer';return a;}
    function token(){try{return options.getToken()||'';}catch(_){return '';}}
    function alive(stamp,owner){return !dead&&stamp===generation&&!!owner&&owner===token();}
    function closeDialog(){if(!dialog)return;var d=dialog;dialog=null;try{d.close();}catch(_){}d.replaceChildren();d.remove();}
    function noteAt(at){return T.checked+(M.date(at,en)||'—')+(navigator.onLine===false?' '+T.offlineWarning:'');}
    function openQr(value,title,at){
      closeDialog();dialog=el('dialog',null,'customer-event-dialog ym-hide-content');var d=dialog;
      d.append(el('h3',title),el('p',noteAt(at)));
      if(typeof qrcode==='function'){
        try{var qr=qrcode(0,'M');qr.addData(value);qr.make();var box=el('div',null,'customer-qr');box.innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true});d.append(box);}catch(_){d.append(el('p',T.failed));}
      }else d.append(el('p',T.failed));
      d.append(button(T.close,closeDialog));d.addEventListener('close',function(){if(dialog===d)closeDialog();});
      document.body.append(d);if(d.showModal)d.showModal();else d.setAttribute('open','');
    }
    function save(blob,filename,owner){
      if(window.AelitaMobileFiles){window.AelitaMobileFiles.save(blob,filename,{guardToken:owner});return;}
      var url=URL.createObjectURL(blob),a=link(filename,url);a.download=filename;root.append(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(url);a.remove();},60000);
    }
    async function downloadInvitation(d,b,msg){
      var stamp=generation,owner=token();if(!alive(stamp,owner)||pending.has(d.ref))return;
      pending.add(d.ref);b.disabled=true;b.textContent=T.opening;msg.textContent='';
      try{
        var r=await options.downloadInvitation(d.ref);
        if(!alive(stamp,owner))return;
        if(!r||!r.ok||!r.data||typeof r.data.pdf_base64!=='string'||r.data.pdf_base64.length>16000000)throw Error('pdf_unavailable');
        var raw=atob(r.data.pdf_base64);if(!raw.startsWith('%PDF-'))throw Error('bad_pdf');
        var data=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);
        save(new Blob([data],{type:'application/pdf'}),/^Invitation-\d+\.pdf$/.test(r.data.filename||'')?r.data.filename:'Invitation.pdf',owner);msg.textContent=T.prepared;
      }catch(_){if(alive(stamp,owner))msg.textContent=T.failed;}
      finally{pending.delete(d.ref);if(alive(stamp,owner)){b.disabled=false;b.textContent=T.download;if(!b.isConnected)render();}}
    }
    function help(card,g){
      var details=el('details');details.open=openHelp.has(g.ref);var summary=el('summary',T.help);details.append(summary);
      details.addEventListener('toggle',function(){details.open?openHelp.add(g.ref):openHelp.delete(g.ref);});
      var label=el('label',T.topic),select=el('select');select.setAttribute('aria-label',T.topic);
      T.topicOptions.forEach(function(text){var o=el('option',text);o.value=text;select.append(o);});select.value=topics.get(g.ref)||T.topicOptions[0];label.append(select);details.append(label);
      var actions=el('div',null,'customer-event-actions'),mail=link(T.mail,'mailto:aelita.production@yandex.ru'),message=el('p');message.setAttribute('role','status');
      function update(){topics.set(g.ref,select.value);mail.href='mailto:aelita.production@yandex.ru?subject='+encodeURIComponent(T.help+' · '+g.title)+'&body='+encodeURIComponent(M.supportText(g,en,select.value));}
      select.addEventListener('change',update);update();
      actions.append(mail,button(T.copy,async function(){var stamp=generation,owner=token(),text=M.supportText(g,en,select.value);try{await navigator.clipboard.writeText(text);if(alive(stamp,owner))message.textContent=T.copied;}catch(_){if(!alive(stamp,owner))return;message.replaceChildren(el('p',T.manual));var area=el('textarea');area.value=text;area.readOnly=true;message.append(area);area.focus();area.select();}}),link(T.telegram,'https://t.me/aelita_production_bot'));
      details.append(actions,message);card.append(details);
    }
    function documentCard(card,g,doc){
      var d=doc.data,box=el('div',null,'customer-event-doc ym-hide-content'),actions=el('div',null,'customer-event-actions'),msg=el('p');msg.setAttribute('role','status');
      if(doc.kind==='order'){
        box.append(el('h4',T.ticket+(d.orderNumber?' №'+d.orderNumber:'')),el('p',T.count+Number(d.ticketsCount||0)));
        (d.ticketPages||[]).forEach(function(raw,i){var u=M.privateUrl(raw,'ticket');if(u&&!g.canceled)actions.append(link(T.openTicket+' '+(i+1),u,true));});
        (d.onlineTickets||[]).forEach(function(x){var u=x.mode==='online'&&M.privateUrl(x.accessUrl,'online');if(u&&!g.past&&!g.canceled)actions.append(link(T.stream+(x.ticketNumber?' · '+x.ticketNumber:''),u,true));});
        actions.append(link(T.manageTicket,'#tickets'));
      }else if(doc.kind==='registration'){
        box.append(el('h4',T.registration),el('p',T.count+Number(d.quantity||(d.tickets||[]).length||1)));
        (d.tickets||[]).forEach(function(x,i){if(x.qrToken&&!g.past&&!g.canceled)actions.append(button(T.qr+' '+(i+1),function(){openQr(x.qrToken,g.title,doc.checkedAt);}));});
        actions.append(link(T.manageReg,'#regs'));
      }else{
        box.append(el('h4',T.invitation+d.number),el('p',T.people+Number(d.persons||1)+' · '+(d.attendanceMode==='online'?T.online:T.offline)));
        if(d.status!=='active'||d.canceled)box.append(el('p',T.revoked));
        if(d.unavailable)box.append(el('p',T.unavailable));
        if(d.visited)box.append(el('p',T.visited));
        if(d.seats&&d.seats.length)box.append(el('p',d.seats.join(', ')));else if(d.seatsLater)box.append(el('p',T.later));
        if(d.qrToken&&!g.past&&!g.canceled)actions.append(button(T.qr,function(){openQr(d.qrToken,T.invitation+d.number+' · '+g.title,d.checkedAt||doc.checkedAt);}));
        var u=M.privateUrl(d.accessUrl,'invitation');if(u&&!g.past&&!g.canceled)actions.append(link(T.stream,u,true));
        if(d.canDownload){var b=button(T.download,function(){downloadInvitation(d,b,msg);});b.disabled=pending.has(d.ref);actions.append(b);}
      }
      if(actions.childNodes.length)box.append(actions);box.append(el('p',noteAt(d.checkedAt||doc.checkedAt),'customer-event-checked'),msg);card.append(box);
    }
    function render(){
      root.replaceChildren();var head=el('div',null,'customer-events-head'),label=el('label',T.filter+' '),select=el('select');select.setAttribute('aria-label',T.filter);
      [['upcoming',T.upcoming],['past',T.past]].forEach(function(x){var o=el('option',x[1]);o.value=x[0];select.append(o);});select.value=filter;select.addEventListener('change',function(){filter=select.value;render();});label.append(select);
      var refresh=button(T.refresh,loadAll);refresh.disabled=names.some(function(n){return state[n].status==='loading';});head.append(label,refresh);root.append(head);
      if(dead||!token()){var warn=el('div',null,'customer-events-alert');warn.append(el('p',T.session),link(T.signin,(en?'/en':'')+'/account/?next='+encodeURIComponent((en?'/en':'')+'/account/dashboard/#my-events')));root.append(warn);return;}
      names.forEach(function(n){var s=state[n];if(s.status==='error'||s.status==='unsupported'||s.status==='loading'){var p=el('p',T.source[n]+': '+(s.status==='loading'?T.loading:s.status==='unsupported'?T.unsupported:s.error||T.error),'customer-events-alert');root.append(p);}if(s.data&&s.data.emailUnverified){var info=el('div',null,'customer-events-alert');info.append(el('p',T.unverified),link(T.verify,'#tickets'));root.append(info);}});
      var groups=M.group(state,en),shown=groups.filter(function(g){return g.past===(filter==='past');});
      if(!shown.length&&!names.some(function(n){return state[n].status==='loading';}))root.append(el('p',T.empty,'customer-events-empty'));
      shown.forEach(function(g){
        var card=el('article',null,'customer-event ym-hide-content');card.append(el('p',g.canceled?T.canceled:g.past?T.archive:g.postponedFrom?T.moved:'','customer-event-status'),el('h3',g.title),el('p',M.date(g.datetime,en)||g.dateLabel),el('p',[g.venue,g.address].filter(Boolean).join(' · '),'customer-event-where'));
        if(g.postponedFrom)card.append(el('p',T.moved+' · '+M.date(g.postponedFrom,en)));
        var actions=el('div',null,'customer-event-actions');
        if(M.validDate(g.datetime)&&!g.canceled){actions.append(button(T.calendar,function(){var owner=token();if(!owner)return;save(new Blob([M.ics(g,en)],{type:'text/calendar;charset=utf-8'}),'AELITA-event.ics',owner);}));if(!M.validDate(g.endsAt)&&!g.durationMinutes)card.append(el('p',T.endUnknown));}
        if(g.address)actions.append(link(T.route,'https://yandex.ru/maps/?text='+encodeURIComponent(g.address)));
        if(actions.childNodes.length)card.append(actions);
        g.documents.forEach(function(doc){documentCard(card,g,doc);});help(card,g);root.append(card);
      });
    }
    async function load(name){
      var owner=token();if(!owner||dead){render();return false;}
      generation++;closeDialog();var s=state[name],seq=++s.seq;
      if(s.abort)s.abort.abort();var controller=new AbortController();s.abort=controller;s.status='loading';s.data=null;s.error='';render();
      var timeout=setTimeout(function(){controller.abort();},15000);
      try{
        var error='';var data=await options.loaders[name]({signal:s.abort.signal,onError:function(message){error=message;}});
        if(dead||s.seq!==seq||token()!==owner)return false;
        if(!data){s.status='error';s.error=error||T.error;if(options.onError)options.onError(name,s.error);}
        else if(name==='invitations'&&!Array.isArray(data.invitations)){s.status='unsupported';}
        else{s.status='ready';s.data=data;s.checkedAt=new Date().toISOString();if(options.onData)options.onData(name,data);}
      }catch(_){if(!dead&&s.seq===seq&&token()===owner){s.status='error';s.error=T.error;if(options.onError)options.onError(name,T.error);}}
      finally{clearTimeout(timeout);if(!dead&&s.seq===seq&&token()===owner)render();}
      return s.status==='ready';
    }
    function loadAll(){return Promise.all(names.map(load));}
    function reset(){generation++;dead=true;closeDialog();pending.clear();names.forEach(function(n){if(state[n].abort)state[n].abort.abort();state[n]={status:'idle',data:null,seq:state[n].seq+1};});render();if(options.onSessionReset)options.onSessionReset();}
    names.forEach(function(n){state[n]={status:'idle',data:null,seq:0};});
    window.addEventListener('storage',function(e){if(e.key==='aelita_account_token'||e.key===null)reset();});window.addEventListener('pagehide',reset);
    window.addEventListener('pageshow',function(e){if(e.persisted&&options.onResume)options.onResume();});
    document.body.classList.add('customer-events-ready');render();
    return {load:load,loadAll:loadAll,reset:reset,state:state};
  }
  window.AelitaCustomerEvents={create:create};
}());
