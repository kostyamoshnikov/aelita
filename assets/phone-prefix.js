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
    el.addEventListener('input', function () { syncValidity(el); });
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
