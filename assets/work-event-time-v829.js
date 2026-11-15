(function (root) {
  'use strict';
  const timeZone = 'Europe/Moscow';
  const date = new Intl.DateTimeFormat('ru-RU', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const clock = new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' });
  const dateTime = new Intl.DateTimeFormat('ru-RU', { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const groups = { current: 'Актуальные', past: 'Прошедшие' };

  function timestamp(value) {
    if (typeof value !== 'string') return NaN;
    // Older working catalogs sometimes omit an offset on local Moscow times.
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? value + '+03:00' : value;
    return /^\d{4}-\d{2}-\d{2}T/.test(iso) ? Date.parse(iso) : NaN;
  }

  function status(event, now = Date.now()) {
    const start = timestamp(event.datetime);
    const end = timestamp(event.endsAt);
    if (event.cancelled || event.canceled || ['cancelled', 'canceled'].includes(event.status)) {
      return { group: 'past', priority: 0, label: 'Отменено', time: start };
    }
    if (!Number.isFinite(start)) return { group: 'current', priority: 4, label: 'Дата уточняется', time: start };
    if (start <= now) {
      if (!(end > start)) return { group: 'current', priority: 3, label: 'Окончание уточняется', time: start };
      if (now < end) return { group: 'current', priority: 0, label: 'Идёт сейчас', time: start };
      return { group: 'past', priority: 0, label: 'Состоялось', time: end };
    }
    return date.format(start) === date.format(now)
      ? { group: 'current', priority: 1, label: 'Сегодня', time: start }
      : { group: 'current', priority: 2, label: 'Предстоит', time: start };
  }

  function sorted(events, now = Date.now(), rank) {
    const ranked = events.map(event => ({ event, state: status(event, now) }));
    return ranked.sort((a, b) => {
      const x = a.state, y = b.state;
      if (x.group !== y.group) return x.group === 'current' ? -1 : 1;
      const manual = rank ? (rank.get(a.event.id) ?? Infinity) - (rank.get(b.event.id) ?? Infinity) : 0;
      return x.priority - y.priority || manual || (x.group === 'past' || x.priority === 3 ? y.time - x.time : x.time - y.time) || String(a.event.title||'').localeCompare(String(b.event.title||''), 'ru');
    }).map(item => item.event);
  }

  function when(event) {
    const start = timestamp(event.datetime);
    if (!Number.isFinite(start)) return '';
    const end = timestamp(event.endsAt);
    const finish = end > start ? (date.format(start) === date.format(end) ? '–' + clock.format(end) : ' — ' + dateTime.format(end)) : '';
    return dateTime.format(start) + finish + ' МСК';
  }

  function label(event, now = Date.now()) {
    const state = status(event, now);
    const schedule = when(event) || (event.dateLabel||'');
    return [state.label, event.title, schedule].filter(Boolean).join(' · ');
  }

  const api = { timeZone, groups, status, sorted, when, label };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AelitaWorkEventTime = api;
})(typeof window === 'object' ? window : globalThis);
