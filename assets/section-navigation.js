(function () {
  'use strict';
  var mounted = new WeakMap();
  function init(bar) {
    if (!bar) return null;
    if (mounted.has(bar)) return mounted.get(bar);
    var rail = bar.querySelector('[data-section-rail]');
    if (!rail) return null;
    var arrows = bar.querySelectorAll('[data-scroll]');
    var headerIn = document.querySelector('nav .nav-in');
    var header = headerIn && headerIn.closest('nav');
    var track = bar.hasAttribute('data-section-track'), scheduled = false;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function reveal(link) {
      var r = rail.getBoundingClientRect(), a = link.getBoundingClientRect();
      if (a.left < r.left) rail.scrollBy({ left: a.left - r.left - 2, behavior: reduced ? 'auto' : 'smooth' });
      else if (a.right > r.right) rail.scrollBy({ left: a.right - r.right + 2, behavior: reduced ? 'auto' : 'smooth' });
    }
    function updateActive() {
      if (!track) return;
      var links = Array.prototype.filter.call(rail.querySelectorAll('a[href^="#"]'), function (a) {
        var target = document.getElementById(a.getAttribute('href').slice(1));
        return !a.hidden && target && !target.hidden;
      });
      if (!links.length) return;
      var current = links[0], line = bar.getBoundingClientRect().bottom + 24;
      links.forEach(function (a) { if (document.getElementById(a.getAttribute('href').slice(1)).getBoundingClientRect().top <= line) current = a; });
      links.forEach(function (a) {
        var active = a === current, changed = a.classList.contains('is-active') !== active;
        a.classList.toggle('is-active', active);
        if (active) { a.setAttribute('aria-current', 'true'); if (changed) reveal(a); }
        else a.removeAttribute('aria-current');
      });
    }
    function measure() {
      var top = header ? Math.max(0, Math.ceil(header.getBoundingClientRect().bottom)) : 0;
      var height = Math.ceil(bar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--section-nav-top', top + 'px');
      document.documentElement.style.setProperty('--section-nav-offset', top + height + 'px');
      if (arrows[0]) arrows[0].hidden = rail.scrollLeft < 4;
      if (arrows[1]) arrows[1].hidden = rail.scrollWidth - rail.clientWidth - rail.scrollLeft < 4;
      updateActive();
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; measure(); });
    }
    Array.prototype.forEach.call(arrows, function (button) {
      button.addEventListener('click', function () { rail.scrollBy({ left: Number(button.dataset.scroll) * rail.clientWidth * .7, behavior: reduced ? 'auto' : 'smooth' }); });
    });
    rail.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    if (window.ResizeObserver) {
      var resize = new ResizeObserver(schedule);
      if (header) resize.observe(header);
      resize.observe(bar); resize.observe(rail);
    }
    if (window.MutationObserver) new MutationObserver(schedule).observe(rail, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    var controller = { refresh: measure, updateActive: updateActive };
    mounted.set(bar, controller);
    measure();
    return controller;
  }
  window.AelitaSectionNavigation = { init: init };
  function start() { Array.prototype.forEach.call(document.querySelectorAll('[data-section-nav]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
