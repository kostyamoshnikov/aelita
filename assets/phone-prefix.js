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
 *   — телефон гостя подставляется в других формах той же вкладки;
 *   — введённый телефон сохраняется в профиль кабинета (если вошёл и он
 *     там другой) — тогда подставится и на другом устройстве.
 * Страницы самого кабинета и админки — со своей логикой, их не трогаем. */
(function () {
  if (/^\/(en\/)?(account|admin)(\/|$)/.test(location.pathname)) return;
  var TOKEN_KEY = 'aelita_account_token', PHONE_KEY = 'aelita_guest_phone_v830', CACHE_KEY = 'aelita_me_cache';
  var API = 'https://api.aelita-production.ru/account';
  var profile = null;
  var profileToken = token();
  var filled = new Map();
  try { localStorage.removeItem('aelita_last_phone'); } catch (e) {}

  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function digits(v) { return String(v || '').replace(/\D/g, '').slice(-10); }
  function isName(el) {
    if (el.type !== 'text') return false;
    if (/(org|company|brand|venue|event|project|title|promo|gift|code)/i.test(el.id || '')) return false;
    return el.getAttribute('autocomplete') === 'name' || /(^|[-_])name([-_]|$)/i.test(el.id || '') || /^(fname|subName)$/.test(el.id || '');
  }
  function ownEmailField(el) {
    return el.type === 'email' && el.id !== 'j-gift-email' && !/^inv-/.test(el.id);
  }
  function fill() {
    if (profileToken !== token()) return;
    var phone = profile && profile.phone;
    if (!profileToken) {
      try { phone = sessionStorage.getItem(PHONE_KEY); } catch (e) {}
    }
    document.querySelectorAll('input').forEach(function (el) {
      if (el.disabled || el.readOnly || el.value || /^inv-/.test(el.id || '')) return;
      var value = el.type === 'tel' ? phone
        : profile && (ownEmailField(el) ? profile.email : isName(el) ? profile.name : '');
      if (value) { el.value = value; filled.set(el, el.value); }
    });
  }
  function savePhone(v, expectedToken = profileToken) {
    v = String(v || '').trim();
    if (digits(v).length < 10 || expectedToken !== token()) return;
    if (!expectedToken) {
      try { sessionStorage.setItem(PHONE_KEY, v); } catch (e) {}
      return;
    }
    if (profileToken === expectedToken && profile && digits(profile.phone) === digits(v)) return;
    if (profileToken === expectedToken && profile) profile.phone = v;
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
    fetch(API + '/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + expectedToken },
      body: JSON.stringify({ phone: v }),
    }).catch(function () {});
  }
  window.AELITA_savePhone = savePhone;

  function loadProfile(t) {
    if (!t) return;
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.t === t && Date.now() - c.at < 5 * 60 * 1000) {
        profile = c.d;
        fill();
        return;
      }
    } catch (e) {}
    fetch(API + '/me', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || t !== token() || t !== profileToken) return;
        profile = { name: d.name || '', email: d.email || '', phone: d.phone || '' };
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: t, at: Date.now(), d: profile })); } catch (e) {}
        fill();
      })
      .catch(function () {});
  }
  function refreshIdentity() {
    var current = token();
    if (profileToken === current) return;
    filled.forEach(function (value, el) { if (el.value === value) el.value = ''; });
    filled.clear();
    profile = null;
    profileToken = current;
    try {
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(PHONE_KEY);
    } catch (e) {}
    loadProfile(current);
  }
  function start() {
    fill();
    loadProfile(profileToken);
    document.addEventListener('change', function (e) {
      if (!token() && e.target && e.target.type === 'tel' && !/^inv-/.test(e.target.id)) savePhone(e.target.value);
    });
    window.addEventListener('storage', function (e) { if (e.key === TOKEN_KEY || e.key === null) refreshIdentity(); });
    window.addEventListener('aelita:account-changed', refreshIdentity);
    window.addEventListener('pageshow', refreshIdentity);
    if (typeof window.AELITA_sendLead === 'function' && !window.AELITA_sendLead.__aelitaWrapped) {
      var orig = window.AELITA_sendLead;
      var wrapped = async function (title, fields) {
        var owner = token();
        var r = await orig.apply(this, arguments);
        if (r && !owner && fields && fields['Телефон']) savePhone(fields['Телефон'], owner);
        return r;
      };
      wrapped.__aelitaWrapped = true;
      window.AELITA_sendLead = wrapped;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
