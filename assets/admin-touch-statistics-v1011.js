(function (root) {
  'use strict';

  const prefix = 'aelita-admin-touches-v1:';
  const daysKept = 30;
  const kinds = ['touch', 'pointer', 'keyboard'];
  const dateFormat = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit'});
  const surfaces = {
    admin:'Админка', crm:'CRM', team:'AELITA CREW', access:'Доступ сотрудника',
    bot:'Админка бота', directory:'Люди и площадки', editor:'Редактор страниц',
    events:'Мастер событий', 'mail-texts':'Тексты писем', pages:'Новые страницы',
    promocodes:'Промокоды', 'site-nav':'Меню, подвал, главная и афиша', 'social-posts':'Публикации в соцсетях', 'crew-ops':'Работа команды CREW'
  };
  const subsections = {
    'crew-ops': {
      projects: 'Проекты', tasks: 'Задачи', schedule: 'Расписание', people: 'Участники', import: 'Перенос данных',
    },
    'social-posts': {
      draft: 'Редактор публикации', ai: 'Черновики с ИИ', preview: 'Предпросмотр', queue: 'Очередь и история',
    },
  };
  const actionable = 'button, a[href], summary, input:not([type=hidden]):not([type=password]), select, textarea, [role=button], [role=tab], [onclick]';
  const idPattern = /^u_[a-f0-9]{24}$/;
  const keyPattern = /^(\d{4}-\d{2}-\d{2}):(u_[a-f0-9]{24}):[a-z0-9-]+$/;
  const sectionPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)?$/;
  const empty = () => [0, 0, 0];

  function dateKey(now, daysAgo = 0) {
    const today = dateFormat.format(now);
    return new Date(Date.parse(today + 'T00:00:00Z') - daysAgo * 86400000).toISOString().slice(0, 10);
  }

  function keys(storage) {
    return Array.from({length:storage.length}, (_, i) => storage.key(i)).filter(key => key?.startsWith(prefix));
  }

  function prune(storage, today, firstDay) {
    const marker = prefix + 'cleanup';
    if (storage.getItem(marker) === today) return;
    for (const key of keys(storage)) {
      const match = keyPattern.exec(key.slice(prefix.length));
      if (match && match[1] < firstDay) storage.removeItem(key);
    }
    storage.setItem(marker, today);
  }

  function record(storage, actor, instance, section, kind, now = Date.now()) {
    if (!idPattern.test(actor) || !sectionPattern.test(section) || !/^[a-z0-9-]+$/.test(instance)) return;
    const index = kinds.indexOf(kind);
    if (index === -1) return;
    const today = dateKey(now);
    prune(storage, today, dateKey(now, daysKept - 1));
    // Each document has its own bucket, including when two tabs are open.
    const key = prefix + today + ':' + actor + ':' + instance;
    const counts = JSON.parse(storage.getItem(key) || '{}');
    counts[section] ??= empty();
    counts[section][index]++;
    storage.setItem(key, JSON.stringify(counts));
  }

  function aggregate(storage, actor, days, now = Date.now()) {
    const rows = new Map();
    const today = dateKey(now);
    const first = dateKey(now, days - 1);
    const totals = empty();
    for (const key of keys(storage)) {
      const match = keyPattern.exec(key.slice(prefix.length));
      if (!match || match[2] !== actor || match[1] < first || match[1] > today) continue;
      let counts;
      try { counts = JSON.parse(storage.getItem(key)); } catch (_) { continue; }
      for (const [section, amounts] of Object.entries(counts || {})) {
        if (!sectionPattern.test(section) || !Array.isArray(amounts) || amounts.length !== kinds.length ||
            amounts.some(count => !Number.isSafeInteger(count) || count < 0)) continue;
        if (!rows.has(section)) rows.set(section, empty());
        const row = rows.get(section);
        amounts.forEach((amount, i) => { row[i] += amount; totals[i] += amount; });
      }
    }
    return {rows, totals};
  }

  function surfaceFor(path) {
    const match = /^\/admin(?:\/([a-z-]+))?\/?$/.exec(path.replace(/\/index\.html$/, '/'));
    return match && Object.hasOwn(surfaces, match[1] || 'admin') ? match[1] || 'admin' : '';
  }

  function inputKind(event) {
    if (event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) return 'touch';
    return !event.pointerType && event.detail === 0 ? 'keyboard' : 'pointer';
  }

  function init() {
    const {document} = root;
    const surface = surfaceFor(root.location.pathname);
    if (!surface) return;
    const instance = root.crypto?.randomUUID?.();
    if (!instance) return;
    const actor = () => {
      const session = root.AelitaStaffSession?.read();
      return session?.crmToken && idPattern.test(session.user?.id || '') ? session.user.id : '';
    };
    const labels = () => root.AelitaWork?.tabs || {};
    function section(control) {
      if (Object.hasOwn(subsections, surface)) {
        const name = control.closest('[data-admin-touch-section]')?.dataset.adminTouchSection;
        return Object.hasOwn(subsections[surface], name) ? surface + '.' + name : surface;
      }
      if (surface !== 'admin' && surface !== 'crm') return surface;
      const selected = surface === 'admin'
        ? document.querySelector('#admNav [data-adm-tab-btn].on')?.dataset.admTabBtn
        : document.querySelector('.crm-navbox [data-tab][aria-current=true]')?.dataset.tab;
      return selected && Object.hasOwn(labels()[surface] || {}, selected) ? surface + '.' + selected : surface;
    }
    function label(sectionName) {
      const [area, tab] = sectionName.split('.');
      const subsection = subsections[area]?.[tab] || labels()[area]?.[tab];
      return (surfaces[area] || 'Рабочий раздел') + (subsection ? ' · ' + subsection : '');
    }
    let storageFailed = false;
    let renderTimer;
    const panels = [...document.querySelectorAll('[data-admin-touch-report]')];
    const num = new Intl.NumberFormat('ru-RU');
    const total = counts => counts.reduce((a, b) => a + b, 0);

    function node(tag, text) {
      const element = document.createElement(tag);
      if (text !== undefined) element.textContent = text;
      return element;
    }

    function render(panel) {
      if (!panel.open) return;
      const output = panel.querySelector('[data-admin-touch-output]');
      const current = actor();
      if (!current) {
        output.replaceChildren(node('p', 'Войдите через единый вход, чтобы увидеть свою статистику.'));
        return;
      }
      let summary;
      try { summary = aggregate(root.localStorage, current, Number(panel.querySelector('select').value)); }
      catch (_) {
        output.replaceChildren(node('p', 'Хранилище браузера недоступно.'));
        return;
      }
      const details = [node('p', 'Действий за период: ' + num.format(total(summary.totals)))];
      if (storageFailed) details.push(node('p', 'Браузер не смог сохранить последние действия.'));
      if (!summary.rows.size) details.push(node('p', 'За выбранный период пока нет действий.'));
      else {
        const table = node('table');
        const heading = node('thead'), header = node('tr'), body = node('tbody');
        for (const name of ['Раздел', 'Всего', 'Касания', 'Клики', 'Клавиатура']) {
          const cell = node('th', name);
          cell.scope = 'col';
          header.append(cell);
        }
        heading.append(header);
        const sorted = [...summary.rows].sort((a,b) => total(b[1]) - total(a[1]) || label(a[0]).localeCompare(label(b[0]), 'ru'));
        for (const [name, counts] of sorted) {
          const row = node('tr'), title = node('th', label(name));
          title.scope = 'row';
          row.append(title, ...[total(counts), ...counts].map(count => node('td', num.format(count))));
          body.append(row);
        }
        table.append(heading, body);
        const scroll = node('div');
        scroll.className = 'touch-statistics-table';
        scroll.tabIndex = 0;
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', 'Таблица действий по разделам');
        scroll.append(table);
        details.push(scroll);
      }
      const previous = output.querySelector('.touch-statistics-table');
      const scrollLeft = previous?.scrollLeft || 0;
      const hadFocus = previous && document.activeElement === previous;
      output.replaceChildren(...details);
      const scroll = output.querySelector('.touch-statistics-table');
      if (hadFocus) (scroll || panel.querySelector('select')).focus({preventScroll: true});
      if (scroll) scroll.scrollLeft = scrollLeft;
    }
    function refresh() {
      if (!panels.some(panel => panel.open)) return;
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => panels.forEach(render), 120);
    }

    for (const panel of panels) {
      panel.addEventListener('toggle', () => render(panel));
      panel.querySelector('select').addEventListener('change', () => render(panel));
    }
    document.addEventListener('click', event => {
      if (!event.isTrusted) return;
      if (surface === 'access' && document.querySelector('#access-done')?.hidden !== false) return;
      let control = event.target.closest?.(actionable);
      if (!control && surface === 'crm' && !event.defaultPrevented &&
          !event.target.closest?.('a,input,select,textarea,label,summary,[role=button],[contenteditable]') &&
          !root.getSelection()?.toString()) {
        control = event.target.closest?.('.record')?.querySelector(':scope > h3 > button[data-open]');
      }
      if (!control || control.closest('[data-admin-touch-report], [inert], [aria-disabled=true]') ||
          control.matches(':disabled')) return;
      const current = actor();
      if (!current) return;
      try { record(root.localStorage, current, instance, section(control), inputKind(event)); }
      catch (_) { storageFailed = true; }
      refresh();
    }, true);
    root.addEventListener('storage', event => {
      if (!event.key || event.key.startsWith(prefix) || event.key === root.AelitaStaffSession?.key) refresh();
    });
    root.addEventListener('aelita-staff-session-changed', refresh);
    root.addEventListener('pageshow', refresh);
  }

  if (typeof module === 'object' && module.exports) module.exports = {record, aggregate, surfaceFor, inputKind, dateKey};
  else init();
})(typeof window === 'object' ? window : globalThis);
