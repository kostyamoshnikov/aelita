// AELITA PRODUCTION — отзывы зрителей.
// Один модуль на все страницы спектаклей: рендерит уже опубликованные
// отзывы (fetch к Code.gs-веб-приложению, см. _tools/Reviews/) и
// отправляет новые через форму. Каждая страница спектакля просто
// вызывает AelitaReviews.init('slug-спектакля') один раз.
//
// С автопубликацией (см. _tools/Reviews/README.md, портировано из
// ReviewsBot Николая Балашова, pack-v70): чистый по спам-фильтру
// отзыв публикуется сразу на бэкенде, подозрительный — ждёт ручной
// модерации. Ответ Apps Script непрозрачен для fetch() без preflight
// (см. комментарий ниже про бэклог) — клиент не может достоверно
// узнать, какой из двух случаев произошёл, поэтому текст «спасибо»
// намеренно не утверждает ни того, ни другого.

(function () {
  'use strict';

  // Заполняется после деплоя веб-приложения (_tools/Reviews/Code.gs) —
  // см. _tools/Reviews/README.md, шаг 4.
  var REVIEWS_API_URL = 'https://script.google.com/macros/s/ВСТАВЬТЕ_ID_ПОСЛЕ_ДЕПЛОЯ/exec';

  // ── Подстраховка на случай недоступности Apps Script (pack-v111) ──
  // Ответ Apps Script Web App непрозрачен для fetch() без preflight
  // (см. комментарий у самой отправки ниже) — отличить «дошло, но
  // Apps Script упал внутри» от «дошло и всё нормально» с клиента
  // нельзя. НО полный сетевой отказ (adres недоступен, DNS, оффлайн)
  // — отличим: fetch() в этом случае РЕЖЕКТИТСЯ, не просто даёт
  // непрозрачный ответ. Именно эту, самую частую причину «таблица не
  // подключена» (опечатка в URL, деплой ещё не сделан, временно
  // недоступен) и подстраховываем: при сетевом отказе — сохраняем
  // отзыв в localStorage вместо того, чтобы потерять его молча;
  // при следующем заходе на любую страницу спектакля с отзывами —
  // пробуем дослать то, что скопилось (до 10 последних).
  var REVIEWS_BACKLOG_KEY = 'aelita_reviews_backlog';
  var REVIEWS_BACKLOG_MAX = 10;

  function reviewsBacklogGet() {
    try { return JSON.parse(localStorage.getItem(REVIEWS_BACKLOG_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function reviewsBacklogSet(list) {
    try { localStorage.setItem(REVIEWS_BACKLOG_KEY, JSON.stringify(list)); }
    catch (e) { /* localStorage может быть недоступен (приватный режим и т.п.) — тихо игнорируем */ }
  }
  function reviewsBacklogPush(payload) {
    var list = reviewsBacklogGet();
    list.push({ payload: payload, ts: Date.now() });
    while (list.length > REVIEWS_BACKLOG_MAX) list.shift();
    reviewsBacklogSet(list);
  }
  // Пробует дослать всё, что скопилось, старое → новое, останавливаясь
  // на первом же сетевом отказе (значит по-прежнему недоступно — нет
  // смысла долбить остальное в эту же попытку).
  function reviewsBacklogFlush() {
    var list = reviewsBacklogGet();
    if (!list.length) return;
    var i = 0;
    function next() {
      if (i >= list.length) { reviewsBacklogSet([]); return; }
      fetch(REVIEWS_API_URL, { method: 'POST', body: JSON.stringify(list[i].payload) })
        .then(function () { i++; next(); })
        .catch(function () { reviewsBacklogSet(list.slice(i)); }); // недосланное — оставляем в очереди
    }
    next();
  }
  reviewsBacklogFlush(); // пробуем при каждой загрузке страницы с отзывами

  // Тот же вебхук, что уже использует сайт для остальных форм —
  // мгновенное уведомление админам прямо с фронтенда (Code.gs шлёт то
  // же самое вторым, серверным путём, см. комментарий в Code.gs).
  var TG_WORKER = 'https://withered-glade-64b6.kostyamoshnikov.workers.dev';

  var LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';

  var TEXT = {
    ru: {
      empty: 'Пока нет опубликованных отзывов — станьте первым.',
      loading: 'Загружаем отзывы…',
      formTitle: 'Оставить отзыв',
      namePh: 'Ваше имя',
      textPh: 'Что вам запомнилось?',
      consent: 'Согласен(на) на публикацию отзыва на сайте',
      pdConsent: 'Согласен(на) на обработку персональных данных',
      submit: 'Отправить отзыв',
      sending: 'Отправляем…',
      thanksTitle: 'Спасибо!',
      thanksBody: 'Отзыв отправлен. Если в нём не нашлось признаков спама — он уже опубликован, иначе появится после проверки.',
      errName: 'Укажите имя',
      errText: 'Текст отзыва — от 10 до 2000 символов',
      errRating: 'Поставьте оценку',
      errConsent: 'Нужно согласие на публикацию',
      errPdConsent: 'Нужно согласие на обработку персональных данных',
      errNetwork: 'Не получилось отправить — попробуйте ещё раз чуть позже.',
    },
    en: {
      empty: 'No published reviews yet — be the first.',
      loading: 'Loading reviews…',
      formTitle: 'Leave a review',
      namePh: 'Your name',
      textPh: 'What stayed with you?',
      consent: 'I agree to have my review published on the site',
      pdConsent: 'I agree to the processing of my personal data',
      submit: 'Submit review',
      sending: 'Sending…',
      thanksTitle: 'Thank you!',
      thanksBody: "Your review has been sent. If it didn't trip the spam filter, it's already live — otherwise it'll appear after a quick check.",
      errName: 'Please enter your name',
      errText: 'Review text — 10 to 2000 characters',
      errRating: 'Please give a rating',
      errConsent: 'Publication consent is required',
      errPdConsent: 'Personal data consent is required',
      errNetwork: "Couldn't send it — please try again in a moment.",
    },
  };
  var t = TEXT[LANG];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  function starsHtml(rating) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += '<span class="aud-star' + (i <= rating ? ' on' : '') + '">★</span>';
    return out;
  }

  // Дописывает aggregateRating в JSON-LD страницы (TheaterEvent/Event
  // с @id вида ".../<slug>/#event", см. Site/<slug>/index.html) — но
  // ТОЛЬКО когда реально пришли опубликованные отзывы с сервера.
  // Намеренно не пишет нулевые/выдуманные значения — Google и Яндекс
  // штрафуют структурированные данные с рейтингом, который нельзя
  // подтвердить на самой странице (см. правила Google Search Central
  // про rating snippets). Пока REVIEWS_API_URL не задеплоен (заглушка,
  // см. начало файла) — reviews всегда пустой массив, эта функция не
  // вызывается вообще, схема остаётся как есть, без aggregateRating.
  function updateAggregateRatingSchema(reviews) {
    if (!reviews || !reviews.length) return;
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        var data;
        try { data = JSON.parse(scripts[i].textContent); } catch (e) { continue; }
        var nodes = data['@graph'] || [data];
        var found = false;
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (node && typeof node['@id'] === 'string' && node['@id'].indexOf('#event') !== -1) {
            var sum = 0;
            for (var k = 0; k < reviews.length; k++) sum += Number(reviews[k].rating) || 0;
            var avg = Math.round((sum / reviews.length) * 10) / 10;
            node.aggregateRating = {
              '@type': 'AggregateRating',
              'ratingValue': avg,
              'reviewCount': reviews.length,
              'bestRating': 5,
              'worstRating': 1
            };
            found = true;
          }
        }
        if (found) scripts[i].textContent = JSON.stringify(data);
      }
    } catch (e) { /* структурированные данные — не критично для страницы, тихо пропускаем */ }
  }

  function renderReviews(container, reviews) {
    if (!reviews.length) {
      container.innerHTML = '<p class="aud-reviews-empty">' + t.empty + '</p>';
      return;
    }
    var html = '<div class="aud-reviews-grid">';
    reviews.forEach(function (r) {
      html += '<div class="aud-review-card">' +
        '<div class="aud-stars">' + starsHtml(r.rating) + '</div>' +
        '<p class="aud-review-text">' + esc(r.text) + '</p>' +
        '<p class="aud-review-name">' + esc(r.name) + '<span class="aud-review-date">' + esc(r.date) + '</span></p>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
    updateAggregateRatingSchema(reviews);
  }

  function loadReviews(slug, container) {
    container.innerHTML = '<p class="aud-reviews-empty">' + t.loading + '</p>';
    fetch(REVIEWS_API_URL + '?slug=' + encodeURIComponent(slug))
      .then(function (r) { return r.json(); })
      .then(function (data) { renderReviews(container, data.reviews || []); })
      .catch(function () { renderReviews(container, []); });
  }

  function buildForm(slug) {
    var wrap = document.createElement('div');
    wrap.className = 'aud-review-form';
    wrap.innerHTML =
      '<h3>' + t.formTitle + '</h3>' +
      '<div class="aud-review-form-fields">' +
        '<div class="aud-stars-input" id="aud-stars-input">' +
          [1, 2, 3, 4, 5].map(function (i) { return '<span class="aud-star-btn" data-val="' + i + '">★</span>'; }).join('') +
        '</div>' +
        '<input type="text" class="aud-input" id="aud-name" placeholder="' + t.namePh + '" maxlength="80">' +
        '<textarea class="aud-textarea" id="aud-text" placeholder="' + t.textPh + '" maxlength="2000" rows="4"></textarea>' +
        '<label class="aud-consent"><input type="checkbox" id="aud-consent"> ' + t.consent + '</label>' +
        '<label class="aud-consent"><input type="checkbox" id="aud-pd-consent"> ' + t.pdConsent + '</label>' +
        '<p class="aud-error" id="aud-error" style="display:none"></p>' +
        '<button class="btn-gold" id="aud-submit" type="button">' + t.submit + '</button>' +
        // Honeypot: скрыто от людей (position off-screen), боты часто
        // заполняют все поля формы вслепую — портировано из ReviewsBot
        // Николая Балашова (pack-v70).
        '<input type="text" id="aud-website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true">' +
      '</div>' +
      '<p class="aud-thanks" id="aud-thanks" style="display:none"><strong>' + t.thanksTitle + '</strong><br>' + t.thanksBody + '</p>';

    var rating = 0;
    var starBtns = wrap.querySelectorAll('.aud-star-btn');
    starBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        rating = Number(btn.getAttribute('data-val'));
        starBtns.forEach(function (b) { b.classList.toggle('on', Number(b.getAttribute('data-val')) <= rating); });
      });
    });

    var errorEl = wrap.querySelector('#aud-error');
    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }

    wrap.querySelector('#aud-submit').addEventListener('click', function () {
      var name = wrap.querySelector('#aud-name').value.trim();
      var text = wrap.querySelector('#aud-text').value.trim();
      var consent = wrap.querySelector('#aud-consent').checked;
      var pdConsent = wrap.querySelector('#aud-pd-consent').checked;

      errorEl.style.display = 'none';
      if (!name) return showError(t.errName);
      if (text.length < 10 || text.length > 2000) return showError(t.errText);
      if (!(rating >= 1 && rating <= 5)) return showError(t.errRating);
      if (!pdConsent) return showError(t.errPdConsent);
      if (!consent) return showError(t.errConsent);

      var submitBtn = wrap.querySelector('#aud-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = t.sending;

      var payload = { slug: slug, name: name, rating: rating, text: text, consent: consent,
        website: wrap.querySelector('#aud-website').value }; // honeypot

      // Fire-and-forget к Apps Script: ответ CORS-непрозрачный при
      // простом fetch без preflight, но данные долетают и пишутся в
      // таблицу — это нормальный, ожидаемый режим для Apps Script
      // Web App, не ошибка. Полный сетевой отказ (не «непрозрачно», а
      // именно упавший fetch) — не теряем отзыв молча, кладём в
      // localStorage-бэклог (см. reviewsBacklogPush выше).
      fetch(REVIEWS_API_URL, { method: 'POST', body: JSON.stringify(payload) })
        .catch(function () { reviewsBacklogPush(payload); });

      // Резервное уведомление напрямую с фронтенда — тот же паттерн,
      // что и у остальных форм сайта (см. sendTelegram в tickets/index.html).
      fetch(TG_WORKER, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '[AELITA] Новый отзыв (' + slug + ') — на модерации\n\nИмя: ' + name + '\nОценка: ' + rating + '/5\n\n' + text.substring(0, 400) }),
      }).catch(function () {});

      wrap.querySelector('.aud-review-form-fields').style.display = 'none';
      wrap.querySelector('#aud-thanks').style.display = 'block';
    });

    return wrap;
  }

  window.AelitaReviews = {
    init: function (slug) {
      var listEl = document.getElementById('aud-reviews-list');
      var formHost = document.getElementById('aud-reviews-form-host');
      if (listEl) loadReviews(slug, listEl);
      if (formHost) formHost.appendChild(buildForm(slug));
    },
  };
})();
