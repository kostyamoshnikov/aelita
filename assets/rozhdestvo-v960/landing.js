(() => {
  const menu = document.querySelector('.compact-menu');
  const menuControl = menu?.querySelector('summary');
  for (const link of menu?.querySelectorAll('a') || []) link.addEventListener('click', () => { menu.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.open) { menu.open = false; menuControl?.focus(); } });

  const form = document.querySelector('.enquiry-form');
  if (!form) return;
  const en = document.documentElement.lang === 'en';
  const phone = form.elements.namedItem('phone');
  const format = form.elements.namedItem('format');
  const company = form.elements.namedItem('company');
  const guests = form.elements.namedItem('guests');
  const date = form.elements.namedItem('date');
  const time = form.elements.namedItem('time');
  const fieldNames = ['name', 'company', 'phone', 'email', 'format', 'guests', 'date', 'time', 'city', 'venue', 'note'];
  const draftLabels = en
    ? ['Name', 'Company', 'Phone', 'Email', 'Format', 'Guests', 'Date', 'Start time (Moscow)', 'City', 'Venue', 'Notes']
    : ['Имя', 'Компания', 'Телефон', 'Email', 'Формат', 'Гостей', 'Дата', 'Время начала (МСК)', 'Город', 'Площадка', 'Пожелания'];
  const draft = document.querySelector('#draft');
  const draftText = document.querySelector('#draft-text');
  const draftMail = document.querySelector('#draft-mail');
  const draftStatus = document.querySelector('#draft-status');
  const receipt = document.querySelector('#request-receipt');
  const submit = form.querySelector('[type="submit"]');
  const api = 'https://api.aelita-production.ru/leads';
  // Store only a random attempt key, never form fields or contact details.
  const attemptStorageKey = 'aelita.christmas.attempt.v1.' + (en ? 'en' : 'ru');
  const newAttempt = document.querySelector('#new-attempt');
  let pendingId = '';
  let storageAvailable = false;
  try { pendingId = sessionStorage.getItem(attemptStorageKey) || ''; storageAvailable = true; }
  catch { /* Privacy mode may disable sessionStorage; do not submit non-retryable attempts. */ }
  let locked = false;

  function updateRequirements() {
    company.required = format.value !== 'open';
    guests.max = format.value === 'closed' ? '25' : '999999';
    date.required = Boolean(time.value);
  }
  function clear() { if (locked) return; draft.hidden = true; receipt.hidden = true; draftText.value = ''; draftStatus.textContent = ''; draftMail.removeAttribute('href'); }
  function resetAttempt() {
    pendingId = '';
    if (storageAvailable) {
      try { sessionStorage.removeItem(attemptStorageKey); }
      catch { storageAvailable = false; }
    }
    newAttempt.hidden = true;
  }
  newAttempt?.addEventListener('click', () => {
    if (locked || !globalThis.confirm(en ? 'Start a separate enquiry? Your previous attempt may have been received.' : 'Начать отдельную заявку? Предыдущее обращение могло быть принято.')) return;
    resetAttempt(); clear(); form.focus();
  });
  updateRequirements();
  format.addEventListener('change', updateRequirements);
  for (const link of document.querySelectorAll('a[data-format]')) link.addEventListener('click', () => { format.value = link.dataset.format; updateRequirements(); clear(); });
  form.addEventListener('input', () => {
    phone.setCustomValidity('');
    guests.setCustomValidity('');
    updateRequirements();
    clear();
  });

  function newId() {
    if (!globalThis.crypto?.getRandomValues) throw new Error('secure_random_unavailable');
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
  }
  function fallback() {
    const lines = fieldNames.map((key, index) => {
      const field = form.elements.namedItem(key);
      const value = key === 'format' ? field.selectedOptions[0].textContent : field.value.trim();
      return value ? draftLabels[index] + ': ' + value : '';
    }).filter(Boolean);
    if (pendingId) lines.push((en ? 'Attempt ID: ' : 'Код попытки: ') + pendingId);
    const text = lines.join('\n');
    draftText.value = text;
    draftMail.href = 'mailto:aelita.production@yandex.ru?subject=' + encodeURIComponent(en ? 'Christmas evening enquiry' : 'Рождество · Заявка') + '&body=' + encodeURIComponent(text);
    draft.hidden = false;
    draft.focus();
  }
  function markReceipt(data) {
    const reference = String(data.reference || '').trim();
    if (!/^РЖ-2026-[0-9A-F]{16}$/.test(reference)) throw new Error('invalid_receipt');
    const emailNote = data.emailStatus === 'accepted'
      ? (en ? 'An acknowledgement was accepted by the email service.' : 'Письмо-подтверждение принято почтовым сервером.')
      : (en ? 'Email delivery is not confirmed. Please save your reference.' : 'Отправка письма пока не подтверждена. Сохраните номер заявки.');
    receipt.textContent = en
      ? `Your enquiry has been received. Reference: ${reference}. ${emailNote} The date and booking are not confirmed.`
      : `Заявка получена. Номер: ${reference}. ${emailNote} Дата и бронирование пока не подтверждены.`;
    receipt.hidden = false;
    draft.hidden = true;
    receipt.focus();
    resetAttempt();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (locked) return;
    const number = phone.value.trim();
    const digits = number.replace(/\D/g, '');
    const validPhone = number.startsWith('+')
      ? digits.length >= 7 && digits.length <= 15
      : digits.length === 11 && /^[78]/.test(digits);
    if (!/^[+0-9 ().-]+$/.test(number) || (number.includes('+') && !/^\+[^+]*$/.test(number)) || !validPhone) {
      phone.setCustomValidity(form.dataset.feedback); phone.reportValidity(); return;
    }
    if (!/^[1-9][0-9]{0,5}$/.test(guests.value)) {
      guests.setCustomValidity(en ? 'Enter a whole number of guests.' : 'Укажите целое число гостей.');
    }
    if (!form.reportValidity()) return;
    if (!pendingId) {
      try {
        if (!storageAvailable) throw new Error('session_storage_unavailable');
        const attemptId = newId();
        sessionStorage.setItem(attemptStorageKey, attemptId);
        pendingId = attemptId;
      } catch {
        receipt.textContent = en ? 'Secure online submission is unavailable. Please send the email draft below.' : 'Безопасная онлайн-отправка недоступна. Отправьте черновик письма ниже.';
        receipt.hidden = false; fallback(); return;
      }
    }
    const fields = Object.fromEntries(fieldNames.map(key => [
      key === 'note' ? 'comment' : key, form.elements.namedItem(key).value.trim()
    ]));
    const qs = new URLSearchParams(location.search);
    const utm = {};
    for (const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) if (qs.has(name)) utm[name] = qs.get(name).slice(0,200);
    const payload = { form: 'Рождество 2026–2027', page: location.pathname, lang: en ? 'en' : 'ru',
      client_id: pendingId, pd_consent: form.elements.namedItem('pd_consent').checked,
      newsletter_consent: false, fields, utm };
    locked = true; submit.disabled = true;
    receipt.hidden = true; draft.hidden = true;
    let errorKind = 'uncertain';
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok && data?.received) { markReceipt(data); return; }
      if (response.status === 409) errorKind = 'conflict';
      else if (response.status === 429) errorKind = 'rate_limit';
      else if (response.status === 400) errorKind = 'invalid';
      else if (response.status === 503 && data?.error === 'christmas_not_ready') errorKind = 'disabled';
    } catch (e) { /* Timeout, transport failure, and lost responses have unknown persistence. */ }
    finally { clearTimeout(deadline); locked = false; submit.disabled = false; }
    const problems = en ? {
      uncertain: 'Unable to confirm whether your enquiry was received. Retry with the same attempt or send the email draft below.',
      conflict: 'This attempt key is already linked to different details. Check the previous enquiry or explicitly start a separate one.',
      rate_limit: 'Too many requests. Please retry this attempt later.',
      invalid: 'The request was rejected. Check the form details and try again.',
      disabled: 'Online enquiries are not yet available. Use the email draft instead.'
    } : {
      uncertain: 'Не удалось проверить, принята ли заявка. Повторите с тем же кодом попытки или отправьте черновик письма ниже.',
      conflict: 'Этот код попытки уже связан с другими данными. Сверьте прежнюю заявку или явно начните новую.',
      rate_limit: 'Слишком много запросов. Повторите эту же попытку позже.',
      invalid: 'Заявка отклонена проверкой. Исправьте поля и повторите.',
      disabled: 'Онлайн-приём заявок пока закрыт. Используйте черновик письма.'
    };
    receipt.textContent = problems[errorKind];
    receipt.hidden = false;
    newAttempt.hidden = errorKind !== 'conflict' && errorKind !== 'uncertain';
    if (errorKind === 'uncertain' || errorKind === 'disabled') fallback();
  });
  document.querySelector('#draft-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(draftText.value); draftStatus.textContent = form.dataset.copied; }
    catch { draftText.focus(); draftText.select(); }
  });
})();
