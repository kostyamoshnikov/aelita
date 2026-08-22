// AELITA PRODUCTION — личный кабинет: регистрация/вход/выход, история покупок.
// Бэкенд — Yandex Cloud Functions (_tools/Account/), см. README.md там —
// в частности, почему токен в localStorage, а не cookie.
(function () {
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
    alert('Личный кабинет ещё не подключён — напишите нам напрямую: aelita.production@yandex.ru');
  }

  var ERROR_MESSAGES = {
    bad_email: 'Проверьте адрес почты — похоже, в нём опечатка.',
    password_too_short: 'Пароль должен быть не короче 8 символов.',
    email_taken: 'Этот email уже зарегистрирован — попробуйте войти.',
    missing_credentials: 'Укажите email и пароль.',
    invalid_credentials: 'Неверный email или пароль.',
    storage_unreachable: 'Не получилось связаться с сервером. Попробуйте ещё раз.',
    server_misconfigured: 'Личный кабинет временно недоступен — напишите нам напрямую.',
  };
  function errorMessage(data) {
    return (data && ERROR_MESSAGES[data.error]) || 'Что-то пошло не так. Попробуйте ещё раз или напишите нам.';
  }

  window.AELITA_account = {
    isLoggedIn: function () { return !!getToken(); },
    logout: function () { clearToken(); },

    register: async function (email, password, opts) {
      opts = opts || {};
      if (!REGISTER_URL) { notConfigured(); return; }
      var buttonEl = opts.buttonEl || null;
      var original = buttonEl ? buttonEl.textContent : '';
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = 'Создаём аккаунт…'; }
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
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = 'Входим…'; }
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
