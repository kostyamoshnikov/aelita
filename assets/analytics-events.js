// === Отслеживание конверсионных действий (AELITA PRODUCTION) ===
// Событие уходит в Яндекс.Метрику (reachGoal) — без необходимости
// заранее создавать цели в интерфейсе.
//
// ⚠️ pack-v101: расширено с 4 категорий кликов до полного покрытия
// кнопок сайта (карточки спектаклей, спикеров, партнёров; внешние
// ссылки на билеты и cuire-fest.ru; PWA-установка; Google Drive).
// Порядок проверок важен — от самого специфичного к самому общему,
// иначе более широкое правило (например, «любая ссылка на
// cuire-fest.ru») перехватит клик раньше специфичного
// («ссылка на билеты cuire-fest.ru»).
(function () {
  function track(goal, params) {
    params = params || {};
    if (window.ym) {
      try { window.ym(104681911, 'reachGoal', goal, params); } catch (e) {}
    }
  }

  // Достаёт слаг страницы из внутренней ссылки вида /slug/ или /en/slug/.
  // Для внешних ссылок возвращает href как есть — тоже годится как
  // идентификатор, просто менее компактный.
  function slugFromHref(href) {
    var m = href.match(/^\/(?:en\/)?([a-z0-9-]+)\/?(?:[?#].*)?$/);
    return m ? m[1] : href;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (a) {
      var href = a.getAttribute('href') || '';
      var cls = ' ' + (a.className || '') + ' ';

      // --- способы связи ---
      if (href.indexOf('tel:') === 0) {
        track('phone_click', { link_url: href });
        return;
      }
      if (href.indexOf('mailto:') === 0) {
        track('email_click', { link_url: href });
        return;
      }
      if (href.indexOf('t.me/') !== -1) {
        track(href.indexOf('_bot') !== -1 ? 'telegram_bot_click' : 'telegram_channel_click', { link_url: href });
        return;
      }

      // --- билеты: сначала более специфичный случай (внешняя продажа
      //     на cuire-fest.ru), потом внутренняя страница /tickets ---
      if (href.indexOf('cuire-fest.ru/tickets') !== -1) {
        track('festival_tickets_click', { link_url: href, page: location.pathname });
        return;
      }
      if (/\/tickets\/?($|[?#])/.test(href)) {
        track('tickets_page_click', { link_url: href });
        return;
      }

      // --- PDF: юридические документы + CV отдельным событием поверх ---
      if (/\/documents-pdf\/.+\.pdf$/.test(href)) {
        track('legal_pdf_download', { link_url: href });
        // Регэксп на имя файла, не жёсткий список имён — новый CV
        // (любое имя-cv.pdf в этой папке) подхватится сам, без правки
        // сюда каждый раз при появлении нового человека.
        var cvMatch = href.match(/\/documents-pdf\/([a-z-]+)-cv\.pdf$/);
        if (cvMatch) {
          track('cv_download', { link_url: href, person: cvMatch[1] });
        }
        return;
      }

      // --- карточки спектаклей/проектов, ведущие на детальную страницу
      //     (work-card — страницы спектаклей, show-card — «Человеческое»/
      //     «Послушайте», proj-card — карточки ИОВ и др. на /projects,
      //     prog-item — карточки программы фестиваля на /tochkacuire) ---
      if (/ (work-card|show-card|proj-card|prog-item) /.test(cls)) {
        var cardType = cls.match(/ (work-card|show-card|proj-card|prog-item) /)[1];
        track('show_card_click', { link_url: href, slug: slugFromHref(href), card_type: cardType, page: location.pathname });
        return;
      }

      // --- карточки людей: спикеры деловой/кино-программы, партнёры ---
      if (/ (speaker-card|partner-card) /.test(cls)) {
        var personCardType = cls.match(/ (speaker-card|partner-card) /)[1];
        track('person_card_click', { link_url: href, slug: slugFromHref(href), card_type: personCardType, page: location.pathname });
        return;
      }

      // --- документы на Google Drive (например, партнёрская колода) ---
      if (href.indexOf('drive.google.com') !== -1) {
        track('drive_doc_click', { link_url: href, page: location.pathname });
        return;
      }

      // --- любая другая ссылка на сайт фестиваля «Точка Кюри», не
      //     попавшая в правила выше (оферта, open call, сама
      //     cuire-fest.ru как площадка и т.п.) — общий улов, чтобы
      //     новый тип ссылки на cuire-fest.ru не остался незамеченным,
      //     если появится раньше, чем сюда допишут отдельное правило ---
      if (href.indexOf('cuire-fest.ru') !== -1) {
        track('cuire_fest_outbound_click', { link_url: href, page: location.pathname });
        return;
      }

      return;
    }

    // --- кнопка установки PWA — не <a>, обычная <button> ---
    var installBtn = e.target.closest('.install-btn');
    if (installBtn) {
      track('pwa_install_click', { page: location.pathname });
      return;
    }
  }, true);

  // Клик по кнопке отправки форм (handleForm/subscribe/joinClub/handleSubmit и т.п.)
  // Отмечает попытку отправки; фактическая доставка идёт через Formspree/Telegram-воркер в самих формах.
  var FORM_TRIGGERS = ['handleForm', 'subscribe', 'joinClub', 'handleSubmit'];
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[onclick]');
    if (!el) return;
    const onclick = (el.getAttribute('onclick') || '').trim();
    const matched = FORM_TRIGGERS.filter(function (fn) { return onclick.indexOf(fn + '(') === 0; })[0];
    if (matched) {
      track('form_submit_click', { form_handler: matched, page: location.pathname });
    }
  }, true);

  // Включение звука на hero-видео (страницы спектаклей) — сигнал вовлечённости
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#teaser-sound-btn, .teaser-sound-btn');
    if (!btn) return;
    setTimeout(function () {
      if (btn.classList.contains('on')) {
        track('video_sound_on', { page: location.pathname });
      }
    }, 0);
  }, true);
})();
