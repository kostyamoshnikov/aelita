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
  var KINDS = { crm_find: 1, orders_find: 1, crm_task: 1, crm_invite: 1 };
  // pack-v751 (ТЗ TASK-01): черновик задачи из незавершённого заказа — номер попытки, почта (если есть)
  // и короткие сведения о покупке. Только перечисленные поля, строки до 300 знаков.
  var TASK_FACTS = ['title', 'when', 'stage', 'why', 'name', 'phone', 'amount', 'seats', 'attempts'];
  var WAIT_MS = 6000, KEEP_MS = 60000;

  function cleanEmail(v) {
    v = String(v == null ? '' : v).trim().toLowerCase();
    return v.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : '';
  }

  function cleanTask(v) {
    if (!v || typeof v !== 'object') return null;
    var ref = String(v.sourceRef || '');
    if (!/^checkout:[a-f0-9]{24}$/.test(ref)) return null;
    var facts = {}, f = v.facts && typeof v.facts === 'object' ? v.facts : {};
    TASK_FACTS.forEach(function (k) { if (f[k] != null && String(f[k]).trim()) facts[k] = String(f[k]).trim().slice(0, 300); });
    var acc = cleanEmail(v.accountEmail);
    return { sourceRef: ref, email: cleanEmail(v.email), accountEmail: acc, facts: facts };
  }
  function cleanInvite(v) { return v && /^[A-Za-z0-9_-]{1,160}\/[a-f0-9]{12}\.json$/.test(v.key||'') ? {key:v.key} : null; }
  function cleanPayload(kind, v) { if(kind==='crm_invite')return cleanInvite(v); return kind === 'crm_task' ? cleanTask(v) : (cleanEmail(v) || null); }

  /** Исходная вкладка: открыть url и передать данные (адрес или черновик задачи), когда она попросит. */
  function open(url, kind, data) {
    if (!KINDS[kind]) return { ok: false, reason: 'kind' };
    var email = cleanPayload(kind, data);
    if (!email) return { ok: false, reason: kind === 'crm_task' ? 'source' : 'email' };
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
      var got = cleanPayload(kind, d.email);
      finish(got || null, got ? null : 'bad_email');
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
    source: 'У записи нет устойчивого номера попытки — обновите список в админке и нажмите ещё раз.',
  };

  window.AelitaHandoff = { open: open, receive: receive, cleanEmail: cleanEmail, cleanTask: cleanTask, reason: function (r) { return REASONS[r] || 'Не получилось открыть переход. Нажмите ещё раз.'; } };
}());
