(function () {
  'use strict';
  var form = document.getElementById('corporate-salon-form');
  var success = document.getElementById('corporate-salon-success');
  var fields = form.elements;
  var button = fields.send;
  var en = document.documentElement.lang === 'en';
  var pending;
  if (typeof window.AELITA_sendLead !== 'function') return;
  fields.details.disabled = false;
  document.getElementById('corporate-salon-unavailable').hidden = true;

  function validateFields() {
    fields.company.setCustomValidity(fields.company.value && !fields.company.value.trim()
      ? (en ? 'Enter your company name.' : 'Укажите название компании.') : '');
    fields.contact.setCustomValidity(fields.contact.value && !fields.contact.value.trim()
      ? (en ? 'Enter a contact name.' : 'Укажите имя контактного лица.') : '');
    var email = fields.email.value.trim();
    var phone = fields.phone.value.trim();
    var digits = phone.replace(/\D/g, '');
    fields.email.setCustomValidity(email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
      ? (en ? 'Enter your full email address.' : 'Укажите полный адрес почты.') : '');
    var validPhone = /^[+0-9 ().-]+$/.test(phone) &&
      (phone.startsWith('+') ? digits.length >= 7 && digits.length <= 15 : /^[78][0-9]{10}$/.test(digits));
    fields.phone.setCustomValidity(validPhone ? '' :
      (en ? 'Enter a phone number with its country code, beginning with +.' : 'Укажите телефон с кодом страны, начиная с +.'));
  }

  [fields.company, fields.contact, fields.email, fields.phone].forEach(function (field) {
    field.addEventListener('input', validateFields);
  });
  fields.guests.addEventListener('input', function () {
    document.getElementById('corporate-salon-guests-hint').hidden = Number(fields.guests.value) <= 27;
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled) return;
    validateFields();
    if (!fields.consent.checked || !form.reportValidity()) return;
    var values = {
      'Компания': fields.company.value.trim(),
      'Контактное лицо': fields.contact.value.trim(),
      'Email': fields.email.value.trim(),
      'Телефон': fields.phone.value.trim(),
      'Желаемые даты': fields.dates.value.trim(),
      'Гостей': fields.guests.value ? String(Number(fields.guests.value)) : '',
      'Комментарий': fields.comment.value.trim(),
    };
    var key = JSON.stringify(values);
    if (!pending || pending.key !== key) pending = { key: key, id: aelitaLeadId() };
    var conflict = false;
    var label = button.textContent;
    button.textContent = en ? 'Sending…' : 'Отправляем…';
    button.disabled = true;
    fields.details.disabled = true;
    window.AELITA_formMessageClear(button);
    try {
      var sent = await window.AELITA_sendLead('Рождественский салон · корпоративный', values, {
        clientId: pending.id,
        website: fields.website.value,
        onConflict: function () {
          conflict = true;
          pending = null;
        },
      });
      if (!sent) throw new Error('lead_not_sent');
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (_) {
      if (conflict) {
        window.AELITA_formMessage(button,
          'Не удалось подтвердить заявку. Проверьте поля и отправьте её ещё раз.',
          'We could not confirm the enquiry. Check the fields and send it again.');
      } else {
        window.AELITA_formMessage(button, AELITA_LEAD_FAIL.ru, AELITA_LEAD_FAIL.en);
      }
    } finally {
      button.textContent = label;
      button.disabled = false;
      fields.details.disabled = false;
    }
  });
})();
