// AELITA PRODUCTION — отзывы зрителей.
// Один модуль на все страницы спектаклей: рендерит уже опубликованные
// отзывы (fetch к Code.gs-веб-приложению, см. _tools/Reviews/) и
// отправляет новые через форму. Каждая страница спектакля просто
// вызывает AelitaReviews.init('slug-спектакля') один раз.
//
// Опубликованный отзыв появляется не мгновенно — сначала модерация
// (см. _tools/Reviews/README.md). Отправленный отзыв сразу показывает
// зрителю «спасибо, на модерации», не притворяется, что он уже виден.

(function () {
  'use strict';

  // Заполняется после деплоя веб-приложения (_tools/Reviews/Code.gs) —
  // см. _tools/Reviews/README.md, шаг 4.
  var REVIEWS_API_URL = 'https://script.google.com/macros/s/ВСТАВЬТЕ_ID_ПОСЛЕ_ДЕПЛОЯ/exec';

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
      submit: 'Отправить отзыв',
      sending: 'Отправляем…',
      thanksTitle: 'Спасибо!',
      thanksBody: 'Отзыв отправлен и появится на сайте после модерации.',
      errName: 'Укажите имя',
      errText: 'Текст отзыва — от 10 до 2000 символов',
      errRating: 'Поставьте оценку',
      errConsent: 'Нужно согласие на публикацию',
      errNetwork: 'Не получилось отправить — попробуйте ещё раз чуть позже.',
    },
    en: {
      empty: 'No published reviews yet — be the first.',
      loading: 'Loading reviews…',
      formTitle: 'Leave a review',
      namePh: 'Your name',
      textPh: 'What stayed with you?',
      consent: 'I agree to have my review published on the site',
      submit: 'Submit review',
      sending: 'Sending…',
      thanksTitle: 'Thank you!',
      thanksBody: 'Your review has been sent and will appear on the site after moderation.',
      errName: 'Please enter your name',
      errText: 'Review text — 10 to 2000 characters',
      errRating: 'Please give a rating',
      errConsent: 'Publication consent is required',
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
        '<p class="aud-error" id="aud-error" style="display:none"></p>' +
        '<button class="btn-gold" id="aud-submit" type="button">' + t.submit + '</button>' +
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

      errorEl.style.display = 'none';
      if (!name) return showError(t.errName);
      if (text.length < 10 || text.length > 2000) return showError(t.errText);
      if (!(rating >= 1 && rating <= 5)) return showError(t.errRating);
      if (!consent) return showError(t.errConsent);

      var submitBtn = wrap.querySelector('#aud-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = t.sending;

      var payload = { slug: slug, name: name, rating: rating, text: text, consent: consent };

      // Fire-and-forget к Apps Script: ответ CORS-непрозрачный при
      // простом fetch без preflight, но данные долетают и пишутся в
      // таблицу — это нормальный, ожидаемый режим для Apps Script
      // Web App, не ошибка.
      fetch(REVIEWS_API_URL, { method: 'POST', body: JSON.stringify(payload) }).catch(function () {});

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
