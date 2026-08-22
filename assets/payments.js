// AELITA PRODUCTION — общий помощник для кнопок «Оплатить».
// Бэкенд — Yandex Cloud Function (_tools/Payments/create-payment.js),
// НЕ Cloudflare — первичный приём персональных данных для платежа
// должен физически происходить на территории РФ (152-ФЗ), см.
// _tools/Payments/README.md.
//
// С pack-v117 оплата без входа в личный кабинет невозможна (раньше
// была доступна гостевым образом, заказчик попросил закрыть). Это
// ПРОВЕРЯЕТСЯ НА СЕРВЕРЕ (create-payment.js отклоняет запрос без
// валидного токена — см. там), а не только здесь — проверка тут нужна
// исключительно для того, чтобы не пытаться платить впустую, а сразу
// отправить человека войти, не дожидаясь ошибки уже после клика.
(function () {
  // ЗАПОЛНИТЬ после деплоя _tools/Payments/create-payment.js — публичный
  // URL вида https://functions.yandexcloud.net/<id функции>. Пока пусто —
  // кнопки «Оплатить» показывают понятное сообщение вместо тихой
  // поломки, сайт при этом не ломается.
  var CREATE_PAYMENT_URL = '';

  var DRAFT_KEY = 'aelita_form_draft:' + location.pathname;

  // Раз оплата теперь ВСЕГДА требует входа, человек без аккаунта
  // заполняет форму (иногда длинную — см. book-concierge), жмёт
  // «Оплатить» и тут же улетает на /account регистрироваться — без
  // этого он вернулся бы на чистую форму и вводил всё заново. То же
  // самое нужно и при 401 ниже (истёкший токен посреди оплаты) — не
  // только при изначальном отсутствии токена.
  function saveFormDraft() {
    try {
      var data = {};
      document.querySelectorAll('input[id], textarea[id]').forEach(function (el) {
        if (el.type === 'password') return; // на этих страницах их нет, но на всякий случай
        data[el.id] = el.value;
      });
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) { /* приватный режим и т.п. — просто не восстановится, форма не сломается */ }
  }

  function restoreFormDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = data[id];
      });
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }
  restoreFormDraft(); // при каждой загрузке страницы — так работает и после регистрации, и просто при возврате назад

  function goToLogin() {
    saveFormDraft();
    location.href = '/account?next=' + encodeURIComponent(location.pathname + location.hash);
  }

  // product — 'community' | 'concierge' | 'gift'. Цену для community/
  // concierge сервер знает сам (см. create-payment.js) — amount имеет
  // смысл только для gift, для остальных передавать не нужно.
  window.AELITA_pay = async function (product, opts) {
    opts = opts || {};
    var name = (opts.name || '').trim();
    var contact = (opts.contact || '').trim();
    var amount = opts.amount;
    var comment = opts.comment || '';
    var buttonEl = opts.buttonEl || null;

    var token = null;
    try { token = localStorage.getItem('aelita_account_token'); } catch (e) { /* приватный режим и т.п. */ }
    if (!token) {
      // Без входа в кабинет оплата на сайте недоступна — не пытаемся
      // вызывать API впустую (он всё равно откажет), сразу ведём
      // войти/зарегистрироваться и вернуться на эту же страницу.
      goToLogin();
      return;
    }

    if (!CREATE_PAYMENT_URL) {
      alert('Оплата на сайте ещё не подключена — напишите нам напрямую, поможем оформить: aelita.production@yandex.ru');
      return;
    }
    if (!name || !contact) {
      alert('Укажите имя и контакт');
      return;
    }
    if (product === 'gift') {
      var n = Number(amount);
      if (!n || n < 500 || n > 100000) {
        alert('Укажите сумму от 500 до 100 000 ₽');
        return;
      }
    }

    var originalText = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = 'Переходим к оплате…'; }

    // Метка в return_url — чтобы страница, на которую ЮKassa вернёт
    // человека, могла показать понятное «мы вас ждали» вместо тишины
    // (см. handlePaymentReturn на страницах с оплатой). Это не
    // подтверждение самой оплаты — та подтверждается асинхронно через
    // webhook.js на сервере, фронтенд об этом узнать в моменте не
    // может — поэтому и текст сообщения формулируется без гарантий.
    var returnUrl = new URL(location.href);
    returnUrl.searchParams.set('aelita_paid', '1');

    try {
      var res = await fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ product: product, name: name, contact: contact, amount: amount, comment: comment, return_url: returnUrl.toString() }),
      });
      if (res.status === 401) {
        // Токен был, но сервер его не принял (истёк/подделан/аккаунт
        // удалён) — с точки зрения человека это то же самое «нужно
        // войти», а не общая ошибка оплаты. Форму тоже сохраняем —
        // это могло случиться посреди заполнения длинной анкеты.
        try { localStorage.removeItem('aelita_account_token'); } catch (e) {}
        goToLogin();
        return;
      }
      var data = await res.json();
      if (data && data.confirmation_url) {
        location.href = data.confirmation_url;
        return; // уходим со страницы — не нужно возвращать кнопку в исходное состояние
      }
      alert('Не получилось начать оплату. Попробуйте ещё раз или напишите нам напрямую.');
    } catch (e) {
      alert('Не получилось начать оплату. Попробуйте ещё раз или напишите нам напрямую.');
    }
    if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = originalText; }
  };
})();
