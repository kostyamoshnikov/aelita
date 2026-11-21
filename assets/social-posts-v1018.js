(function () {
  'use strict';

  const endpoint = 'https://api.aelita-production.ru/admin/site-edit';
  const $ = id => document.getElementById('social-' + id);
  const channels = [
    { id: 'telegram', label: 'Telegram', field: 'textTg', target: 'tg' },
    { id: 'vk', label: 'ВКонтакте', field: 'textVk', target: 'vk' },
    { id: 'instagram', label: 'Instagram', field: 'textIg', target: 'ig' }
  ];
  const fieldIds = { project: 'project', label: 'label', localTime: 'date', mode: 'mode', textTg: 'telegram',
    textVk: 'vk', textIg: 'instagram', photoUrl: 'photo', linkText: 'link-text', linkUrl: 'link-url' };
  const messages = {
    not_authenticated: 'Войдите в админку снова.',
    social_not_configured: 'Очередь AELITA CREW ещё не подключена к админке.',
    crew_upgrade_required: 'Для доступа к очереди нужно обновить веб-приложение AELITA CREW.',
    invalid_project: 'Модуль публикаций у проекта выключен или проект в архиве.',
    bad_project: 'Выберите проект.', bad_label: 'Введите название для очереди.',
    bad_schedule: 'Проверьте дату и время по Москве.', schedule_passed: 'Укажите время в будущем.',
    bad_telegram: 'Сократите текст для Telegram. С фото доступно до 1 024 символов, без фото — до 4 096.',
    bad_vk: 'Проверьте длину текста ВКонтакте.', bad_instagram: 'В подписи Instagram доступно до 2 200 символов.',
    no_text: 'Введите текст хотя бы для одной площадки.',
    bad_photo: 'Укажите публичную HTTPS-ссылку на фото.', instagram_photo_required: 'Для Instagram нужна публичная ссылка на фото.',
    bad_link: 'Укажите HTTPS-адрес и фразу, которая встречается в тексте Telegram ровно один раз.',
    destination_changed: 'У проекта изменился адрес публикации. Откройте предпросмотр снова.',
    preview_required: 'Откройте свежий предпросмотр и проверьте данные.',
    post_conflict: 'Запись уже изменилась. Сверьтесь с очередью.',
    campaign_source_changed: 'Событие изменилось или к дате публикации уже начнётся. Обновите черновик по каталогу или снимите привязку.',
    crew_catalog_unavailable: 'Каталог событий пока недоступен. Попробуйте повторить проверку.',
    post_locked: 'Время публикации наступило или запись уже отправлена. Обновите очередь.',
    crew_store_invalid: 'Хранилище очереди недоступно.',
    crew_store_busy: 'Очередь занята. Попробуйте ещё раз.'
  };
  const time = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Moscow' });
  const queueViews = { queue: 'В очереди', review: 'Требуют сверки', history: 'История', all: 'Все публикации' };
  let draftId = '', review = null, projects = [], listRequest = 0, queuePage = 1;
  let senderStatusRequest = 0;
  let dirty = false, busy = false, editing = null, aiChannel = '', aiDraftId = '', campaignSources = {};

  function token() {
    try { return window.AelitaStaffSession?.read()?.adminToken || localStorage.getItem('aelita_admin_token') || ''; }
    catch (_) { return ''; }
  }

  function node(tag, text, css) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (css) element.className = css;
    return element;
  }

  function status(id, text, error = false) {
    $(id).textContent = text;
    $(id).classList.toggle('ed-error', error);
  }

  function actionError(id, message) {
    status(id, message, true);
    $(id).focus();
  }

  function errorMessage(error) {
    return messages[error.code] || 'Очередь AELITA CREW временно недоступна. Попробуйте обновить раздел.';
  }

  async function api(body) {
    if (!activeToken || token() !== activeToken) throw { code: 'not_authenticated' };
    const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + activeToken }, body: JSON.stringify(body) });
    const data = await response.json();
    if (activeToken !== token()) throw { code: 'not_authenticated' };
    if (!response.ok || data.error) throw { code: data.error };
    return data;
  }

  function setBusy(value) {
    busy = value;
    $('fields').disabled = value;
    $('preview').disabled = value || !projects.length;
    $('schedule').disabled = value;
    $('review-close').disabled = value;
    $('edit-close').disabled = value;
  }

  function date(value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? time.format(parsed) + ' МСК' : 'Время не задано';
  }

  function mode(value) {
    return value === 'auto' ? 'Автоматически' : 'Подтверждение в админке';
  }

  function snapshot() {
    const values = Object.fromEntries(Object.entries(fieldIds).map(([key,id]) => [key, $(id).value]));
    const sources = Object.fromEntries(channels.filter(channel => values[channel.field].trim() && campaignSources[channel.id])
      .map(channel => [channel.id,campaignSources[channel.id]]));
    return { id: draftId, ...(editing ? { revision: editing.revision } : {}), ...values,
      ...(Object.keys(sources).length ? { sources } : {}) };
  }

  function showSourceBindings() {
    const bar = $('campaign-sources');
    const linked = channels.filter(channel=>campaignSources[channel.id]);
    bar.hidden = !linked.length;
    bar.replaceChildren(...linked.map(channel => queueButton('Снять привязку · ' + channel.label, () => {
      delete campaignSources[channel.id];
      dirty = true;
      closeReview();
      showSourceBindings();
    })));
    if (linked.length) bar.prepend(node('p','Проверка события по каталогу включена для выбранных площадок.','ed-note'));
  }

  function closeReview() {
    review = null;
    $('review').hidden = true;
    $('review-body').replaceChildren();
    status('review-status', '');
  }

  function renderReview(data) {
    const { post, targets } = data;
    const rows = [node('p', [data.projectName, date(post.scheduledAt), mode(post.mode)].join(' · '))];
    for (const channel of channels) {
      if (!post[channel.field]) continue;
      const area = node('article', null, 'social-copy');
      area.append(node('h3', channel.label), node('p', targets[channel.target] || 'Аккаунт по умолчанию в AELITA CREW'), node('pre', post[channel.field]));
      rows.push(area);
    }
    if (post.photoUrl) rows.push(node('p', 'Фото · ' + post.photoUrl));
    if (post.linkUrl) rows.push(node('p', 'Ссылка Telegram · «' + post.linkText + '» → ' + post.linkUrl));
    $('review-body').replaceChildren(...rows);
    $('schedule').textContent = editing ? 'Сохранить изменения' : 'Запланировать публикацию';
    $('review').hidden = false;
    $('review').focus();
  }

  function resetDraft() {
    const project = $('project').value;
    $('form').reset();
    $('project').value = project;
    $('project').disabled = false;
    $('form-title').textContent = 'Новая публикация';
    $('edit-close').hidden = true;
    draftId = 'web-' + crypto.randomUUID();
    editing = null;
    dirty = false;
    campaignSources = {};
    showSourceBindings();
    aiDraftId = '';
    closeReview();
    $('ai-result').replaceChildren();
  }

  function fillPost(post, copy = false) {
    if (busy || (dirty && !window.confirm('Заменить текущий черновик текстом из очереди?'))) return;
    resetDraft();
    const p = post.platforms;
    if (!copy) {
      editing = { revision: post.revision };
      draftId = post.id;
      $('form-title').textContent = 'Редактирование публикации';
      $('edit-close').hidden = false;
      $('project').disabled = true;
      $('date').value = new Date(Date.parse(post.scheduledAt) + 3 * 3600_000).toISOString().slice(0, 16);
    }
    $('label').value = post.label;
    $('mode').value = post.mode;
    for (const channel of channels) $(channel.id).value = p[channel.id]?.text || '';
    $('photo').value = (p.telegram || p.vk || p.instagram)?.photoUrl || '';
    $('link-text').value = p.telegram?.linkText || '';
    $('link-url').value = p.telegram?.linkUrl || '';
    campaignSources = { ...(post.sources || {}) };
    showSourceBindings();
    dirty = copy;
    status('form-status', copy ? 'Тексты скопированы в новый черновик. Выберите для него дату.' : 'После правок откройте новый предпросмотр.');
    $('label').focus();
  }

  function queueButton(label, run) {
    const button = node('button', label, 'ed-quiet');
    button.type = 'button';
    button.addEventListener('click', () => run(button));
    return button;
  }

  async function queueChange(button, payload, success = '') {
    button.disabled = true;
    const project = $('project').value;
    try {
      await api(payload);
      if (project === $('project').value) {
        await loadQueue();
        if (success) status('status', success);
      }
    }
    catch (error) { if (project === $('project').value) status('queue-status', errorMessage(error), true); }
    finally { button.disabled = false; }
  }

  function deliveryRow(post, channel) {
    const slot = post.delivery?.channels?.[channel.id];
    const state = post.publishedAt?.[channel.id] ? 'Опубликовано' : {
      sending: 'Идёт отправка', review: 'Требуется сверка', ready: 'Повтор разрешён'
    }[slot?.state] || 'Ожидает отправки';
    const item = node('div', null, 'social-delivery');
    item.append(node('p', channel.label + ' · ' + state));
    if (slot?.url && /^https:\/\/(?:t\.me\/[a-zA-Z0-9_/-]+|vk\.com\/wall-?\d+_\d+)$/.test(slot.url)) {
      const link = node('a', 'Открыть публикацию в ' + channel.label);
      link.href = slot.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      item.append(link);
    }
    if (slot?.state === 'review' && post.status === 'pending') {
      const note = slot.reason === 'event_changed' ? 'Событие изменилось. Подготовьте новый текст по текущему каталогу.' :
        slot.reason === 'destination_unconfigured' ? 'Сначала укажите аккаунт площадки в настройках проекта или воркера.' :
        slot.reason === 'destination_changed' ? 'Адрес проекта изменился. Сверьте настройки AELITA CREW.' :
        slot.reason === 'invalid_media' ? 'Площадке требуется фото.' : 'Проверьте площадку перед выбором действия.';
      item.append(node('p', note, 'ed-note'));
      const actions = node('div', null, 'ed-actions');
      function resolve(decision, button) {
        const existing = decision === 'published';
        if (!window.confirm(existing ? 'Публикация в ' + channel.label + ' уже есть и вы её проверили?' :
          'Вы проверили ' + channel.label + ' и убедились, что публикации там нет?')) return;
        const success = existing ? 'Отметка об отправке сохранена.' : post.mode === 'auto'
          ? 'Повтор для площадки разрешён. Запись подхватит таймер CREW.'
          : 'Повтор для площадки разрешён. Откройте карточку публикации в CREW и подтвердите отправку.';
        queueChange(button, { action:'social_resolve', id:post.id, platform:channel.id, attempt:slot.attempt, decision }, success);
      }
      actions.append(queueButton('Отметить опубликованной', button => resolve('published', button)));
      if (!['invalid_media','event_changed'].includes(slot.reason)) actions.append(queueButton('Разрешить повтор', button => resolve('retry', button)));
      item.append(actions);
    }
    return item;
  }

  function postRow(post) {
    const li = node('li');
    const remaining = channels.filter(ch => post.platforms?.[ch.id] && !post.publishedAt?.[ch.id]);
    const needsReview = Object.values(post.delivery?.channels || {}).some(slot => slot.state === 'review');
    const state = post.status === 'imported' ? 'Из прежней очереди' : post.status === 'skipped' ? 'Отменён' :
      post.status === 'published' ? 'Опубликован' : needsReview ? 'Нужна сверка' :
      remaining.length < channels.filter(ch => post.platforms?.[ch.id]).length ? 'Опубликован частично' : 'В очереди';
    li.append(node('h3', post.label || 'Публикация без названия'),
      node('p', [date(post.scheduledAt), mode(post.mode), state].join(' · ')));
    for (const channel of channels) {
      if (post.platforms?.[channel.id]) li.append(deliveryRow(post, channel));
    }
    if (post.delivery?.available === false) li.append(node('p', messages.post_schema_conflict, 'ed-error'));
    const texts = channels.filter(channel => post.platforms?.[channel.id]?.text);
    if (texts.length) {
      const details = node('details', null, 'social-copy');
      details.append(node('summary', 'Тексты публикации'));
      for (const channel of texts) {
        details.append(node('h4', channel.label), node('pre', post.platforms[channel.id].text));
      }
      li.append(details);
    }
    const actions = node('div', null, 'ed-actions social-queue-actions');
    if (post.editable && Date.parse(post.scheduledAt) > Date.now()) {
      actions.append(queueButton('Редактировать', () => fillPost(post)));
      const cancel = queueButton('Отменить публикацию', button => {
        if (!window.confirm('Отменить «' + (post.label || 'Публикация без названия') + '»?')) return;
        queueChange(button, { action: 'social_cancel', id: post.id, revision: post.revision }, 'Публикация отменена. Запись доступна в истории.');
      });
      actions.append(cancel);
    }
    if (post.awaitingApproval) actions.append(queueButton('Подтвердить отправку', button => {
      if (!window.confirm('Подтвердить отправку «' + (post.label || 'Публикация без названия') + '»?')) return;
      queueChange(button, { action:'social_approve', id:post.id, revision:post.revision }, 'Публикация подтверждена. Запись ждёт отправки в очереди.');
    }));
    if (texts.length) actions.append(queueButton('Скопировать в черновик', () => fillPost(post, true)));
    if (actions.childElementCount) li.append(actions);
    return li;
  }

  async function loadQueue() {
    const project = $('project').value;
    if (!project) return;
    const job = ++listRequest;
    const view = $('queue-view').value;
    status('queue-status', 'Загружаем очередь…');
    try {
      const data = await api({ action: 'social_list', project, view, page: queuePage });
      if (job !== listRequest) return;
      queuePage = data.page || 1;
      $('queue').replaceChildren(...data.posts.map(postRow));
      for (const option of $('queue-view').options) {
        const count = data.counts?.[option.value];
        option.textContent = queueViews[option.value] + (Number.isInteger(count) ? ' (' + count + ')' : '');
      }
      const last = data.pages || 1;
      $('queue-pages').hidden = last <= 1;
      $('queue-prev').disabled = queuePage <= 1;
      $('queue-next').disabled = queuePage >= last;
      $('queue-page').textContent = 'Страница ' + queuePage + ' из ' + last;
      status('queue-status', data.posts.length ? 'Публикаций в разделе: ' + data.total : 'Таких публикаций у проекта пока нет.');
    } catch (error) { if (job === listRequest) status('queue-status', errorMessage(error), true); }
  }

  async function loadWorkerStatus() {
    const job = ++senderStatusRequest;
    const current = () => job === senderStatusRequest && activeToken === token();
    try {
      const { sender } = await api({ action:'social_sender_status' });
      if (!current()) return;
      const checkedTime = Date.parse(sender?.checkedAt);
      if (!Number.isFinite(checkedTime)) {
        status('worker-status', 'Первый запуск отправителя ещё не зарегистрирован. Записи сохраняются в очереди.');
        return;
      }
      const checked = date(sender.checkedAt);
      if (Date.now() - checkedTime >= 5 * 60_000) {
        status('worker-status', 'Отправитель давно не проверял очередь. Последняя проверка — ' + checked + '.', true);
        return;
      }
      const ready = sender?.platforms?.map(id => channels.find(channel => channel.id === id)?.label).filter(Boolean) || [];
      status('worker-status', !sender.enabled ? 'Таймер работает. Отправка выключена. Проверено — ' + checked + '.' :
        ready.length ? 'Отправка включена для площадок: ' + ready.join(', ') + '. Проверено — ' + checked + '.' :
        'Таймер работает. Ключи площадок пока не заданы. Проверено — ' + checked + '.');
    } catch (_) { if (current()) status('worker-status','Статус отправителя недоступен. Обновите очередь, чтобы повторить проверку.', true); }
  }

  function registerWorkGuard() {
    window.AelitaWorkForms?.register('social-posts', { dirty: () => dirty, busy: () => busy, visible: () => !$('app').hidden });
  }

  function initAi() {
    const ai = window.AelitaAI;
    if (!ai) return status('ai-status', 'Модуль черновиков ИИ недоступен.', true);
    const runner = ai.runner({ lang: 'ru', token, status: $('ai-status'), submit: $('ai-submit'),
      cancel: $('ai-cancel'), result: $('ai-result'), readyMessage: 'Варианты готовы. Сверьте текст и выберите нужный.',
      done(result) {
        if (aiDraftId !== draftId) return;
        function insertText(entries) {
          if (busy || activeToken !== token() || aiDraftId !== draftId) return;
          const edited = entries.filter(({channel, value}) => $(channel.id).value && $(channel.id).value !== value);
          if (edited.length && !window.confirm('Заменить текущий текст для ' + edited.map(e=>e.channel.label).join(', ') + '?')) return;
          for (const {channel, value} of entries) {
            $(channel.id).value = value;
            if (aiChannel === 'social_campaign' && result.source) campaignSources[channel.id] = result.source;
            else delete campaignSources[channel.id];
          }
          showSourceBindings();
          $(entries[0].channel.id).dispatchEvent(new Event('input', { bubbles: true }));
          status('status', 'Черновик вставлен. Проверьте тексты перед планированием.');
          $(entries[0].channel.id).focus();
        }
        function previewText(channel, value, title) {
          const article = node('article', null, 'social-copy');
          const insert = node('button', 'Вставить в ' + channel.label, 'ed-quiet');
          insert.type = 'button';
          insert.setAttribute('data-ai-feature', '');
          insert.addEventListener('click', () => insertText([{channel, value}]));
          article.append(node('h3', title), node('pre', value), insert);
          $('ai-result').append(article);
        }
        if (aiChannel === 'social_campaign') {
          const entries = channels.map(channel => ({channel, value: result.campaign?.[channel.id]}));
          if (entries.some(entry => typeof entry.value !== 'string' || !entry.value.trim())) return;
          const all = node('button', 'Вставить все три текста', 'ed-quiet');
          all.type = 'button'; all.setAttribute('data-ai-feature', '');
          all.addEventListener('click', () => insertText(entries));
          $('ai-result').append(all);
          for (const {channel, value} of entries) previewText(channel, value, channel.label);
        } else {
          const channel = channels.find(item => item.id === aiChannel);
          const variants = (result.variants || [result.text]).filter(value => typeof value === 'string' && value.trim());
          variants.forEach((value, index) => previewText(channel, value, channel.label + ' · вариант ' + (index + 1)));
        }
      }
    });

    ai.api({ action: 'ai_capabilities' }, activeToken).then(data => {
      if (activeToken !== token()) return;
      if (!data.configured) throw { code: 'key_not_configured' };
      if (data.features?.socialCampaign === true) {
        $('ai-campaign').hidden = false;
        $('ai-campaign').disabled = false;
      }
      const events = Array.isArray(data.events) ? data.events : [];
      $('ai-event').replaceChildren(...events.map(event => new Option(event.title || event.id, event.id)));
      $('ai-submit').disabled = !events.length;
      if (!events.length) status('ai-status', 'В каталоге пока нет событий для черновика.');
    }).catch(error => { if (activeToken === token()) status('ai-status', ai.message(error.code, 'ru'), true); });

    $('ai-form').addEventListener('submit', event => {
      event.preventDefault();
      if ($('ai-submit').disabled || !$('ai-event').value) return;
      aiChannel = $('ai-channel').value;
      aiDraftId = draftId;
      const include = Array.from($('ai-facts').querySelectorAll('input:checked'), field => field.value)
        .filter(value => aiChannel !== 'instagram' || value !== 'tickets');
      runner.send({ kind: aiChannel, eventId: $('ai-event').value, lang: $('ai-lang').value,
        text: $('ai-wishes').value, settings: { type: $('ai-type').value, length: $('ai-length').value, tone: $('ai-tone').value,
          include } });
    });
  }

  const activeToken = token();
  $('gate').hidden = !!activeToken;
  if (!activeToken) return;
  draftId = 'web-' + crypto.randomUUID();
  $('app').hidden = false;
  registerWorkGuard();
  if (!window.AelitaWorkForms) window.addEventListener('aelita-work-forms-ready', registerWorkGuard, { once: true });

  $('form').addEventListener('input', () => {
    dirty = true;
    closeReview();
    if ($('form-status').classList.contains('ed-error')) status('form-status', '');
  });
  function showFirstPage() {
    queuePage = 1;
    $('queue').replaceChildren();
    $('queue-pages').hidden = true;
    loadQueue();
  }
  $('project').addEventListener('change', showFirstPage);
  $('queue-view').addEventListener('change', showFirstPage);
  $('queue-prev').addEventListener('click', () => { if (queuePage > 1) { queuePage--; loadQueue(); } });
  $('queue-next').addEventListener('click', () => { if (!$('queue-next').disabled) { queuePage++; loadQueue(); } });
  $('reload').addEventListener('click', () => { loadWorkerStatus(); if (projects.length) loadQueue(); else loadProjects(); });
  $('review-close').addEventListener('click', () => { closeReview(); $('preview').focus(); });
  $('edit-close').addEventListener('click', () => {
    if (dirty && !window.confirm('Закрыть редактирование без сохранения?')) return;
    resetDraft();
    status('form-status', '');
    $('label').focus();
  });
  $('form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const post = snapshot();
    closeReview();
    setBusy(true);
    status('form-status', 'Проверяем дату, тексты и площадки…');
    try {
      const data = await api({ action: 'social_preview', post });
      review = { post, preview: data.preview };
      status('form-status', '');
      renderReview(data);
    } catch (error) { actionError('form-status', errorMessage(error)); }
    finally { setBusy(false); }
  });

  $('schedule').addEventListener('click', async () => {
    if (busy || !review) return;
    setBusy(true);
    const wasEditing = !!editing;
    status('review-status', wasEditing ? 'Сохраняем изменения…' : 'Добавляем публикацию в очередь…');
    try {
      await api({ action: 'social_schedule', ...review });
      resetDraft();
      if (!wasEditing) { $('queue-view').value = 'queue'; queuePage = 1; }
      status('form-status', wasEditing ? 'Изменения публикации сохранены.' : 'Публикация добавлена в очередь.');
      $('form-status').focus();
      loadQueue();
    } catch (error) {
      const message = messages[error.code] || 'Ответ очереди потерян. Проверьте список или повторите планирование с этого предпросмотра.';
      const expired = ['destination_changed', 'preview_required', 'schedule_passed', 'invalid_project', 'post_conflict', 'post_locked','campaign_source_changed'].includes(error.code);
      if (expired) closeReview();
      actionError(expired ? 'form-status' : 'review-status', message);
    } finally { setBusy(false); }
  });

  async function loadProjects() {
    $('reload').disabled = true;
    try {
      const data = await api({ action: 'social_projects' });
      projects = data.projects;
      status('status', '');
      $('project').replaceChildren(...projects.map(project => new Option(project.name, project.id)));
      const requested = new URLSearchParams(location.search).get('project');
      if (requested && projects.some(project => project.id === requested)) $('project').value = requested;
      $('preview').disabled = !projects.length;
      if (projects.length) { status('queue-status', ''); await loadQueue(); }
      else status('queue-status', 'Включите публикации в настройках проекта CREW.');
    } catch (error) {
      status('queue-status', errorMessage(error), true);
      if (error.code === 'not_authenticated') { $('app').hidden = true; $('gate').hidden = false; }
      else status('status', errorMessage(error), true);
    }
    finally { $('reload').disabled = false; }
  }

  loadProjects();
  loadWorkerStatus();
  initAi();
})();
