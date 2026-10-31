(function () {
  'use strict';
  var en = document.documentElement.lang === 'en', current = 'offline', active = null;
  var text = en ? {
    legend: 'How would you like to join?', offline: 'Offline · Kaluga', online: 'Online · Telemost',
    closed: 'The room is sold out. Online tickets are available.',
    hint: 'Both options cost 1,000 ₽. You can change an offline ticket to online in your account until ',
    onlineNote: 'Online stream · 1,000 ₽ per ticket', offlineNote: 'Offline · 1,000 ₽ per ticket',
  } : {
    legend: 'Как будете участвовать?', offline: 'Офлайн · Калуга', online: 'Онлайн · Телемост',
    closed: 'Места в зале закончились. Доступны онлайн-билеты.',
    hint: 'Оба формата — 1 000 ₽. Перевести офлайн-билет в онлайн можно в кабинете до ',
    onlineNote: 'Онлайн-трансляция · 1 000 ₽ за билет', offlineNote: 'Офлайн · 1 000 ₽ за билет',
  };
  function date(iso) { return new Date(iso).toLocaleString(en ? 'en-GB' : 'ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + (en ? ' MSK' : ' МСК'); }
  function supported(d) { return !!(d && d.attendance && d.attendance.enabled && d.seating === 'general'); }
  function set(d, mode) {
    if (!supported(d)) return;
    current = mode === 'online' || d._offlineLeft === 0 ? 'online' : 'offline';
    d.left = current === 'online' ? null : d._offlineLeft;
    document.querySelectorAll('input[name="attendance-mode"]').forEach(function (r) { r.checked = r.value === current; });
    note(d);
  }
  function note(d) {
    if (!supported(d)) return;
    var n = document.getElementById('qty-note');
    if (n) n.textContent = current === 'online' ? text.onlineNote : text.offlineNote;
    var m = document.getElementById('meta');
    if (m && d._attendanceMeta) m.textContent = current === 'online' ? date(d.datetime) + ' · ' + (en ? 'Online · Yandex Telemost' : 'Онлайн · Яндекс Телемост') + ' · ' + d.ageRating : d._attendanceMeta;
    var sum = document.getElementById('step2-sum-text');
    if (sum && !sum.querySelector('[data-attendance-summary]')) {
      var s = document.createElement('span'); s.dataset.attendanceSummary = '1'; s.textContent = ' · ' + (current === 'online' ? text.online : text.offline); sum.appendChild(s);
    }
  }
  function mount(d, desired, changed) {
    if (!supported(d)) return;
    active = d; d._offlineLeft = d.left;
    var brand = document.createElement('p'); brand.className = 'att-checkout-brand'; brand.textContent = en ? 'AELITA PRODUCTION' : 'АЭЛИТА ПРОДАКШЕН'; document.getElementById('title').before(brand);
    var host = document.getElementById('general-block'), fs = document.createElement('fieldset');
    fs.className = 'att-choice'; fs.id = 'attendance-choice';
    var legend = document.createElement('legend'); legend.textContent = text.legend; fs.appendChild(legend);
    var options = document.createElement('div'); options.className = 'att-options';
    ['offline', 'online'].forEach(function (mode) {
      var label = document.createElement('label'), radio = document.createElement('input'), span = document.createElement('span');
      radio.type = 'radio'; radio.name = 'attendance-mode'; radio.value = mode; radio.disabled = mode === 'offline' && d._offlineLeft === 0;
      span.textContent = text[mode]; label.append(radio, span); options.appendChild(label);
      radio.addEventListener('change', function () { set(d, mode); if (changed) changed(); });
    });
    fs.appendChild(options);
    var hint = document.createElement('p'); hint.className = 'att-hint';
    hint.textContent = d._offlineLeft === 0 ? text.closed : text.hint + date(d.attendance.switchUntil) + '.';
    fs.appendChild(hint); host.prepend(fs); set(d, desired);
  }
  window.AelitaAttendance = { mount: mount, set: set, supported: supported, note: note, mode: function () { return active ? current : 'offline'; }, meta: function (d) { if (supported(d)) { d._attendanceMeta = document.getElementById('meta').textContent; note(d); } } };
}());
