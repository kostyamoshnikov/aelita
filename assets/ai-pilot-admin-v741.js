(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, revision = 'new', bound = false, available = false, explaining = false;
  var draftKinds = ['newsletter', 'telegram', 'vk', 'press', 'ad_public'];
  function token() { try { return localStorage.getItem('aelita_admin_token') || ''; } catch (_) { return ''; } }
  function api(b) { return window.AelitaAI.api(b, token()); }
  function split(s) { return s.split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function status(text, bad) { $('ai-admin-status').textContent = text; $('ai-admin-status').classList.toggle('ai-error', !!bad); }
  async function diagnostics() {
    var d = await api({ action: 'ai_diagnostics' });
    $('ai-admin-diag').textContent = 'За ' + d.day + ' (МСК): ' + d.today + ' тестовых запросов.\nВ очереди: ' + d.queued + '. Обрабатывается: ' + d.running + '.\n' + d.recent.map(function (j) { return new Date(j.createdAt).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' · ' + j.kind + ' · ' + j.channel + ' · ' + j.status + (j.error ? ' · ' + j.error : '') + (j.delivery ? ' · Telegram: ' + j.delivery : ''); }).join('\n');
  }
  function bind() {
    if (bound) return; bound = true;
    var run = window.AelitaAI.runner({ token: token, status: $('ai-draft-status'), submit: $('ai-draft-submit'), cancel: $('ai-draft-cancel'), result: $('ai-draft-sources'),
      done: function (r) { var box=$('ai-draft-variants');box.replaceChildren();(r.variants||[r.text]).forEach(function(text,i){var card=document.createElement('section');card.className='ai-card';var h=document.createElement('h3');h.textContent='Вариант '+(i+1);var p=document.createElement('p');p.textContent=text;p.style.whiteSpace='pre-wrap';var count=document.createElement('small');count.textContent=Array.from(text).length+' знаков';var copy=document.createElement('button');copy.type='button';copy.textContent='Скопировать';copy.onclick=async function(){try{await navigator.clipboard.writeText(text);copy.textContent='Скопировано';}catch(_){$('ai-draft-output').value=text;$('ai-draft-output').focus();$('ai-draft-output').select();}};card.append(h,p,count,copy);box.append(card);});$('ai-draft-output').value = r.text; $('ai-draft-copy').disabled = false; window.AelitaAI.render($('ai-draft-sources'), Object.assign({}, r, { text: r.draft ? 'Факты из карточки события:' : r.text })); diagnostics().catch(function () {}); } });
    function kindChanged() {
      var kind = $('ai-draft-kind').value, draft = draftKinds.includes(kind);
      $('ai-draft-presets').hidden = !draft;
      $('ai-draft-include').hidden = !draft;
      $('ai-draft-input').required = ['shorten', 'translate', 'ask'].includes(kind);
      $('ai-draft-input-label').textContent = $('ai-draft-input').required ? 'Текст' : 'Пожелания · необязательно';
      $('ai-draft-event').disabled = kind === 'stats';
      $('ai-draft-event').required = ['newsletter','telegram','vk'].includes(kind);
      $('ai-draft-submit').disabled = explaining || (kind !== 'stats' && !available);
      $('ai-draft-submit').textContent = kind === 'stats' ? 'Объяснить посещаемость' : 'Подготовить';
    }
    $('ai-draft-kind').addEventListener('change', kindChanged);
    $('ai-draft-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      if ($('ai-draft-submit').disabled) return;
      var kind = $('ai-draft-kind').value, lang = $('ai-draft-lang').value;
      $('ai-draft-output').value = '';
      $('ai-draft-copy').disabled = true;
      $('ai-draft-variants').replaceChildren();
      if (kind === 'stats') {
        explaining = true; kindChanged();
        $('ai-draft-sources').replaceChildren();
        var note = $('ai-draft-status'), currentToken = token();
        note.classList.remove('ai-error');
        note.textContent = 'Считаем посещения за выбранный период…';
        try {
          var report = await api({ action: 'ai_stats_summary', lang: lang, days: Number($('statisticsDays').value) || 7 });
          if (currentToken !== token()) return;
          $('ai-draft-output').value = report.text;
          $('ai-draft-copy').disabled = false;
          note.textContent = 'Готово. Сводка из статистики сайта.';
        } catch (err) {
          note.textContent = 'Не удалось прочитать статистику. Попробуйте ещё раз.';
          note.classList.add('ai-error');
        } finally { explaining = false; kindChanged(); }
        return;
      }
      await run.send({ kind: kind, lang: lang, eventId: $('ai-draft-event').value, text: $('ai-draft-input').value.trim(),
        ...(draftKinds.includes(kind) ? {settings:{type:$('ai-draft-type').value,length:$('ai-draft-length').value,tone:$('ai-draft-tone').value,include:Array.from(document.querySelectorAll('#ai-draft-include input:checked')).map(function(input){return input.value;})}} : {}) });
      kindChanged();
    });
    kindChanged();
    $('ai-draft-more').onclick=function(){$('ai-draft-form').requestSubmit();};
    $('ai-admin-save').addEventListener('click', async function () {
      $('ai-admin-save').disabled = true; status('Сохраняем…');
      try { await api({ action: 'ai_config_save', revision: revision, config: { enabled: $('ai-admin-enabled').checked, emails: split($('ai-admin-emails').value), telegramIds: split($('ai-admin-telegram').value), dailyMax: Number($('ai-admin-daily').value), userDailyMax: Number($('ai-admin-user-daily').value) } }); await load(); }
      catch (e) { status(window.AelitaAI.message(e.code, 'ru'), true); }
      finally { $('ai-admin-save').disabled = false; }
    });
    $('ai-admin-refresh').addEventListener('click', function () { load(); });
    $('ai-draft-copy').addEventListener('click', async function () { try { await navigator.clipboard.writeText($('ai-draft-output').value); $('ai-draft-status').textContent = 'Скопировано. Проверьте текст перед использованием.'; } catch (_) { $('ai-draft-output').focus(); $('ai-draft-output').select(); $('ai-draft-status').textContent = 'Текст выделен — скопируйте вручную.'; } });
  }
  async function load() {
    if (!$('ai-admin-root') || !window.AelitaAI) return;
    bind(); status('Читаем настройки пилота…');
    try {
      var d = await api({ action: 'ai_config_get' }); revision = d.revision;
      $('ai-admin-enabled').checked = d.value.enabled;
      $('ai-admin-emails').value = d.value.emails.join('\n'); $('ai-admin-telegram').value = d.value.telegramIds.join('\n');
      $('ai-admin-daily').value = d.value.dailyMax; $('ai-admin-user-daily').value = d.value.userDailyMax;
      available = d.effectiveEnabled && d.keyConfigured;
      status(d.model + ' · одновременно: 1 · ключ: ' + (d.keyConfigured ? 'задан' : 'не задан') + ' · пилот: ' + (d.effectiveEnabled ? 'включён' : 'выключен'));
      $('ai-draft-kind').dispatchEvent(new Event('change'));
      var select = $('ai-draft-event'); select.replaceChildren(); var base = document.createElement('option'); base.value = ''; base.textContent = 'Без привязки к событию'; select.appendChild(base);
      if (available) { var c = await api({ action: 'ai_capabilities' }); (c.events || []).forEach(function (ev) { var o = document.createElement('option'); o.value = ev.id; o.textContent = ev.title; select.appendChild(o); }); }
      await diagnostics();
    } catch (e) { status(window.AelitaAI.message(e.code, 'ru'), true); available = false; $('ai-draft-kind').dispatchEvent(new Event('change')); }
  }
  window.AelitaAiPilotAdmin = { load: load };
  if (document.querySelector('[data-adm-tab-btn="ai"].on')) load();
})();
