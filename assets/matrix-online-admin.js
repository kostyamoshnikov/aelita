(function () {
  'use strict';
  var panel = document.getElementById('matrix-online-admin');
  if (!panel) return;
  var cfg = null, pid = 'matritsa-2026-11-14', sel = document.getElementById('pa-perf');
  var field = document.getElementById('online-telemost-url'), msg = document.getElementById('online-admin-msg'), save = document.getElementById('online-admin-save');
  function fmt(iso) { return new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' МСК'; }
  async function call(body) {
    var token = typeof getToken === 'function' ? getToken() : null;
    if (!token) throw new Error('Войдите в админку.');
    var url = 'https://api.aelita-production.ru/admin/performance-action' + (body ? '' : '?online=' + pid);
    var r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, cache: 'no-store', body: body ? JSON.stringify(body) : undefined });
    var d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error === 'bad_telemost_url' ? 'Нужна ссылка встречи: https://telemost.yandex.ru/j/…' : d.error === 'config_changed' ? 'Настройки изменились. Нажмите «Обновить» и повторите.' : 'Не удалось прочитать настройки трансляции. Проверьте обновление функции и соединение.');
    return d;
  }
  async function load() {
    save.disabled = true; msg.textContent = 'Загружаем…';
    try {
      cfg = await call(); field.value = cfg.telemostUrl || '';
      var schedule = document.getElementById('online-mail-schedule'); schedule.replaceChildren();
      (cfg.schedule || []).forEach(function (s, i) { var li = document.createElement('li'); li.textContent = ['За сутки: ', 'За час: ', 'В момент начала: '][i] + fmt(s.at); schedule.appendChild(li); });
      var counts = {}; (cfg.deliveries || []).forEach(function (d) { counts[d.state] = (counts[d.state] || 0) + 1; });
      msg.textContent = (cfg.telemostUrl ? 'Ссылка сохранена.' : 'Добавьте ссылку Телемоста до первой отправки.') + ' Онлайн-билетов: ' + cfg.tickets.online + ', офлайн: ' + cfg.tickets.offline + '. Писем принято сервером: ' + (counts.sent || 0) + (counts.retry || counts.uncertain ? '. Требуют внимания: ' + ((counts.retry || 0) + (counts.uncertain || 0)) + '. Проверьте почтовый журнал и при необходимости перешлите билет из заказа.' : '');
      save.disabled = false;
    } catch (e) { cfg = null; msg.textContent = e.message; }
  }
  function selected() { panel.hidden = sel.value !== pid; if (!panel.hidden) load(); }
  sel.addEventListener('change', selected);
  document.getElementById('online-admin-reload').addEventListener('click', load);
  save.addEventListener('click', async function () {
    if (!cfg) return; save.disabled = true; msg.textContent = 'Сохраняем…';
    try { await call({ action: 'online_save', performance_id: pid, telemost_url: field.value, etag: cfg.etag }); await load(); }
    catch (e) { msg.textContent = e.message; save.disabled = false; }
  });
  selected();
}());
