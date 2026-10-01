/* pack-v526 (заказчик 28.09): поля телефона на всём сайте сразу
 * заполнены «+7 » — человеку остаётся ввести номер. Префикс можно
 * стереть и написать свой (зарубежный номер): поле его обратно не
 * навязывает.
 *
 * Чтобы не переписывать проверки каждой формы (их больше десяти, и
 * все читают el.value), у поля переопределён геттер value: пока в нём
 * только префикс, скрипты страниц видят пустую строку — «обязательное
 * поле не заполнено», fillIfEmpty (сохранённый телефон в кассе)
 * по-прежнему срабатывает, в необязательных полях не уходит «+7».
 * Запись '' (сброс формы после отправки) возвращает префикс. Для
 * нативной проверки required — setCustomValidity.
 */
(function () {
  var PREFIX = '+7 ';
  var ONLY = /^\s*\+?7?\s*$/;
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  var en = (document.documentElement.lang || '').indexOf('en') === 0;
  function raw(el) { return desc.get.call(el); }
  function syncValidity(el) {
    if (!el.setCustomValidity) return;
    var bare = raw(el) === PREFIX || raw(el) === PREFIX.trim();
    el.setCustomValidity(bare && el.required ? (en ? 'Enter your phone number' : 'Введите номер телефона') : '');
  }
  function enhance(el) {
    if (el.__aelitaPhone) return;
    el.__aelitaPhone = true;
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () {
        var v = raw(this);
        return (v === PREFIX || v === PREFIX.trim()) ? '' : v;
      },
      set: function (v) {
        desc.set.call(this, (v === '' || v == null) ? PREFIX : v);
        syncValidity(this);
      },
    });
    if (raw(el) === '' || ONLY.test(raw(el))) desc.set.call(el, PREFIX);
    syncValidity(el);
    // pack-v540 (перепроверка): человек по привычке набирает номер целиком
    // — «+7 900…» или «8 900…» — поверх готового «+7 ». Получалось
    // «+7 79001112233+» или «+7 89001112233», и форма отклоняла номер как
    // неверный (заметно по журналу незавершённых заказов: bad_phone).
    // Если после префикса стоит «+» или 11 цифр, начинающихся с 7/8, —
    // убираем лишнее. Номер без «+7 » в начале (стёрли префикс, зарубежный)
    // не трогаем.
    el.addEventListener('input', function () {
      var v = raw(el);
      if (v.indexOf(PREFIX) === 0) {
        var rest = v.slice(PREFIX.length);
        var digits = rest.replace(/\D/g, '');
        var fixed = null;
        if (rest.indexOf('+') !== -1) fixed = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : rest.replace(/\+/g, '');
        else if (digits.length === 11 && /^[78]/.test(digits)) fixed = digits.slice(1);
        if (fixed !== null) {
          desc.set.call(el, PREFIX + fixed);
          try { el.setSelectionRange(raw(el).length, raw(el).length); } catch (e) {}
        }
      }
      syncValidity(el);
    });
    // курсор — после «+7 », а не перед ним
    el.addEventListener('focus', function () {
      var v = raw(el);
      if (v === PREFIX) setTimeout(function () { try { el.setSelectionRange(v.length, v.length); } catch (e) {} }, 0);
    });
  }
  function scan(root) {
    (root || document).querySelectorAll('input[type="tel"]').forEach(enhance);
  }
  scan();
  document.addEventListener('DOMContentLoaded', function () { scan(); });
  // поля, которые появляются позже (модальные формы и т.п.)
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el && el.tagName === 'INPUT' && el.type === 'tel') enhance(el);
  });
})();

/* pack-v536 (заказчик 29.09): «чтобы не приходилось лишний раз заполнять».
 * Во всех формах сайта:
 *   — если человек вошёл в личный кабинет, пустые поля имени, почты и
 *     телефона заполняются из профиля (всё можно поправить);
 *   — телефон, введённый один раз, подставляется в любой форме на этом
 *     устройстве (тот же ключ, что у кассы с pack-v442);
 *   — введённый телефон сохраняется в профиль кабинета (если вошёл и он
 *     там другой) — тогда подставится и на другом устройстве.
 * Страницы самого кабинета и админки — со своей логикой, их не трогаем. */
(function () {
  if (/^\/(en\/)?(account|admin)(\/|$)/.test(location.pathname)) return;
  var TOKEN_KEY = 'aelita_account_token', PHONE_KEY = 'aelita_last_phone', CACHE_KEY = 'aelita_me_cache';
  var API = 'https://api.aelita-production.ru/account';
  var profile = null;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function token() { return ls(TOKEN_KEY); }
  function digits(v) { return String(v || '').replace(/\D/g, '').slice(-10); }
  function isName(el) {
    if (el.type !== 'text') return false;
    if (/(org|company|brand|venue|event|project|title|promo|gift|code)/i.test(el.id || '')) return false;
    return el.getAttribute('autocomplete') === 'name' || /(^|[-_])name([-_]|$)/i.test(el.id || '') || /^(fname|subName)$/.test(el.id || '');
  }
  function inputs() { return Array.prototype.slice.call(document.querySelectorAll('input')); }
  function fill() {
    var local = ls(PHONE_KEY);
    inputs().forEach(function (el) {
      if (el.disabled || el.readOnly || el.value) return;
      if (el.type === 'tel') { var p = (profile && profile.phone) || local; if (p) el.value = p; }
      else if (profile && el.type === 'email' && profile.email) el.value = profile.email;
      else if (profile && profile.name && isName(el)) el.value = profile.name;
    });
  }
  function savePhone(v) {
    v = String(v || '').trim();
    if (digits(v).length < 10) return;
    ls(PHONE_KEY, v);
    if (!token() || !profile || digits(profile.phone) === digits(v)) return;
    profile.phone = v;
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
    fetch(API + '/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ phone: v }),
    }).catch(function () {});
  }
  window.AELITA_savePhone = savePhone;
  function loadProfile() {
    var t = token(); if (!t) return Promise.resolve(null);
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.t === t && Date.now() - c.at < 5 * 60 * 1000) return Promise.resolve(c.d);
    } catch (e) {}
    return fetch(API + '/me', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d) { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: t, at: Date.now(), d: { name: d.name || '', email: d.email || '', phone: d.phone || '' } })); } catch (e) {} }
        return d;
      })
      .catch(function () { return null; });
  }
  function start() {
    fill();
    loadProfile().then(function (d) { if (d) { profile = { name: d.name || '', email: d.email || '', phone: d.phone || '' }; fill(); } });
    document.addEventListener('change', function (e) { if (e.target && e.target.type === 'tel') savePhone(e.target.value); });
    // заявки с сайта: телефон из отправленной заявки — в память и профиль
    if (typeof window.AELITA_sendLead === 'function' && !window.AELITA_sendLead.__aelitaWrapped) {
      var orig = window.AELITA_sendLead;
      var wrapped = async function (title, fields) {
        var r = await orig.apply(this, arguments);
        if (r && fields && fields['Телефон']) savePhone(fields['Телефон']);
        return r;
      };
      wrapped.__aelitaWrapped = true;
      window.AELITA_sendLead = wrapped;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
