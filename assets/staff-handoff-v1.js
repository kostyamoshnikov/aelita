/*
 * AELITA PRODUCTION · переход «админка ↔ CRM» с адресом почты (pack-v750; ТЗ LINK-04…07).
 *
 * Адрес почты НЕ кладётся ни в ссылку, ни в историю, ни в хранилище браузера (local/session):
 * исходная вкладка открывает вторую (адрес в ссылке — только вид перехода: #handoff=crm_find),
 * вторая вкладка говорит «готова», и первая передаёт адрес сообщением postMessage — только
 * в эту вкладку и только в пределах сайта (origin). Вкладка-получатель стирает #handoff из
 * адреса, держит адрес в памяти и отвязывается от исходной (opener = null).
 * Токены входа не передаются никогда: админка и CRM проверяют каждая свою сессию.
 * Исходную вкладку закрыли или перезагрузили до ответа — получатель скажет «повторите».
 */
(function () {
  'use strict';
  var ORIGIN = location.origin;
  var KINDS = { crm_find: 1, orders_find: 1 };
  var WAIT_MS = 6000, KEEP_MS = 60000;

  function cleanEmail(v) {
    v = String(v == null ? '' : v).trim().toLowerCase();
    return v.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : '';
  }

  /** Исходная вкладка: открыть url и передать адрес, когда она попросит. */
  function open(url, kind, email) {
    if (!KINDS[kind]) return { ok: false, reason: 'kind' };
    email = cleanEmail(email);
    if (!email) return { ok: false, reason: 'email' };
    var w = null;
    try { w = window.open(url + '#handoff=' + kind, '_blank'); } catch (e) { w = null; }
    if (!w) return { ok: false, reason: 'popup' };
    var done = false;
    function on(e) {
      if (done || e.source !== w || e.origin !== ORIGIN) return;
      var d = e.data;
      if (!d || d.type !== 'aelita-handoff-ready' || d.kind !== kind) return;
      done = true;
      window.removeEventListener('message', on);
      try { w.postMessage({ type: 'aelita-handoff', kind: kind, email: email }, ORIGIN); } catch (x) { /* вкладку закрыли */ }
      email = '';
    }
    window.addEventListener('message', on);
    setTimeout(function () { if (!done) { done = true; window.removeEventListener('message', on); email = ''; } }, KEEP_MS);
    return { ok: true };
  }

  /**
   * Вкладка-получатель: если открыта переходом этого вида — получить адрес.
   * cb(email, null) или cb(null, 'no_opener' | 'timeout' | 'bad_email'). Возвращает true, если переход был.
   */
  function receive(kind, cb) {
    var m = /^#handoff=([a-z_]+)$/.exec(location.hash || '');
    if (!m || m[1] !== kind) return false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* без истории — не страшно */ }
    var op = window.opener;
    if (!op) { cb(null, 'no_opener'); return true; }
    var finished = false;
    var timer = setTimeout(function () { finish(null, 'timeout'); }, WAIT_MS);
    function finish(email, err) {
      if (finished) return;
      finished = true; clearTimeout(timer);
      window.removeEventListener('message', on);
      try { window.opener = null; } catch (e) { /* только чтение — не страшно */ }
      cb(email, err);
    }
    function on(e) {
      if (e.source !== op || e.origin !== ORIGIN) return;
      var d = e.data;
      if (!d || d.type !== 'aelita-handoff' || d.kind !== kind) return;
      var email = cleanEmail(d.email);
      finish(email || null, email ? null : 'bad_email');
    }
    window.addEventListener('message', on);
    try { op.postMessage({ type: 'aelita-handoff-ready', kind: kind }, ORIGIN); } catch (e) { finish(null, 'no_opener'); }
    return true;
  }

  var REASONS = {
    email: 'В записи нет корректного адреса почты — искать не по чему.',
    popup: 'Браузер не дал открыть новую вкладку. Разрешите всплывающие окна для этого сайта и нажмите ещё раз.',
    no_opener: 'Адрес не передан: вкладку открыли не кнопкой или исходную уже закрыли. Вернитесь к записи и нажмите кнопку ещё раз.',
    timeout: 'Адрес не передан: исходная вкладка не ответила (её могли закрыть или перезагрузить). Нажмите кнопку ещё раз.',
    bad_email: 'Пришёл некорректный адрес почты. Нажмите кнопку ещё раз.',
  };

  window.AelitaHandoff = { open: open, receive: receive, cleanEmail: cleanEmail, reason: function (r) { return REASONS[r] || 'Не получилось открыть переход. Нажмите ещё раз.'; } };
}());
