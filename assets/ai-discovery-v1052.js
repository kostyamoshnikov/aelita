(function () {
  'use strict';
  const form = document.getElementById('ai-discovery-form');
  if (!form || !window.AelitaAI) return;

  const status = document.getElementById('ai-discovery-status');
  const result = document.getElementById('ai-discovery-results');
  const submit = document.getElementById('ai-discovery-submit');
  const mode = document.getElementById('ai-discovery-mode');
  const topic = document.getElementById('ai-discovery-topic');
  const days = document.getElementById('ai-discovery-days');
  const exportActions = document.getElementById('ai-discovery-export-actions');
  const exportButton = document.getElementById('ai-discovery-export');
  const labels = { mentions: 'Упоминания', reviews: 'Отзывы', prospects: 'Потенциальные заказчики' };
  let requested = 'all';
  let requestedDays = 0;
  let exportRows = [];
  let searchToken = '';

  function csvCell(value) {
    const text = String(value ?? '');
    const safe = /^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/u.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }

  exportButton.addEventListener('click', () => {
    if (!searchToken || searchToken !== window.getToken() || !exportRows.length) return;
    const headers = ['Категория', 'Заголовок', 'Дата публикации', 'Источник', 'Пояснение ИИ', 'Фрагмент выдачи'];
    const table = [headers, ...exportRows.map(item => [labels[item.kind], item.title, item.date, item.url, item.reason, item.excerpt])];
    const csv = '\uFEFF' + table.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const filename = 'AELITA-search-results.csv';
    if (window.AelitaMobileFiles) {
      window.AelitaMobileFiles.save(blob, filename, { guardToken: searchToken, after: exportButton });
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = node('a', '');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });

  function node(tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }

  function show(data) {
    for (const kind of requested === 'all' ? Object.keys(labels) : [requested]) {
      const section = document.createElement('section');
      section.append(node('h3', labels[kind]));
      const findings = data.findings.filter(item => item.kind === kind);
      if (data.unavailable.includes(kind)) {
        section.append(node('p', 'Поиск в этой категории временно недоступен. Можно запустить её отдельно.'));
      } else if (!findings.length) {
        section.append(node('p', requestedDays ? 'За выбранный период в выдаче нет подходящих результатов с датой.' : 'В открытой выдаче подходящих результатов не найдено.'));
      }
      for (const item of findings) {
        const card = document.createElement('article');
        card.className = 'ai-card';
        const link = node('a', item.title);
        const url = new URL(item.url);
        if (!['https:', 'http:'].includes(url.protocol)) continue;
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.append(link, node('p', url.hostname + (item.date ? ' · ' + item.date : '')));
        card.append(node('p', item.reason));
        if (item.excerpt) {
          const evidence = document.createElement('details');
          evidence.append(node('summary', 'Фрагмент поисковой выдачи'), node('p', item.excerpt));
          card.append(evidence);
        }
        section.append(card);
        exportRows.push(item);
      }
      result.append(section);
    }
    exportActions.hidden = exportRows.length === 0;
  }

  const runner = window.AelitaAI.runner({
    token: () => window.getToken(),
    status,
    submit,
    cancel: document.getElementById('ai-discovery-cancel'),
    result,
    done: show,
    readyMessage: 'Поиск завершён. Откройте источники, чтобы проверить находки.'
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (submit.disabled) return;
    requested = mode.value;
    requestedDays = Number(days.value);
    searchToken = window.getToken();
    exportRows = [];
    exportActions.hidden = true;
    runner.send({ kind: 'web_discovery', mode: requested, text: topic.value.trim(), days: requestedDays });
  });
})();
