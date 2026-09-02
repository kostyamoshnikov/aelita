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
        email_taken: 'Этот email нам уже знаком — попробуйте войти.',
        missing_credentials: 'Укажите email и пароль.',
        invalid_credentials: 'Email или пароль не совпадают — проверьте и попробуйте ещё раз.',
        storage_unreachable: 'Не достучались до сервера. Попробуйте ещё раз через минуту.',
        server_misconfigured: 'Личный кабинет временно недоступен — напишите нам напрямую.',
        purchase_not_found: 'Не нашли эту покупку в кабинете — обновите страницу и попробуйте ещё раз.',
        pdf_failed: 'Не получилось собрать договор. Попробуйте ещё раз или напишите нам: aelita.production@yandex.ru',
        unknown_or_closed_event: 'Регистрация на это мероприятие сейчас недоступна.',
        already_registered: 'Вы уже зарегистрированы на это мероприятие.',
        event_full: 'Мест больше нет — все места заняты.',
        not_registered: 'Регистрация не найдена — возможно, уже отменена.',
        mail_failed: 'Не удалось отправить письмо — попробуйте ещё раз через минуту. QR-код для входа виден прямо здесь, в кабинете.',
      },
      fallback: 'Что-то пошло не так с нашей стороны. Попробуйте ещё раз — или напишите нам, разберёмся.',
      passwordChanged: 'Пароль изменён.',
      registering: 'Регистрируем…',
      cancelling: 'Отменяем регистрацию…',
      resending: 'Отправляем письмо…',
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
        email_taken: 'That email is already registered — try signing in instead.',
        missing_credentials: 'Enter your email and password.',
        invalid_credentials: "Email or password doesn't match — check and try again.",
        storage_unreachable: "Couldn't reach the server. Try again in a moment.",
        server_misconfigured: 'The account is temporarily unavailable — email us directly.',
        purchase_not_found: "Couldn't find that purchase in your account — refresh the page and try again.",
        pdf_failed: "Couldn't generate the contract. Try again or email us: aelita.production@yandex.ru",
        unknown_or_closed_event: "Registration for this event isn't available right now.",
        already_registered: "You're already registered for this event.",
        event_full: 'No spots left — the event is full.',
        not_registered: "Registration not found — it may already be cancelled.",
        mail_failed: "Couldn't send the email — try again in a minute. Your entry QR code is visible right here in your account.",
      },
      fallback: "Something went wrong on our end. Try again — or email us and we'll sort it out.",
      passwordChanged: 'Password changed.',
      registering: 'Registering…',
      cancelling: 'Cancelling registration…',
      resending: 'Sending email…',
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
  // pack-v235 — регистрация на бесплатные мероприятия (_tools/Events/),
  // отдельный префикс под тем же Gateway, см. _tools/Events/README.md.
  var EVENTS_API_BASE = 'https://api.aelita-production.ru/events';
  var EVENTS_REGISTER_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/register';
  var EVENTS_CANCEL_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/cancel';
  var EVENTS_MY_URL = EVENTS_API_BASE && EVENTS_API_BASE + '/my';
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
        var res = await fetch(CONTRACT_URL + '?paymentId=' + encodeURIComponent(paymentId), {
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

    // pack-v235 — регистрация на бесплатные мероприятия (_tools/Events/).
    // Тот же принцип, что у остальных методов: токен из localStorage,
    // 401 трактуем как «нужно войти заново» (см. me() комментарий про
    // разные причины null — здесь ситуация проще: единственная причина
    // 401 у этих трёх ручек — невалидный/просроченный токен, сервер не
    // возвращает 401 ни по какой другой причине, см. register.js/
    // cancel.js/my-registrations.js в _tools/Events/).
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
      if (!token) { location.href = (LANG === 'en' ? '/en' : '') + '/account?next=' + encodeURIComponent(location.pathname + '?auto_register=1'); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.registering; }
      try {
        var res = await fetch(EVENTS_REGISTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ event_id: eventId }),
        });
        if (res.status === 401) { clearToken(); location.href = (LANG === 'en' ? '/en' : '') + '/account?next=' + encodeURIComponent(location.pathname + '?auto_register=1'); return; }
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
