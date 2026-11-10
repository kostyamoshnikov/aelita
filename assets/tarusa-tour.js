(function () {
  'use strict';
  var en = document.documentElement.lang === 'en';
  var header = document.querySelector('body > nav');
  function headerSpace() {
    if (header) document.documentElement.style.setProperty('--tour-nav-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  headerSpace();
  window.addEventListener('resize', headerSpace);
  if (header && window.ResizeObserver) new ResizeObserver(headerSpace).observe(header);

  var gallery = document.querySelector('.tour-gallery');
  if (gallery) {
    var track = gallery.querySelector('.tour-gallery-track');
    var slides = track.querySelectorAll('.tour-slide');
    var controls = gallery.querySelector('.tour-gallery-controls');
    var previous = gallery.querySelector('[data-gallery-previous]');
    var next = gallery.querySelector('[data-gallery-next]');
    var counter = gallery.querySelector('output');
    var index = 0;
    function update() {
      index = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      previous.disabled = index === 0;
      next.disabled = index === slides.length - 1;
      counter.textContent = (index + 1) + ' / ' + slides.length;
    }
    function move(delta) {
      var target = Math.max(0, Math.min(slides.length - 1, index + delta));
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      track.scrollTo({left:target * track.clientWidth, behavior:reduced ? 'auto' : 'smooth'});
    }
    previous.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    gallery.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    track.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
    controls.hidden = false;
    update();
  }

  var form = document.getElementById('tour-request');
  if (!form) return;
  var status = document.getElementById('tour-form-status');
  var submit = form.querySelector('button[type=submit]');
  var phone = form.elements.namedItem('phone');
  var name = form.elements.namedItem('name');
  var sending = false;
  phone.addEventListener('input', function () { phone.setCustomValidity(''); });
  name.addEventListener('input', function () { name.setCustomValidity(''); });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (sending) return;
    name.setCustomValidity(name.value.trim() ? '' : (en ? 'Enter your name.' : 'Укажите ваше имя.'));
    if (window.AELITA_phoneOk && !window.AELITA_phoneOk(phone.value)) {
      phone.setCustomValidity(en ? 'Enter a valid phone number.' : 'Укажите корректный номер телефона.');
    } else phone.setCustomValidity('');
    if (!form.reportValidity()) return;
    var value = function (name) { return form.elements.namedItem(name).value.trim(); };
    sending = true; submit.disabled = true;
    status.dataset.state = 'sending';
    status.textContent = en ? 'Sending your enquiry…' : 'Отправляем заявку…';
    try {
      var ok = await window.AELITA_sendLead('Таруса — театральное турне', {
        'Имя':value('name'), 'Email':value('email'), 'Телефон':value('phone'),
        'Компания':value('company'), 'Количество гостей':value('guests'), 'Сообщение':value('message')
      });
      if (!ok) throw new Error('not_accepted');
      form.reset(); status.dataset.state = 'success';
      status.textContent = en ? 'Thank you! We have received your enquiry and will contact you to discuss the journey.' : 'Спасибо! Заявка получена. Свяжемся с вами, чтобы обсудить поездку.';
    } catch (_) {
      status.dataset.state = 'error';
      status.textContent = en ? 'Could not send your enquiry. Your details are still here. Try again or email aelita.production@yandex.ru.' : 'Не получилось отправить заявку. Данные остались в форме. Попробуйте ещё раз или напишите на aelita.production@yandex.ru.';
    } finally { sending = false; submit.disabled = false; }
  });
}());
