/* AELITA · separate analytics choice, policy 2026-11-14. No identity/PII stored here. */
(function () {
  'use strict';
  if (window.AelitaCookies) return;
  var KEY = 'aelita_cookie_choice_v1', VERSION = '2026-11-14';
  var TTL = 180 * 86400000, choice = null;
  var EN = /^en/i.test(document.documentElement.lang || '');
  var T = EN ? {
    label: 'Cookie preferences', accept: 'Accept', reject: 'Necessary only',
    text: 'Necessary technologies keep the site and purchases working. Optional Yandex Metrica analytics, including Webvisor, starts only with your consent. Your choice does not affect buying tickets.',
    policy: 'Cookie policy', privacy: 'Privacy policy'
  } : {
    label: 'Настройки cookies', accept: 'Принять', reject: 'Только необходимые',
    text: 'Необходимые технологии обеспечивают работу сайта и покупку. Необязательная аналитика Яндекс.Метрики, включая Вебвизор, включается только с вашего согласия. Ваш выбор не влияет на покупку билетов.',
    policy: 'Соглашение о cookies', privacy: 'Политика конфиденциальности'
  };
  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      var time = v && Date.parse(v.at), now = Date.now();
      return v && v.version === VERSION && typeof v.analytics === 'boolean' &&
        isFinite(time) && time <= now + 60000 && now - time < TTL ? v : null;
    } catch (_) { return null; }
  }
  function mirror() {
    try {
      if (choice && choice.analytics) localStorage.setItem('cookies_accepted', '1');
      else localStorage.removeItem('cookies_accepted');
    } catch (_) { /* storage may be unavailable: this visit still has an explicit choice */ }
  }
  choice = read();
  // An old flag contains neither the current policy nor the date: ask again.
  mirror();
  function hasConsent() { return !!(choice && choice.analytics && Date.now() - Date.parse(choice.at) < TTL); }
  function canTrack() { return hasConsent() && !/^\/(en\/)?(account|admin|ticket|tickets-scan|events-scan|matrix-online|online-invitation)(\/|$)/.test(location.pathname || '/'); }
  function banner() { return document.getElementById('cookie-banner'); }
  function show(on) {
    var b = banner();
    if (!b) return;
    b.hidden = !on;
    b.classList.toggle('hidden', !on);
    b.style.display = on ? 'flex' : 'none';
    window.dispatchEvent(new Event('resize'));
  }
  function clearAnalyticsCookies() {
    try { sessionStorage.removeItem('aelita_sid'); } catch (_) {}
    try {
      document.cookie.split(';').forEach(function (part) {
        var name = part.split('=')[0].trim();
        if (!/^(_ym_|_tmr_|tmr_)/.test(name)) return;
        var host = location.hostname.split('.');
        var domains = [''];
        while (host.length > 1) { domains.push(host.join('.')); host.shift(); }
        domains.forEach(function (domain) {
          document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
        });
      });
    } catch (_) {}
  }
  function choose(analytics) {
    var wasAllowed = hasConsent();
    choice = {version: VERSION, analytics: analytics === true, at: new Date().toISOString()};
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch (_) {}
    mirror();
    show(false);
    window.dispatchEvent(new CustomEvent('aelita:cookie-choice', {detail: {analytics: hasConsent()}}));
    if (wasAllowed && !hasConsent()) {
      // Stop an already running third-party script; new document starts denied.
      try { if (typeof window.ym === 'function') window.ym(104681911, 'destruct'); } catch (_) {}
      clearAnalyticsCookies();
      location.reload();
    }
  }
  function settingsButton() {
    var p = document.createElement('p'), b = document.createElement('button');
    p.className = 'cookie-settings'; b.type = 'button'; b.textContent = T.label;
    b.addEventListener('click', function () { show(true); var first = banner() && banner().querySelector('button'); if (first) first.focus(); });
    p.appendChild(b);
    (document.querySelector('footer') || document.querySelector('.wrap') || document.body).appendChild(p);
  }
  function init() {
    var b = banner();
    if (!b) return;
    b.classList.add('cookie-choice'); b.setAttribute('role', 'region'); b.setAttribute('aria-label', T.label);
    var p = b.querySelector('p');
    if (p) {
      p.textContent = T.text + ' ';
      [['cookies', T.policy], ['privacy', T.privacy]].forEach(function (item, i) {
        if (i) p.appendChild(document.createTextNode(' · '));
        var a = document.createElement('a'); a.href = (EN ? '/en/' : '/') + item[0] + '/'; a.textContent = item[1]; p.appendChild(a);
      });
    }
    var actions = b.querySelector('.cookie-actions');
    if (actions) {
      actions.textContent = '';
      [[false, T.reject], [true, T.accept]].forEach(function (item) {
        var button = document.createElement('button'); button.type = 'button';
        button.className = 'cookie-btn ' + (item[0] ? 'cookie-btn-accept' : 'cookie-btn-more');
        button.textContent = item[1]; button.addEventListener('click', function () { choose(item[0]); }); actions.appendChild(button);
      });
    }
    // Checkout consent stays in the document flow: no payment/keyboard collision.
    var steps = document.getElementById('steps');
    if (document.getElementById('buy-btn') && steps) {
      b.classList.add('cookie-checkout'); steps.insertAdjacentElement('afterend', b);
    }
    settingsButton(); show(!choice);
    window.dispatchEvent(new CustomEvent('aelita:cookie-choice', {detail: {analytics: hasConsent()}}));
  }
  window.AelitaCookies = {hasConsent: hasConsent, canTrack: canTrack, accept: function () { choose(true); }, reject: function () { choose(false); }, open: function () { show(true); }};
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY && event.key !== null) return;
    var wasAllowed = hasConsent(); choice = read(); mirror(); show(!choice);
    window.dispatchEvent(new CustomEvent('aelita:cookie-choice', {detail: {analytics: hasConsent()}}));
    if (wasAllowed && !hasConsent()) { clearAnalyticsCookies(); location.reload(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
