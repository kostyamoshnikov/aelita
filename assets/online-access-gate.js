(function () {
  'use strict';
  var API = 'https://api.aelita-production.ru/tickets/my-orders';
  var tokenPattern = /^[A-Za-z0-9_-]{10,600}\.[A-Za-z0-9_-]{43}$/;
  function telemost(raw) {
    try {
      var u = new URL(raw);
      return u.protocol === 'https:' && u.hostname === 'telemost.yandex.ru' && !u.port && !u.username && !u.password && !u.search && !u.hash && /^\/j\/[A-Za-z0-9_-]{6,200}\/?$/.test(u.pathname) ? u.href : null;
    } catch (_) { return null; }
  }
  function accessToken(raw, kind) {
    try {
      var u = new URL(raw), path = kind === 'invitation' ? /^\/(en\/)?online-invitation\/$/ : /^\/(en\/)?matrix-online\/$/;
      if (u.protocol !== 'https:' || u.hostname !== 'aelita-production.ru' || u.port || u.username || u.password || u.search || !path.test(u.pathname)) return null;
      var token = new URLSearchParams(u.hash.slice(1)).get('access');
      return tokenPattern.test(token || '') ? token : null;
    } catch (_) { return null; }
  }
  function start(kind) {
    var en = document.documentElement.lang === 'en', invitation = kind === 'invitation';
    var T = en ? {
      invalid:'The link is invalid or no longer active. Open the latest email or recover access from your account.',
      scheduled:'Your access is confirmed. The meeting link will open here one day before the event.',
      preparing:'Your access is confirmed. We are preparing the meeting link. Please check again later.',
      ready:'Your access is confirmed. Open Telemost to join the event.',
      error:'Could not verify access. Check your connection and retry.', checking:'Checking your access…',
      recover:'Recover from my account', recovered:'Choose your ticket or invitation:', none:'No matching online access was found. Check the email address in your account or open your latest invitation email.',
      login:'Sign in to recover access', refresh:'Check again', start:'Start', release:'Link opens', item:invitation?'Invitation No. ':'Ticket '
    } : {
      invalid:'Ссылка недействительна или больше не активна. Откройте последнее письмо или восстановите доступ через кабинет.',
      scheduled:'Доступ подтверждён. Ссылка на встречу появится здесь за сутки до начала.',
      preparing:'Доступ подтверждён. Мы готовим ссылку на встречу. Загляните сюда чуть позже.',
      ready:'Доступ подтверждён. Откройте Телемост, чтобы присоединиться к событию.',
      error:'Не получилось проверить доступ. Проверьте соединение и повторите.', checking:'Проверяем ваш доступ…',
      recover:'Восстановить через мой кабинет', recovered:'Выберите свой билет или приглашение:', none:'Подходящий онлайн-доступ не найден. Проверьте почту в кабинете или откройте последнее письмо с приглашением.',
      login:'Войти для восстановления доступа', refresh:'Проверить ещё раз', start:'Начало', release:'Ссылка откроется', item:invitation?'Пригласительный №':'Билет '
    };
    var status = document.getElementById('stream-status'), when = document.getElementById('stream-when');
    var link = document.getElementById('stream-join'), refresh = document.getElementById('stream-refresh'), title = document.getElementById('stream-title');
    var controls = document.createElement('div'); controls.id = 'stream-recovery'; controls.className = 'online-access-recovery ym-hide-content'; refresh.after(controls);
    var hash = new URLSearchParams(location.hash.slice(1)), explicit = hash.has('access'), token = hash.get('access');
    var context = history.state && history.state.aelitaOnlineContext;
    if (!context || context.kind !== kind || !/^(tickets|invitations):[A-Za-z0-9_-]{1,150}$/.test(context.eventRef || '') || !/^[A-Za-z0-9_:-]{1,180}$/.test(context.document || '')) context = null;
    // Only non-secret event/document identifiers survive a reload. Bearer tokens stay in memory.
    function remember(value) { context = value; try { history.replaceState(value ? {aelitaOnlineContext:value} : null, '', location.pathname); } catch (_) {} }
    remember(context);
    var seq = 0, abort = null, hidden = false;
    function session() { try { return localStorage.getItem('aelita_account_token') || ''; } catch (_) { return ''; } }
    function clear() { link.hidden = true; link.removeAttribute('href'); when.replaceChildren(); when.hidden = true; }
    function cancel() { seq++; if (abort) abort.abort(); clear(); refresh.disabled = false; }
    function button(text, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-outline'; b.textContent = text; b.addEventListener('click', fn); return b; }
    function recoveryControls() {
      controls.replaceChildren(); controls.append(button(T.recover, recover));
      var a = document.createElement('a'); a.className = 'btn-outline'; a.href = (en?'/en':'')+'/account/?next='+encodeURIComponent(location.pathname); a.textContent = T.login; controls.append(a);
    }
    function fmt(iso) { return new Date(iso).toLocaleString(en?'en-GB':'ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+(en?' MSK':' МСК'); }
    function schedule(data) {
      when.replaceChildren();
      var rows = [[T.start,data.startsAt]]; if (data.state === 'scheduled') rows.push([T.release,data.releaseAt]);
      rows.forEach(function(row) {
        if (!row[1] || !Number.isFinite(Date.parse(row[1]))) throw Error('date_unavailable');
        var el = document.createElement(when.tagName === 'DL'?'div':'span');
        if(when.tagName==='DL'){
          var dt=document.createElement('dt'),dd=document.createElement('dd'),time=document.createElement('time');
          dt.textContent=row[0];time.dateTime=row[1];time.textContent=fmt(row[1]);dd.appendChild(time);el.append(dt,dd);when.appendChild(el);
        }else{el.textContent=row[0]+': '+fmt(row[1]);when.append(el,document.createTextNode(' '));}
      }); when.hidden = false;
    }
    async function request(url, options) {
      var controller = new AbortController(); if (abort) abort.abort(); abort = controller;
      var timer = setTimeout(function(){controller.abort();},15000);
      try { var r = await fetch(url,Object.assign({cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal},options)); return {ok:r.ok,status:r.status,data:await r.json()}; }
      finally { clearTimeout(timer); }
    }
    async function check() {
      cancel(); var stamp = seq, owner = session(); controls.replaceChildren(); refresh.disabled = true; status.textContent = T.checking;
      if (!tokenPattern.test(token || '')) { status.textContent = T.invalid; refresh.disabled = false; recoveryControls(); return; }
      try {
        var r = await request(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:invitation?'online_invitation_access':'online_access',token:token})});
        if (hidden || stamp !== seq || owner !== session()) return;
        var data = r.data;
        if (!r.ok) { status.textContent = r.status === 503 || r.status >= 500 || data.error === 'access_temporarily_unavailable' ? T.error : T.invalid; recoveryControls(); return; }
        if (!['scheduled','preparing','ready'].includes(data.state)) throw Error('invalid_state');
        schedule(data);
        if (title && (data.title || data.titleEn)) title.textContent = en ? data.titleEn || data.title : data.title;
        if (data.eventRef && data.document && /^(tickets|invitations):[A-Za-z0-9_-]{1,150}$/.test(data.eventRef) && /^[A-Za-z0-9_:-]{1,180}$/.test(data.document)) remember({kind:kind,eventRef:data.eventRef,document:String(data.document)});
        if (data.state === 'ready') { var url = telemost(data.joinUrl); if (!url) throw Error('unexpected_url'); link.href = url; link.hidden = false; }
        status.textContent = T[data.state];
      } catch (_) { if (!hidden && stamp === seq && owner === session()) { clear(); status.textContent = T.error; recoveryControls(); } }
      finally { if (stamp === seq) refresh.disabled = false; }
    }
    async function recover() {
      cancel(); var stamp = seq, owner = session(); token = null; controls.replaceChildren(); status.textContent = T.checking;
      if (!owner) { status.textContent = T.invalid; recoveryControls(); return; }
      refresh.disabled = true;
      try {
        var r = await request(API+(invitation?'?invitations=1':''),{headers:{Authorization:'Bearer '+owner}});
        if (hidden || stamp !== seq || owner !== session()) return;
        if (!r.ok) throw Error('recovery_unavailable');
        var choices = [];
        if (invitation) (r.data.invitations || []).forEach(function(d) { var value = d.status === 'active' && !d.canceled && accessToken(d.accessUrl,kind); if (value) choices.push({eventRef:d.eventRef,document:d.ref,token:value,title:en?d.titleEn||d.title:d.title,number:d.number}); });
        else (r.data.orders || []).forEach(function(o) { if(o.canceled)return; (o.onlineTickets || []).forEach(function(d) { var value = d.mode === 'online' && accessToken(d.accessUrl,kind); if(value)choices.push({eventRef:o.eventRef,document:String(d.ticketNumber),token:value,title:en?o.titleEn||o.title:o.title,number:d.ticketNumber}); }); });
        if (context) choices = choices.filter(function(d) { return d.eventRef === context.eventRef && d.document === context.document; });
        if (choices.length === 1) { token = choices[0].token; await check(); return; }
        status.textContent = choices.length ? T.recovered : T.none; recoveryControls();
        choices.forEach(function(d) { controls.prepend(button(d.title+' · '+T.item+d.number,function(){token=d.token;check();})); });
      } catch (_) { if (!hidden && stamp === seq && owner === session()) { status.textContent = T.error; recoveryControls(); } }
      finally { if(stamp === seq)refresh.disabled=false; }
    }
    refresh.textContent = T.refresh; refresh.addEventListener('click',function(){token?check():recover();});
    window.addEventListener('storage',function(e){if(e.key === 'aelita_account_token' || e.key === null){cancel();token=null;status.textContent=T.invalid;recoveryControls();}});
    document.addEventListener('visibilitychange',function(){hidden=document.hidden;if(hidden)cancel();else token?check():recover();});
    window.addEventListener('pagehide',function(){hidden=true;cancel();token=null;});
    window.addEventListener('pageshow',function(e){if(e.persisted){hidden=false;recover();}});
    if (explicit) check(); else recover();
    return {check:check,recover:recover};
  }
  window.AelitaOnlineGate = {start:start,telemost:telemost,accessToken:accessToken};
}());
