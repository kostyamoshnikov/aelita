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
  const mailLabels = {pending: 'ожидают', sending: 'отправляются', sent: 'приняты SMTP',
    failed: 'отказ', unknown: 'требуют сверки', skipped: 'пропущены'};

  function mount(root, { api, selection, isCurrent }) {
    const line = root.querySelector('[role="status"]');
    const details = root.querySelector('[data-program]');
    const refresh = root.querySelector('[data-refresh]');
    const configure = root.querySelector('[data-configure]');
    const open = root.querySelector('[data-open]');
    const close = root.querySelector('[data-close]');
    const streamPanel = root.querySelector('[data-stream-panel]');
    const streamLine = root.querySelector('[data-stream-status]');
    const streamUrl = root.querySelector('[data-stream-url]');
    const streamEnd = root.querySelector('[data-stream-end]');
    const streamConfirm = root.querySelector('[data-stream-confirm]');
    const streamSave = root.querySelector('[data-stream-save]');
    const providerConfirm = root.querySelector('[data-stream-provider-confirm]');
    const stopConfirm = root.querySelector('[data-stream-stop-confirm]');
    const pauseStream = root.querySelector('[data-stream-pause]');
    const finishStream = root.querySelector('[data-stream-finish]');
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
      if (streamUrl) streamUrl.value = '';
      if (streamConfirm) streamConfirm.checked = false;
      if (providerConfirm) providerConfirm.checked = false;
      if (stopConfirm) stopConfirm.checked = false;
      if (streamLine) streamLine.textContent = '';
      if (streamEnd) streamEnd.value = '';
      if (streamSave) streamSave.disabled = true;
      if (pauseStream) pauseStream.hidden = true;
      if (finishStream) finishStream.hidden = true;
    }

    function current(context) {
      return view === context && isCurrent(context.epoch);
    }
    function renderStream(context, stream) {
      context.stream = stream;
      streamSave.disabled = !stream.enabled || stream.state === 'finished';
      streamUrl.value = ''; streamConfirm.checked = false;
      if (providerConfirm) providerConfirm.checked = false;
      if (stopConfirm) stopConfirm.checked = false;
      streamEnd.value = stream.accessUntil ? stream.accessUntil.slice(0, 16) : '';
      const labels = {active: 'Подключение настроено', paused: 'Выдача адреса приостановлена. Для возобновления нужна новая комната', finished: 'Доступ завершён', preparing: 'Подключение ещё не настроено'};
      streamLine.textContent = (labels[stream.state] || labels.preparing) + ' · версия ' + stream.revision;
      if (stream.configured && (!stream.providerReady || stream.providerStatus !== 'operator_attested')) streamLine.textContent += ' · требуется проверка комнаты организатором';
      if (stream.providerStatus === 'manual_action_required') streamLine.textContent += ' · внешнюю комнату нужно проверить и закрыть вручную';
      if (pauseStream) pauseStream.hidden = !stream.configured || stream.state !== 'active';
      if (finishStream) finishStream.hidden = !stream.configured || stream.state === 'finished';
    }

    function render(context, state) {
      context.state = state;
      root.hidden = !state.visible;
      if (!state.visible) return;
      const p = state.program;
      details.textContent = p ? p.title + ' · ' + date.format(new Date(p.datetime)) + ' МСК · мест: ' + p.onlineCapacity : '';
      const mail = Object.entries(mailLabels).filter(([key]) => state.mail?.[key] > 0)
        .map(([key, label]) => label + ' ' + state.mail[key]);
      if (mail.length) details.textContent += ' · Письма · ' + mail.join(' · ');
      line.textContent = statusText[state.status] || 'Обновите состояние записи.';
      setActions(state);
    }

    async function read(context, confirmedChange = false) {
      context.stream = null;
      if (streamUrl) streamUrl.value = '';
      if (streamSave) streamSave.disabled = true;
      if (pauseStream) pauseStream.hidden = true;
      if (finishStream) finishStream.hidden = true;
      context.busy = true;
      refresh.disabled = true;
      setActions(null);
      if (!root.hidden) line.textContent = 'Проверяем состояние записи…';
      try {
        const state = await api({ action: 'event_master_free_online_status', id: context.id }, context.epoch);
        if (!current(context)) return;
        render(context, state);
        if (streamPanel && state.visible) {
          const stream = await api({action: 'event_master_free_online_stream_status', id: context.id}, context.epoch);
          if (!current(context)) return;
          renderStream(context, stream);
        }
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
    if (streamSave) streamSave.onclick = async () => {
      const context = view;
      if (!context || !current(context) || context.busy || !context.stream?.enabled || context.stream.state === 'finished') return;
      if (!streamConfirm.checked || !streamUrl.value || !streamEnd.value) {streamLine.textContent = 'Укажите ссылку, окончание и подтверждение.'; return;}
      const body = {action: 'event_master_free_online_stream_configure', id: context.id,
        streamRevision: context.stream.revision, request_id: crypto.randomUUID(), joinUrl: streamUrl.value,
        accessUntil: streamEnd.value + ':00+03:00', confirmEnd: true, confirmReplace: true,
        confirmProvider: providerConfirm?.checked === true};
      streamUrl.value = ''; streamConfirm.checked = false; context.busy = true; streamSave.disabled = true;
      try {
        const stream = await api(body, context.epoch);
        if (!current(context)) return;
        renderStream(context, stream);
      } catch (_) {
        if (current(context)) {context.stream = null; streamLine.textContent = 'Результат не подтверждён. Обновите статус перед повтором.';}
      } finally {if (current(context)) {context.busy = false; streamSave.disabled = !context.stream || !context.stream.enabled || context.stream.state === 'finished';}}
    };
    async function stopStream(state) {
      const context = view;
      if (!context || !current(context) || context.busy || !context.stream?.configured) return;
      if (!stopConfirm?.checked) {streamLine.textContent = 'Подтвердите остановку выдачи адреса.'; return;}
      const body = {action: 'event_master_free_online_stream_set_state', id: context.id, state,
        reason: state === 'finished' ? 'finished' : 'operator_pause', streamRevision: context.stream.revision,
        request_id: crypto.randomUUID(), confirmStop: true};
      context.busy = true; pauseStream.disabled = true; finishStream.disabled = true; stopConfirm.checked = false;
      try {
        const stream = await api(body, context.epoch);
        if (current(context)) renderStream(context, stream);
      } catch (_) {
        if (current(context)) {context.stream = null; pauseStream.hidden = true; finishStream.hidden = true;
          streamLine.textContent = 'Результат остановки не подтверждён. Обновите статус, не повторяя действие вслепую.';}
      } finally {if (current(context)) {context.busy = false; pauseStream.disabled = false; finishStream.disabled = false;}}
    }
    if (pauseStream) pauseStream.onclick = () => stopStream('paused');
    if (finishStream) finishStream.onclick = () => stopStream('finished');
    if (streamPanel) window.addEventListener('pagehide', () => {streamUrl.value = '';});
    clear();
    return { clear, sync };
  }

  window.AelitaFreeOnlineMaster = { mount };
})();
