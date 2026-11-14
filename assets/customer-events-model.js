(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaCustomerEventsModel=api;}(typeof window==='object'?window:this,function(){
  'use strict';
  function validDate(v){return typeof v==='string'&&Number.isFinite(Date.parse(v));}
  function date(v,en){return validDate(v)?new Date(v).toLocaleString(en?'en-GB':'ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+(en?' MSK':' МСК'):'';}
  function privateUrl(raw,kind){
    try{var u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='aelita-production.ru'||u.port||u.username||u.password)return null;
      if(kind==='ticket')return u.pathname==='/ticket/'&&/^[A-Za-z0-9_.-]{20,400}$/.test(u.searchParams.get('t')||'')?u.href:null;
      var path=kind==='invitation'?/^\/(en\/)?online-invitation\/$/:/^\/(en\/)?matrix-online\/$/;
      return path.test(u.pathname)&&/^#access=[A-Za-z0-9_-]{10,600}\.[A-Za-z0-9_-]{43}$/.test(u.hash)?u.href:null;
    }catch(_){return null;}
  }
  function eventRef(raw,fallback){return /^(tickets|events|invitations):[A-Za-z0-9_-]{1,150}$/.test(raw||'')?raw:fallback;}
  function group(states,en,now){
    now=now==null?Date.now():now;var groups=new Map();
    function add(kind,d,index){
      var meta=d.event||d,key=eventRef(d.eventRef,kind==='registration'&&d.eventId?'events:'+d.eventId:'legacy-'+kind+':'+index);
      var g=groups.get(key);
      if(!g){g={ref:key,title:(en?meta.titleEn||meta.title:meta.title)||'',datetime:meta.datetime||null,dateLabel:(en?meta.dateLabelEn||meta.dateLabel:meta.dateLabel)||'',venue:(en?meta.venueNameEn||meta.venueName:meta.venueName)||meta.venue||'',address:meta.venueAddress||'',endsAt:meta.endsAt||null,durationMinutes:meta.durationMinutes||null,canceled:!!meta.canceled,postponedFrom:meta.postponedFrom||null,validUntil:meta.validUntil||null,documents:[]};groups.set(key,g);}
      if(!g.title)g.title=(en?meta.titleEn||meta.title:meta.title)||'';
      if(!validDate(g.datetime)&&validDate(meta.datetime))g.datetime=meta.datetime;
      if(!g.venue)g.venue=(en?meta.venueNameEn||meta.venueName:meta.venueName)||meta.venue||'';
      if(!g.address)g.address=meta.venueAddress||'';
      if(!validDate(g.endsAt)&&validDate(meta.endsAt))g.endsAt=meta.endsAt;
      if(!g.durationMinutes&&Number(meta.durationMinutes)>0)g.durationMinutes=Number(meta.durationMinutes);
      g.canceled=g.canceled||!!meta.canceled;
      g.documents.push({kind:kind,data:d,checkedAt:states[kind==='order'?'orders':kind==='registration'?'regs':'invitations'].checkedAt||null});
    }
    [['orders','order','orders'],['regs','registration','registrations'],['invitations','invitation','invitations']].forEach(function(x){var s=states[x[0]];if(s&&s.status==='ready'&&s.data&&Array.isArray(s.data[x[2]]))s.data[x[2]].forEach(function(d,i){if(d&&typeof d==='object')add(x[1],d,i);});});
    return Array.from(groups.values()).map(function(g){
      var limit=validDate(g.endsAt)?Date.parse(g.endsAt):validDate(g.validUntil)?Date.parse(g.validUntil):validDate(g.datetime)?Date.parse(new Date(Date.parse(g.datetime)+3*3600000).toISOString().slice(0,10)+'T23:59:59+03:00'):Infinity;
      g.past=limit<=now;return g;
    }).sort(function(a,b){return (a.past?1:0)-(b.past?1:0)||(a.past?-1:1)*((Date.parse(a.datetime)||0)-(Date.parse(b.datetime)||0))||a.ref.localeCompare(b.ref);});
  }
  function summary(g,en){
    var labels=[];g.documents.forEach(function(doc){var d=doc.data;
      if(doc.kind==='order')labels.push((en?'Tickets: ':'Билеты: ')+Number(d.ticketsCount||0));
      if(doc.kind==='registration')labels.push((en?'Registration: ':'Регистрация: ')+Number(d.quantity||(d.tickets||[]).length||1));
      if(doc.kind==='invitation')labels.push((en?'Invitation No. ':'Пригласительный №')+String(d.number)+(en?' · people: ':' · лиц: ')+Number(d.persons||1));
    });return labels.join(' · ');
  }
  function supportText(g,en,topic){
    var lines=[en?'Help with my event':'Помощь по моему событию',g.title,date(g.datetime,en)||g.dateLabel];
    if(topic)lines.push((en?'Question: ':'Вопрос: ')+String(topic));
    g.documents.forEach(function(doc){var d=doc.data;if(doc.kind==='order')lines.push(d.orderNumber?(en?'Order No. ':'Заказ №')+d.orderNumber:(en?'Transferred ticket':'Переданный билет'));if(doc.kind==='registration')lines.push((en?'Registration: ':'Регистрация: ')+d.registrationId);if(doc.kind==='invitation')lines.push((en?'Invitation No. ':'Пригласительный №')+d.number);});
    // Deliberately excludes QR, access links, email, secret refs and payment credentials.
    return lines.filter(Boolean).join('\n');
  }
  function fold(line){var parts=[],part='',size=0;for(var c of line){var len=new TextEncoder().encode(c).length;if(size+len>75){parts.push(part);part=' ';size=1;}part+=c;size+=len;}parts.push(part);return parts.join('\r\n');}
  function ics(g,en,now){
    if(!validDate(g.datetime))throw Error('date_unavailable');
    var utc=function(v){return new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');};
    var escape=function(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');};
    var start=Date.parse(g.datetime),end=validDate(g.endsAt)&&Date.parse(g.endsAt)>start?Date.parse(g.endsAt):Number(g.durationMinutes)>0&&Number(g.durationMinutes)<=1440?start+Number(g.durationMinutes)*60000:null;
    var registration=g.documents&&g.documents.find(function(d){return d.kind==='registration'&&d.data.registrationId;});
    var uid=registration?registration.data.registrationId:g.ref;
    var lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AELITA PRODUCTION//My Events//'+(en?'EN':'RU'),'CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+encodeURIComponent(uid)+'@aelita-production.ru','DTSTAMP:'+utc(now==null?Date.now():now),'DTSTART:'+utc(start)];
    if(end)lines.push('DTEND:'+utc(end));
    lines.push('SUMMARY:'+escape(g.title),'LOCATION:'+escape([g.venue,g.address].filter(Boolean).join(', ')),'DESCRIPTION:'+escape(end?(en?'AELITA PRODUCTION event.':'Событие АЭЛИТА ПРОДАКШЕН.'):(en?'The end time has not been announced. Only the start is specified.':'Время окончания не объявлено. Указано только начало.')),'TRANSP:'+(end?'OPAQUE':'TRANSPARENT'),'STATUS:'+(g.canceled?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR');
    return lines.map(fold).join('\r\n')+'\r\n';
  }
  return {group:group,summary:summary,supportText:supportText,ics:ics,date:date,validDate:validDate,privateUrl:privateUrl};
}));
