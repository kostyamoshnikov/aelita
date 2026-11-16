(() => {
  'use strict';

  const root = document.querySelector('[data-free-online]');
  if (!root) return;

  const en = document.documentElement.lang === 'en';
  const copy = en ? {
    checking: 'Checking online registration…',
    closed: 'Online registration is closed.',
    full: 'All online places are booked.',
    open: 'Reserve one free online place.',
    guest: 'Sign in to your account to register.',
    expired: 'Sign in again, then return to this page.',
    unverified: 'Confirm your email in your account, then return to this page.',
    login: 'Sign in', account: 'Go to account',
    registered: 'Your online place is reserved.',
    sending: 'Sending your registration…',
    invalidName: 'Enter your name to register.',
    invalidPhone: 'Check the phone number or leave it blank.',
    invalidConsent: 'Please agree to personal data processing.',
    invalidEvent: 'Registration is unavailable for this event. Check the event listings.',
    conflict: 'The details differ from the first attempt. Check your registration status.',
    unavailable: 'Registration status is temporarily unavailable. Check again.',
    submitFailed: 'We could not confirm your registration. Try submitting again or check its status.',
  } : {
    checking: 'Проверяем онлайн-запись…',
    closed: 'Онлайн-запись закрыта.',
    full: 'Все онлайн-места заняты.',
    open: 'Можно записаться на одно бесплатное онлайн-место.',
    guest: 'Войдите в личный кабинет, чтобы записаться.',
    expired: 'Войдите в кабинет заново и вернитесь на эту страницу.',
    unverified: 'Подтвердите почту в личном кабинете и вернитесь на эту страницу.',
    login: 'Войти', account: 'Перейти в кабинет',
    registered: 'Ваше онлайн-место забронировано.',
    sending: 'Отправляем заявку…',
    invalidName: 'Введите имя для записи.',
    invalidPhone: 'Проверьте телефон или оставьте поле пустым.',
    invalidConsent: 'Подтвердите согласие на обработку персональных данных.',
    invalidEvent: 'Запись на это событие недоступна. Проверьте афишу.',
    conflict: 'Данные повтора отличаются от первой заявки. Проверьте статус записи.',
    unavailable: 'Статус записи временно недоступен. Проверьте ещё раз.',
    submitFailed: 'Не удалось подтвердить запись. Отправьте заявку ещё раз или проверьте её статус.',
  };
  const message = root.querySelector('[data-message]');
  const account = root.querySelector('[data-account]');
  const check = root.querySelector('[data-check]');
  const form = root.querySelector('[data-registration]');
  const name = form.querySelector('[data-name]');
  const phone = form.querySelector('[data-phone]');
  const consent = form.querySelector('[data-consent]');
  const submit = form.querySelector('[type="submit"]');
  const address = (en ? '/en' : '') + '/account/';
  const storageKey = 'aelita_account_token';
  const fields = {event_id: root.dataset.freeOnline, program_key: root.dataset.programKey};
  const drafts = window.AelitaCustomerDrafts;
  const draftKey = 'online-registration:' + fields.event_id + ':' + fields.program_key;
  const retryTtl = 24 * 60 * 60 * 1000;
  const fieldErrors = {invalid_name: ['invalidName', name], invalid_phone: ['invalidPhone', phone],
    pd_consent_required: ['invalidConsent', consent]};
  let epoch = 0;
  let activeToken;
  let busy = false;
  let pending;

  function token() {
    try { return localStorage.getItem(storageKey) || ''; } catch (_) { return ''; }
  }

  function current(run, auth) {
    return run === epoch && !document.hidden && token() === auth;
  }

  function clearForm() {
    pending = undefined;
    drafts?.remove(draftKey);
    form.reset();
  }

  function hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function show(state, {editable = false, retry = false, accountLink = false, signedOut = false} = {}) {
    message.textContent = copy[state];
    form.hidden = !editable;
    submit.disabled = busy;
    check.hidden = !retry;
    account.hidden = !accountLink;
    if (accountLink) {
      account.textContent = signedOut ? copy.login : copy.account;
      account.href = signedOut ? address + '?next=' + encodeURIComponent(location.pathname + '#online-registration') : address + 'dashboard/';
    }
  }

  async function request(action, auth, data) {
    const headers = {'Content-Type': 'application/json'};
    if (auth) headers.Authorization = 'Bearer ' + auth;
    const response = await fetch('https://api.aelita-production.ru/events/register?flow=free-online', {
      method: 'POST', headers, body: JSON.stringify({...fields, action, ...data}),
      cache: 'no-store', credentials: 'omit', redirect: 'error',
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error('registration_request_failed'), {code: result?.error});
    return result;
  }

  function showAccess(state, authError) {
    if (state !== 'open') return show(state, {retry: true});
    if (authError) return show(authError === 'email_unverified' ? 'unverified' : 'expired', {accountLink: true, retry: true});
    if (!activeToken) return show('guest', {accountLink: true, signedOut: true});
    show('open', {editable: true});
  }

  async function sync() {
    const run = ++epoch;
    const auth = token();
    if (auth !== activeToken) {
      if (activeToken === undefined) form.reset();
      else clearForm();
    }
    activeToken = auth;
    busy = false;
    show('checking');
    if (document.hidden) return;
    let state;
    try {
      const result = await request('availability');
      if (!current(run, auth)) return;
      state = result.status;
      if (!['closed', 'open', 'full', 'unavailable'].includes(state)) throw Error('invalid_registration_status');
      if (auth) {
        const mine = await request('mine', auth);
        if (!current(run, auth)) return;
        if (mine.ok !== true || !Array.isArray(mine.registrations)) throw Error('invalid_registration_result');
        if (mine.registrations.some(row => row.eventId === fields.event_id && row.mode === 'online' && row.status === 'registered')) {
          clearForm();
          return show('registered');
        }
      }
      showAccess(state);
    } catch (error) {
      if (!current(run, auth)) return;
      if (state && ['auth_required', 'email_unverified'].includes(error.code)) {
        clearForm();
        return showAccess(state, error.code);
      }
      show('unavailable', {retry: true});
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.hidden || busy || !form.reportValidity()) return;
    const run = epoch;
    const auth = token();
    if (!auth || auth !== activeToken) return sync();
    const data = {name: name.value.trim(), phone: phone.value.trim(), pd_consent: consent.checked, lang: en ? 'en' : 'ru'};
    if (!data.name) {
      show('invalidName', {editable: true});
      return name.focus();
    }

    busy = true;
    show('sending', {editable: true});
    try {
      // The tab retains the random ID and a digest, without the token or form fields.
      const bytes = new TextEncoder().encode(JSON.stringify([auth, data]));
      const scope = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
      if (!current(run, auth)) return;
      if (pending?.scope !== scope) {
        const previous = drafts?.read(draftKey, scope, retryTtl);
        const id = /^[a-f0-9]{32}$/.test(previous || '') ? previous : hex(crypto.getRandomValues(new Uint8Array(16)));
        pending = {scope, id};
        drafts?.write(draftKey, scope, id);
      }
      const result = await request('register', auth, {...data, request_id: pending.id});
      if (!current(run, auth)) return;
      if (result.ok !== true || result.eventId !== fields.event_id || result.mode !== 'online' || result.status !== 'registered') {
        throw Error('invalid_registration_result');
      }
      clearForm();
      busy = false;
      show('registered');
      message.focus();
    } catch (error) {
      if (!current(run, auth)) return;
      busy = false;
      if (['full', 'already_registered', 'unknown_or_closed_event', 'registration_closed', 'registration_changed', 'configuration_changed', 'registration_disabled',
        'auth_required', 'email_unverified'].includes(error.code)) return sync();
      if (Object.hasOwn(fieldErrors, error.code)) {
        const [state, input] = fieldErrors[error.code];
        show(state, {editable: true});
        return input.focus();
      }
      if (error.code === 'request_conflict') return show('conflict', {editable: true, retry: true});
      show('submitFailed', {editable: true, retry: true});
    }
  });

  if (!/^evt-[a-f0-9]{32}$/.test(fields.event_id || '') || !/^[a-f0-9]{64}$/.test(fields.program_key || '')) {
    show('invalidEvent');
    return;
  }
  check.addEventListener('click', sync);
  window.addEventListener('aelita:account-changed', sync);
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) sync();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pagehide', () => {
    epoch++;
    form.reset();
    show('checking');
  });
  window.addEventListener('pageshow', event => { if (event.persisted) sync(); });
  sync();
})();
