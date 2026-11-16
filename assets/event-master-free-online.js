(function () {
  'use strict';

  const statusText = {
    not_configured: 'Опубликованные условия готовы. Подключите запись.',
    closed: 'Приём заявок закрыт.',
    open: 'Приём заявок открыт.',
    needs_terms: 'Назначьте дату и опубликуйте числовую квоту для онлайн-участия.',
    ended: 'Время для записи уже закончилось.',
    disabled: 'Бесплатная онлайн-регистрация выключена в настройках сервера.',
    catalog_changed: 'Опубликованные условия отличаются от сохранённых условий записи.',
  };
  const errors = {
    content_conflict: 'Анонсы изменились. Обновите статус и проверьте условия.',
    configuration_changed: 'Состояние записи уже изменилось. Обновите статус.',
    free_online_terms_required: statusText.needs_terms,
    free_online_catalog_changed: statusText.catalog_changed,
    registration_disabled: statusText.disabled,
    registration_closed: statusText.ended,
    invalid_title: 'Проверьте русское и английское названия анонса.',
  };
  const date = new Intl.DateTimeFormat('ru-RU', {dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Moscow'});

  function mount(root, { api, selection, isCurrent }) {
    const line = root.querySelector('[role="status"]');
    const details = root.querySelector('[data-program]');
    const refresh = root.querySelector('[data-refresh]');
    const configure = root.querySelector('[data-configure]');
    const open = root.querySelector('[data-open]');
    const close = root.querySelector('[data-close]');
    let view = null;

    function setActions(state) {
      configure.hidden = !state?.canConfigure;
      open.hidden = !state?.canOpen;
      close.hidden = !state?.canClose;
    }

    function clear() {
      view = null;
      root.hidden = true;
      details.textContent = '';
      line.textContent = '';
      refresh.disabled = false;
      setActions(null);
    }

    function current(context) {
      return view === context && isCurrent(context.epoch);
    }

    function render(context, state) {
      context.state = state;
      root.hidden = !state.visible;
      if (!state.visible) return;
      const p = state.program;
      details.textContent = p ? p.title + ' · ' + date.format(new Date(p.datetime)) + ' МСК · мест: ' + p.onlineCapacity : '';
      line.textContent = statusText[state.status] || 'Обновите состояние записи.';
      setActions(state);
    }

    async function read(context, confirmedChange = false) {
      context.busy = true;
      refresh.disabled = true;
      setActions(null);
      if (!root.hidden) line.textContent = 'Проверяем состояние записи…';
      try {
        const state = await api({ action: 'event_master_free_online_status', id: context.id }, context.epoch);
        if (!current(context)) return;
        render(context, state);
      } catch (error) {
        if (!current(context) || error.code === 'superseded') return;
        const last = context.state;
        context.state = last ? {...last, canConfigure: false, canOpen: false} : null;
        if (context.relevant || last?.visible) {
          root.hidden = false;
          line.textContent = confirmedChange
            ? 'Приём закрыт. Состояние анонса сейчас недоступно.'
            : 'Состояние записи недоступно. Обновите статус.';
          setActions(context.state);
        }
      } finally {
        if (current(context)) {
          context.busy = false;
          refresh.disabled = false;
        }
      }
    }

    function sync() {
      clear();
      const selected = selection();
      if (!selected) return;
      const context = { id: selected.id, epoch: selected.epoch, relevant: selected.relevant, state: null, busy: false };
      view = context;
      root.hidden = !context.relevant;
      void read(context);
    }

    async function change(kind) {
      const context = view;
      if (!context || !current(context) || !context.state || context.busy) return;
      const state = context.state;
      const allowed = { configure: state.canConfigure, open: state.canOpen, close: state.canClose };
      if (!allowed[kind]) return;
      const body = {
        action: kind === 'configure' ? 'event_master_free_online_configure' : 'event_master_free_online_set_open',
        id: context.id, announcementRevision: state.announcementRevision,
      };
      if (kind !== 'configure') {
        body.open = kind === 'open';
        body.registrationRevision = state.registrationRevision;
      }
      context.busy = true;
      refresh.disabled = true;
      line.textContent = 'Сохраняем состояние записи…';
      line.focus({preventScroll: true});
      setActions(null);
      try {
        const state = await api(body, context.epoch);
        if (!current(context)) return;
        render(context, state);
        if (kind === 'close') await read(context, true);
      } catch (error) {
        if (!current(context) || error.code === 'superseded') return;
        context.state = null;
        line.textContent = errors[error.code] || 'Результат сохранения неизвестен. Сначала обновите статус.';
      } finally {
        if (current(context)) {
          context.busy = false;
          refresh.disabled = false;
        }
      }
    }

    refresh.onclick = () => { if (view && current(view) && !view.busy) void read(view); };
    configure.onclick = () => void change('configure');
    open.onclick = () => void change('open');
    close.onclick = () => void change('close');
    clear();
    return { clear, sync };
  }

  window.AelitaFreeOnlineMaster = { mount };
})();
