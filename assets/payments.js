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
//
// Один файл на RU и EN версию сайта (общий <script src="/assets/payments.js">
// на обеих) — переводческий пайплайн (_tools/DesignSystem/i18n/) сюда не
// заходит, script/style не переводятся (см. i18n/README.md). Язык — по
// document.documentElement.lang, тот же паттерн, что у reviews.js и
// account.js (см. `var LANG` там).
(function () {
  var LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';

  var TEXT = {
    ru: {
      notConfigured: 'Оплата на сайте ещё не подключена — напишите нам напрямую, поможем оформить: aelita.production@yandex.ru',
      missingFields: 'Заполните имя и контакт — без них не отправим',
      badAmount: 'Укажите сумму от 500 до 100 000 ₽',
      missingShow: 'Выберите спектакль',
      processing: 'Переходим к оплате…',
      failed: 'Оплата не началась. Попробуйте ещё раз — или напишите нам напрямую, поможем оформить.',
    },
    en: {
      notConfigured: "Payment isn't connected on the site yet — email us directly and we'll help set it up: aelita.production@yandex.ru",
      missingFields: "Fill in your name and contact — we can't send this without them",
      badAmount: 'Enter an amount between 500 and 100,000 ₽',
      missingShow: 'Choose a show',
      processing: 'Redirecting to payment…',
      failed: "Payment didn't start. Try again — or email us directly and we'll help sort it out.",
    },
  };
  var t = TEXT[LANG];

  // ЗАПОЛНИТЬ после деплоя _tools/Payments/create-payment.js — публичный
  // URL вида https://functions.yandexcloud.net/<id функции>. Пока пусто —
  // кнопки «Оплатить» показывают понятное сообщение вместо тихой
  // поломки, сайт при этом не ломается.
  var CREATE_PAYMENT_URL = '';

  // Кнопки «Оплатить» на всех страницах остаются на месте нетронутыми
  // (видны, кликабельны, ведут на реальный флоу) даже пока
  // CREATE_PAYMENT_URL пуст — так попросил заказчик: ЮKassa при
  // модерации магазина смотрит на живой сайт и должна увидеть
  // настоящую кнопку оплаты, а не её отсутствие. Вместо того чтобы
  // прятать кнопку, показываем рядом честное уведомление — см.
  // AELITA_showNotConnectedNotice() ниже, вызывается со страниц с
  // оплатой (community/book-concierge/gift-card/programs). Уведомление
  // само пропадёт, как только сюда впишут реальный URL — ничего не
  // нужно будет чистить вручную на каждой странице по отдельности.
  window.AELITA_paymentsConfigured = !!CREATE_PAYMENT_URL;

  // id — элемент уведомления на конкретной странице (текст уже готов
  // в разметке, тут только показываем/прячем). Вызывать после того как
  // DOM готов — используется как <script>AELITA_showNotConnectedNotice('id')</script>
  // сразу после подключения payments.js на каждой странице с оплатой.
  window.AELITA_showNotConnectedNotice = function (elId) {
    if (window.AELITA_paymentsConfigured) return; // реальный URL уже есть — ничего не показываем
    var el = document.getElementById(elId);
    if (el) el.style.display = 'block';
  };

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

  // product — 'community' | 'concierge' | 'gift' | 'program'. Цену для
  // community/concierge/program сервер знает сам (см. create-payment.js)
  // — amount имеет смысл только для gift. show — только для program
  // (слаг спектакля, для которого покупается программка).
  //
  // 'program' — ЕДИНСТВЕННОЕ исключение из «оплата только после входа»
  // (pack-v126, см. create-payment.js докстринг зачем): гостевая
  // покупка у стойки в фойе, без токена и без имени/контакта — не
  // задерживаем человека формальностями там, где вся суть в скорости.
  window.AELITA_pay = async function (product, opts) {
    opts = opts || {};
    var name = (opts.name || '').trim();
    var contact = (opts.contact || '').trim();
    var amount = opts.amount;
    var show = opts.show || '';
    var comment = opts.comment || '';
    var buttonEl = opts.buttonEl || null;
    var isGuestCheckout = product === 'program';

    var token = null;
    try { token = localStorage.getItem('aelita_account_token'); } catch (e) { /* приватный режим и т.п. */ }
    if (!token && !isGuestCheckout) {
      // Без входа в кабинет оплата на сайте недоступна — не пытаемся
      // вызывать API впустую (он всё равно откажет), сразу ведём
      // войти/зарегистрироваться и вернуться на эту же страницу.
      goToLogin();
      return;
    }

    if (!CREATE_PAYMENT_URL) {
      alert(t.notConfigured);
      return;
    }
    if (!isGuestCheckout && (!name || !contact)) {
      alert(t.missingFields);
      return;
    }
    if (product === 'gift') {
      var n = Number(amount);
      if (!n || n < 500 || n > 100000) {
        alert(t.badAmount);
        return;
      }
    }
    if (product === 'program' && !show) {
      alert(t.missingShow);
      return;
    }

    var originalText = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.processing; }

    // Метка в return_url — чтобы страница, на которую ЮKassa вернёт
    // человека, могла показать понятное «мы вас ждали» вместо тишины
    // (см. handlePaymentReturn на страницах с оплатой). Это не
    // подтверждение самой оплаты — та подтверждается асинхронно через
    // webhook.js на сервере, фронтенд об этом узнать в моменте не
    // может — поэтому и текст сообщения формулируется без гарантий.
    var returnUrl = new URL(location.href);
    returnUrl.searchParams.set('aelita_paid', '1');

    try {
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token; // program и без токена пройдёт — сервер его не требует для этого продукта
      var res = await fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ product: product, name: name, contact: contact, amount: amount, show: show, comment: comment, return_url: returnUrl.toString() }),
      });
      if (res.status === 401) {
        if (isGuestCheckout) {
          // program не требует токена вообще — 401 здесь означает
          // что-то другое (например, случайно протухший токен из
          // localStorage помешал), не «нужно войти». Ведём себя как
          // при обычной ошибке оплаты, не отправляем на /account —
          // это гостевой сценарий, у него нет /account-предыстории.
          alert(t.failed);
        } else {
          // Токен был, но сервер его не принял (истёк/подделан/аккаунт
          // удалён) — с точки зрения человека это то же самое «нужно
          // войти», а не общая ошибка оплаты. Форму тоже сохраняем —
          // это могло случиться посреди заполнения длинной анкеты.
          try { localStorage.removeItem('aelita_account_token'); } catch (e) {}
          goToLogin();
        }
        return;
      }
      var data = await res.json();
      if (data && data.confirmation_url) {
        location.href = data.confirmation_url;
        return; // уходим со страницы — не нужно возвращать кнопку в исходное состояние
      }
      alert(t.failed);
    } catch (e) {
      alert(t.failed);
    }
    if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = originalText; }
  };
})();
