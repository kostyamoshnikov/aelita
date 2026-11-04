/* AELITA PRODUCTION · optional, nonmodal newsletter invitation.
 * Source: _tools/Newsletter/. Rebuild: python3 _tools/Newsletter/install_invite.py
 * No requests, analytics, email storage, automatic consent or subscription.
 */
(function () {
  'use strict';
  if (window.__aelitaNewsletterInvite) return;
  window.__aelitaNewsletterInvite = true;
  var CONFIG = {"enabled":true,"reading_seconds":45,"scroll_percent":40,"settle_seconds":3,"shown_cooldown_days":7,"dismissed_cooldown_days":30,"submitted_cooldown_days":180,"routes":["/","/projects/","/about/","/team/","/rezidents/","/iov/","/porfiriy/","/listen/","/stories/","/instruction/","/jazz-dance/","/human/","/katya-abdulova/","/films/matritsa/","/press/"]};
  var KEY = 'aelita_news_invite_v1', SESSION = 'aelita_news_invite_session_v1';
  var DAY = 86400000, card = null, retired = false, timer = null;
  var EN = /^en\b/i.test(document.documentElement.lang);
  var storeOK = true;

  function read() {
    try {
      var raw = localStorage.getItem(KEY), value = raw ? JSON.parse(raw) : {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('preference');
      ['shownAt', 'deferredAt', 'submittedAt'].forEach(function (k) {
        if (value[k] !== undefined && (!Number.isFinite(value[k]) || value[k] < 0)) throw new Error('timestamp');
      });
      return value;
    } catch (e) { storeOK = false; return {}; }
  }
  function remember(field) {
    var state = read();
    if (!storeOK) return false;
    state[field] = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { storeOK = false; return false; }
  }
  function recent(state, field, days) {
    return !!state[field] && Date.now() - state[field] < days * DAY;
  }
  function suppressed() {
    var state = read();
    try { if (sessionStorage.getItem(SESSION)) return true; }
    catch (e) { storeOK = false; }
    return !storeOK || recent(state, 'shownAt', CONFIG.shown_cooldown_days) ||
      recent(state, 'deferredAt', CONFIG.dismissed_cooldown_days) ||
      recent(state, 'submittedAt', CONFIG.submitted_cooldown_days);
  }
  function stop() {
    retired = true;
    clearInterval(timer);
    timer = null;
    if (observer) observer.disconnect();
    if (card) { card.remove(); card = null; }
  }
  function submitted() {
    remember('submittedAt');
    stop();
  }
  // Adapt the existing form result; preserve its arguments, return value,
  // retry/idempotency flow, validation, consent and double opt-in backend.
  // Only a successful newsletter request counts, never a general enquiry.
  var original = window.AELITA_sendLead;
  if (typeof original === 'function') {
    window.AELITA_sendLead = async function (name, fields, options) {
      var result = await original.apply(this, arguments);
      if (result === true && options && options.newsletter === true) {
        window.dispatchEvent(new CustomEvent('aelita:newsletter-submitted'));
      }
      return result;
    };
  }
  window.addEventListener('aelita:newsletter-submitted', submitted);

  var route = location.pathname.replace(/\/index\.html$/, '/').replace(/^\/en(?=\/|$)/, '');
  route = '/' + route.replace(/^\/+|\/+$/g, '');
  if (route !== '/') route += '/';
  // The module also runs on native newsletter form pages to remember a
  // successful request. It never invites on these unless explicitly allowed.
  if (!CONFIG.enabled || CONFIG.routes.indexOf(route) === -1 || suppressed()) return;
  try {
    // Check write access, too. With unavailable storage, fail quietly rather
    // than nag on every page; no identifier or browsing history is stored.
    localStorage.setItem(KEY, JSON.stringify(read()));
    sessionStorage.setItem(SESSION, 'probe');
    sessionStorage.removeItem(SESSION);
  } catch (e) { return; }
  if (!storeOK) return;

  var elapsed = 0, last = performance.now(), lastScroll = last, lastBlocked = last;
  var scrolled = false, initialY = window.scrollY, wasReadable = false;
  var observer = null;
  var BLOCKERS = '#cookie-banner, #mMenu.open, .thanks-modal.open, dialog[open], ' +
    '[aria-modal="true"]:not(#mMenu), #ios-hint, #mob-cta:not(.hidden), #tg-widget.visible, ' +
    '#back-to-top.visible, [data-newsletter-invite-block], #subscribe, footer';
  function visible(el) {
    if (!el || el.hidden) return false;
    var r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight &&
        r.right > 0 && r.left < window.innerWidth)) return false;
    for (var node = el; node && node.nodeType === 1; node = node.parentElement) {
      var s = getComputedStyle(node);
      if (node.hidden || s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    }
    return true;
  }
  function blocked() {
    if (document.hidden || document.documentElement.classList.contains('a11y') ||
        window.innerWidth < 320 || window.innerHeight < 560) return true;
    if (window.visualViewport && window.visualViewport.height < window.innerHeight * 0.75) return true;
    var focus = document.activeElement;
    if (focus && focus.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return true;
    return Array.prototype.some.call(document.querySelectorAll(BLOCKERS), visible);
  }
  function engaged() {
    var distance = document.documentElement.scrollHeight - window.innerHeight;
    return distance > 100 && scrolled && window.scrollY / distance * 100 >= CONFIG.scroll_percent;
  }
  function dismiss() {
    remember('deferredAt');
    var hadFocus = card && card.contains(document.activeElement);
    stop();
    // Do not leave keyboard focus on a removed control. Return to the
    // reading location only after an explicit keyboard/button dismissal.
    if (hadFocus) {
      var main = document.querySelector('main') || document.body;
      var old = main.getAttribute('tabindex');
      main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true });
      main.addEventListener('blur', function () {
        if (old === null) main.removeAttribute('tabindex'); else main.setAttribute('tabindex', old);
      }, { once: true });
    }
  }
  function build() {
    var el = document.createElement('section');
    el.id = 'aelita-news-invite'; el.className = 'ani';
    el.setAttribute('role', 'region'); el.setAttribute('aria-labelledby', 'ani-title');
    el.style.visibility = 'hidden';
    el.innerHTML = EN
      ? '<button class="ani-close" type="button" aria-label="Close newsletter invitation">×</button>' +
        '<p class="ani-brand">AELITA PRODUCTION</p><h2 id="ani-title">Stay close to what’s next</h2>' +
        '<p class="ani-copy">Performances, encounters and behind the scenes — in Aelita’s emails.</p>' +
        '<div class="ani-actions"><a class="ani-link" href="/en/#subscribe">Subscribe</a>' +
        '<button class="ani-later" type="button">Not now</button></div>'
      : '<button class="ani-close" type="button" aria-label="Закрыть предложение подписки">×</button>' +
        '<p class="ani-brand">АЭЛИТА ПРОДАКШЕН</p><h2 id="ani-title">Не пропустить новое</h2>' +
        '<p class="ani-copy">Показы, встречи и закулисье — в письмах Аэлиты.</p>' +
        '<div class="ani-actions"><a class="ani-link" href="/#subscribe">Подписаться</a>' +
        '<button class="ani-later" type="button">Не сейчас</button></div>';
    el.querySelector('.ani-close').addEventListener('click', dismiss);
    el.querySelector('.ani-later').addEventListener('click', dismiss);
    el.querySelector('.ani-link').addEventListener('click', function (event) {
      // Normal links preserve opening in a new tab. A local anchor uses
      // native smooth scrolling; the existing form alone submits the data.
      remember('deferredAt');
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 &&
          (location.pathname === '/' || /^\/en\/?$/.test(location.pathname) || /^(\/en)?\/index\.html$/.test(location.pathname))) {
        var section = document.getElementById('subscribe');
        if (section) {
          event.preventDefault(); stop();
          history.replaceState(null, '', location.pathname + location.search + '#subscribe');
          section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
          section.setAttribute('tabindex', '-1'); section.focus({ preventScroll: true });
          section.addEventListener('blur', function () { section.removeAttribute('tabindex'); }, { once: true });
          return;
        }
      }
      stop();
    });
    document.body.appendChild(el);
    return el;
  }
  function room(el) {
    var r = el.getBoundingClientRect();
    // Also fail closed if styles are blocked/unavailable or zoom makes
    // the card too tall. It must remain a small banner on mobile.
    if (getComputedStyle(el).position !== 'fixed' || r.height > innerHeight * 0.35 ||
        r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight) return false;
    return !Array.prototype.some.call(document.querySelectorAll('a,button,input,select,textarea,summary,[role="button"]'), function (control) {
      if (el.contains(control) || !visible(control)) return false;
      var b = control.getBoundingClientRect();
      // A whole project card is a large link, not a small action button.
      // Its remaining area stays clickable; protect compact controls below.
      if (control.tagName === 'A' && b.height > r.height * 2 && b.width >= r.width * 0.75) return false;
      var area = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)) *
        Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top));
      return area > 0 && area / (b.width * b.height) >= 0.15;
    });
  }
  function tick() {
    var now = performance.now(), delta = Math.max(0, Math.min(1000, now - last));
    last = now;
    var busy = blocked();
    if (card) { if (busy) stop(); return; }
    if (retired) return;
    if (busy) lastBlocked = now;
    if (!busy && wasReadable) elapsed += delta;
    wasReadable = !busy;
    if (elapsed < CONFIG.reading_seconds * 1000 || !engaged() || busy ||
        now - Math.max(lastScroll, lastBlocked) < CONFIG.settle_seconds * 1000) return;
    if (suppressed()) { stop(); return; }
    var el = build();
    if (!room(el)) { el.remove(); return; }
    if (!remember('shownAt')) { el.remove(); stop(); return; }
    try { sessionStorage.setItem(SESSION, '1'); } catch (e) { el.remove(); stop(); return; }
    card = el; el.style.visibility = '';
  }
  addEventListener('scroll', function () {
    if (retired) return;
    lastScroll = performance.now();
    if (Math.abs(window.scrollY - initialY) >= 80) scrolled = true;
    // Protect controls and forms immediately, not just at the next tick.
    if (card && (blocked() || !room(card))) stop();
  }, { passive: true });
  document.addEventListener('focusin', function () { if (card && blocked()) stop(); });
  document.addEventListener('visibilitychange', function () {
    last = performance.now(); wasReadable = false;
    if (card && document.hidden) stop();
  });
  document.addEventListener('keydown', function (event) {
    if (card && event.key === 'Escape' && !blocked()) { event.preventDefault(); dismiss(); }
  });
  addEventListener('resize', function () { if (card && (blocked() || !room(card))) stop(); });
  addEventListener('storage', function (event) {
    if ((event.key === KEY || event.key === null) && suppressed()) stop();
  });
  addEventListener('pagehide', stop);
  // Mutation checks are coalesced to a frame so native menus/modal dialogs
  // take priority immediately, without observing text or collecting data.
  if (window.MutationObserver) {
    var scheduled = false;
    observer = new MutationObserver(function () {
      if (!card || scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; if (card && blocked()) stop(); });
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'hidden'], childList: true });
  }
  timer = setInterval(tick, 500);
})();
