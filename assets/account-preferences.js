(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var presets = [
    ['Санкт-Петербург', 'Saint Petersburg', 498817], ['Калуга', 'Kaluga', 553915],
    ['Старый Оскол', 'Stary Oskol', 487846], ['Москва', 'Moscow', 524901], ['Казань', 'Kazan', 551487]
  ];
  var selected = null;

  function mount(profile, lang) {
    if (!profile.profilePreferencesAvailable) return;
    var input = $('pf-city'), results = $('pf-city-results'), source = $('pf-city-source'), en = lang === 'en';
    var date = $('pf-birthday'), consent = $('pf-birthday-offers');
    date.max = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
    date.value = profile.birthday || '';
    consent.checked = profile.birthdayOffers === true;
    date.addEventListener('change', function () { if (!date.value) consent.checked = false; });
    selected = profile.city;
    input.value = selected ? selected.name : '';
    $('profile-extras').hidden = false;

    var timer, controller;
    var favourites = presets.map(function (p) { return { name: p[en ? 1 : 0], country: 'RU', id: p[2] }; });
    function draw(places, remote) {
      results.replaceChildren();
      places.forEach(function (place) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'contract-btn';
        b.textContent = [place.name, place.region, place.country].filter(Boolean).join(' · ');
        b.onclick = function () {
          selected = place;
          input.value = place.name;
          results.hidden = true;
          input.focus();
        };
        results.append(b);
      });
      results.hidden = !places.length;
      source.hidden = !remote;
    }
    function suggest() {
      clearTimeout(timer);
      if (controller) controller.abort();
      var query = input.value.trim().toLowerCase();
      var local = favourites.filter(function (place, i) { return presets[i].slice(0,2).some(function (name) { return name.toLowerCase().includes(query); }); });
      draw(local, false);
      if (query.length < 2 || !profile.citySearchAvailable) return;
      timer = setTimeout(async function () {
        var request = new AbortController();
        controller = request;
        try {
          var data = await window.AELITA_account.searchCities(query, request.signal);
          if (request.signal.aborted || input.value.trim().toLowerCase() !== query ||
              (document.activeElement !== input && !results.contains(document.activeElement))) return;
          var remote = (data.places || []).filter(function (place) { return !local.some(function (x) { return x.id === place.id; }); });
          draw(local.concat(remote), remote.length > 0);
        } catch (_) {}
      }, 400);
    }
    input.addEventListener('focus', suggest);
    input.addEventListener('input', function () { selected = null; suggest(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { results.hidden = true; clearTimeout(timer); if (controller) controller.abort(); } });
    input.closest('.profile-extras').addEventListener('focusout', function (e) {
      if (e.relatedTarget !== input && !results.contains(e.relatedTarget)) results.hidden = true;
    });
  }

  function fields() {
    if ($('profile-extras').hidden) return {};
    var name = $('pf-city').value.trim(), birthday = $('pf-birthday').value;
    return { city: selected && selected.name === name ? selected : name, birthday: birthday, birthdayOffers: $('pf-birthday-offers').checked };
  }

  function sticky() {
    var header = document.querySelector('nav .nav-in').closest('nav'), bar = $('accountSectionBar'), rail = bar.querySelector('.acc-nav');
    var arrows = bar.querySelectorAll('.acc-nav-arrow');
    function measure() {
      var top = Math.ceil(header.getBoundingClientRect().height), height = Math.ceil(bar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--cab-header', top + 'px');
      document.documentElement.style.setProperty('--cab-scroll', top + height + 'px');
      arrows[0].hidden = rail.scrollLeft < 4;
      arrows[1].hidden = rail.scrollWidth - rail.clientWidth - rail.scrollLeft < 4;
    }
    arrows.forEach(function (button) {
      button.addEventListener('click', function () { rail.scrollBy({ left: Number(button.dataset.scroll) * rail.clientWidth * .7, behavior: 'smooth' }); });
    });
    measure();
    rail.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(measure);
      observer.observe(header); observer.observe(rail);
    }
    new MutationObserver(measure).observe(rail, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }
  window.AelitaPreferences = { mount: mount, fields: fields, sticky: sticky };
})();
