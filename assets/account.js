// AELITA PRODUCTION — личный кабинет: регистрация/вход/выход, история покупок.
// Бэкенд — Yandex Cloud Functions (_tools/Account/), см. README.md там —
// в частности, почему токен в localStorage, а не cookie.
//
// Один файл на RU и EN версию сайта (общий <script src="/assets/account.js">
// на обеих) — переводческий пайплайн (_tools/DesignSystem/i18n/) сюда не
// заходит, script/style не переводятся (см. i18n/README.md). Поэтому язык
// определяем сами по document.documentElement.lang — тот же паттерн, что
// уже использует reviews.js (см. `var LANG` там).
(function () {
  var LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';

  var TEXT = {
    ru: {
      notConfigured: 'Личный кабинет ещё не подключён — напишите нам напрямую: aelita.production@yandex.ru',
      creating: 'Создаём аккаунт…',
      signingIn: 'Входим…',
      downloadingContract: 'Готовим договор…',
      changingPassword: 'Сохраняем новый пароль…',
      errors: {
        bad_name: 'Укажите имя.',
        bad_email: 'Проверьте адрес почты — похоже, в нём опечатка.',
        password_too_short: 'Пароль должен быть не короче 8 символов.',
        email_taken: 'Этот email нам уже знаком — попробуйте войти. Не помните пароль — нажмите «Забыли пароль?» у формы входа.',
        missing_credentials: 'Укажите email и пароль.',
        invalid_credentials: 'Email или пароль не совпадают — проверьте и попробуйте ещё раз. Не помните пароль — «Забыли пароль?» чуть ниже.',
        storage_unreachable: 'Не достучались до сервера. Попробуйте ещё раз через минуту.',
        server_misconfigured: 'Личный кабинет временно недоступен — напишите нам напрямую.',
        purchase_not_found: 'Не нашли эту покупку в кабинете — обновите страницу и попробуйте ещё раз.',
        pdf_failed: 'Не получилось собрать договор. Попробуйте ещё раз или напишите нам: aelita.production@yandex.ru',
        unknown_or_closed_event: 'Регистрация на это мероприятие сейчас недоступна.',
        already_registered: 'Вы уже зарегистрированы на это мероприятие.',
        event_full: 'Мест больше нет — все места заняты.',
        bad_quantity: 'Проверьте количество билетов.',
        not_registered: 'Регистрация не найдена — возможно, уже отменена.',
        mail_failed: 'Не удалось отправить письмо — попробуйте ещё раз через минуту. QR-код для входа виден прямо здесь, в кабинете.',
        auth_required: 'Сессия истекла — войдите заново, и регистрация продолжится.',
        bad_event_id: 'Не поняли, о каком мероприятии речь — обновите страницу и попробуйте ещё раз.',
        bad_json: 'Запрос не дошёл целиком — обновите страницу и попробуйте ещё раз.',
        nothing_to_change: 'Ничего не изменилось — поправьте имя или адрес и сохраните.',
        name_too_long: 'Имя слишком длинное — до 120 символов.',
        same_email: 'Это тот же адрес, что и сейчас.',
        too_many_requests: 'Слишком много запросов на этот адрес — подождите десять минут и попробуйте снова.',
        bad_reset_link: 'Ссылка недействительна: она устарела, уже использована или пароль с тех пор меняли. Запросите новую на странице входа.',
      },
      fallback: 'Что-то пошло не так с нашей стороны. Попробуйте ещё раз — или напишите нам, разберёмся.',
      passwordChanged: 'Пароль изменён.',
      savingProfile: 'Сохраняем…',
      profileSaved: 'Сохранено.',
      emailChanged: 'Адрес изменён. Письма по прошлым заказам остались на старом адресе — если нужны, нажмите «Прислать на почту», теперь они придут на новый.',
      deletingAccount: 'Удаляем аккаунт…',
      sendingReset: 'Отправляем письмо…',
      savingPassword: 'Сохраняем пароль…',
      registering: 'Регистрируем…',
      cancelling: 'Отменяем регистрацию…',
      resending: 'Отправляем письмо…',
      resentOk: 'Отправлено — проверьте почту',
      resent: 'Письмо с билетом отправлено — проверьте почту, в том числе папку «Спам».',
    },
    en: {
      notConfigured: "The account isn't connected yet — email us directly: aelita.production@yandex.ru",
      creating: 'Creating account…',
      signingIn: 'Signing in…',
      downloadingContract: 'Preparing the contract…',
      changingPassword: 'Saving new password…',
      errors: {
        bad_name: 'Please enter your name.',
        bad_email: 'Check your email address — looks like there might be a typo.',
        password_too_short: 'Password must be at least 8 characters.',
        email_taken: "That email is already registered — try signing in. Don't remember the password? Use “Forgot password?” by the sign-in form.",
        missing_credentials: 'Enter your email and password.',
        invalid_credentials: "Email or password doesn't match — check and try again. Don't remember the password? “Forgot password?” is just below.",
        storage_unreachable: "Couldn't reach the server. Try again in a moment.",
        server_misconfigured: 'The account is temporarily unavailable — email us directly.',
        purchase_not_found: "Couldn't find that purchase in your account — refresh the page and try again.",
        pdf_failed: "Couldn't generate the contract. Try again or email us: aelita.production@yandex.ru",
        unknown_or_closed_event: "Registration for this event isn't available right now.",
        already_registered: "You're already registered for this event.",
        event_full: 'No spots left — the event is full.',
        bad_quantity: 'Check the number of tickets.',
        not_registered: "Registration not found — it may already be cancelled.",
        mail_failed: "Couldn't send the email — try again in a minute. Your entry QR code is visible right here in your account.",
        auth_required: 'Your session has expired — sign in again and the registration will continue.',
        bad_event_id: "We couldn't tell which event this is — refresh the page and try again.",
        bad_json: "The request didn't arrive in full — refresh the page and try again.",
        nothing_to_change: 'Nothing changed — edit the name or the address and save.',
        name_too_long: 'That name is too long — up to 120 characters.',
        same_email: 'That is the address you already use.',
        too_many_requests: 'Too many requests for this address — wait ten minutes and try again.',
        bad_reset_link: 'This link is no longer valid: it has expired, was already used, or the password has changed since. Request a new one on the sign-in page.',
      },
      fallback: "Something went wrong on our end. Try again — or email us and we'll sort it out.",
      passwordChanged: 'Password changed.',
      savingProfile: 'Saving…',
      profileSaved: 'Saved.',
      emailChanged: 'Address changed. Emails about earlier orders stayed at the old address — if you need them, press “Email me the tickets” and they will arrive at the new one.',
      deletingAccount: 'Deleting the account…',
      sendingReset: 'Sending the email…',
      savingPassword: 'Saving the password…',
      registering: 'Registering…',
      cancelling: 'Cancelling registration…',
      resending: 'Sending email…',
      resentOk: 'Sent — check your email',
      resent: 'Ticket email sent — check your inbox, including the spam folder.',
    },
  };
  var t = TEXT[LANG];

  // ЗАПОЛНИТЬ после деплоя Gateway (см. _tools/Gateway/README.md) —
  // одно значение на всю систему: https://api.aelita-production.ru/account
  // (тот же Gateway обслуживает все четыре системы, каждая под своим
  // префиксом пути — см. _tools/SYSTEMS-CONSOLIDATION.md). До
  // заполнения формы показывают понятное сообщение, не ломаются молча.
  var API_BASE = 'https://api.aelita-production.ru/account';
  var REGISTER_URL = API_BASE && API_BASE + '/register';
  var LOGIN_URL = API_BASE && API_BASE + '/login';
  var ME_URL = API_BASE && API_BASE + '/me';
  var CONTRACT_URL = API_BASE && API_BASE + '/contract';
  var CHANGE_PASSWORD_URL = API_BASE && API_BASE + '/change-password';
  var UPDATE_PROFILE_URL = API_BASE && API_BASE + '/update-profile';
  var DELETE_ACCOUNT_URL = API_BASE && API_BASE + '/delete-account';
  var REQUEST_RESET_URL = API_BASE && API_BASE + '/request-password-reset';
  var RESET_PASSWORD_URL = API_BASE && API_BASE + '/reset-password';
  // pack-v235 — регистрация на бесплатные мероприятия (_tools/Events/),
  // отдельный префикс под тем же Gateway, см. _tools/Events/README.md.
  var EVENTS_API_BASE = 'https://api.aelita-production.ru/events';
  var EVENTS_REGISTER_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/register';
  var EVENTS_CANCEL_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/cancel';
  var EVENTS_MY_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/my';
  // pack-v371: платные билеты в кабинете (раздел «Мои билеты»).
  var TICKETS_API_BASE = 'https://api.aelita-production.ru/tickets';
  var TICKETS_MY_ORDERS_URL = TICKETS_API_BASE + '/my-orders';
  var TICKETS_RESEND_URL = TICKETS_API_BASE + '/resend-ticket';
  var EVENTS_RESEND_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/resend-ticket';

  var STORAGE_KEY = 'aelita_account_token';

  function getToken() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function setToken(token) {
    try { localStorage.setItem(STORAGE_KEY, token); } catch (e) { /* приватный режим и т.п. — просто не сохранится */ }
  }
  function clearToken() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function notConfigured() {
    alert(t.notConfigured);
  }

  function errorMessage(data) {
    return (data && t.errors[data.error]) || t.fallback;
  }

  function escapeHtml_(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  window.AELITA_account = {
    isLoggedIn: function () { return !!getToken(); },
    logout: function () { clearToken(); },

    register: async function (name, email, password, opts) {
      opts = opts || {};
      if (!REGISTER_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.creating; }
      try {
        var res = await fetch(REGISTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ name: name, email: email, password: password }),
        });
        var data = await res.json();
        if (res.ok && data.token) {
          setToken(data.token);
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    login: async function (email, password, opts) {
      opts = opts || {};
      if (!LOGIN_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.signingIn; }
      try {
        var res = await fetch(LOGIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ email: email, password: password }),
        });
        var data = await res.json();
        if (res.ok && data.token) {
          setToken(data.token);
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // Возвращает {email, createdAt, purchases} или null. Причины null
    // РАЗНЫЕ и вызывающий код должен их различать (см. dashboard):
    // 401 — токен невалиден/истёк, localStorage уже очищен ниже, можно
    // смело уводить на /account. Любая другая причина (сеть недоступна,
    // ME_URL не настроен, сервер упал) — токен НЕ трогаем: если в
    // такой ситуации всё равно редиректить на /account, а там при
    // валидном токене в localStorage редиректить обратно на dashboard —
    // получится бесконечный цикл редиректов между двумя страницами
    // (нашёл именно так, вручную проверяя кабинет — см. CHANGELOG).
    me: async function (opts) {
      opts = opts || {};
      var token = getToken();
      if (!token) return null;
      if (!ME_URL) { if (opts.onError) opts.onError(errorMessage({ error: 'server_misconfigured' })); return null; }
      try {
        var res = await fetch(ME_URL, { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401) { clearToken(); return null; } // токен истёк/недействителен — это ЕДИНСТВЕННЫЙ случай, где можно смело уводить со страницы
        var data = await res.json();
        if (res.ok) return data;
        if (opts.onError) opts.onError(errorMessage(data));
        return null;
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        return null;
      }
    },
    // Скачивает индивидуальный договор по конкретной покупке
    // (paymentId) и запускает сохранение файла в браузере. В отличие
    // от register/login/me, это не JSON — сервер отдаёт сам PDF
    // (Content-Type: application/pdf), поэтому здесь fetch → blob →
    // временная ссылка с click(), а не res.json().
    downloadContract: async function (paymentId, opts) {
      opts = opts || {};
      if (!CONTRACT_URL) { notConfigured(); return; }
      var token = getToken();
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.downloadingContract; }
      try {
        var res = await fetch(CONTRACT_URL + '?paymentId=' + encodeURIComponent(paymentId) + '&lang=' + LANG, { // З-11 этап 5, ч. 5 (pack-v480)
          headers: { Authorization: 'Bearer ' + token },
        });
        if (res.status === 401) { clearToken(); location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
        if (!res.ok) {
          var data = null;
          try { data = await res.json(); } catch (e) {}
          if (opts.onError) opts.onError(errorMessage(data));
          else alert(errorMessage(data));
          return;
        }
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'AELITA-dogovor-' + paymentId + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        if (opts.onSuccess) opts.onSuccess();
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // opts.currentPassword/newPassword — {ok:true} при успехе. Не
    // трогает токен: пароль подтверждён и так самим запросом, повторно
    // логиниться не нужно (см. комментарий в change-password.js).
    changePassword: async function (currentPassword, newPassword, opts) {
      opts = opts || {};
      if (!CHANGE_PASSWORD_URL) { notConfigured(); return; }
      var token = getToken();
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.changingPassword; }
      try {
        var res = await fetch(CHANGE_PASSWORD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword }),
        });
        if (res.status === 401) {
          var data401 = null;
          try { data401 = await res.json(); } catch (e) {}
          // 401 здесь чаще всего значит «текущий пароль не совпал», не
          // «токен истёк» (токен уже проверен раньше в этом же ответе
          // сервера, см. change-password.js) — поэтому, в отличие от
          // me()/downloadContract(), НЕ трогаем localStorage и не
          // редиректим: остаёмся на странице с понятной ошибкой.
          if (opts.onError) opts.onError(errorMessage(data401));
          else alert(errorMessage(data401));
          return;
        }
        var data = await res.json();
        if (res.ok && data.ok) {
          if (opts.onSuccess) opts.onSuccess();
          else alert(t.passwordChanged);
          return;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // pack-v439 — правка профиля и удаление аккаунта.
    //
    // 401 здесь, как и в changePassword(), означает «пароль не совпал»,
    // а не «сессия истекла»: токен сервер уже проверил раньше в том же
    // запросе. Поэтому localStorage не трогаем и никуда не уводим —
    // иначе человек, один раз ошибшись в пароле, вылетал бы из
    // кабинета.
    updateProfile: async function (fields, opts) {
      opts = opts || {};
      if (!UPDATE_PROFILE_URL) { notConfigured(); return; }
      var token = getToken();
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.savingProfile; }
      try {
        var res = await fetch(UPDATE_PROFILE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify(fields),
        });
        var data = null;
        try { data = await res.json(); } catch (e) {}
        if (res.ok && data && data.ok) {
          // Адрес сменился — старый токен подписывал старый адрес и
          // теперь везде отвечал бы 401. Подменяем молча: человек
          // просил сменить почту, а не войти заново.
          if (data.token) setToken(data.token);
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // Удаление аккаунта. Предупреждение о том, ЧТО именно останется
    // (оплаченные заказы как учётные документы, уже выданные билеты),
    // показывает страница до вызова — здесь только действие: библиотека
    // не место для текста, от которого зависит решение человека.
    deleteAccount: async function (currentPassword, opts) {
      opts = opts || {};
      if (!DELETE_ACCOUNT_URL) { notConfigured(); return; }
      var token = getToken();
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.deletingAccount; }
      try {
        var res = await fetch(DELETE_ACCOUNT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ currentPassword: currentPassword }),
        });
        var data = null;
        try { data = await res.json(); } catch (e) {}
        if (res.ok && data && data.deleted) {
          clearToken();
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // pack-v448 — восстановление пароля. Без токена: человек как раз
    // не может войти. Ответ сервера одинаковый, есть аккаунт или нет
    // (см. _tools/Account/request-password-reset.js) — поэтому и здесь
    // успех один на всех: «если адрес есть, письмо в пути».
    requestPasswordReset: async function (email, opts) {
      opts = opts || {};
      if (!REQUEST_RESET_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.sendingReset; }
      try {
        var res = await fetch(REQUEST_RESET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ email: email, lang: LANG }),
        });
        var data = null;
        try { data = await res.json(); } catch (e) {}
        if (res.ok && data && data.ok) {
          if (opts.onSuccess) opts.onSuccess();
          return true;
        }
        if (opts.onError) opts.onError(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    resetPassword: async function (token, newPassword, opts) {
      opts = opts || {};
      if (!RESET_PASSWORD_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.savingPassword; }
      try {
        var res = await fetch(RESET_PASSWORD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ token: token, newPassword: newPassword }),
        });
        var data = null;
        try { data = await res.json(); } catch (e) {}
        if (res.ok && data && data.ok) {
          // Сразу входим: сервер выдал сессию. Без токена (редкий сбой
          // подписи) — просто без автоматического входа.
          if (data.token) setToken(data.token);
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // pack-v235 — регистрация на бесплатные мероприятия (_tools/Events/).
    // Тот же принцип, что у остальных методов: токен из localStorage,
    // 401 трактуем как «нужно войти заново» (см. me() комментарий про
    // разные причины null — здесь ситуация проще: единственная причина
    // 401 у этих трёх ручек — невалидный/просроченный токен, сервер не
    // возвращает 401 ни по какой другой причине, см. register.js/
    // cancel.js/my-registrations.js в _tools/Events/).
    // pack-v363: открыта ли регистрация на событие. Нужна страницам
    // деловой программы, которые по умолчанию показывают «регистрация
    // ещё не открыта» и разворачивают форму, только если сервер
    // подтвердил обратное. Единственный источник правды — поле status
    // в _tools/Events/config/events.js; страницы его НЕ дублируют.
    // Запрос без токена и без побочных эффектов (probe:true), поэтому
    // вызывается и для неавторизованного посетителя.
    // pack-v364: единый текст подтверждения регистрации для ВСЕХ
    // страниц с регистрацией. До этого он был скопирован в разметку
    // каждой страницы, и копии уже разошлись: страницы встреч
    // обрабатывали несколько билетов и сбой почты, новые страницы
    // лекций (pack-v363) — нет, потому что блок переносили руками.
    // Тот же урок, что с reviews.js (pack-v358): один текст в двух
    // местах расходится молча.
    //
    // Что показываем сверх прежнего — подсмотрено на странице
    // подтверждения Timepad: АДРЕС ПОЧТЫ, на который ушло письмо
    // (человек регистрируется через кабинет и не всегда помнит, какой
    // email там указан — без адреса он не знает, где искать), контакт
    // поддержки в обычном случае, а не только при сбое, и «как
    // добраться», пока страница открыта.
    registrationSuccessHtml: function (data) {
      data = data || {};
      var gold = 'style="color:var(--gold)"';
      var mail = 'aelita.production@yandex.ru';
      var qty = Number(data.quantity) || 1;
      var dash = LANG === 'en' ? '/en' : '';
      var L = LANG === 'en'
        ? {
            okFail: function (q) { return 'Done — you are registered' + (q > 1 ? ', tickets: ' + q : '') + '. We could not send the email with your ticket, but the registration is saved — you will find it in your '; },
            cabinet: 'account', ifNeed: '. If you need the ticket by email, write to us: ',
            okHead: function (q) { return 'Thank you — you are registered' + (q > 1 ? ', tickets: ' + q : '') + '! '; },
            many: function (to) { return 'All tickets with QR codes have been sent in a single email' + to + ' — at the entrance each one shows its own code.'; },
            one: function (to) { return 'A ticket with a QR code has been sent' + to + '.'; },
            toMail: ' to ', toDefault: ' to your email',
            cancel: ' You can cancel the registration in your ',
            where: 'Where: ', how: 'how to get there', when: 'When: ',
            spam: 'Email not arrived? Check your spam folder. If it is not there either — write to ',
            spamTail: ', stating the name of the event.',
          }
        : {
            okFail: function (q) { return 'Готово — вы зарегистрированы' + (q > 1 ? ', билетов: ' + q : '') + '. Письмо с билетом отправить не удалось, но регистрация сохранена — найдёте её в '; },
            cabinet: 'личном кабинете', ifNeed: '. Если билет нужен на почту — напишите нам: ',
            okHead: function (q) { return 'Спасибо, вы зарегистрированы' + (q > 1 ? ', билетов: ' + q : '') + '! '; },
            many: function (to) { return 'Все билеты с QR-кодами отправлены одним письмом' + to + ' — на входе каждый показывает свой код.'; },
            one: function (to) { return 'Билет с QR-кодом отправлен' + to + '.'; },
            toMail: ' на ', toDefault: ' на почту',
            cancel: ' Отменить регистрацию можно в ',
            where: 'Где: ', how: 'как добраться', when: 'Когда: ',
            spam: 'Письмо не пришло? Загляните в папку «Спам». Если его нет и там — напишите на ',
            spamTail: ', указав название события.',
          };
      var cab = '<a href="' + dash + '/account/dashboard" ' + gold + '>' + L.cabinet + '</a>';

      if (data.mailSent === false) {
        return '<p ' + gold + '>' + L.okFail(qty) + cab + L.ifNeed +
          '<a href="mailto:' + mail + '" ' + gold + '>' + mail + '</a>.</p>';
      }

      var to = data.email ? L.toMail + '<strong>' + escapeHtml_(data.email) + '</strong>' : L.toDefault;
      var html = '<p ' + gold + '>' + L.okHead(qty) + (qty > 1 ? L.many(to) : L.one(to)) + L.cancel + cab + '.</p>';

      if (data.venueLabel) {
        html += '<p style="color:var(--sand);font-size:14px;margin-top:10px">' + L.where + escapeHtml_(data.venueLabel) +
          ' · <a href="https://yandex.ru/maps/?text=' + encodeURIComponent(data.venueLabel) + '" target="_blank" rel="noopener" ' + gold + '>' + L.how + '</a>' +
          (data.datetimeLabel ? '<br>' + L.when + escapeHtml_(data.datetimeLabel) : '') + '</p>';
      }

      html += '<p style="color:var(--sand);font-size:13px;margin-top:10px">' + L.spam +
        '<a href="mailto:' + mail + '" ' + gold + '>' + mail + '</a>' + L.spamTail + '</p>';
      return html;
    },

    isEventOpen: async function (eventId) {
      if (!EVENTS_REGISTER_URL) return false;
      try {
        var res = await fetch(EVENTS_REGISTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: String(eventId || ''), probe: true }),
        });
        var data = await res.json().catch(function () { return null; });
        if (data && typeof data.open === 'boolean') return data.open;
        return !(data && data.error === 'unknown_or_closed_event');
      } catch (e) {
        // Сеть недоступна — не обещаем того, чего не знаем.
        return false;
      }
    },

    registerForEvent: async function (eventId, opts) {
      opts = opts || {};
      if (!EVENTS_REGISTER_URL) { notConfigured(); return; }
      var token = getToken();
      // pack-v242: добавлен ?auto_register=1 к next= — если токен
      // истёк ровно между загрузкой страницы (где кнопка уже была
      // показана как «войдите») и кликом, человека всё равно вернут
      // сюда и продолжат регистрацию автоматически, не просто на
      // пустую страницу мероприятия. Основной путь (не залогинен с
      // самого начала) — та же логика зашита статично в href на
      // самих страницах мероприятий (regLoggedOut), здесь — подстраховка
      // на редкий гоночный случай.
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account?next=' + encodeURIComponent(location.pathname + '?auto_register=1#join'); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.registering; }
      try {
        // pack-v296: quantity — сколько билетов за одну регистрацию
        // (по умолчанию 1, прежнее поведение без изменений для
        // страниц, ещё не обновлённых под селектор количества).
        var res = await fetch(EVENTS_REGISTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ event_id: eventId, quantity: opts.quantity || 1, lang: LANG }), // З-11 этап 5, ч. 3 (pack-v478): язык письма и первой страницы PDF
        });
        if (res.status === 401) { clearToken(); location.href = (LANG === 'en' ? '/en' : '') + '/account?next=' + encodeURIComponent(location.pathname + '?auto_register=1#join'); return; }
        var data = await res.json();
        if (res.ok) {
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    cancelEventRegistration: async function (eventId, opts) {
      opts = opts || {};
      if (!EVENTS_CANCEL_URL) { notConfigured(); return; }
      var token = getToken();
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.cancelling; }
      try {
        var res = await fetch(EVENTS_CANCEL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ event_id: eventId }),
        });
        if (res.status === 401) { clearToken(); location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
        var data = await res.json();
        if (res.ok) {
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // pack-v246: повторная отправка PDF-билета на почту — если письмо
    // потерялось или ушло в спам. Отправляется всегда СЕБЕ: адрес
    // сервер берёт из проверенного токена, не из тела запроса (см.
    // _tools/Events/resend-ticket.js), поэтому здесь передаётся только
    // event_id. QR в письме тот же самый, что и в первом — старое
    // письмо не протухает, оба билета валидны на входе.
    resendEventTicket: async function (eventId, opts) {
      opts = opts || {};
      if (!EVENTS_RESEND_URL) { notConfigured(); return; }
      var token = getToken();
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.resending; }
      try {
        var res = await fetch(EVENTS_RESEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ event_id: eventId }),
        });
        if (res.status === 401) { clearToken(); location.href = (LANG === 'en' ? '/en' : '') + '/account'; return; }
        var data = await res.json();
        if (res.ok) {
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (opts.onError) opts.onError(errorMessage(data));
        else alert(errorMessage(data));
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        else alert(errorMessage(null));
      } finally {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
      }
    },

    // Список активных регистраций для /account/dashboard — та же
    // осторожность с null, что у me(): 401 значит «уводить на
    // /account», любая другая причина — «сеть/сервер, оставаться на
    // странице с ошибкой».
    listEventRegistrations: async function (opts) {
      opts = opts || {};
      var token = getToken();
      if (!token) return null;
      if (!EVENTS_MY_URL) { if (opts.onError) opts.onError(errorMessage({ error: 'server_misconfigured' })); return null; }
      try {
        var res = await fetch(EVENTS_MY_URL, { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401) { clearToken(); return null; }
        var data = await res.json();
        if (res.ok) return data;
        if (opts.onError) opts.onError(errorMessage(data));
        return null;
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        return null;
      }
    },

    // pack-v371: заказы билетов текущего кабинета. Та же осторожность
    // с null, что у listEventRegistrations: 401 — «уводить на
    // /account», остальное — «остаться на странице с ошибкой».
    listTicketOrders: async function (opts) {
      opts = opts || {};
      var token = getToken();
      if (!token) return null;
      try {
        var res = await fetch(TICKETS_MY_ORDERS_URL, { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401) { clearToken(); return null; }
        var data = await res.json();
        if (res.ok) return data;
        if (opts.onError) opts.onError(errorMessage(data));
        return null;
      } catch (e) {
        if (opts.onError) opts.onError(errorMessage(null));
        return null;
      }
    },

    // Выслать себе билеты повторно. Кнопку блокируем на время запроса:
    // второе нажатие — второе письмо, а не ускорение первого.
    resendTicketOrder: async function (orderId, opts) {
      opts = opts || {};
      var token = getToken();
      if (!token) { if (opts.onError) opts.onError(errorMessage({ error: 'auth_required' })); return null; }
      var buttonEl = opts.buttonEl;
      var original = buttonEl ? buttonEl.textContent : null;
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.resending; }
      try {
        var res = await fetch(TICKETS_RESEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ order_id: orderId }),
        });
        var data = await res.json().catch(function () { return null; });
        if (res.ok && data && data.ok) {
          if (buttonEl) buttonEl.textContent = t.resentOk;
          if (opts.onSuccess) opts.onSuccess(data);
          return data;
        }
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
        if (opts.onError) opts.onError(errorMessage(data));
        return null;
      } catch (e) {
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = original; }
        if (opts.onError) opts.onError(errorMessage(null));
        return null;
      }
    },

    // Экспорт данных заказчика (152-ФЗ) — из уже загруженных me()
    // данных, БЕЗ отдельного запроса к серверу: всё, что сервер вообще
    // отдаёт про аккаунт (email, дата регистрации, покупки), уже есть
    // на странице к моменту, когда кабинет отрисован. Отдельная Cloud
    // Function для этого не нужна.
    exportData: function (accountData) {
      var blob = new Blob([JSON.stringify(accountData, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'aelita-account-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },
  };
})();
