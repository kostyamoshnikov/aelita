(() => {
  const menu = document.querySelector('.compact-menu');
  const menuControl = menu.querySelector('summary');
  for (const link of menu.querySelectorAll('a')) {
    link.addEventListener('click', () => { menu.open = false; });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menuControl.focus();
    }
  });

  const form = document.querySelector('.enquiry-form');
  const phone = form.elements.namedItem('phone');
  const format = form.elements.namedItem('format');
  const draft = document.querySelector('#draft');
  const draftText = document.querySelector('#draft-text');
  const draftMail = document.querySelector('#draft-mail');
  const status = document.querySelector('#draft-status');

  function clearDraft() {
    draft.hidden = true;
    draftText.value = '';
    draftMail.removeAttribute('href');
    status.textContent = '';
  }
  for (const link of document.querySelectorAll('a[data-format]')) {
    link.addEventListener('click', () => {
      format.value = link.dataset.format;
      clearDraft();
    });
  }
  form.addEventListener('input', () => {
    phone.setCustomValidity('');
    clearDraft();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const number = phone.value.trim();
    const digits = number.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]+$/.test(number) || digits.length < 7 || digits.length > 15) {
      phone.setCustomValidity(form.dataset.feedback);
      phone.reportValidity();
      return;
    }
    const body = ['name', 'company', 'phone', 'email', 'format', 'note']
      .map(name => {
        const field = form.elements.namedItem(name);
        const value = name === 'format' ? field.selectedOptions[0].textContent : field.value.trim();
        return value ? field.closest('label').firstChild.textContent.trim().replace(/\s\*$/, '') + ': ' + value : '';
      })
      .filter(Boolean)
      .join('\n');
    const subject = document.querySelector('h1').textContent.trim();
    draftText.value = body;
    draftMail.href = 'mailto:aelita.production@yandex.ru?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    draft.hidden = false;
    draft.focus();
  });
  document.querySelector('#draft-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(draftText.value);
      status.textContent = form.dataset.copied;
    } catch {
      draftText.focus();
      draftText.select();
    }
  });
})();
