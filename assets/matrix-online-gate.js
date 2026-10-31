(function () {
  'use strict';
  var en = document.documentElement.lang === 'en';
  var t = en ? {
    invalid: 'The link is invalid or no longer active. Open the latest email or your account.',
    scheduled: 'Your online ticket is confirmed. The Telemost link will open here one day before the event.',
    preparing: 'Your ticket is confirmed. We are preparing the meeting link. Please check this page again later.',
    ready: 'Your access is confirmed. Open Telemost to join the film talk.',
    error: 'Could not verify your access. Check your connection and try again.',
    start: 'Start: ', release: 'Link opens: ', refresh: 'Check again',
  } : {
    invalid: 'Ссылка недействительна или больше не активна. Откройте последнее письмо или личный кабинет.',
    scheduled: 'Ваш онлайн-билет подтверждён. Ссылка на Телемост появится здесь за сутки до начала.',
    preparing: 'Ваш билет подтверждён. Мы готовим ссылку на встречу. Загляните сюда чуть позже.',
    ready: 'Доступ подтверждён. Откройте Телемост, чтобы присоединиться к киноразбору.',
    error: 'Не получилось проверить доступ. Проверьте соединение и попробуйте ещё раз.',
    start: 'Начало: ', release: 'Ссылка откроется: ', refresh: 'Проверить ещё раз',
  };
  var token = new URLSearchParams(location.hash.slice(1)).get('access');
  // Never put a bearer token in query strings, analytics, referrers or persistent storage.
  try { history.replaceState(null, '', location.pathname); } catch (_) {}
  var status = document.getElementById('stream-status'), when = document.getElementById('stream-when'), link = document.getElementById('stream-join'), refresh = document.getElementById('stream-refresh');
  refresh.textContent = t.refresh;
  function fmt(iso) { return new Date(iso).toLocaleString(en ? 'en-GB' : 'ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + (en ? ' MSK' : ' МСК'); }
  async function check() {
    link.hidden = true; link.removeAttribute('href'); refresh.disabled = true;
    if (!token || !/^[A-Za-z0-9_-]{10,600}\.[A-Za-z0-9_-]{43}$/.test(token)) { status.textContent = t.invalid; refresh.hidden = true; return; }
    try {
      var response = await fetch('https://api.aelita-production.ru/tickets/my-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', body: JSON.stringify({ action: 'online_access', token: token }) });
      var data = await response.json();
      if (!response.ok) { status.textContent = (response.status === 503 || data.error === 'access_temporarily_unavailable') ? t.error : t.invalid; when.textContent = ''; return; }
      status.textContent = t[data.state] || t.error;
      when.textContent = t.start + fmt(data.startsAt) + (data.state === 'scheduled' ? ' · ' + t.release + fmt(data.releaseAt) : '');
      if (data.state === 'ready') {
        var u = new URL(data.joinUrl);
        if (u.protocol !== 'https:' || u.hostname !== 'telemost.yandex.ru' || u.username || u.password) throw new Error('unexpected_url');
        link.href = u.href; link.hidden = false;
      }
    } catch (_) { status.textContent = t.error; }
    finally { refresh.disabled = false; }
  }
  refresh.addEventListener('click', check); check();
}());
