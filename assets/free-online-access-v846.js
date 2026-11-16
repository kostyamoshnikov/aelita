(() => {
  'use strict';
  const API = 'https://api.aelita-production.ru/events/register?flow=free-online';
  const KEY = 'aelita_account_token';
  const en = document.documentElement.lang === 'en';
  const messages = en ? {
    scheduled: 'Joining will become available when the event starts.', preparing: 'We are preparing the connection.',
    ready: 'Your registration is active. You can join the event.', access_unavailable: 'No active access was found for this account.',
    schedule_changed: 'The event time is being updated. Check your account for details.', event_finished: 'The event has ended.',
    temporarily_unavailable: 'We could not verify access. Please try again.', auth_required: 'Sign in to your account to check your registration.',
    email_unverified: 'Confirm your email address in your account.', checking: 'Checking your registration…',
    popup_blocked: 'Allow a new browser tab and try joining again.',
    event_paused: 'Joining has been temporarily paused by the organizer.',
    registration_cancelled: 'Your registration has been cancelled. Joining is no longer available.',
  } : {
    scheduled: 'Подключение откроется в начале встречи.', preparing: 'Готовим подключение.',
    ready: 'Ваша запись действует. Можно подключиться к встрече.', access_unavailable: 'Действующий доступ для этого аккаунта не найден.',
    schedule_changed: 'Время встречи уточняется. Проверьте обновления в кабинете.', event_finished: 'Встреча завершилась.',
    temporarily_unavailable: 'Не удалось проверить доступ. Попробуйте ещё раз.', auth_required: 'Войдите в свой аккаунт, чтобы проверить запись.',
    email_unverified: 'Подтвердите почту в личном кабинете.', checking: 'Проверяем вашу запись…',
    popup_blocked: 'Разрешите открытие новой вкладки в браузере и попробуйте подключиться снова.',
    event_paused: 'Подключение временно закрыто организатором.',
    registration_cancelled: 'Ваша запись отменена. Подключение больше недоступно.',
  };
  const status = document.getElementById('stream-status'), when = document.getElementById('stream-when');
  const join = document.getElementById('stream-join'), refresh = document.getElementById('stream-refresh');
  const params = new URLSearchParams(location.hash.slice(1));
  const eventId = params.get('event'), registrationId = params.get('registration');
  const valid = /^evt-[a-f0-9]{32}$/.test(eventId || '') && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(registrationId || '');
  const token = () => {try {return localStorage.getItem(KEY) || '';} catch (_) {return '';}};
  let epoch = 0, controller, handoffRequest, suspended = document.hidden, timeout;
  function clear(message = '') {
    epoch++; controller?.abort(); controller = undefined; clearTimeout(timeout);
    join.hidden = true; join.disabled = false; join.removeAttribute('href');
    refresh.disabled = false;
    when.textContent = ''; when.hidden = true; status.textContent = message;
  }
  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 256 || value !== value.trim() || !/^https:\/\/telemost\.yandex\.ru\/j\/[A-Za-z0-9_-]{6,200}\/?$/.test(value)) return null;
    try {const u = new URL(value); return u.protocol === 'https:' && u.host === 'telemost.yandex.ru' && !u.username && !u.password && !u.search && !u.hash && /^\/j\/[A-Za-z0-9_-]{6,200}\/?$/.test(u.pathname) ? u.href : null;} catch (_) {return null;}
  }
  async function check(open = false) {
    clear();
    if (suspended) return;
    const owner = token();
    if (!owner) {status.textContent = messages.auth_required; return;}
    if (!valid) {status.textContent = messages.access_unavailable; return;}
    const current = epoch, request = new AbortController(); controller = request;
    if (open) handoffRequest = request;
    const windowRef = open ? window.open('about:blank', '_blank') : null;
    let handedOff = false;
    if (windowRef) windowRef.opener = null;
    const matches = () => epoch === current && !suspended && owner === token() && !request.signal.aborted;
    status.textContent = messages.checking; refresh.disabled = true;
    try {
      if (open && !windowRef) throw Object.assign(Error('popup_blocked'), {code: 'popup_blocked'});
      const response = await fetch(API, {method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
        signal: request.signal, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + owner},
        body: JSON.stringify({action: 'stream-access', event_id: eventId, registration_id: registrationId, join: open})});
      const data = await response.json();
      if (!matches()) return;
      if (!response.ok) throw Object.assign(Error('access_failed'), {code: data.error || data.reason || data.state});
      if (!Object.hasOwn(messages, data.state)) throw Error('invalid_access_state');
      status.textContent = messages[data.state];
      if (data.startsAt && Number.isFinite(Date.parse(data.startsAt))) {
        when.textContent = new Intl.DateTimeFormat(en ? 'en-GB' : 'ru-RU', {dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Moscow'}).format(new Date(data.startsAt)) + (en ? ' MSK' : ' МСК');
        when.hidden = false;
      }
      if (data.state === 'ready') {
        const remaining = Date.parse(data.accessUntil) - Date.parse(data.checkedAt);
        if (!Number.isFinite(remaining) || remaining <= 0) throw Error('expired_access');
        join.hidden = false;
        if (open) {
          const url = safeUrl(data.joinUrl);
          if (!url || !windowRef) throw Error('join_unavailable');
          if (!matches()) return;
          windowRef.location.replace(url);
          handedOff = true;
        }
        // Even a visible ready button is a short-lived hint, never a credential.
        timeout = setTimeout(() => clear(messages.temporarily_unavailable), Math.min(30000, remaining));
      } else if (Object.hasOwn(data, 'joinUrl')) throw Error('invalid_access_response');
    } catch (error) {
      if (matches()) {clear(messages[error.code] || messages.temporarily_unavailable);}
    } finally {
      if (windowRef && !handedOff) windowRef.close();
      if (handoffRequest === request) handoffRequest = undefined;
      if (epoch === current) {controller = undefined; refresh.disabled = false;}
      if (epoch === current && document.hidden) {suspended = true; clear();}
    }
  }
  join.addEventListener('click', () => check(true));
  refresh.addEventListener('click', () => check());
  const session = () => {clear(messages.auth_required);};
  window.addEventListener('storage', e => {if (e.key === KEY || e.key === null) session();});
  window.addEventListener('aelita:account-changed', session);
  window.addEventListener('pagehide', () => {suspended = true; clear();});
  window.addEventListener('pageshow', () => {suspended = document.hidden; if (!suspended) check();});
  document.addEventListener('visibilitychange', () => {
    // A tab opened by this click must be able to finish its fresh gate request.
    // pagehide and account changes still abort it immediately.
    if (document.hidden && handoffRequest && !handoffRequest.signal.aborted) {join.hidden = true; return;}
    suspended = document.hidden; clear(); if (!suspended) check();
  });
  check();
})();
