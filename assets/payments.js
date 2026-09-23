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
      badName: 'Укажите имя',
      badEmail: 'Проверьте email — похоже, в адресе опечатка',
      badPhone: 'Проверьте телефон — похоже, номер введён не полностью или с ошибкой',
      badAmount: 'Укажите сумму от 500 до 100 000 ₽',
      missingShow: 'Выберите спектакль',
      missingConsent: 'Отметьте согласие на обработку персональных данных — без него мы не можем принять оплату',
      processing: 'Переходим к оплате…',
      failed: 'Оплата не началась. Попробуйте ещё раз — или напишите нам напрямую, поможем оформить.',
    },
    en: {
      notConfigured: "Payment isn't connected on the site yet — email us directly and we'll help set it up: aelita.production@yandex.ru",
      badName: 'Please enter your name',
      badEmail: "Check your email — the address doesn't look right",
      badPhone: "Check your phone number — it looks incomplete or incorrect",
      badAmount: 'Enter an amount between 500 and 100,000 ₽',
      missingShow: 'Choose a show',
      missingConsent: "Please check the personal data consent box — we can't process payment without it",
      processing: 'Redirecting to payment…',
      failed: "Payment didn't start. Try again — or email us directly and we'll help sort it out.",
    },
  };
  var t = TEXT[LANG];

  // ── Подарочная карта при оплате консьержа и COMMUNITY (ТЗ клиентских
  // текстов, З-5 вариант Б, pack-v470) ──────────────────────────────────
  // ⚠️ Переключатель стоит ПАРОЙ с серверным `_tools/Shared/lib/gift-
  // scope.js` → GIFT_ON_PRODUCTS; порядок включения — в докстринге там.
  // Пока false, поле кода на book-space/book-concierge спрятано и код не
  // отправляется: старый create-payment его молча проигнорировал бы, и
  // человек заплатил бы полную сумму, думая, что карта учтена. Аудит
  // `client_ui` проверяет, что оба переключателя в одном положении.
  var GIFT_ON_PRODUCTS = false;
  var GIFT_PRODUCTS = { community: true, concierge: true };
  var GIFT_TEXT = {
    ru: {
      not_found: 'Такой код подарочной карты не найден. Проверьте его — он в PDF сертификата, вида AELITA-XXXX-XXXX-XXXX.',
      inactive: 'Эта подарочная карта не активна. Напишите нам: aelita.production@yandex.ru',
      depleted: 'На этой подарочной карте не осталось средств. Уберите код, чтобы оплатить без неё.',
      rate_limited: 'Слишком много попыток ввести код. Подождите 10 минут или напишите нам: aelita.production@yandex.ru',
      changed: 'Остаток карты только что изменился. Нажмите «Оплатить» ещё раз.',
      not_applicable: 'Подарочную карту здесь принять нельзя. Уберите код, чтобы оплатить без неё.',
    },
    en: {
      not_found: 'Gift card code not found. Please check it: it is in the gift card PDF and looks like AELITA-XXXX-XXXX-XXXX.',
      inactive: 'This gift card is not active. Write to us: aelita.production@yandex.ru',
      depleted: 'There is no balance left on this gift card. Remove the code to pay without it.',
      rate_limited: 'Too many attempts to enter the code. Wait 10 minutes or write to us: aelita.production@yandex.ru',
      changed: 'The card balance has just changed. Press Pay again.',
      not_applicable: 'A gift card cannot be used here. Remove the code to pay without it.',
    },
  }[LANG];
  window.AELITA_GIFT_ON_PRODUCTS = GIFT_ON_PRODUCTS;

  // ── Статус оплаты продукта после возврата с ЮKassa (З-12, pack-v481,
  // ВЫКЛЮЧЕНО) ─────────────────────────────────────────────────────────
  // Пока false — экран возврата (З-3) безусловно говорит «Спасибо! Оплата
  // прошла», как раньше. true — спрашиваем сервер
  // (`_tools/Payments/order-status.js`, маршрут /payments/order-status) и
  // показываем правду: выдано / обрабатывается дольше обычного / не
  // прошла. Включать ПОСЛЕ создания функции aelita-payments-order-status
  // и обновления Gateway (функция — только чтение, не денежный путь).
  // id платежа кладём в sessionStorage перед уходом на ЮKassa; вернулся на
  // другом устройстве или в другой вкладке — id нет, экран прежний.
  var PRODUCT_STATUS_POLL = false;
  var PAY_ID_KEY = 'aelita-last-payment';
  var RETURNED_FROM_PAYMENT = new URLSearchParams(location.search).get('aelita_paid') === '1';
  function rememberPayment(id) {
    if (!id) return;
    try { sessionStorage.setItem(PAY_ID_KEY, JSON.stringify({ id: String(id), path: location.pathname })); } catch (e) {}
  }
  var STATUS_TEXT = {
    ru: {
      checking: ['Проверяем оплату…', 'Это несколько секунд.'],
      canceled: ['Оплата не прошла', 'Деньги не списаны. Можно попробовать ещё раз — форма ниже.'],
      slow: ['Оплата обрабатывается дольше обычного', 'Если деньги списались, письмо придёт в течение нескольких минут. Если не пришло — напишите нам, ничего не потеряется: aelita.production@yandex.ru'],
    },
    en: {
      checking: ['Checking your payment…', 'This takes a few seconds.'],
      canceled: ['The payment did not go through', 'No money was charged. You can try again — the form is below.'],
      slow: ['The payment is taking longer than usual', 'If you were charged, the email will arrive within a few minutes. If it does not, write to us — nothing will be lost: aelita.production@yandex.ru'],
    },
  }[LANG];
  if (PRODUCT_STATUS_POLL && RETURNED_FROM_PAYMENT) {
    document.addEventListener('DOMContentLoaded', function () {
      var stored = null;
      try { stored = JSON.parse(sessionStorage.getItem(PAY_ID_KEY) || 'null'); } catch (e) {}
      var box = document.getElementById('paymentReturnMsg');
      if (!stored || !stored.id || stored.path !== location.pathname || !box) return;
      var h = box.querySelector('h2'), p = box.querySelector('p');
      if (!h || !p) return;
      var okH = h.textContent, okP = p.textContent;
      var set = function (pair) { h.textContent = pair[0]; p.textContent = pair[1]; };
      set(STATUS_TEXT.checking);
      var started = Date.now();
      var poll = async function () {
        var st = 'unknown';
        try {
          var r = await fetch('https://api.aelita-production.ru/payments/order-status?payment_id=' + encodeURIComponent(stored.id));
          if (r.ok) st = (await r.json()).status;
        } catch (e) { /* сеть — попробуем ещё раз */ }
        if (st === 'delivered') { h.textContent = okH; p.textContent = okP; try { sessionStorage.removeItem(PAY_ID_KEY); } catch (e) {} return; }
        if (st === 'canceled') {
          set(STATUS_TEXT.canceled);
          var form = document.getElementById('joinForm');
          if (form) form.style.display = '';
          try { sessionStorage.removeItem(PAY_ID_KEY); } catch (e) {}
          return;
        }
        if (Date.now() - started > 60000) { set(STATUS_TEXT.slow); return; }
        setTimeout(poll, 3000);
      };
      poll();
    });
  }

  // ── Личное сообщение в PDF сертификата (З-12, pack-v481, ВЫКЛЮЧЕНО) ──
  // ⚠️ Пара с `_tools/Shared/lib/gift-scope.js → GIFT_MESSAGE_IN_PDF`;
  // аудит `client_ui` сверяет. Пока false — поле подписано «Пожелание —
  // передадим, если оформляем вручную» и отдельно не отправляется.
  var GIFT_MESSAGE_IN_PDF = false;
  if (GIFT_MESSAGE_IN_PDF) {
    document.addEventListener('DOMContentLoaded', function () {
      var lbl = document.querySelector('[data-gift-message-label]');
      if (lbl) lbl.textContent = LANG === 'en' ? 'Personal message — we will print it on the certificate' : 'Личное сообщение — напечатаем в сертификате';
      var ta = document.getElementById('j-message');
      if (ta) ta.maxLength = 300;
    });
  }
  if (GIFT_ON_PRODUCTS) {
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('[data-gift-code-field]').forEach(function (el) { el.style.display = ''; });
    });
  }

  // ── Валидация email/телефона — тот же паттерн и та же нормализация
  // телефона, что на сервере (_tools/Shared/lib/validate.js, pack-v235)
  // — держать оба места в синхроне вручную, единого общего файла между
  // клиентским JS и Node-функциями в этом паке нет технически (разные
  // среды выполнения). Клиентская проверка — только для мгновенной
  // обратной связи человеку; окончательное решение всегда за сервером.
  var EMAIL_RE = /^[^\s@<>"'&]+@[^\s@<>"'&]+\.[^\s@<>"'&]+$/;
  function isValidEmail(raw) {
    return typeof raw === 'string' && EMAIL_RE.test(raw.trim());
  }
  function normalizePhone(raw) {
    if (typeof raw !== 'string') return null;
    var digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) digits = '7' + digits.slice(1);
    else if (digits.length === 10) digits = '7' + digits;
    else return null;
    return '+' + digits;
  }
  window.AELITA_isValidEmail = isValidEmail;
  window.AELITA_normalizePhone = normalizePhone;

  // ── Подсветка ошибок ПРЯМО ПОД ПОЛЕМ — вместо alert() на весь экран.
  // Вызывается и при потере фокуса (пока человек ещё заполняет форму —
  // подсказать сразу, не дожидаясь клика «Оплатить»), и при отправке
  // формы (последняя проверка перед запросом к серверу).
  function fieldErrorEl(inputEl) {
    var id = inputEl.id + '-err';
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'field-err';
      el.style.cssText = 'color:#C98B6B;font-size:12px;margin:-6px 0 10px;min-height:14px';
      inputEl.insertAdjacentElement('afterend', el);
    }
    return el;
  }
  function showFieldError(inputEl, message) {
    if (!inputEl) return;
    fieldErrorEl(inputEl).textContent = message;
    inputEl.style.borderColor = '#C98B6B';
  }
  function clearFieldError(inputEl) {
    if (!inputEl) return;
    var el = document.getElementById(inputEl.id + '-err');
    if (el) el.textContent = '';
    inputEl.style.borderColor = '';
  }
  window.AELITA_showFieldError = showFieldError;
  window.AELITA_clearFieldError = clearFieldError;

  // Подключает live-проверку к полю: показывает/убирает ошибку под
  // полем при потере фокуса и при вводе (если поле уже было отмечено
  // ошибочным — снимаем пометку сразу, как только оно снова стало
  // валидным, не дожидаясь следующего blur). kind — 'email' | 'phone'.
  // Вызывать один раз на странице для каждого поля:
  // AELITA_wireContactValidation('j-email', 'email'); и т.п.
  window.AELITA_wireContactValidation = function (fieldId, kind) {
    var el = document.getElementById(fieldId);
    if (!el) return;
    var check = function () {
      var v = el.value.trim();
      if (!v) { clearFieldError(el); return; } // пустое поле — не подсказываем формат, только «обязательно» при отправке
      var ok = kind === 'email' ? isValidEmail(v) : normalizePhone(v) !== null;
      if (ok) clearFieldError(el);
      else showFieldError(el, kind === 'email' ? t.badEmail : t.badPhone);
    };
    el.addEventListener('blur', check);
    el.addEventListener('input', function () {
      // Пока поле пустое или уже помечено ошибкой — перепроверяем на
      // каждый ввод, чтобы ошибка исчезла сразу, как только человек её
      // исправит, а не только после следующего ухода из поля.
      if (document.getElementById(fieldId + '-err') && document.getElementById(fieldId + '-err').textContent) check();
    });
  };

  // Показывает сообщение о результате отправки формы в заданном месте
  // страницы (id элемента с текстом), а не в alert() — так текст видно
  // рядом с кнопкой, не перекрывая форму модальным окном. Если элемент
  // с таким id на странице не найден — откатываемся на alert(), чтобы
  // сообщение точно не потерялось молча.
  function showPayMsg(msgElId, text) {
    var el = msgElId ? document.getElementById(msgElId) : null;
    if (el) { el.textContent = text; el.style.display = 'block'; }
    else alert(text);
  }

  // ЗАПОЛНИТЬ после деплоя Gateway (см. _tools/Gateway/README.md) —
  // финальное значение https://api.aelita-production.ru/payments/create-payment.
  // Пока пусто — кнопки «Оплатить» показывают понятное сообщение
  // вместо тихой поломки, сайт при этом не ломается.
  var CREATE_PAYMENT_URL = 'https://api.aelita-production.ru/payments/create-payment';

  // ClientID Метрики — нужен, чтобы после реальной оплаты webhook.js мог
  // отправить честную серверную конверсию «purchase» через Measurement
  // Protocol (см. _tools/Payments/webhook.js и README.md, раздел
  // «Аналитика»). getClientID — асинхронный колбэк-метод самой
  // Метрики; если счётчик ещё не загружен (нет cookie-согласия) или
  // не успел ответить за разумное время — просто не передаём id,
  // платёж всё равно проходит как обычно, только без этой конверсии.
  function getYmClientId() {
    return new Promise(function (resolve) {
      if (!window.ym || typeof window.YM_ID === 'undefined') { resolve(null); return; }
      var settled = false;
      var finish = function (id) { if (!settled) { settled = true; resolve(id || null); } };
      try {
        window.ym(window.YM_ID, 'getClientID', finish);
      } catch (e) { finish(null); }
      setTimeout(function () { finish(null); }, 1000);
    });
  }

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
      // pack-v246: не восстанавливаем черновик, если человек вернулся
      // ПОСЛЕ успешной оплаты (метка aelita_paid=1 в return_url) — он
      // увидит благодарность «мы вас ждали» и тут же снова заполненную
      // форму, как будто оплата не прошла и надо платить ещё раз.
      // Черновик при этом стираем: он больше не нужен, а если оставить
      // — всплывёт при следующем заходе на эту же страницу.
      if (new URLSearchParams(location.search).get('aelita_paid') === '1') {
        sessionStorage.removeItem(DRAFT_KEY);
        return;
      }
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
    // pack-v242: раньше всегда вело на /account (RU), даже с EN-страниц
    // — человек создавал аккаунт и терял языковой контекст, возвращаясь
    // на русскую версию (тот же класс бага, что и на workshop-страницах,
    // см. account.js). LANG уже вычисляется выше в этом же файле.
    // location.pathname САМ по себе уже содержит /en/, если страница
    // английская (это реальный путь браузера) — добавлять префикс
    // повторно сюда нельзя, задвоится в /en/en/....
    // pack-v468 (ТЗ клиентских текстов, З-4): в next кладём якорь формы.
    // Без него человек после входа возвращался в начало длинной
    // страницы и заново искал, где платил.
    var anchor = location.hash || (document.getElementById('join') ? '#join' : (document.getElementById('pay') ? '#pay' : ''));
    location.href = (LANG === 'en' ? '/en' : '') + '/account?next=' + encodeURIComponent(location.pathname + anchor);
  }

  // product — 'community' | 'concierge' | 'gift' | 'program'. Цену для
  // community/concierge/program сервер знает сам (см. create-payment.js)
  // — amount имеет смысл только для gift. show — только для program
  // (слаг спектакля, для которого покупается программка).
  //
  // 'program' — ЕДИНСТВЕННОЕ исключение из «оплата только после
  // ЛОГИНА» (pack-v126, см. create-payment.js докстринг зачем):
  // гостевая покупка у стойки в фойе без создания аккаунта. ⚠️
  // pack-v235: имя/email/телефон теперь обязательны и здесь тоже (см.
  // opts.msgElId ниже — каждая страница передаёт id своего блока для
  // сообщений) — искючение касается только требования входа, не
  // требования контакта.
  //
  // opts.email/opts.phone — сырые значения из полей формы страницы;
  // opts.msgElId — id элемента, куда вывести сообщение об ошибке или
  // прогрессе (см. showPayMsg выше) — если не передан, используется
  // alert() как отказоустойчивый запасной вариант.
  window.AELITA_pay = async function (product, opts) {
    opts = opts || {};
    var name = (opts.name || '').trim();
    var email = (opts.email || '').trim();
    var phoneRaw = (opts.phone || '').trim();
    var amount = opts.amount;
    var show = opts.show || '';
    var comment = opts.comment || '';
    var buttonEl = opts.buttonEl || null;
    var msgElId = opts.msgElId || null;
    var giftEl = document.getElementById(opts.giftFieldId || 'j-gift');
    var giftCode = (GIFT_ON_PRODUCTS && GIFT_PRODUCTS[product] && giftEl) ? giftEl.value.trim().toUpperCase() : '';
    // З-12: получатель и сообщение для PDF сертификата — только при
    // GIFT_MESSAGE_IN_PDF и только у подарочной карты.
    var giftTo, giftMessage;
    if (GIFT_MESSAGE_IN_PDF && product === 'gift') {
      var gtEl = document.getElementById('j-recipient'), gmEl = document.getElementById('j-message');
      giftTo = gtEl && gtEl.value.trim() ? gtEl.value.trim().slice(0, 100) : undefined;
      giftMessage = gmEl && gmEl.value.trim() ? gmEl.value.trim().slice(0, 300) : undefined;
    }
    var isGuestCheckout = product === 'program'; // касается ТОЛЬКО входа/логина, не контакта — см. докстринг выше

    var nameEl = document.getElementById(opts.nameFieldId || 'j-name');
    var emailEl = document.getElementById(opts.emailFieldId || 'j-email');
    var phoneEl = document.getElementById(opts.phoneFieldId || 'j-phone');

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
      showPayMsg(msgElId, t.notConfigured);
      return;
    }

    // Имя, email, телефон — теперь ОБЯЗАТЕЛЬНЫ для любого продукта, в
    // т.ч. program (pack-v235, было раньше опущено для гостевой
    // покупки у стойки, см. докстринг выше про 54-ФЗ). Проверяем по
    // очереди и подсвечиваем ИМЕННО то поле, где ошибка — а не одно
    // общее сообщение — так человек сразу видит, что поправить.
    if (!name) {
      showFieldError(nameEl, t.badName);
      showPayMsg(msgElId, t.badName);
      if (nameEl) nameEl.focus();
      return;
    }
    if (!isValidEmail(email)) {
      showFieldError(emailEl, t.badEmail);
      showPayMsg(msgElId, t.badEmail);
      if (emailEl) emailEl.focus();
      return;
    }
    var normalizedPhone = normalizePhone(phoneRaw);
    if (!normalizedPhone) {
      showFieldError(phoneEl, t.badPhone);
      showPayMsg(msgElId, t.badPhone);
      if (phoneEl) phoneEl.focus();
      return;
    }
    // Согласие на обработку персональных данных — отдельный чекбокс
    // (id="pdConsent"), НЕ пассивная надпись у кнопки (той раньше
    // ограничивались все формы на сайте, но пассивное «нажимая кнопку,
    // вы соглашаетесь» — это не «конкретное, информированное и
    // однозначное действие», как того требует ст. 9 152-ФЗ; чекбокс,
    // который нужно осознанно поставить, соответствует требованию
    // напрямую). Есть не на каждой странице — если чекбокса на
    // странице нет, проверку пропускаем, а не блокируем оплату
    // несуществующим полем.
    var consentEl = document.getElementById('pdConsent');
    if (consentEl && !consentEl.checked) {
      showPayMsg(msgElId, t.missingConsent);
      return;
    }
    if (product === 'gift') {
      var n = Number(amount);
      if (!n || n < 500 || n > 100000) {
        showPayMsg(msgElId, t.badAmount);
        return;
      }
    }
    if (product === 'program' && !show) {
      showPayMsg(msgElId, t.missingShow);
      return;
    }

    var originalText = buttonEl ? buttonEl.textContent : '';
    if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.processing; }
    showPayMsg(msgElId, t.processing);

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
      var yandexClientId = await getYmClientId();
      // Тестовый режим — только для внутреннего тестирования, НЕ видно
      // обычным покупателям ни в интерфейсе, ни в URL по умолчанию.
      // Включается вручную дописыванием ?aelita_test=1 к адресу
      // страницы (см. _tools/Payments/README.md, «Тестовые заказы») —
      // сервер (create-payment.js) сам откажет, если тестовые
      // реквизиты ЮKassa не настроены, так что случайно оставленный
      // параметр в ссылке никого не подставит под боевой платёж.
      var isTest = new URLSearchParams(location.search).get('aelita_test') === '1';
      var res = await fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ product: product, name: name, email: email, phone: phoneRaw, amount: amount, show: show, comment: comment, return_url: returnUrl.toString(), yandex_client_id: yandexClientId, test: isTest, gift_code: giftCode || undefined, lang: LANG /* З-11 этап 5, ч. 4 (pack-v479) */, gift_to: giftTo, gift_message: giftMessage }),
      });
      if (res.status === 401) {
        if (isGuestCheckout) {
          // program не требует токена вообще — 401 здесь означает
          // что-то другое (например, случайно протухший токен из
          // localStorage помешал), не «нужно войти». Ведём себя как
          // при обычной ошибке оплаты, не отправляем на /account —

          // это гостевой сценарий, у него нет /account-предыстории.
          showPayMsg(msgElId, t.failed);
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
      // З-5 Б: карта покрыла всю сумму — платить нечего, заказ уже
      // выдан сервером. Ведём на тот же экран «Спасибо», что и после ЮKassa.
      if (data && data.zero_amount && data.redirect_url) {
        rememberPayment('gift-' + data.order_id);
        location.href = data.redirect_url;
        return;
      }
      if (data && (data.error === 'gift_code_invalid' || data.error === 'gift_card_changed' || data.error === 'gift_not_applicable')) {
        var gmsg = data.error === 'gift_card_changed' ? GIFT_TEXT.changed
          : data.error === 'gift_not_applicable' ? GIFT_TEXT.not_applicable
          : (GIFT_TEXT[data.reason] || GIFT_TEXT.not_found);
        if (giftEl) showFieldError(giftEl, gmsg);
        showPayMsg(msgElId, gmsg);
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = originalText; }
        return;
      }
      if (data && data.confirmation_url) {
        // pack-v246: сохраняем черновик и перед уходом на ЮKassa, не
        // только перед уходом на /account (goToLogin). Человек часто
        // возвращается со страницы оплаты кнопкой «назад» — передумал,
        // не хватило денег на карте, ошибся реквизитами — и раньше
        // попадал на ПУСТУЮ форму, хотя только что её заполнил
        // (у book-concierge это 9 полей, включая длинные текстовые).
        // restoreFormDraft() уже вызывается при каждой загрузке
        // страницы, так что достаточно просто сохранить здесь.
        saveFormDraft();
        rememberPayment(data.payment_id);
        location.href = data.confirmation_url;
        return; // уходим со страницы — не нужно возвращать кнопку в исходное состояние
      }
      // Сервер — окончательный источник истины по валидации (см.
      // Shared/lib/validate.js) — клиентская проверка выше в норме уже
      // отсекла bad_name/bad_email/bad_phone, но если сервер всё же
      // вернул один из этих кодов (например, другая, более старая
      // версия страницы без обновлённой проверки), подсвечиваем то же
      // поле, а не молчим общей фразой.
      if (data && data.error === 'bad_email') { showFieldError(emailEl, t.badEmail); showPayMsg(msgElId, t.badEmail); }
      else if (data && data.error === 'bad_phone') { showFieldError(phoneEl, t.badPhone); showPayMsg(msgElId, t.badPhone); }
      else if (data && data.error === 'bad_name') { showFieldError(nameEl, t.badName); showPayMsg(msgElId, t.badName); }
      else showPayMsg(msgElId, t.failed);
    } catch (e) {
      // Сеть недоступна (fetch не смог достучаться вообще, TypeError) и
      // «сервер ответил, но что-то не так» (JSON не распарсился и т.п.)
      // раньше показывали одно и то же сообщение — разницы для человека
      // почти нет («попробуйте ещё раз» подходит в обоих случаях), но
      // если сеть точно недоступна — стоит сказать прямо, а не звать
      // «попробовать ещё раз», который тут же упадёт по той же причине.
      if (e instanceof TypeError) {
        // pack-v334: TypeError здесь = ответа не пришло вовсе, значит
        // до сервера не дошло. Самая частая причина — включённый VPN:
        // страница лежит на GitHub Pages и через VPN открывается, а
        // оплата идёт в Yandex Cloud, куда с зарубежного узла запрос
        // часто не доходит. pack-v467: VPN назван как возможная
        // причина, а не как приговор, и рядом стоит адрес почты —
        // человек с выключенным VPN раньше упирался в тупик. Ветка
        // else не тронута: там сервер ОТВЕТИЛ, и про VPN писать нельзя.
        showPayMsg(msgElId, LANG === 'en'
          ? "We couldn't reach the payment server. If you're using a VPN, try without it. If that doesn't help, write to us: aelita.production@yandex.ru"
          : 'Не получилось связаться с сервером оплаты. Если у вас включён VPN, попробуйте без него. Если не поможет — напишите нам, разберёмся: aelita.production@yandex.ru');
      } else {
        showPayMsg(msgElId, t.failed);
      }
    }
    if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = originalText; }
  };
})();
