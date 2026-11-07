/* Editor for private links within the existing subscriptions section. */
(function () {
  window.mountSubscriptionMaterials = function (panel, getToken, endpoint) {
    if (!panel || panel.dataset.mounted) return;
    panel.dataset.mounted = '1';
    var form = panel.querySelector('form');
    var plan = form.elements.plan;
    var rows = panel.querySelector('[data-materials-rows]');
    var status = panel.querySelector('[role="status"]');
    var add = panel.querySelector('[data-add-material]');
    var save = form.querySelector('[type="submit"]');
    var revision = null;
    var ready = false;
    var dirty = false;
    var sequence = 0;
    var displayedPlan = null;
    var ownerToken = null;

    function field(row, caption, name, value, type, max) {
      var label = document.createElement('label');
      label.append(caption);
      var input = document.createElement('input');
      input.type = type;
      input.dataset.field = name;
      input.value = value || '';
      input.maxLength = max;
      input.className = 'search ym-disable-keys';
      input.required = name !== 'titleEn';
      label.append(input);
      row.append(label);
    }

    function appendItem(item) {
      var row = document.createElement('div');
      row.className = 'ai-grid sub-material-editor';
      field(row, 'Название', 'title', item.title, 'text', 120);
      field(row, 'Название EN', 'titleEn', item.titleEn, 'text', 120);
      field(row, 'Ссылка HTTPS', 'url', item.url, 'url', 2048);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'mini-btn';
      remove.textContent = 'Убрать ссылку';
      remove.onclick = function () { row.remove(); dirty = true; add.disabled = !ready; };
      row.append(remove);
      rows.append(row);
      add.disabled = !ready || rows.children.length >= 30;
    }

    async function request(url, token, body) {
      var response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || 'request_failed');
      return data;
    }

    async function load() {
      var seq = ++sequence;
      var currentPlan = plan.value;
      var token = getToken();
      displayedPlan = currentPlan;
      ownerToken = token;
      ready = false;
      dirty = false;
      rows.replaceChildren();
      add.disabled = save.disabled = true;
      status.textContent = 'Загружаем материалы…';
      if (!token) { status.textContent = 'Войдите в админку.'; return; }
      try {
        var data = await request(endpoint + '?materials=1&plan=' + encodeURIComponent(currentPlan), token);
        if (seq !== sequence || token !== getToken()) return;
        revision = data.revision;
        ready = true;
        (data.items || []).forEach(appendItem);
        add.disabled = rows.children.length >= 30;
        save.disabled = false;
        status.textContent = rows.children.length ? '' : 'Ссылок пока нет.';
      } catch (_) {
        if (seq === sequence && token === getToken()) status.textContent = 'Не удалось загрузить материалы. Нажмите «Обновить ссылки».';
      }
    }

    function reload() {
      if (!dirty || window.confirm('Открыть сохранённые ссылки? Изменения в форме ещё не сохранены.')) load();
      else plan.value = displayedPlan;
    }

    form.addEventListener('input', function (event) { if (event.target !== plan) dirty = true; });
    plan.onchange = reload;
    panel.querySelector('[data-reload-materials]').onclick = reload;
    panel.addEventListener('toggle', function () { if (panel.open && (!ready || ownerToken !== getToken())) load(); });
    add.onclick = function () {
      if (!ready || rows.children.length >= 30) return;
      appendItem({});
      dirty = true;
      rows.lastElementChild.querySelector('input').focus();
    };
    form.onsubmit = async function (event) {
      event.preventDefault();
      var token = getToken();
      if (!ready || !token || token !== ownerToken || plan.value !== displayedPlan) return;
      var seq = ++sequence;
      var items = Array.from(rows.children, function (row) {
        var item = {};
        row.querySelectorAll('[data-field]').forEach(function (input) { item[input.dataset.field] = input.value; });
        return item;
      });
      var controls = Array.from(form.querySelectorAll('button, select, input'));
      var previous = controls.map(function (el) { return el.disabled; });
      controls.forEach(function (el) { el.disabled = true; });
      status.textContent = 'Сохраняем…';
      try {
        var data = await request(endpoint, token, { action: 'save_materials', plan: displayedPlan, revision: revision, items: items });
        if (seq !== sequence || token !== getToken()) return;
        revision = data.revision;
        dirty = false;
        status.textContent = 'Ссылки сохранены.';
      } catch (error) {
        if (seq !== sequence || token !== getToken()) return;
        status.textContent = error.message === 'materials_changed'
          ? 'Список изменился в другой вкладке. Скопируйте свои ссылки и обновите список.'
          : 'Не удалось сохранить. Проверьте названия и адреса HTTPS.';
      } finally {
        if (seq === sequence) controls.forEach(function (el, index) { el.disabled = previous[index]; });
      }
    };
    window.addEventListener('storage', function () {
      if (ownerToken === getToken()) return;
      ++sequence;
      rows.replaceChildren();
      ready = false;
      dirty = false;
      if (panel.open) load();
    });
    if (panel.open) load();
  };
})();
