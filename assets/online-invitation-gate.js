(function () {
  'use strict';
  var en = document.documentElement.lang === 'en';
  var t = en ? {
    invalid: 'This invitation is invalid or no longer active. Ask the organiser for the latest invitation.',
    scheduled: 'Your online invitation is confirmed. The meeting link opens here one day before the event.',
    preparing: 'Your invitation is confirmed. The organiser is preparing the meeting link. Please check again later.',
    ready: 'Your access is confirmed. Open Telemost to join the event.',
    error: 'Could not verify your access. Check your connection and try again.',
    start: 'Start: ', release: 'Link opens: ', refresh: 'Check again'
  } : {
    invalid: 'Пригласительный недействителен или больше не активен. Попросите организатора прислать актуальный.',
    scheduled: 'Ваш онлайн-пригласительный подтверждён. Ссылка на встречу появится здесь за сутки до начала.',
    preparing: 'Пригласительный подтверждён. Организатор готовит ссылку на встречу. Загляните сюда чуть позже.',
    ready: 'Доступ подтверждён. Откройте Телемост, чтобы присоединиться к событию.',
    error: 'Не получилось проверить доступ. Проверьте соединение и попробуйте ещё раз.',
    start: 'Начало: ', release: 'Ссылка откроется: ', refresh: 'Проверить ещё раз'
  };
  var token = new URLSearchParams(location.hash.slice(1)).get('access');
  try { history.replaceState(null, '', location.pathname); } catch (_) {}
  var status = document.getElementById('stream-status'), when = document.getElementById('stream-when');
  var title = document.getElementById('stream-title'), link = document.getElementById('stream-join'), refresh = document.getElementById('stream-refresh');
  refresh.textContent = t.refresh;
  function fmt(iso) {
    return new Date(iso).toLocaleString(en ? 'en-GB' : 'ru-RU', {timeZone:'Europe/Moscow', day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) + (en ? ' MSK' : ' МСК');
  }
  async function check() {
    link.hidden = true; link.removeAttribute('href'); refresh.disabled = true;
    if (!token || !/^[A-Za-z0-9_-]{10,600}\.[A-Za-z0-9_-]{43}$/.test(token)) { status.textContent = t.invalid; refresh.hidden = true; return; }
    try {
      var r = await fetch('https://api.aelita-production.ru/tickets/my-orders', {method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify({action:'online_invitation_access',token:token})});
      var d = await r.json();
      if (!r.ok) { status.textContent = r.status === 503 ? t.error : t.invalid; when.textContent = ''; return; }
      status.textContent = t[d.state] || t.error;
      title.textContent = en ? (d.titleEn || d.title) : d.title;
      when.textContent = t.start + fmt(d.startsAt) + (d.state === 'scheduled' ? ' · ' + t.release + fmt(d.releaseAt) : '');
      if (d.state === 'ready') {
        var u = new URL(d.joinUrl);
        if (u.protocol !== 'https:' || u.hostname !== 'telemost.yandex.ru' || u.port || u.username || u.password || !/^\/j\/[A-Za-z0-9_-]{6,200}\/?$/.test(u.pathname)) throw new Error('unexpected_url');
        link.href = u.href; link.hidden = false;
      }
    } catch (_) { status.textContent = t.error; }
    finally { refresh.disabled = false; }
  }
  refresh.addEventListener('click',check); check();
}());
