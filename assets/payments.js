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
    location.href = (LANG === 'en' ? '/en' : '') + '/account?next=' + encodeURIComponent(location.pathname + location.hash);
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
        body: JSON.stringify({ product: product, name: name, email: email, phone: phoneRaw, amount: amount, show: show, comment: comment, return_url: returnUrl.toString(), yandex_client_id: yandexClientId, test: isTest }),
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
      if (data && data.confirmation_url) {
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
        showPayMsg(msgElId, LANG === 'en' ? 'No connection — check your internet and try again.' : 'Нет связи с сервером — проверьте интернет и попробуйте ещё раз.');
      } else {
        showPayMsg(msgElId, t.failed);
      }
    }
    if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = originalText; }
  };
})();
