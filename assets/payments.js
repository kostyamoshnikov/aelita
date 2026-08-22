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

  function goToLogin() {
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

    try {
      var res = await fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ product: product, name: name, contact: contact, amount: amount, comment: comment, return_url: location.href }),
      });
      if (res.status === 401) {
        // Токен был, но сервер его не принял (истёк/подделан/аккаунт
        // удалён) — с точки зрения человека это то же самое «нужно
        // войти», а не общая ошибка оплаты.
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
