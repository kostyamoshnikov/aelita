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
      errors: {
        bad_email: 'Проверьте адрес почты — похоже, в нём опечатка.',
        password_too_short: 'Пароль должен быть не короче 8 символов.',
        email_taken: 'Этот email нам уже знаком — попробуйте войти.',
        missing_credentials: 'Укажите email и пароль.',
        invalid_credentials: 'Email или пароль не совпадают — проверьте и попробуйте ещё раз.',
        storage_unreachable: 'Не достучались до сервера. Попробуйте ещё раз через минуту.',
        server_misconfigured: 'Личный кабинет временно недоступен — напишите нам напрямую.',
      },
      fallback: 'Что-то пошло не так с нашей стороны. Попробуйте ещё раз — или напишите нам, разберёмся.',
    },
    en: {
      notConfigured: "The account isn't connected yet — email us directly: aelita.production@yandex.ru",
      creating: 'Creating account…',
      signingIn: 'Signing in…',
      errors: {
        bad_email: 'Check your email address — looks like there might be a typo.',
        password_too_short: 'Password must be at least 8 characters.',
        email_taken: 'That email is already registered — try signing in instead.',
        missing_credentials: 'Enter your email and password.',
        invalid_credentials: "Email or password doesn't match — check and try again.",
        storage_unreachable: "Couldn't reach the server. Try again in a moment.",
        server_misconfigured: 'The account is temporarily unavailable — email us directly.',
      },
      fallback: "Something went wrong on our end. Try again — or email us and we'll sort it out.",
    },
  };
  var t = TEXT[LANG];

  // ЗАПОЛНИТЬ после деплоя функций _tools/Account/ — тот же принцип,
  // что у CREATE_PAYMENT_URL в payments.js: пока пусто, формы
  // показывают понятное сообщение вместо тихой поломки.
  var REGISTER_URL = '';
  var LOGIN_URL = '';
  var ME_URL = '';

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

    register: async function (email, password, opts) {
      opts = opts || {};
      if (!REGISTER_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.creating; }
      try {
        var res = await fetch(REGISTER_URL, {
          method: 'POST',
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

    login: async function (email, password, opts) {
      opts = opts || {};
      if (!LOGIN_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = t.signingIn; }
      try {
        var res = await fetch(LOGIN_URL, {
          method: 'POST',
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
  };
})();
