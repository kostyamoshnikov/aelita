// AELITA PRODUCTION — подписка AELITA COMMUNITY (pack-v542).
//
// Один файл на три места и два языка (язык — по <html lang>, как у
// payments.js и account.js: переводческий пайплайн в <script> не заходит):
//   • страницы оплаты /book-space/main/pay и /book-space/business/pay
//     (main[data-plan]) — форма, вход/регистрация прямо в форме, статус
//     уже оформленной подписки, экран после возврата с ЮKassa;
//   • блок «Подписки» в личном кабинете (#subscriptions);
//   • страница по ссылке из письма /account/subscription/?t=… (#subLink) —
//     отмена и продление без входа.
//
// Цена, которую спишут, — только на сервере (Shared/lib/subscriptions.js).
// Здесь — подписи и проверки для мгновенной подсказки.
(function () {
  var LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';
  var EN = LANG === 'en';
  var PREFIX = EN ? '/en' : '';
  var API = 'https://api.aelita-production.ru';
  var SUBS_API = API + '/payments/subscriptions';
  var PAY_API = API + '/payments/create-payment';
  var ACCOUNT_API = API + '/account';
  var TOKEN_KEY = 'aelita_account_token';
  var QS = new URLSearchParams(location.search);
  var IS_TEST = QS.get('aelita_test') === '1';

  // ⚠️ Пара с переменной SUBSCRIPTIONS_ENABLED у функций Payments (выпуск 3
  // ТЗ). Пока false — на странице оплаты строка «Автосписание включим в
  // ближайшие дни». Вошедшему человеку сервер сам говорит, включено ли
  // (GET /payments/subscriptions → enabled), и это побеждает константу.
  var AUTOPAY_LIVE = true;
  // ⚠️ Пара с COMPANY_INVOICES_ENABLED (выпуск 4 ТЗ, оплата от компании по
  // счёту). Обе половины переключает _tools/Payments/subscriptions_switch.py
  // invoices on|off; аудит `subscriptions` сверяет.
  var INVOICES_LIVE = false;
  var INVOICE_API = API + '/payments/company-invoice';

  var MONTHS = {
    ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };

  var T = {
    ru: {
      plans: { community_main: 'AELITA COMMUNITY — основной поток', community_biz: 'AELITA COMMUNITY — поток для предпринимателей' },
      today: ' сегодня',
      payFirst: 'Оплатить первый месяц — ',
      payNextBtn: 'Оплатить следующий месяц — ',
      extendTail: function (s) { return ' — участие продлится с ' + d(s.paidThrough) + ' ещё на месяц.'; },
      alreadyTitle: { active: 'Подписка действует', past_due: 'Списание не прошло', canceled: 'Подписка отменена', invoice: 'Оплачено компанией', other: 'Участие оплачено' },
      resultPaidTitle: 'Оплата прошла',
      whenTail: function (day) { return day > 28 ? ', дальше ' + day + '-го числа каждого месяца (в коротких месяцах — в последний день) — до отмены.' : ', дальше ' + day + '-го числа каждого месяца — до отмены.'; },
      perMonth: ' ₽ в месяц',
      badName: 'Укажите имя',
      badEmail: 'Проверьте email — похоже, в адресе опечатка',
      badPhone: 'Проверьте телефон — похоже, номер введён не полностью или с ошибкой',
      needPd: 'Отметьте согласие на обработку персональных данных.',
      needAutopay: 'Отметьте согласие на ежемесячное автосписание — без него подписку оформить нельзя.',
      needPassword: 'Придумайте пароль для личного кабинета — не короче 8 символов. В кабинете подписку можно отменить.',
      needLoginPassword: 'Введите пароль от личного кабинета.',
      registering: 'Заводим личный кабинет…',
      signingIn: 'Входим в кабинет…',
      emailTaken: 'На эту почту кабинет уже есть — введите пароль от него.',
      wrongPassword: 'Пароль не подошёл.',
      forgot: 'Забыли пароль?',
      resetSent: 'Ссылка для нового пароля отправлена на почту. Задайте пароль, вернитесь на эту вкладку и нажмите кнопку ещё раз.',
      toLogin: 'Уже есть кабинет — войти',
      toRegister: 'Нет кабинета — создать',
      pwLabelRegister: 'Пароль для личного кабинета',
      pwLabelLogin: 'Пароль от личного кабинета',
      processing: 'Переходим к оплате…',
      failed: 'Оплата не началась. Попробуйте ещё раз — или напишите нам: aelita.production@yandex.ru',
      network: 'Не получилось связаться с сервером оплаты. Если у вас включён VPN, попробуйте без него. Если не поможет — напишите нам: aelita.production@yandex.ru',
      gift: {
        not_found: 'Такой код подарочной карты не найден — он в PDF сертификата, вида AELITA-XXXX-XXXX-XXXX.',
        inactive: 'Эта подарочная карта не активна. Напишите нам: aelita.production@yandex.ru',
        depleted: 'На этой карте не осталось средств. Уберите код, чтобы оплатить без неё.',
        rate_limited: 'Слишком много попыток ввести код. Подождите 10 минут.',
        changed: 'Остаток карты только что изменился. Нажмите кнопку ещё раз.',
        not_applicable: 'Подарочную карту здесь пока принять нельзя. Уберите код, чтобы оплатить без неё.',
      },
      signedOut: 'Сессия кабинета истекла — войдите ещё раз.',
      alreadyActive: function (s) { return 'Следующее списание — ' + d(s.nextChargeAt) + ', ' + rub(s.amount) + '.'; },
      alreadyPastDue: function (s) { return 'Последнее списание не прошло — повторим ' + d(s.nextRetryAt) + '. Сменить карту можно в личном кабинете.'; },
      alreadyCanceled: function (s) { return 'Подписка отменена, участие до ' + d(s.paidThrough) + '. Передумали — возобновите без новой оплаты, график прежний.'; },
      alreadyPaid: function (s) { return 'Участие оплачено до ' + d(s.paidThrough) + '. За 3 дня до конца пришлём письмо — следующий месяц можно будет оплатить здесь же.'; },
      resumed: 'Подписка снова действует.',
      resultChecking: 'Проверяем оплату…',
      resultOkActive: function (s) { return 'Следующее списание — ' + d(s.nextChargeAt) + ', ' + rub(s.amount) + '. Отменить можно в личном кабинете.'; },
      resultOkAwaiting: function (s) { return 'Участие оплачено до ' + d(s.paidThrough) + '. За 3 дня до конца месяца напомним письмом, как оплатить следующий.'; },
      resultOkNoAutopay: function (s) { return 'Участие оплачено до ' + d(s.paidThrough) + ', но платёжный сервис не сохранил карту для автосписаний. Чтобы продолжить после этой даты, оформите подписку снова.'; },
      resultSlowTitle: 'Оплата обрабатывается',
      resultSlow: 'Если деньги списались, письмо с подтверждением придёт в течение нескольких минут. Если оплата не прошла — деньги не списаны, попробуйте ещё раз ниже.',
      resultFailTitle: 'Оплата не прошла — попробуйте ещё раз',
      // кабинет
      status: {
        active: function (s) { return 'Следующее списание ' + d(s.nextChargeAt) + ' · ' + rub(s.amount); },
        past_due: function (s) { return 'Списание не прошло, повторим ' + d(s.nextRetryAt); },
        canceled: function (s) { return 'Отменена, участие до ' + d(s.paidThrough); },
        awaiting_autopay: function (s) { return 'Оплачено до ' + d(s.paidThrough) + (s.cardUnlinkedAt ? ' · карта отвязана' : '') + ' · следующий месяц — оплатой на странице потока'; },
        no_autopay: function (s) { return 'Оплачено до ' + d(s.paidThrough) + (s.cardUnlinkedAt ? ' · карта отвязана' : ' · карта не сохранилась') + ', следующий месяц — оплатой на странице потока'; },
        suspended: function () { return 'Не действует: три попытки списания не прошли'; },
        invoice: function (s) { return T.invStatus(s); },
        ended: function () { return 'Не действует'; },
      },
      btn: {
        changeCard: 'Сменить карту', payOther: 'Оплатить другой картой', cancel: 'Отменить подписку', unlinkCard: 'Отвязать карту',
        refund: function (s) { return 'Отменить и вернуть ' + rub(s.refund.amount); },
        resume: 'Возобновить подписку', renew: 'Подключить автосписание', again: 'Оформить снова', payNext: 'Оплатить следующий месяц',
      },
      sheetCancel: function (s) { if (!s.hasAutopay && s.paidThrough && (s.status === 'awaiting_autopay' || s.status === 'no_autopay')) return 'Напоминаний об оплате больше не будет. Участие сохранится до ' + d(s.paidThrough) + '.'; return s.status === 'past_due' || s.status === 'awaiting_autopay' && !s.paidThrough ? 'Списаний больше не будет.' : 'Списаний больше не будет. Участие сохранится до ' + d(s.paidThrough) + '.'; },
      sheetRefund: function (s) { return 'Вернём ' + rub(s.refund.amount) + (s.refund.full ? '' : ' — за неиспользованные дни этого месяца') + ' на карту в течение нескольких дней, участие закончится сегодня.'; },
      // pack-v560: отвязка карты — токен стирается у нас, ЮKassa сообщать не нужно.
      sheetUnlink: function (s) { return 'Карта ' + (s.methodTitle || '') + ' будет удалена из личного кабинета и из нашей системы — списывать с неё мы больше не сможем.' + (s.status === 'active' ? ' Участие сохранится до ' + d(s.paidThrough) + ', следующий месяц можно будет оплатить на странице потока.' : s.status === 'past_due' ? ' Последнее списание не прошло — участие закончится сегодня.' : ''); },
      unlinked: 'Карта отвязана и удалена из нашей системы.',
      // pack-v544: при отмене согласие на автосписание отзывается, а
      // «Возобновить» возвращает списания с сохранённой карты — человек
      // должен видеть это явно, до нажатия (п. 14.2–14.3 оферты).
      sheetResume: function (s) { return s.hasAutopay ? 'Подписка снова будет действовать. ' + rub(s.amount) + ' спишем ' + d(s.paidThrough) + ' с карты ' + (s.methodTitle || '') + ' и дальше каждый месяц в это число. Отменить можно в любой момент.' : 'Подписка снова будет действовать до ' + d(s.paidThrough) + '. Автосписания нет — продлить можно будет на странице тарифа.'; },
      confirm: 'Подтвердить', keep: 'Не надо',
      card: 'Карта', test: 'тест',
      done: 'Готово.', error: 'Не получилось — попробуйте ещё раз или напишите нам: aelita.production@yandex.ru',
      refundClosed: 'Возвращать нечего: оплаченный месяц уже закончился.',
      notEnabled: 'Автосписание ещё не включено — пришлём письмо, когда его можно будет подключить.',
      actErr: {
        charge_in_progress: 'Сейчас идёт списание по подписке — попробуйте через несколько минут.',
        no_card: 'Сохранённой карты уже нет — обновите страницу.',
        not_refundable: 'По этой подписке вернуть деньги уже нельзя — обновите страницу.',
        refund_rejected: 'Платёжный сервис не принял возврат. Напишите нам: aelita.production@yandex.ru — вернём вручную.',
        yookassa_unreachable: 'Платёжный сервис не ответил — попробуйте через минуту.',
      },
      cardReturn: 'Если оплата прошла, новая карта сохранится в течение минуты — обновите страницу.',
      // ссылка из письма
      linkBad: 'Ссылка не подошла — возможно, её скопировали не целиком. Отменить подписку можно и в личном кабинете.',
      linkCanceled: 'Подписка отменена. Письмо с подтверждением — на почте.',
      linkNothing: 'Подписка уже не действует — отменять нечего.',
      linkRenewDone: 'Спасибо! Если оплата прошла, автосписание подключится в течение минуты — письмо придёт на почту.',
      inv: {
        badCompany: 'Укажите название компании', badInn: 'Проверьте ИНН — 10 цифр у организации, 12 у ИП', badKpp: 'Укажите КПП — 9 цифр',
        badAddress: 'Укажите юридический адрес', badAccEmail: 'Проверьте почту бухгалтерии', badEmail: 'Проверьте email участника',
        badPhone: 'Проверьте телефон участника', badName: 'Укажите имя участника', needPd: 'Отметьте согласие на обработку персональных данных.',
        sending: 'Выставляем счёт…', already: 'У этого участника уже есть действующая подписка на поток — второй счёт не нужен.',
        limited: 'Слишком много запросов — попробуйте через 10 минут или напишите нам: aelita.production@yandex.ru',
        done: function (r) { return 'Счёт № ' + r.number + ' на ' + rub(r.amount) + ' отправлен на почту бухгалтерии, копия — участнику. Оплатить до ' + d(r.due_on) + '.'; },
      },
      invStatus: function (s) { return 'Оплачено компанией' + (s.invoice && s.invoice.company ? ' (' + s.invoice.company + ')' : '') + ' до ' + d(s.paidThrough) + (s.invoice && s.invoice.noRenew ? ' · продление отключено' : ' · за 7 дней до конца компании придёт новый счёт'); },
      btnNoRenew: 'Не продлевать', btnRenewOn: 'Продлевать',
      locale: 'ru-RU',
    },
    en: {
      plans: { community_main: 'AELITA COMMUNITY — main stream', community_biz: 'AELITA COMMUNITY — entrepreneurs stream' },
      today: ' today',
      payFirst: 'Pay for the first month — ',
      payNextBtn: 'Pay for the next month — ',
      extendTail: function (s) { return ' — your participation is extended from ' + d(s.paidThrough) + ' for another month.'; },
      alreadyTitle: { active: 'Subscription active', past_due: 'Payment failed', canceled: 'Subscription cancelled', invoice: 'Paid by your company', other: 'Participation paid' },
      resultPaidTitle: 'Payment received',
      whenTail: function (day) { return day > 28 ? ', then on day ' + day + ' of every month (on the last day in shorter months) — until you cancel.' : ', then on day ' + day + ' of every month — until you cancel.'; },
      perMonth: ' ₽ per month',
      badName: 'Please enter your name',
      badEmail: "Check your email — the address doesn't look right",
      badPhone: 'Check your phone number — it looks incomplete or incorrect',
      needPd: 'Please tick the personal data consent box.',
      needAutopay: 'Please tick the consent to monthly automatic payments — the subscription cannot be set up without it.',
      needPassword: 'Choose a password for your account — at least 8 characters. You can cancel the subscription in your account.',
      needLoginPassword: 'Enter your account password.',
      registering: 'Creating your account…',
      signingIn: 'Signing in…',
      emailTaken: 'There is already an account with this email — enter its password.',
      wrongPassword: 'The password did not match.',
      forgot: 'Forgot your password?',
      resetSent: 'A link to set a new password has been emailed to you. Set it, come back to this tab and press the button again.',
      toLogin: 'Already have an account — sign in',
      toRegister: 'No account — create one',
      pwLabelRegister: 'Password for your account',
      pwLabelLogin: 'Account password',
      processing: 'Redirecting to payment…',
      failed: "The payment didn't start. Try again — or email us: aelita.production@yandex.ru",
      network: "We couldn't reach the payment server. If you're using a VPN, try without it. If that doesn't help, write to us: aelita.production@yandex.ru",
      gift: {
        not_found: 'Gift card code not found — it is in the certificate PDF and looks like AELITA-XXXX-XXXX-XXXX.',
        inactive: 'This gift card is not active. Write to us: aelita.production@yandex.ru',
        depleted: 'There is no balance left on this card. Remove the code to pay without it.',
        rate_limited: 'Too many attempts. Wait 10 minutes.',
        changed: 'The card balance has just changed. Press the button again.',
        not_applicable: 'A gift card cannot be used here yet. Remove the code to pay without it.',
      },
      signedOut: 'Your session has expired — please sign in again.',
      alreadyActive: function (s) { return 'Next payment: ' + d(s.nextChargeAt) + ', ' + rub(s.amount) + '.'; },
      alreadyPastDue: function (s) { return 'The last payment did not go through — we will try again on ' + d(s.nextRetryAt) + '. You can change the card in your account.'; },
      alreadyCanceled: function (s) { return 'The subscription is cancelled, participation until ' + d(s.paidThrough) + '. Changed your mind? Resume it without paying again — same schedule.'; },
      alreadyPaid: function (s) { return 'Participation is paid until ' + d(s.paidThrough) + '. We will email you 3 days before it ends — you can pay for the next month right here.'; },
      resumed: 'The subscription is active again.',
      resultChecking: 'Checking your payment…',
      resultOkActive: function (s) { return 'Next payment: ' + d(s.nextChargeAt) + ', ' + rub(s.amount) + '. You can cancel in your account.'; },
      resultOkAwaiting: function (s) { return 'Participation is paid until ' + d(s.paidThrough) + '. 3 days before the month ends we will email you how to pay for the next one.'; },
      resultOkNoAutopay: function (s) { return 'Participation is paid until ' + d(s.paidThrough) + ', but the payment service did not save your card for automatic payments. To continue after that date, subscribe again.'; },
      resultSlowTitle: 'Your payment is being processed',
      resultSlow: 'If you were charged, a confirmation email will arrive within a few minutes. If the payment did not go through, no money was taken — try again below.',
      resultFailTitle: 'The payment did not go through — please try again',
      status: {
        active: function (s) { return 'Next payment ' + d(s.nextChargeAt) + ' · ' + rub(s.amount); },
        past_due: function (s) { return 'The payment failed, we will retry on ' + d(s.nextRetryAt); },
        canceled: function (s) { return 'Cancelled, participation until ' + d(s.paidThrough); },
        awaiting_autopay: function (s) { return 'Paid until ' + d(s.paidThrough) + (s.cardUnlinkedAt ? ' · card removed' : '') + ' · pay for the next month on the stream page'; },
        no_autopay: function (s) { return 'Paid until ' + d(s.paidThrough) + (s.cardUnlinkedAt ? ' · card removed' : ' · the card was not saved') + ', pay for the next month on the stream page'; },
        suspended: function () { return 'Inactive: three payment attempts failed'; },
        invoice: function (s) { return T.invStatus(s); },
        ended: function () { return 'Inactive'; },
      },
      btn: {
        changeCard: 'Change card', payOther: 'Pay with another card', cancel: 'Cancel subscription', unlinkCard: 'Remove card',
        refund: function (s) { return 'Cancel and refund ' + rub(s.refund.amount); },
        resume: 'Resume subscription', renew: 'Connect automatic payments', again: 'Subscribe again', payNext: 'Pay for the next month',
      },
      sheetCancel: function (s) { if (!s.hasAutopay && s.paidThrough && (s.status === 'awaiting_autopay' || s.status === 'no_autopay')) return 'We will stop sending payment reminders. Your participation continues until ' + d(s.paidThrough) + '.'; return s.status === 'past_due' ? 'There will be no more charges.' : 'There will be no more charges. Your participation continues until ' + d(s.paidThrough) + '.'; },
      sheetRefund: function (s) { return 'We will refund ' + rub(s.refund.amount) + (s.refund.full ? '' : ' for the unused days of this month') + ' to your card within a few days; your participation ends today.'; },
      sheetUnlink: function (s) { return 'The card ' + (s.methodTitle || '') + ' will be removed from your account and from our system — we will not be able to charge it any more.' + (s.status === 'active' ? ' Your participation continues until ' + d(s.paidThrough) + '; you can pay for the next month on the stream page.' : s.status === 'past_due' ? ' The last payment did not go through — your participation ends today.' : ''); },
      unlinked: 'The card has been removed from our system.',
      sheetResume: function (s) { return s.hasAutopay ? 'Your subscription will be active again. We will charge ' + rub(s.amount) + ' on ' + d(s.paidThrough) + ' to ' + (s.methodTitle || 'your saved card') + ' and then on that day every month. You can cancel at any time.' : 'Your subscription will be active again until ' + d(s.paidThrough) + '. There are no automatic payments — you can renew on the plan page.'; },
      confirm: 'Confirm', keep: 'Keep it',
      card: 'Card', test: 'test',
      done: 'Done.', error: 'Something went wrong — try again or email us: aelita.production@yandex.ru',
      refundClosed: 'Nothing to refund: the paid month has already ended.',
      notEnabled: 'Automatic payments are not switched on yet — we will email you when you can connect them.',
      actErr: {
        charge_in_progress: 'A subscription payment is being processed right now — try again in a few minutes.',
        no_card: 'There is no saved card any more — refresh the page.',
        not_refundable: 'A refund is no longer possible for this subscription — refresh the page.',
        refund_rejected: 'The payment service did not accept the refund. Email us at aelita.production@yandex.ru — we will refund it manually.',
        yookassa_unreachable: 'The payment service did not respond — try again in a minute.',
      },
      cardReturn: 'If the payment went through, the new card will be saved within a minute — refresh the page.',
      linkBad: 'This link did not work — perhaps it was not copied in full. You can also cancel the subscription in your account.',
      linkCanceled: 'The subscription is cancelled. A confirmation email is on its way.',
      linkNothing: 'The subscription is no longer active — there is nothing to cancel.',
      linkRenewDone: 'Thank you! If the payment went through, automatic payments will be connected within a minute — you will get an email.',
      inv: {
        badCompany: 'Enter the company name', badInn: 'Check the INN — 10 digits for a company, 12 for a sole trader', badKpp: 'Enter the KPP — 9 digits',
        badAddress: 'Enter the registered address', badAccEmail: 'Check the accounts email', badEmail: 'Check the participant\'s email',
        badPhone: 'Check the participant\'s phone', badName: 'Enter the participant\'s name', needPd: 'Please tick the personal data consent box.',
        sending: 'Issuing the invoice…', already: 'This participant already has an active subscription to the stream — no second invoice is needed.',
        limited: 'Too many requests — try again in 10 minutes or email us: aelita.production@yandex.ru',
        done: function (r) { return 'Invoice No. ' + r.number + ' for ' + rub(r.amount) + ' has been sent to the accounts email, with a copy to the participant. Payment due by ' + d(r.due_on) + '.'; },
      },
      invStatus: function (s) { return 'Paid by the company' + (s.invoice && s.invoice.company ? ' (' + s.invoice.company + ')' : '') + ' until ' + d(s.paidThrough) + (s.invoice && s.invoice.noRenew ? ' · renewal switched off' : ' · a new invoice goes to the company 7 days before the end'); },
      btnNoRenew: 'Do not renew', btnRenewOn: 'Renew',
      locale: 'en-GB',
    },
  }[LANG];

  // ── помощники ──────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function d(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return '—';
    var y = +m[1], mo = +m[2], day = +m[3];
    var thisYear = new Date().getFullYear();
    if (EN) return MONTHS.en[mo - 1] + ' ' + day + (y !== thisYear ? ', ' + y : '');
    return day + ' ' + MONTHS.ru[mo - 1] + (y !== thisYear ? ' ' + y : '');
  }
  function rub(v) {
    var n = Number(v);
    var s = EN ? n.toLocaleString('en-GB') : n.toLocaleString('ru-RU').replace(/[   ]/g, ' ');
    return s + ' ₽';
  }
  function track(goal, params) { try { if (window.AELITA_track) window.AELITA_track(goal, params || {}); } catch (e) {} }
  async function api(url, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var tk = token();
    if (opts.auth !== false && tk) headers.Authorization = 'Bearer ' + tk;
    var res = await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, ok: res.ok, data: data };
  }
  async function listSubs() {
    if (!token()) return null;
    try {
      var r = await api(SUBS_API);
      if (r.status === 401) { clearToken(); return null; }
      return r.ok ? r.data : null;
    } catch (e) { return null; }
  }
  function pickSub(data, plan) {
    var list = (data && data.subscriptions) || [];
    for (var i = 0; i < list.length; i++) if (list[i].plan === plan && Boolean(list[i].isTest) === IS_TEST) return list[i];
    return null;
  }

  // Шторка подтверждения (отмена, возврат) — вместо confirm(): на телефоне
  // системный диалог показывает адрес сайта и выглядит как ошибка.
  function sheet(text, confirmLabel) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div');
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(11,11,13,.72);display:flex;align-items:flex-end;justify-content:center';
      wrap.innerHTML = '<div style="background:var(--coal,#141416);border-top:1px solid rgba(214,181,122,.45);width:100%;max-width:560px;padding:24px 20px calc(24px + env(safe-area-inset-bottom))">'
        + '<p style="color:var(--bone,#EDE6DA);font-size:1rem;line-height:1.55;margin:0 0 18px">' + esc(text) + '</p>'
        + '<div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" class="btn-gold" data-a="yes">' + esc(confirmLabel || T.confirm) + '</button>'
        + '<button type="button" class="btn-outline" data-a="no" style="margin-left:0">' + esc(T.keep) + '</button></div></div>';
      function close(v) { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') close(false); }
      wrap.addEventListener('click', function (e) {
        var a = e.target.getAttribute && e.target.getAttribute('data-a');
        if (a === 'yes') close(true); else if (a === 'no' || e.target === wrap) close(false);
      });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-a="yes"]').focus();
    });
  }

  // ── Страница оплаты ────────────────────────────────────────────────
  function initPayPage(main) {
    var PLAN = main.getAttribute('data-plan');
    var form = $('spForm');
    var msg = $('spMsg');
    var btn = $('spPayBtn');
    var acctMode = 'register';
    var signedIn = false;

    // «5 000 ₽ сегодня, дальше 15-го числа каждого месяца».
    // День списания — по Москве (как на сервере), а не по часам браузера.
    var day = new Date(Date.now() + 3 * 3600 * 1000).getUTCDate();
    var priceLabel = EN ? main.getAttribute('data-price').replace(' ', ',') : main.getAttribute('data-price');
    $('spWhen').innerHTML = '<strong>' + esc(priceLabel) + ' ₽' + T.today + '</strong>' + esc(T.whenTail(day));
    // pack-v545: пока автосписание не включено, кнопка честно говорит,
    // что оплачивается первый месяц; включено — «Оформить подписку — … ₽/мес».
    var payBtnLive = btn.textContent;
    var renewing = false;
    function setAutopayLive(live) {
      $('spAutopaySoon').hidden = live || renewing;
      btn.textContent = renewing ? T.payNextBtn + priceLabel + ' ₽' : live ? payBtnLive : T.payFirst + priceLabel + ' ₽';
    }
    setAutopayLive(AUTOPAY_LIVE);
    if (window.AELITA_GIFT_ON_PRODUCTS) $('spGift').hidden = false;
    // Кнопка на первом экране ведёт к форме и ставит фокус в первое пустое поле.
    $('spCtaBtn').addEventListener('click', function (e) {
      e.preventDefault();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = ['j-name', 'j-email', 'j-phone'].map($).filter(function (el) { return el && !el.value && !el.readOnly; })[0];
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
    });
    if (window.AELITA_wireContactValidation) {
      window.AELITA_wireContactValidation('j-email', 'email');
      window.AELITA_wireContactValidation('j-phone', 'phone');
    }

    function say(text) { msg.textContent = text || ''; }
    function fieldErr(el, text) { if (window.AELITA_showFieldError) window.AELITA_showFieldError(el, text); if (el) el.focus(); say(text); }
    function applyAcctMode() {
      $('spPwLabel').innerHTML = esc(acctMode === 'login' ? T.pwLabelLogin : T.pwLabelRegister) + ' <span class="req-mark">*</span>';
      $('j-password').setAttribute('autocomplete', acctMode === 'login' ? 'current-password' : 'new-password');
      $('spAcctToggle').textContent = acctMode === 'login' ? T.toRegister : T.toLogin;
    }
    $('spAcctToggle').addEventListener('click', function () { acctMode = acctMode === 'login' ? 'register' : 'login'; applyAcctMode(); });

    function showSignedIn(email) {
      signedIn = true;
      $('spAcctBlock').hidden = true;
      $('spSignedIn').hidden = false;
      $('spSignedInEmail').textContent = email;
      var e = $('j-email');
      e.value = email;
      e.readOnly = true;
    }

    var lastAlready = null;
    function showAlready(s) {
      lastAlready = s;
      var box = $('spAlready');
      var txt = s.status === 'active' ? T.alreadyActive(s)
        : s.status === 'past_due' ? T.alreadyPastDue(s)
        : s.status === 'canceled' ? T.alreadyCanceled(s)
        : s.status === 'invoice' ? T.invStatus(s)
        : T.alreadyPaid(s);
      $('spAlreadyText').textContent = txt;
      $('spAlreadyTitle').textContent = T.alreadyTitle[s.status] || T.alreadyTitle.other;
      $('spResumeBtn').hidden = !s.canResume;
      box.hidden = false;
      form.hidden = true;
      $('spCta').hidden = true;
    }
    $('spResumeBtn').addEventListener('click', async function () {
      var b = this;
      if (lastAlready && !(await sheet(T.sheetResume(lastAlready), T.btn.resume))) return;
      b.disabled = true;
      try {
        var r = await api(SUBS_API, { method: 'POST', body: { action: 'resume', plan: PLAN, test: IS_TEST } });
        if (r.ok) { $('spAlreadyMsg').textContent = T.resumed; showAlready(r.data.subscription); }
        else $('spAlreadyMsg').textContent = T.error;
      } catch (e) { $('spAlreadyMsg').textContent = T.error; }
      b.disabled = false;
    });

    // Кто вошёл — подставляем профиль, проверяем, нет ли уже подписки.
    async function loadAccount() {
      if (!token()) return;
      try {
        var r = await fetch(ACCOUNT_API + '/me', { headers: { Authorization: 'Bearer ' + token() } });
        if (r.status === 401) { clearToken(); return; }
        if (!r.ok) return;
        var me = await r.json();
        if (me.name && !$('j-name').value) $('j-name').value = me.name;
        if (me.phone && !$('j-phone').value) $('j-phone').value = me.phone;
        showSignedIn(me.email);
      } catch (e) { return; }
      var data = await listSubs();
      var s = pickSub(data, PLAN);
      // pack-v546: последние 3 дня оплаченного месяца без автосписания —
      // страница принимает оплату следующего месяца (продление от paidThrough).
      if (s && s.live && !s.blocksNewPayment && s.paidThrough && (s.status === 'awaiting_autopay' || s.status === 'no_autopay')) {
        renewing = true;
        $('spWhen').innerHTML = '<strong>' + esc(priceLabel) + ' ₽' + T.today + '</strong>' + esc(T.extendTail(s));
      }
      setAutopayLive(data && typeof data.enabled === 'boolean' ? data.enabled : AUTOPAY_LIVE);
      if (s && s.blocksNewPayment && !returned) showAlready(s);
    }

    // Вернулись с ЮKassa.
    var returned = QS.get('aelita_paid') === '1';
    if (returned) {
      var box = $('spResult');
      box.hidden = false;
      form.hidden = true;
      $('spCta').hidden = true;
      $('spResultTitle').textContent = T.resultChecking;
      $('spResultText').textContent = '';
      $('spWhatNext').hidden = true;
      var started = Date.now();
      var poll = async function () {
        var data = await listSubs();
        var s = pickSub(data, PLAN);
        var fresh = s && s.live && s.payments && s.payments.length && (Date.now() - new Date(s.payments[s.payments.length - 1].at).getTime() < 30 * 60 * 1000);
        if (fresh) {
          $('spResultTitle').textContent = s.status === 'active' ? (EN ? 'Subscription confirmed' : 'Подписка оформлена') : T.resultPaidTitle;
          $('spResultText').textContent = s.status === 'active' ? T.resultOkActive(s) : s.status === 'no_autopay' ? T.resultOkNoAutopay(s) : T.resultOkAwaiting(s);
          $('spWhatNext').hidden = false;
          track('subscription_started', { plan: PLAN });
          return;
        }
        if (Date.now() - started > 25000) {
          $('spResultTitle').textContent = T.resultSlowTitle;
          $('spResultText').textContent = T.resultSlow;
          form.hidden = false;
          return;
        }
        setTimeout(poll, 2500);
      };
      poll();
      QS.delete('aelita_paid');
      var rest = QS.toString();
      history.replaceState(null, '', location.pathname + (rest ? '?' + rest : ''));
    }

    async function ensureAccount(name, email) {
      if (token()) return token();
      var pwEl = $('j-password');
      var password = pwEl.value;
      if (acctMode === 'register' && password.length < 8) { fieldErr(pwEl, T.needPassword); return null; }
      if (acctMode === 'login' && !password) { fieldErr(pwEl, T.needLoginPassword); return null; }
      if (window.AELITA_clearFieldError) window.AELITA_clearFieldError(pwEl);
      say(acctMode === 'login' ? T.signingIn : T.registering);
      var r;
      try {
        r = await api(ACCOUNT_API + '/' + (acctMode === 'login' ? 'login' : 'register'), {
          method: 'POST', auth: false,
          body: acctMode === 'login' ? { email: email, password: password } : { name: name, email: email, password: password, pd_consent: true },
        });
      } catch (e) { say(T.network); return null; }
      if (r.ok && r.data.token) {
        setToken(r.data.token);
        pwEl.value = '';
        showSignedIn(r.data.email || email);
        return r.data.token;
      }
      if (r.data.error === 'email_taken') {
        acctMode = 'login'; applyAcctMode(); pwEl.value = '';
        fieldErr(pwEl, T.emailTaken);
        return null;
      }
      if (r.data.error === 'invalid_credentials') {
        if (window.AELITA_showFieldError) window.AELITA_showFieldError(pwEl, T.wrongPassword);
        msg.innerHTML = esc(T.wrongPassword) + ' <a href="#" id="spForgot">' + esc(T.forgot) + '</a>';
        $('spForgot').onclick = async function (e) {
          e.preventDefault();
          try { await api(ACCOUNT_API + '/request-password-reset', { method: 'POST', auth: false, body: { email: email, lang: LANG } }); } catch (x) {}
          say(T.resetSent);
        };
        return null;
      }
      if (r.data.error === 'bad_email') { fieldErr($('j-email'), T.badEmail); return null; }
      say(T.error);
      return null;
    }

    btn.addEventListener('click', async function () {
      say('');
      var nameEl = $('j-name'), emailEl = $('j-email'), phoneEl = $('j-phone');
      var name = nameEl.value.trim(), email = emailEl.value.trim(), phone = phoneEl.value.trim();
      if (!name) return fieldErr(nameEl, T.badName);
      if (!window.AELITA_isValidEmail || !window.AELITA_isValidEmail(email)) return fieldErr(emailEl, T.badEmail);
      if (!window.AELITA_normalizePhone || !window.AELITA_normalizePhone(phone)) return fieldErr(phoneEl, T.badPhone);
      if (!$('pdConsent').checked) return say(T.needPd);
      if (!$('autopayConsent').checked) return say(T.needAutopay);
      track('product_pay_click', { product: PLAN });
      btn.disabled = true;
      var tk = await ensureAccount(name, email);
      if (!tk) { btn.disabled = false; return; }
      if (window.AELITA_savePhone) window.AELITA_savePhone(phone);
      say(T.processing);
      var giftEl = $('j-gift');
      var gift = window.AELITA_GIFT_ON_PRODUCTS && giftEl ? giftEl.value.trim().toUpperCase() : '';
      var ret = new URL(location.href);
      ret.hash = '';
      ret.searchParams.set('aelita_paid', '1');
      var r;
      try {
        r = await api(PAY_API, {
          method: 'POST',
          body: {
            product: PLAN, name: name, email: email, phone: phone,
            return_url: ret.toString(), test: IS_TEST, lang: LANG,
            gift_code: gift || undefined, pd_consent: true, autopay_consent: true,
          },
        });
      } catch (e) { say(T.network); btn.disabled = false; return; }
      var data = r.data || {};
      if (r.status === 401) {
        clearToken(); signedIn = false;
        $('spAcctBlock').hidden = false; $('spSignedIn').hidden = true; $('j-email').readOnly = false;
        say(T.signedOut); btn.disabled = false; return;
      }
      if (data.zero_amount && data.redirect_url) { location.href = data.redirect_url; return; }
      if (data.confirmation_url) { location.href = data.confirmation_url; return; }
      btn.disabled = false;
      if (r.status === 409 && data.error === 'already_subscribed') {
        var full = pickSub(await listSubs(), PLAN);
        showAlready(full || { status: data.status, nextChargeAt: data.next_charge_at, paidThrough: data.paid_through, amount: main.getAttribute('data-price').replace(/\D/g, '') });
        return;
      }
      if (data.error === 'autopay_consent_required') return say(T.needAutopay);
      if (data.error === 'gift_code_invalid' || data.error === 'gift_card_changed' || data.error === 'gift_not_applicable') {
        var g = data.error === 'gift_card_changed' ? T.gift.changed : data.error === 'gift_not_applicable' ? T.gift.not_applicable : (T.gift[data.reason] || T.gift.not_found);
        return fieldErr(giftEl, g);
      }
      if (data.error === 'bad_email') return fieldErr(emailEl, T.badEmail);
      if (data.error === 'bad_phone') return fieldErr(phoneEl, T.badPhone);
      if (data.error === 'bad_name') return fieldErr(nameEl, T.badName);
      say(T.failed);
    });

    initInvoiceForm(main);
    applyAcctMode();
    loadAccount();
  }

  // ── Оплата от компании по счёту (выпуск 4 ТЗ) ──────────────────────
  function initInvoiceForm(main) {
    var section = $('invoiceSection');
    if (!section || !INVOICES_LIVE) return;
    section.hidden = false;
    var form = $('invForm'), msg = $('invMsg'), btn = $('invBtn');
    $('invToggle').addEventListener('click', function () {
      form.hidden = !form.hidden;
      if (!form.hidden) $('inv-company').focus();
    });
    function err(id, text) { var el = $(id); if (window.AELITA_showFieldError) window.AELITA_showFieldError(el, text); if (el) el.focus(); msg.textContent = text; }
    btn.addEventListener('click', async function () {
      msg.textContent = '';
      var v = function (id) { return ($(id).value || '').trim(); };
      var inn = v('inv-inn').replace(/\D/g, ''), kpp = v('inv-kpp').toUpperCase();
      if (!v('inv-company')) return err('inv-company', T.inv.badCompany);
      if (!/^\d{10}$|^\d{12}$/.test(inn)) return err('inv-inn', T.inv.badInn);
      if (inn.length === 10 && !/^\d{4}[\dA-Z]{2}\d{3}$/.test(kpp)) return err('inv-kpp', T.inv.badKpp);
      if (v('inv-address').length < 10) return err('inv-address', T.inv.badAddress);
      if (!window.AELITA_isValidEmail || !window.AELITA_isValidEmail(v('inv-acc-email'))) return err('inv-acc-email', T.inv.badAccEmail);
      if (!v('inv-p-name')) return err('inv-p-name', T.inv.badName);
      if (!window.AELITA_isValidEmail(v('inv-p-email'))) return err('inv-p-email', T.inv.badEmail);
      if (!window.AELITA_normalizePhone || !window.AELITA_normalizePhone(v('inv-p-phone'))) return err('inv-p-phone', T.inv.badPhone);
      if (!$('invConsent').checked) { msg.textContent = T.inv.needPd; return; }
      track('company_invoice_request', { months: Number(v('inv-months')) });
      btn.disabled = true;
      msg.textContent = T.inv.sending;
      var r;
      try {
        r = await api(INVOICE_API, { method: 'POST', auth: false, body: {
          company: { name: v('inv-company'), inn: inn, kpp: kpp, address: v('inv-address') },
          participant: { name: v('inv-p-name'), email: v('inv-p-email'), phone: v('inv-p-phone') },
          accounting_email: v('inv-acc-email'), months: Number(v('inv-months')), pd_consent: true, test: IS_TEST, lang: LANG,
        } });
      } catch (e) { msg.textContent = T.network; btn.disabled = false; return; }
      btn.disabled = false;
      var data = r.data || {};
      if (r.ok && data.number) { msg.textContent = T.inv.done(data); form.querySelectorAll('input,select').forEach(function (el) { if (el.type !== 'checkbox') el.disabled = true; }); btn.hidden = true; return; }
      var map = { bad_company_name: ['inv-company', T.inv.badCompany], bad_inn: ['inv-inn', T.inv.badInn], bad_kpp: ['inv-kpp', T.inv.badKpp], bad_address: ['inv-address', T.inv.badAddress],
        bad_accounting_email: ['inv-acc-email', T.inv.badAccEmail], bad_email: ['inv-p-email', T.inv.badEmail], bad_phone: ['inv-p-phone', T.inv.badPhone], bad_name: ['inv-p-name', T.inv.badName] };
      if (map[data.error]) return err(map[data.error][0], map[data.error][1]);
      msg.textContent = data.error === 'already_subscribed' ? T.inv.already : data.error === 'rate_limited' ? T.inv.limited : T.error;
    });
  }

  // ── Демонстрация для скриншотов (pack-v560) ────────────────────────
  // ЮKassa до подключения автоплатежей просит скриншоты сценария отвязки
  // карты с видимым адресом сайта, а сохранить карту без подключённых
  // автоплатежей нельзя. `?sub_demo=1` на странице кабинета показывает блок
  // «Подписки» с примером сохранённой карты; кнопки работают только на
  // экране (на сервер ничего не уходит), внешний вид и тексты — настоящие.
  var DEMO = QS.get('sub_demo') === '1';
  function demoSubs() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth(), dd = now.getDate();
    function ymd(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
    var next = new Date(y, m + 1, Math.min(dd, new Date(y, m + 2, 0).getDate()));
    return [{
      plan: 'community_main', title: T.plans.community_main, titleEn: 'AELITA COMMUNITY — main stream', amount: '5000.00', status: 'active', isTest: false,
      paidThrough: ymd(next), nextChargeAt: ymd(next), methodTitle: 'Mastercard •• 4444', hasAutopay: true, canUnlinkCard: true,
      canCancel: true, canChangeCard: true, canResume: false, canRenew: false, blocksNewPayment: true, refund: null, payments: [],
    }];
  }
  function demoAct(s, act) {
    if (act === 'unlink_card') {
      s.methodTitle = null; s.hasAutopay = false; s.canUnlinkCard = false; s.canChangeCard = false;
      s.cardUnlinkedAt = new Date().toISOString();
      if (s.status === 'active') { s.status = 'no_autopay'; s.nextChargeAt = null; }
    } else if (act === 'cancel') {
      s.status = 'canceled'; s.nextChargeAt = null; s.canResume = true; s.canCancel = false; s.canChangeCard = false;
    } else if (act === 'resume') {
      s.status = s.hasAutopay ? 'active' : 'no_autopay'; s.nextChargeAt = s.hasAutopay ? s.paidThrough : null; s.canResume = false; s.canCancel = true; s.canChangeCard = s.hasAutopay;
    }
  }

  // ── Кабинет: блок «Подписки» ───────────────────────────────────────
  function initDashboard(block) {
    var list = $('subsList');
    var note = $('subsMsg');
    var subsCache = [];

    function buttons(s) {
      var b = [];
      if (s.status === 'active') {
        if (s.canChangeCard) b.push(['change_card', T.btn.changeCard, 'outline']);
        b.push(['cancel', T.btn.cancel, 'outline']);
        if (s.refund) b.push(['refund', T.btn.refund(s), 'outline']);
      } else if (s.status === 'past_due') {
        if (s.canChangeCard) b.push(['change_card', T.btn.payOther, 'gold']);
        b.push(['cancel', T.btn.cancel, 'outline']);
      } else if (s.status === 'canceled') {
        if (s.canResume) b.push(['resume', T.btn.resume, 'gold']);
        if (s.refund) b.push(['refund', T.btn.refund(s), 'outline']);
      } else if (s.status === 'awaiting_autopay') {
        if (s.canRenew) b.push(['renew', T.btn.renew, 'gold']);
        // pack-v546: последние 3 дня месяца без автосписания — оплатить следующий.
        else if (!s.blocksNewPayment) b.push(['again', T.btn.payNext, 'gold']);
        b.push(['cancel', T.btn.cancel, 'outline']);
        if (s.refund) b.push(['refund', T.btn.refund(s), 'outline']);
      } else if (s.status === 'invoice') {
        b.push(s.invoice && s.invoice.noRenew ? ['renew_on', T.btnRenewOn, 'outline'] : ['no_renew', T.btnNoRenew, 'outline']);
      } else if (s.status === 'no_autopay') {
        if (!s.blocksNewPayment) b.push(['again', T.btn.payNext, 'gold']);
        b.push(['cancel', T.btn.cancel, 'outline']);
        if (s.refund) b.push(['refund', T.btn.refund(s), 'outline']);
      } else {
        b.push(['again', T.btn.again, 'gold']);
      }
      // pack-v560: «Отвязать карту» — при любом статусе, пока карта сохранена
      // (после отмены, возврата и приостановки карта тоже хранилась).
      if (s.canUnlinkCard) b.push(['unlink_card', T.btn.unlinkCard, 'outline']);
      return b;
    }

    function render(data) {
      subsCache = (data && data.subscriptions) || [];
      if (!subsCache.length) { block.hidden = true; return; }
      block.hidden = false;
      list.innerHTML = subsCache.map(function (s, i) {
        var title = (EN ? s.titleEn : s.title) || T.plans[s.plan] || s.plan;
        var st = (T.status[s.status] || T.status.ended)(s);
        var card = s.methodTitle ? '<p class="acc-hint">' + esc(T.card) + ': ' + esc(s.methodTitle) + '</p>' : '';
        var btns = buttons(s).map(function (x) {
          return '<button type="button" class="' + (x[2] === 'gold' ? 'btn-gold' : 'btn-outline') + '" style="margin:8px 10px 0 0" data-i="' + i + '" data-act="' + x[0] + '">' + esc(x[1]) + '</button>';
        }).join('');
        return '<div class="sub-item" style="border:1px solid rgba(214,181,122,.28);padding:16px 18px;margin:0 0 14px">'
          + '<p style="margin:0 0 6px;color:var(--bone)"><strong>' + esc(title) + '</strong>' + (s.isTest ? ' <span style="color:#C98B6B;font-size:0.75rem">[' + esc(T.test) + ']</span>' : '') + '</p>'
          + '<p style="margin:0;color:var(--sand)">' + esc(st) + '</p>' + card + btns + '</div>';
      }).join('');
    }

    async function load() {
      if (DEMO) { render({ subscriptions: subsCache.length ? subsCache : demoSubs() }); return; }
      var data = await listSubs();
      render(data);
    }

    list.addEventListener('click', async function (e) {
      var el = e.target.closest && e.target.closest('[data-act]');
      if (!el) return;
      var s = subsCache[+el.getAttribute('data-i')];
      var act = el.getAttribute('data-act');
      note.textContent = '';
      if (act === 'again') {
        location.href = PREFIX + (s.plan === 'community_biz' ? '/book-space/business/pay' : '/book-space/main/pay') + (s.isTest ? '?aelita_test=1' : '');
        return;
      }
      if (act === 'cancel' && !(await sheet(T.sheetCancel(s), T.btn.cancel))) return;
      if (act === 'refund' && !(await sheet(T.sheetRefund(s), T.btn.refund(s)))) return;
      if (act === 'resume' && !(await sheet(T.sheetResume(s), T.btn.resume))) return;
      if (act === 'unlink_card' && !(await sheet(T.sheetUnlink(s), T.btn.unlinkCard))) return;
      if (DEMO) { demoAct(s, act); render({ subscriptions: subsCache }); note.textContent = act === 'unlink_card' ? T.unlinked : T.done; return; }
      el.disabled = true;
      try {
        var r = await api(SUBS_API, { method: 'POST', body: { action: act, plan: s.plan, test: Boolean(s.isTest) } });
        if (r.data && r.data.confirmation_url) { location.href = r.data.confirmation_url; return; }
        if (r.ok) { note.textContent = act === 'unlink_card' ? T.unlinked : T.done; await load(); return; }
        note.textContent = (r.data.error === 'refund_window_closed' || r.data.error === 'nothing_to_refund') ? T.refundClosed : r.data.error === 'autopay_not_enabled' ? T.notEnabled : (T.actErr[r.data.error] || T.error);
      } catch (x) { note.textContent = T.error; }
      el.disabled = false;
    });

    if (QS.get('sub_return')) {
      note.textContent = T.cardReturn;
      setTimeout(load, 4000);
    }
    load();
  }

  // ── Страница по ссылке из письма ───────────────────────────────────
  function initLinkPage(box) {
    var t = QS.get('t') || '';
    var action = QS.get('do') === 'renew' ? 'renew' : 'cancel';
    var title = $('subLinkTitle'), text = $('subLinkText'), btn = $('subLinkBtn'), out = $('subLinkMsg');
    // Токен — ключ к отмене подписки без входа: из адресной строки его
    // убираем сразу (история браузера, адрес страницы в аналитике).
    try { history.replaceState(null, '', location.pathname + (IS_TEST ? '?aelita_test=1' : '')); } catch (e) {}
    if (QS.get('done') === 'renew') { text.textContent = T.linkRenewDone; return; }
    if (!t) { text.textContent = T.linkBad; return; }
    (async function () {
      var r;
      try { r = await api(SUBS_API + '/cancel-link?t=' + encodeURIComponent(t), { auth: false }); } catch (e) { text.textContent = T.error; return; }
      if (!r.ok) { text.textContent = T.linkBad; return; }
      var s = r.data.subscription;
      title.textContent = (EN ? s.titleEn : s.title) || T.plans[s.plan] || '';
      text.textContent = (T.status[s.status] || T.status.ended)(s);
      var can = action === 'renew' ? s.canRenew : s.canCancel;
      if (!can) { out.textContent = action === 'renew' ? T.notEnabled : T.linkNothing; return; }
      btn.textContent = action === 'renew' ? T.btn.renew : T.btn.cancel;
      btn.hidden = false;
      btn.onclick = async function () {
        if (action === 'cancel' && !(await sheet(T.sheetCancel(s), T.btn.cancel))) return;
        btn.disabled = true;
        var p;
        try { p = await api(SUBS_API + '/cancel-link', { method: 'POST', auth: false, body: { t: t, action: action } }); } catch (e) { out.textContent = T.error; btn.disabled = false; return; }
        if (p.data && p.data.confirmation_url) { location.href = p.data.confirmation_url; return; }
        if (p.ok) { btn.hidden = true; out.textContent = T.linkCanceled; text.textContent = (T.status[p.data.subscription.status] || T.status.ended)(p.data.subscription); return; }
        out.textContent = T.error; btn.disabled = false;
      };
    })();
  }

  function start() {
    var main = document.querySelector('main[data-plan]');
    if (main) initPayPage(main);
    var block = $('subscriptions');
    if (block && $('subsList')) initDashboard(block);
    var link = $('subLink');
    if (link) initLinkPage(link);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
