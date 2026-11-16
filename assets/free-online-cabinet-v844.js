(() => {
  'use strict';

  const API = 'https://api.aelita-production.ru/events/register?flow=free-online';
  const TOKEN_KEY = 'aelita_account_token';
  const EVENT = /^evt-[a-f0-9]{32}$/;
  const REGISTRATION = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const messages = {
    ru: {
      title: 'Бесплатные онлайн-регистрации', loading: 'Загружаем регистрации…',
      empty: 'Пока нет бесплатных онлайн-регистраций.',
      unavailable: 'Не удалось обновить список. Повторите попытку.',
      login: 'Войдите заново, чтобы увидеть регистрации.', verify: 'Подтвердите почту в личном кабинете.',
      retry: 'Повторить загрузку', kind: 'Онлайн · бесплатно', when: 'МСК', registered: 'Вы зарегистрированы',
      past: 'Отмена сейчас закрыта', cancel: 'Отменить запись', keep: 'Сохранить запись',
      confirmTitle: 'Отменить онлайн-регистрацию?', confirm: 'Место освободится после отмены.',
      sending: 'Отменяем запись…', done: 'Запись отменена. Место освобождено.',
      inactive: 'Эта запись больше не активна.', closed: 'Отмена этой записи сейчас закрыта.',
      uncertain: 'Не удалось подтвердить отмену. Попробуйте ещё раз.',
      notificationBusy: 'Сейчас обрабатывается уведомление. Запись сохранена; повторите отмену позже.',
    },
    en: {
      title: 'Free online registrations', loading: 'Loading your registrations…',
      empty: 'You have no free online registrations yet.',
      unavailable: 'Could not refresh your registrations. Try again.',
      login: 'Sign in again to see your registrations.', verify: 'Confirm your email address in your account.',
      retry: 'Try loading again', kind: 'Online · free', when: 'Moscow time', registered: 'You are registered',
      past: 'Cancellation is currently closed', cancel: 'Cancel registration', keep: 'Keep registration',
      confirmTitle: 'Cancel this online registration?', confirm: 'Cancelling releases your place.',
      sending: 'Cancelling your registration…', done: 'Registration cancelled. Your place was released.',
      inactive: 'This registration is no longer active.', closed: 'Cancellation for this registration is currently closed.',
      uncertain: 'Could not confirm cancellation. Try again.',
      notificationBusy: 'A notification is being processed. Your registration remains active; try cancelling later.',
    },
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  async function request(token, signal, body) {
    const response = await fetch(API, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal, body: JSON.stringify(body),
    });
    if (response.status === 401) throw Object.assign(Error('auth_required'), {code: 'auth_required'});
    const data = await response.json();
    if (!response.ok || data?.ok !== true) {
      throw Object.assign(Error('online_registration_request'), {code: data?.error});
    }
    return data;
  }

  function registrations(data, requirePolicy) {
    if (!Array.isArray(data.registrations) || !data.registrations.every(row => row?.mode === 'online' &&
        row.status === 'registered' && EVENT.test(row.eventId) && REGISTRATION.test(row.registrationId) &&
        typeof row.title === 'string' && typeof row.titleEn === 'string' && Number.isFinite(Date.parse(row.datetime)) &&
        (!requirePolicy || typeof row.canCancel === 'boolean'))) throw Error('invalid_online_registrations');
    return data.registrations;
  }

  function mount({root, lang, getToken}) {
    const language = lang === 'en' ? 'en' : 'ru';
    const t = messages[language];
    const token = getToken();
    const focusable = new Map();
    const pending = new Map();
    const inactive = new Set();
    let rows = [];
    let listing;
    let selected;
    let suspended = document.hidden;
    let disposed = false;

    const heading = element('h3', 'fo-title', t.title);
    const status = element('p', 'fo-status');
    const result = element('p', 'fo-status');
    for (const node of [status, result]) {
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
    }
    result.tabIndex = -1;
    const retry = element('button', 'btn-outline fo-button', t.retry);
    retry.type = 'button';
    retry.hidden = true;
    const list = element('ul', 'fo-list');
    const modal = element('dialog', 'fo-dialog');
    modal.setAttribute('aria-labelledby', 'fo-confirm-title');
    modal.setAttribute('aria-describedby', 'fo-confirm-event fo-confirm-description');
    const form = element('form');
    form.method = 'dialog';
    const modalTitle = element('h4', 'fo-title', t.confirmTitle);
    modalTitle.id = 'fo-confirm-title';
    const eventTitle = element('p', 'fo-name');
    eventTitle.id = 'fo-confirm-event';
    const description = element('p', 'fo-status', t.confirm);
    description.id = 'fo-confirm-description';
    const actions = element('div', 'fo-actions');
    for (const [value, label] of [['keep', t.keep], ['cancel', t.cancel]]) {
      const button = element('button', 'btn-outline fo-button', label);
      button.type = 'submit';
      button.value = value;
      button.autofocus = value === 'keep';
      actions.append(button);
    }
    form.append(modalTitle, eventTitle, description, actions);
    modal.append(form);
    root.replaceChildren(heading, status, result, list, retry, modal);
    root.hidden = false;

    const label = row => language === 'en' ? row.titleEn : row.title;
    const key = row => row.eventId + ':' + row.registrationId;
    const date = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'ru-RU', {
      timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });

    function current() {
      return !disposed && !suspended && !!token && getToken() === token;
    }

    function stop(message = '') {
      listing?.abort();
      listing = undefined;
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      selected = undefined;
      if (modal.open) modal.close();
      eventTitle.textContent = '';
      rows = [];
      focusable.clear();
      list.replaceChildren();
      status.textContent = message;
      result.textContent = '';
      retry.hidden = true;
    }

    function authError(code) {
      if (code !== 'auth_required' && code !== 'email_unverified') return false;
      stop(code === 'email_unverified' ? t.verify : t.login);
      retry.hidden = code !== 'email_unverified';
      return true;
    }

    function render() {
      const focused = [...focusable].find(([, button]) => button === document.activeElement)?.[0];
      focusable.clear();
      list.replaceChildren(...rows.map(row => {
        const id = key(row);
        const item = element('li', 'fo-item');
        const main = element('div', 'fo-main');
        const when = element('time', 'fo-meta', date.format(new Date(row.datetime)) + ' · ' + t.when);
        when.dateTime = row.datetime;
        main.append(element('strong', 'fo-name', label(row)), when,
          element('span', 'fo-meta', t.kind + (row.canCancel ? ' · ' + t.registered : '')));
        item.append(main);
        const access = element('a', 'btn-outline fo-button', language === 'en' ? 'Open online access' : 'Открыть онлайн-доступ');
        access.href = (language === 'en' ? '/en' : '') + '/free-online-access/#event=' + encodeURIComponent(row.eventId) + '&registration=' + encodeURIComponent(row.registrationId);
        item.append(access);

        if (row.canCancel) {
          const button = element('button', 'btn-outline fo-button fo-cancel', t.cancel);
          button.type = 'button';
          button.disabled = pending.has(id);
          button.addEventListener('click', () => {
            if (!current() || pending.has(id) || selected || modal.open) return;
            selected = row;
            modal.returnValue = '';
            eventTitle.textContent = label(row);
            modal.showModal();
          });
          focusable.set(id, button);
          item.append(button);
        } else item.append(element('span', 'fo-meta fo-past', t.past));
        return item;
      }));
      if (focused && !modal.open) focusable.get(focused)?.focus();
    }

    async function load() {
      if (!current()) {
        if (!suspended) stop(t.login);
        return;
      }
      listing?.abort();
      const controller = new AbortController();
      listing = controller;
      status.textContent = t.loading;
      retry.hidden = true;
      try {
        const data = await request(token, controller.signal, {action: 'mine-all'});
        if (!current() || controller.signal.aborted) return;
        rows = registrations(data, true).filter(row => !inactive.has(key(row)));
        render();
        status.textContent = rows.length ? '' : t.empty;
      } catch (error) {
        if (!current() || controller.signal.aborted || authError(error.code)) return;
        status.textContent = t.unavailable;
        retry.hidden = false;
      } finally {
        if (listing === controller) listing = undefined;
      }
    }

    async function cancel(row) {
      const id = key(row);
      if (!current() || pending.has(id) || inactive.has(id)) return;
      const controller = new AbortController();
      const ownsResponse = () => current() && !controller.signal.aborted;
      pending.set(id, controller);
      const button = focusable.get(id);
      if (button) button.disabled = true;
      result.textContent = t.sending;
      let confirmation;
      try {
        const data = await request(token, controller.signal, {action: 'cancel', event_id: row.eventId, registration_id: row.registrationId});
        if (!ownsResponse()) return;
        if (data.eventId !== row.eventId || data.registrationId !== row.registrationId || data.mode !== 'online' ||
            typeof data.already !== 'boolean') throw Error('invalid_online_cancellation');
        confirmation = t.done;
      } catch (error) {
        if (!ownsResponse() || authError(error.code)) return;
        if (error.code === 'notification_in_progress') {result.textContent = t.notificationBusy; result.focus(); return;}
        if (error.code === 'cancellation_closed') {
          result.textContent = t.closed;
          rows = rows.map(item => key(item) === id ? {...item, canCancel: false} : item);
          render();
          result.focus();
          load();
          return;
        }
        try {
          const checked = await request(token, controller.signal, {action: 'mine', event_id: row.eventId});
          if (!ownsResponse()) return;
          const ownRows = registrations(checked, false);
          if (ownRows.some(item => item.eventId !== row.eventId)) throw Error('invalid_online_registration_event');
          if (!ownRows.some(item => item.registrationId === row.registrationId)) confirmation = t.inactive;
        } catch (readError) {
          if (!ownsResponse() || authError(readError.code)) return;
        }
      } finally {
        if (pending.get(id) === controller) pending.delete(id);
        const currentButton = focusable.get(id);
        if (ownsResponse() && currentButton) currentButton.disabled = false;
      }
      if (!ownsResponse()) return;
      if (confirmation) {
        inactive.add(id);
        rows = rows.filter(item => key(item) !== id);
        render();
        result.textContent = confirmation;
        result.focus();
        load();
      } else {
        result.textContent = t.uncertain;
        focusable.get(id)?.focus();
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const row = selected;
      modal.close();
      if (row && event.submitter?.value === 'cancel') cancel(row);
    });
    modal.addEventListener('close', () => {
      const row = selected;
      selected = undefined;
      eventTitle.textContent = '';
      if (!row || !current()) return;
      focusable.get(key(row))?.focus();
    });
    retry.addEventListener('click', load);
    function sessionChanged() {
      if (getToken() !== token) stop(t.login);
    }
    function storageChanged(event) {
      if (event.key === TOKEN_KEY || event.key === null) sessionChanged();
    }
    function suspend() {
      suspended = true;
      stop();
    }
    function resume() {
      suspended = document.hidden;
      if (!suspended) load();
    }
    function pageShown(event) {
      if (event.persisted) resume();
    }
    window.addEventListener('aelita:account-changed', sessionChanged);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', pageShown);
    if (document.hidden) document.addEventListener('visibilitychange', resume, {once: true});
    else load();
    return {reload: load, dispose() {
      disposed = true;
      stop();
      window.removeEventListener('aelita:account-changed', sessionChanged);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('pageshow', pageShown);
      document.removeEventListener('visibilitychange', resume);
    }};
  }

  window.AELITA_FreeOnlineCabinet = {mount};
})();
