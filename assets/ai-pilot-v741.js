(function () {
  'use strict';
  var endpoint = 'https://api.aelita-production.ru/ai/pilot';
  var errors = {
    not_authenticated: ['Войдите в личный кабинет, затем вернитесь на эту страницу.', 'Sign in to your account, then return to this page.'],
    not_allowed: ['Доступ открыт только участникам теста из списка администратора.', 'Only approved test participants can use this page.'],
    pilot_disabled: ['Тест пока выключен администратором.', 'The administrator has disabled this test.'],
    key_not_configured: ['Серверный ключ модели ещё не настроен.', 'The server model key has not been configured.'],
    daily_limit: ['Суточный лимит пилота исчерпан. Попробуйте завтра.', 'The test daily limit has been reached. Try tomorrow.'],
    minute_limit: ['Слишком много вопросов подряд. Подождите минуту.', 'Too many questions. Please wait a minute.'],
    provider_busy: ['Модель занята. Попробуйте позже.', 'The model is busy. Please try later.'],
    provider_quota: ['Провайдер ограничил использование. Администратору нужно проверить кабинет Z.ai.', 'The provider has limited usage. The administrator should check Z.ai.'],
    provider_auth: ['Z.ai не принял серверный ключ. Сообщите администратору.', 'Z.ai rejected the server key. Contact the administrator.'],
    provider_timeout: ['Ответ модели не получен вовремя. Запрос не повторяется автоматически.', 'The model response timed out. The request will not be retried automatically.'],
    interrupted: ['Обработка прервалась. Можно задать вопрос заново.', 'Processing was interrupted. You can submit a new question.'],
    config_conflict: ['Настройки уже изменены в другой вкладке. Обновите раздел.', 'Settings changed in another tab. Refresh this section.'],
    bad_config: ['Проверьте настройки и лимиты.', 'Check the settings and limits.'],
    bad_limits: ['Общий лимит: 1–1000; личный: от 1 до общего лимита.', 'Global limit: 1–1000; personal limit: 1 to the global limit.'],
    bad_allowlist: ['Проверьте адреса почты и числовые Telegram ID.', 'Check email addresses and numeric Telegram IDs.'],
    event_unavailable: ['Событие больше не доступно в текущем каталоге. Обновите список.', 'The event is no longer in the current catalog. Refresh the list.'],
    catalog_unavailable: ['Не удалось обновить каталог. Данные о событиях не подставлялись.', 'The event catalog could not be refreshed.'],
    queue_full: ['Тестовая очередь заполнена. Попробуйте позже.', 'The test queue is full. Try later.'],
    already_started: ['Запрос уже начал обрабатываться или завершён.', 'This request has already started or finished.'],
    not_found: ['Запрос не найден или уже истёк. Можно отправить новый.', 'The request was not found or has expired. Submit a new question.'],
    event_required: ['Выберите событие с заполненной карточкой.', 'Select an event with a complete event card.'],
    meaningless_text: ['Уточните пожелания обычными словами или оставьте поле пустым.', 'Use meaningful words for your wishes or leave this field empty.'],
    empty_text: ['Введите вопрос или текст.', 'Enter a question or some text.'],
    text_too_long: ['Текст превышает лимит длины.', 'The text is too long.']
  };
  function message(code, lang) { var a = errors[code]; return a ? a[lang === 'en' ? 1 : 0] : (lang === 'en' ? 'The test could not complete this request. Please try later.' : 'Не удалось выполнить тестовый запрос. Попробуйте позже.'); }
  async function api(body, token) {
    var c = new AbortController(), timer = setTimeout(function () { c.abort(); }, 55000);
    try {
      var res = await fetch(endpoint, { method: 'POST', signal: c.signal, headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }, body: JSON.stringify(body), cache: 'no-store' });
      var data = await res.json();
      if (!res.ok) { var e = new Error(data.error || 'network_error'); e.code = data.error; throw e; }
      return data;
    } catch (e) { if (!e.code) e.code = 'network_error'; throw e; }
    finally { clearTimeout(timer); }
  }
  function link(parent, title, href) {
    try { var u = new URL(href); if (u.origin !== 'https://aelita-production.ru') return; } catch (_) { return; }
    var a = document.createElement('a'); a.textContent = title; a.href = href; parent.appendChild(a);
  }
  function render(parent, r) {
    parent.replaceChildren(); var p = document.createElement('p'); p.textContent = r.text; parent.appendChild(p);
    (r.cards || []).forEach(function (card) { var d = document.createElement('div'); d.className = 'ai-card'; var t = document.createElement('p'); t.textContent = card.text; d.appendChild(t); link(d, card.title, card.url); parent.appendChild(d); });
    (r.links || []).forEach(function (l) { var p = document.createElement('p'); link(p, l.title, l.url); parent.appendChild(p); });
    if (r.totals) { var d = document.createElement('p'); d.className = 'ai-note'; d.textContent = '7 дней: ' + r.totals.views + ' просмотров · ' + r.totals.entries + ' входов · ' + r.totals.notFoundViews + ' просмотров «Не найдено». Это не уникальные посетители.'; parent.appendChild(d); }
  }
  function runner(options) {
    var job = null, active = false;
    var status = options.status, lang = options.lang || 'ru';
    function say(text, bad) { status.textContent = text; status.classList.toggle('ai-error', !!bad); }
    function busy(v) { active = v; options.submit.disabled = v; if (options.cancel) options.cancel.hidden = !v; }
    async function send(body) {
      if (active) return;
      busy(true); options.result.replaceChildren(); say(lang === 'en' ? 'Adding to the test queue…' : 'Добавляем в тестовую очередь…');
      try {
        var data = await api(Object.assign({ action: 'ai_ask', requestId: crypto.randomUUID(), lang: lang }, body), options.token());
        job = data.job;
        var until = Date.now() + 15 * 60000;
        while (job && ['queued', 'running'].includes(job.status) && Date.now() < until) {
          say(job.status === 'running' ? (lang === 'en' ? 'The model is working…' : 'Модель готовит ответ…') : (lang === 'en' ? 'Waiting in the queue. One request runs at a time.' : 'Ожидаем в очереди. Одновременно выполняется один запрос.'));
          await new Promise(function (resolve) { setTimeout(resolve, 2000); });
          data = await api({ action: 'ai_poll', id: job.id }, options.token()); job = data.job;
        }
        if (job.status === 'done') { options.done ? options.done(job.result) : render(options.result, job.result); say(lang === 'en' ? 'Ready. Check the source links.' : 'Готово. Проверьте сведения по ссылкам.'); }
        else if (job.status === 'error') say(message(job.error, lang), true);
        else say(job.status === 'canceled' ? (lang === 'en' ? 'Canceled.' : 'Запрос отменён.') : (lang === 'en' ? 'The request has expired.' : 'Время ожидания истекло.'), false);
      } catch (e) { say(message(e.code, lang), true); }
      finally { busy(false); job = null; }
    }
    if (options.cancel) options.cancel.addEventListener('click', async function () {
      if (!job) return;
      try { var d = await api({ action: 'ai_cancel', id: job.id }, options.token()); job = d.job; say(lang === 'en' ? 'Canceled.' : 'Запрос отменён.'); }
      catch (e) { say(message(e.code, lang), true); }
    });
    return { send: send };
  }
  window.AelitaAI = { api: api, message: message, render: render, runner: runner };
  var form = document.getElementById('ai-question-form');
  if (!form) return;
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
  var status = document.getElementById('ai-status'), submit = document.getElementById('ai-submit');
  var token = function () { try { return localStorage.getItem('aelita_account_token') || ''; } catch (_) { return ''; } };
  var run = runner({ lang: lang, token: token, status: status, submit: submit, cancel: document.getElementById('ai-cancel'), result: document.getElementById('ai-result') });
  form.addEventListener('submit', function (e) { e.preventDefault(); run.send({ kind: 'ask', text: document.getElementById('ai-question').value }); });
  submit.disabled = true;
  if (!token()) { status.textContent = message('not_authenticated', lang); return; }
  api({ action: 'ai_capabilities' }, token()).then(function (d) { if (!d.configured) throw { code: 'key_not_configured' }; submit.disabled = false; status.textContent = lang === 'en' ? 'Test access confirmed.' : 'Доступ к тесту подтверждён.'; }).catch(function (e) { status.textContent = message(e.code, lang); status.classList.add('ai-error'); });
})();
