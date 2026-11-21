(function () {
  'use strict';

  const $ = name => document.getElementById('crew-' + name);
  const endpoint = 'https://api.aelita-production.ru/admin/site-edit';
  const errors = {
    not_authenticated: 'Войдите в админку снова.',
    crew_store_invalid: 'Сервер не смог прочитать данные проекта.',
    crew_store_busy: 'Данные изменяются. Попробуйте ещё раз.',
    crew_project_conflict: 'Данные проекта уже изменились. Обновите страницу проекта.',
    crew_task_conflict: 'Задача уже изменилась. Откройте её снова.',
    crew_task_locked: 'Задачи этого проекта доступны только для просмотра.',
    invalid_assignees: 'Проверьте исполнителей и выберите участников с уникальными именами.',
    bad_project_target: 'Проверьте адреса площадок. Для Telegram нужен @канал или ID, для VK и Instagram — ID.',
    bad_members: 'Укажите имя каждого участника.',
    bad_schedule_rows: 'Проверьте время и название каждой записи.',
    bad_task_deadline: 'Проверьте дату срока.',
    crew_import_conflict: 'В файле есть записи, которые расходятся с сохранёнными. Импорт не изменил данные.',
    bad_import: 'Файл не соответствует формату переноса CREW.',
    preview_required: 'Сначала заново проверьте выбранный файл.',
    schedule_not_configured: 'Модуль расписания выключен в настройках проекта.'
  };
  const panels = ['tasks','schedule','people'];
  let seq = 0, paneSeq = 0, dialogSeq = 0, current = null, day = null;
  let pane = 'tasks', taskPage = 1, draftDirty = false, saving = false, upload = null;
  const timestamp = new Intl.DateTimeFormat('ru-RU', {dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Moscow'});

  function token() {
    try { return window.AelitaStaffSession?.read()?.adminToken || localStorage.getItem('aelita_admin_token') || ''; }
    catch (_) { return ''; }
  }
  const actor = token();

  async function api(action, data = {}) {
    if (!actor || token() !== actor) throw { code:'not_authenticated' };
    const response = await fetch(endpoint, { method:'POST', cache:'no-store', signal:AbortSignal.timeout(25000),
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + actor }, body:JSON.stringify({ action, ...data }) });
    const result = await response.json();
    if (token() !== actor) throw { code:'not_authenticated' };
    if (!response.ok || result.error) throw { code:result.error };
    return result;
  }

  function el(tag, value, css) {
    const item = document.createElement(tag);
    if (value != null) item.textContent = value;
    if (css) item.className = css;
    return item;
  }

  function status(name, value, error = false) {
    $(name).textContent = value;
    $(name).classList.toggle('ed-error', error);
  }

  function errorText(err) {
    return errors[err?.code] || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }

  function button(label, click, css = 'ed-quiet') {
    const control = el('button', label, css);
    control.type = 'button';
    control.addEventListener('click', click);
    return control;
  }

  function input(label, name, value = '', { type = 'text', required = false, max } = {}) {
    const wrapper = el('label', label);
    const control = el(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') control.type = type;
    else control.rows = 3;
    control.className = 'ym-disable-keys';
    control.name = name; control.value = value; control.required = required;
    if (max) control.maxLength = max;
    wrapper.append(control);
    return wrapper;
  }

  function select(label, name, options, value) {
    const wrapper = el('label', label);
    const control = el('select'); control.name = name;
    control.append(...options.map(option => new Option(option, option)));
    control.value = value;
    wrapper.append(control);
    return wrapper;
  }

  function check(label, name, checked = false) {
    const wrapper = el('label', null, 'crew-check');
    const control = el('input');
    control.type = 'checkbox'; control.name = name; control.checked = checked;
    wrapper.append(control, document.createTextNode(label));
    return wrapper;
  }

  function field(form, key) { return form.elements.namedItem(key); }

  function date(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('.') : value || '';
  }

  function startDialog(title, contents) {
    $('dialog-title').textContent = title;
    $('dialog-body').replaceChildren(contents);
    status('dialog-status','');
    draftDirty = false;
    if (!$('dialog').open) $('dialog').showModal();
  }

  function closeDialog() {
    if (saving || (draftDirty && !window.confirm('Закрыть форму без сохранения?'))) return;
    ++dialogSeq;
    draftDirty = false;
    $('dialog').close();
  }

  function editor(title, controls, save, label = 'Сохранить') {
    ++dialogSeq;
    const form = el('form',null,'crew-field');
    const footer = el('div',null,'ed-actions');
    const submit = el('button',label); submit.type = 'submit';
    footer.append(submit); form.append(...controls, footer);
    form.addEventListener('input', () => { draftDirty = true; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving) return;
      saving = true; submit.disabled = true;
      try {
        await save(form);
        draftDirty = false;
        ++dialogSeq;
        $('dialog').close();
      } catch (err) { status('dialog-status',errorText(err),true); }
      finally { saving = false; submit.disabled = false; }
    });
    startDialog(title,form);
    return form;
  }

  async function listProjects(preferred = '') {
    const ticket = ++seq;
    ++paneSeq;
    current = null; day = null;
    $('project-note').textContent = '';
    $('work').hidden = true;
    $('export').disabled = true;
    $('social').hidden = true;
    $('edit-project').hidden = true;
    status('status','Загружаем проекты…');
    try {
      const scope = $('scope').value;
      const { projects } = await api('crew_projects',{ scope });
      if (ticket !== seq) return;
      $('project').replaceChildren(...projects.map(project => new Option(project.name,project.id)));
      if (projects.some(project => project.id === preferred)) $('project').value = preferred;
      if (projects.length) await loadProject();
      else status('status','Архив пока пуст.');
    } catch (err) { if (ticket === seq) status('status',errorText(err),true); }
  }

  async function loadProject() {
    const project = $('project').value;
    if (!project) return;
    const ticket = ++seq;
    ++paneSeq;
    taskPage = 1; current = null; day = null;
    $('work').hidden = true;
    $('edit-project').hidden = true;
    $('social').hidden = true;
    $('export').disabled = true;
    status('status','Открываем проект…');
    try {
      const result = await api('crew_project',{ project });
      if (ticket !== seq) return;
      current = result;
      $('project-note').textContent = [result.project.dates,result.project.archived ? 'Архивный проект' : ''].filter(Boolean).join(' · ');
      $('work').hidden = false;
      $('edit-project').hidden = project === '_team';
      $('export').disabled = false;
      $('social').hidden = !result.project.posts || result.project.archived;
      $('social').href = '/admin/social-posts/?project=' + encodeURIComponent(project);
      status('status','');
      for (const control of document.querySelectorAll('[data-crew-pane]')) {
        control.hidden = control.dataset.crewPane === 'tasks' ? !result.project.tasks :
          control.dataset.crewPane === 'schedule' ? !result.project.schedule : false;
      }
      if (pane === 'tasks' && !result.project.tasks || pane === 'schedule' && !result.project.schedule) pane = 'people';
      switchPane(pane);
    } catch (err) { if (ticket === seq) status('status',errorText(err),true); }
  }

  function switchPane(next) {
    if (!current) return;
    pane = next;
    ++paneSeq;
    for (const name of panels) $('panel-' + name).hidden = name !== next;
    for (const control of document.querySelectorAll('[data-crew-pane]')) control.setAttribute('aria-pressed',String(control.dataset.crewPane === next));
    if (next === 'tasks') loadTasks();
    else if (next === 'schedule') loadDay(day?.day || '');
    else renderPeople();
  }

  async function loadTasks() {
    const project = current?.project.id;
    if (!project) return;
    const ticket = ++paneSeq;
    $('task-list').replaceChildren();
    $('task-pages').hidden = true;
    $('new-task').hidden = current.project.archived;
    status('task-status','Загружаем задачи…');
    try {
      const data = await api('crew_tasks',{ project,view:$('tasks-view').value,page:taskPage });
      if (ticket !== paneSeq) return;
      const items = data.items.map(task => {
        const row = el('li');
        const deadline = task.deadline ? 'Срок ' + date(task.deadline) : '';
        const title = el('h3'); title.append(button(task.title,() => showTask(task.id)));
        row.append(title,el('p',[task.status,task.priority,deadline].filter(Boolean).join(' · '),'crew-meta'));
        if (task.assignees.length) row.append(el('p',task.assignees.join(', ')));
        return row;
      });
      $('task-list').replaceChildren(...items);
      taskPage = data.page;
      $('task-pages').hidden = data.pages <= 1;
      $('task-prev').disabled = taskPage === 1; $('task-next').disabled = taskPage >= data.pages;
      $('task-page').textContent = 'Страница ' + taskPage + ' из ' + data.pages;
      status('task-status',items.length ? 'Задач в разделе: ' + data.total : 'Подходящих задач пока нет.');
    } catch (err) { if (ticket === paneSeq) status('task-status',errorText(err),true); }
  }

  async function showTask(id) {
    const owner = current;
    if (!owner) return;
    const job = ++dialogSeq;
    startDialog('Задача CREW',el('p','Загружаем карточку…'));
    try {
      const data = await api('crew_task',{project:owner.project.id,id});
      if (job !== dialogSeq || current !== owner) return;
      const task = data.task, body = el('div',null,'crew-text');
      $('dialog-title').textContent = task.title;
      body.append(el('p',[task.status,task.priority,task.deadline ? 'Срок ' + date(task.deadline) : ''].filter(Boolean).join(' · '),'crew-meta'));
      if (task.assignees.length) body.append(el('p',task.assignees.join(', ')));
      if (task.description) body.append(el('p',task.description));
      if (!owner.project.archived) {
        const form = el('form');
        form.append(select('Статус','status',owner.statuses,task.status));
        const apply = el('button','Обновить статус'); apply.type='submit';
        form.append(apply);
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (saving) return;
          saving=true; apply.disabled=true;
          try {
            await api('crew_task_status',{project:owner.project.id,id,revision:task.revision,status:field(form,'status').value});
            await showTask(id);
            await loadTasks();
          } catch (err) { status('dialog-status',errorText(err),true); }
          finally { saving=false; apply.disabled=false; }
        });
        body.append(form);
        const actions=el('div',null,'ed-actions');
        actions.append(button('Редактировать задачу',()=>newTask(task)),button('Добавить комментарий',()=>commentTask(task)));
        body.append(actions);
      }
      if (data.subtasks.length) {
        const list = el('ul',null,'crew-items');
        for (const row of data.subtasks) { const item=el('li'); item.append(button(row.title,()=>showTask(row.id))); list.append(item); }
        body.append(el('h3','Подзадачи'),list);
      }
      if (data.comments.length) {
        body.append(el('h3','Комментарии'));
        for (const row of data.comments) {
          const when=Date.parse(row.date);
          body.append(el('p',[row.author,Number.isFinite(when)?timestamp.format(when):''].filter(Boolean).join(' · '),'crew-meta'),el('p',row.text));
        }
      }
      $('dialog-body').replaceChildren(body);
    } catch (err) { if (job === dialogSeq) status('dialog-status',errorText(err),true); }
  }

  function newTask(task) {
    const owner=current;
    if (!owner || owner.project.archived) return;
    const id=task?.id || 'W'+crypto.randomUUID();
    const names=el('details');
    names.append(el('summary','Исполнители'));
    const choices=new Set([...(task?.assignees || []),...owner.participants.filter(row=>row.assignable).map(row=>row.name)]);
    for (const name of choices) {
      const item=check(name,'assignee',task?.assignees.includes(name)); item.querySelector('input').value=name; names.append(item);
    }
    if (names.childElementCount === 1) names.append(el('p','У проекта пока нет участников с уникальными именами.'));
    editor(task ? 'Редактирование задачи' : 'Новая задача', [
      input('Название','title',task?.title,{ required:true,max:3000 }),
      input('Описание','description',task?.description,{ type:'textarea',max:30000 }),
      select('Приоритет','priority',owner.priorities,task?.priority || 'Средний'),
      input('Срок по Москве','deadline',task?.deadline,{ type:'date' }),names
    ],async form=>{
      await api(task?'crew_task_edit':'crew_task_create',{ id,project:owner.project.id,...(task?{revision:task.revision}:{}),
        title:field(form,'title').value,description:field(form,'description').value,
        priority:field(form,'priority').value,deadline:field(form,'deadline').value,assignees:new FormData(form).getAll('assignee') });
      if (!task) { $('tasks-view').value='open'; taskPage=1; }
      await loadTasks();
    },task?'Сохранить задачу':'Создать задачу');
  }

  function commentTask(task) {
    if (!current || current.project.archived) return;
    const commentId='W'+crypto.randomUUID();
    editor('Комментарий к задаче',[input('Комментарий','text','',{type:'textarea',required:true,max:2200})],async form=>{
      await api('crew_task_comment',{project:task.project,id:task.id,commentId,text:field(form,'text').value});
      status('task-status','Комментарий сохранён в задаче «'+task.title+'».');
    });
  }

  function projectEditor(project) {
    const id=project?.id || 'P'+crypto.randomUUID();
    editor(project ? 'Настройки проекта' : 'Новый проект', [
      input('Название','name',project?.name,{required:true,max:140}),input('Даты или период','dates',project?.dates,{max:140}),
      check('Задачи','tasks',project?.tasks ?? true),check('Расписание','schedule',project?.schedule ?? true),
      check('Публикации в соцсетях','posts',project?.posts ?? false),check('В архиве','archived',project?.archived ?? false),
      input('Telegram · @канал или ID','tg',project?.targets?.tg,{max:60}),
      input('ВКонтакте · ID сообщества','vk',project?.targets?.vk,{max:30}),
      input('Instagram · ID аккаунта','ig',project?.targets?.ig,{max:30})
    ],async form=>{
      const switches=Object.fromEntries(['tasks','schedule','posts','archived'].map(key=>[key,field(form,key).checked]));
      const targets=Object.fromEntries(['tg','vk','ig'].map(key=>[key,field(form,key).value]));
      await api('crew_project_save',{project:id,...switches,targets,...(project ? {baseRevision:project.revision} : {}),
        name:field(form,'name').value,dates:field(form,'dates').value});
      $('scope').value=switches.archived?'archive':'active'; await listProjects(id);
    });
  }

  function renderPeople() {
    $('people-edit').hidden=current.project.archived;
    const items=current.participants.map(person=>{
      const row=el('li'); row.append(el('strong',person.name));
      if (person.role) row.append(el('p',person.role,'crew-meta'));
      if (!person.assignable) row.append(el('p','Уточните имя перед назначением задачи.','crew-meta'));
      return row;
    });
    $('people-list').replaceChildren(...items);
    status('people-status',items.length ? 'Участников: '+items.length : 'Участников пока нет.');
  }

  function repeatRows(initial, fields, title, max) {
    const wrapper=el('div',null,'crew-field'), rows=el('div');
    function add(values={}) {
      if (rows.childElementCount >= max) return;
      const row=el('div',null,'crew-edit-row');
      for (const [fieldName,label,options] of fields) row.append(input(label,fieldName,values[fieldName],options));
      row.append(button('Убрать строку',()=>{row.remove();draftDirty=true;}));
      rows.append(row);
    }
    initial.forEach(add);
    wrapper.append(rows,button(title,()=>{add();draftDirty=true;}));
    return { wrapper, values:()=>[...rows.children].map(row=>Object.fromEntries(fields.map(([key])=>[key,row.querySelector('[name="'+key+'"]').value]))) };
  }

  function editPeople() {
    const owner=current;
    if (!owner || owner.project.archived) return;
    const fields=repeatRows(owner.participants,[['name','Имя',{required:true,max:120}],['role','Роль в проекте',{max:100}]],'Добавить участника',500);
    editor('Участники проекта',[fields.wrapper],async()=>{
      await api('crew_members_save',{project:owner.project.id,baseRevision:owner.membersRevision,members:fields.values()});
      await loadProject();
    });
  }

  async function loadDay(selected = '') {
    const project=current?.project.id;
    if (!project) return;
    const job=++paneSeq;
    day=null;
    $('schedule-day').disabled=true; $('schedule-edit').disabled=true; $('schedule-new').disabled=true; $('schedule-copy').disabled=true;
    status('schedule-status','Загружаем расписание…');
    try {
      const data=await api('crew_schedule',{project,day:selected});
      if (job!==paneSeq) return;
      day=data;
      $('schedule-day').replaceChildren(...data.days.map(key=>new Option(date(key),key)));
      $('schedule-day').disabled=!data.days.length; $('schedule-day').value=data.day;
      $('schedule-edit').disabled=current.project.archived || !data.day;
      $('schedule-new').disabled=current.project.archived;
      $('schedule-copy').disabled=!data.events.length;
      $('schedule-list').replaceChildren(...data.events.map(event=>{
        const item=el('li');
        item.append(el('h3',event.what),el('p',[[event.start,event.end].filter(Boolean).join('–'),event.where,event.who].filter(Boolean).join(' · '),'crew-meta'));
        if (event.note) item.append(el('p',event.note,'crew-text'));
        return item;
      }));
      status('schedule-status',data.events.length ? '' : 'На этот день записей пока нет.');
    } catch (err) { if (job===paneSeq) status('schedule-status',errorText(err),true); }
  }

  function editDay(createDay = false) {
    const owner=current, selected=day;
    if (!selected || owner.project.archived) return;
    const existing=!createDay && !!selected.day;
    const dateField=input('Дата','day',existing ? selected.day : '',{type:'date',required:true});
    if (existing) dateField.querySelector('input').readOnly=true;
    const fields=repeatRows(existing?selected.events:[],[
      ['start','Начало',{type:'time'}],['end','Окончание',{type:'time'}],
      ['what','Что',{required:true,max:260}],['who','Участники',{max:260}],['where','Место',{max:200}],['note','Примечание',{max:1200}]
    ],'Добавить строку',150);
    editor(existing?'Расписание дня':'Новый день',[dateField,fields.wrapper],async form=>{
      const target=field(form,'day').value;
      const events=fields.values();
      if (!existing && selected.days.includes(target)) throw {code:'crew_project_conflict'};
      if (!events.length && (!existing || !window.confirm('Удалить пустой день из расписания?'))) throw {code:'bad_schedule_rows'};
      await api('crew_schedule_save',{project:owner.project.id,day:target,events,baseRevision:selected.baseRevision});
      await loadDay(events.length ? target : '');
    });
  }

  function saveFile(blob, filename) {
    if (window.AelitaMobileFiles) return window.AelitaMobileFiles.save(blob,filename,{guardToken:actor});
    if (actor!==token()) return;
    const url=URL.createObjectURL(blob), link=el('a');
    link.href=url; link.download=filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function exportProject() {
    const owner=current;
    if (!owner) return;
    try {
      const data=await api('crew_export',{project:owner.project.id});
      if (current!==owner || actor!==token()) return;
      const book=xlsxBlob([
        {name:'Задачи',title:data.project.name+' · Задачи',rows:[['Задача','Статус','Приоритет','Срок','Исполнители'],...data.tasks.map(t=>[t.title,t.status,t.priority,t.deadline,t.assignees.join(', ')])]},
        {name:'Расписание',title:data.project.name+' · Расписание',rows:[['Дата','Начало','Окончание','Что','Участники','Место','Примечание'],...Object.entries(data.schedule).sort().flatMap(([key,rows])=>rows.map(row=>[key,row.start,row.end,row.what,row.who,row.where,row.note]))]},
        {name:'Участники',title:data.project.name+' · Участники',rows:[['Имя','Роль'],...data.members.map(member=>[member.name,member.role])]},
        {name:'Публикации',title:data.project.name+' · Публикации',rows:[['Название','Срок UTC','Состояние','Telegram','ВКонтакте','Instagram'],...(data.posts||[]).map(p=>[p.label,p.scheduledAt,p.status,p.telegram,p.vk,p.instagram])]}
      ]);
      saveFile(book,'aelita-crew-'+owner.project.id+'.xlsx');
    } catch (err) { status('status',errorText(err),true); }
  }

  $('gate').hidden=!!actor;
  if (!actor) return;
  $('app').hidden=false;
  $('import-section').hidden=false;
  $('scope').addEventListener('change',()=>listProjects());
  $('project').addEventListener('change',loadProject);
  $('close').addEventListener('click',closeDialog);
  $('dialog').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  $('new-project').addEventListener('click',()=>projectEditor());
  $('edit-project').addEventListener('click',()=>{if(current)projectEditor(current.project);});
  $('new-task').addEventListener('click',()=>newTask());
  $('tasks-view').addEventListener('change',()=>{taskPage=1;loadTasks();});
  $('task-prev').addEventListener('click',()=>{taskPage--;loadTasks();});
  $('task-next').addEventListener('click',()=>{taskPage++;loadTasks();});
  $('schedule-day').addEventListener('change',()=>loadDay($('schedule-day').value));
  $('schedule-edit').addEventListener('click',()=>editDay());
  $('schedule-new').addEventListener('click',()=>editDay(true));
  $('schedule-copy').addEventListener('click',async()=>{
    const copy=day;
    if(!copy?.events.length)return;
    const content=[date(copy.day),...copy.events.map(event=>[[event.start,event.end].filter(Boolean).join('–'),event.what,event.where,event.who,event.note].filter(Boolean).join(' · '))].join('\n');
    try{await navigator.clipboard.writeText(content);status('schedule-status','День скопирован.');}
    catch(_){status('schedule-status','Не удалось скопировать расписание.',true);}
  });
  $('people-edit').addEventListener('click',editPeople);
  $('export').addEventListener('click',exportProject);
  for (const control of document.querySelectorAll('[data-crew-pane]')) control.addEventListener('click',()=>switchPane(control.dataset.crewPane));
  $('import-file').addEventListener('change',()=>{
    upload=null; $('import-apply').hidden=true; $('import-review').disabled=!$('import-file').files.length; status('import-status','');
  });
  $('import-review').addEventListener('click',async()=>{
    const file=$('import-file').files[0];
    if(!file) return;
    $('import-review').disabled=true;
    try {
      if(file.size>2_000_000)throw {code:'bad_import'};
      const bundle=JSON.parse(await file.text());
      const review=await api('crew_import_preview',{bundle});
      if(file!==$('import-file').files[0]) return;
      upload={bundle,proof:review.proof};
      status('import-status','К добавлению '+review.added+'. Уже совпадают '+review.matched+'.');
      $('import-apply').hidden=review.added===0;
    } catch(err) { if(file===$('import-file').files[0]) status('import-status',errorText(err),true); }
    finally { $('import-review').disabled=!$('import-file').files.length; }
  });
  $('import-apply').addEventListener('click',async()=>{
    if(!upload)return;
    const prepared=upload;
    $('import-apply').disabled=true;
    try {
      const saved=await api('crew_import_apply',prepared);
      if(upload!==prepared)return;
      upload=null; $('import-apply').hidden=true; status('import-status','Добавлено записей: '+saved.added+'.'); await listProjects();
    }catch(err){status('import-status',errorText(err),true);}
    finally{$('import-apply').disabled=false;}
  });
  function register() {
    window.AelitaWorkForms?.register('crew-ops',{dirty:()=>draftDirty,busy:()=>saving,visible:()=>$('dialog').open});
  }
  register();
  if (!window.AelitaWorkForms) window.addEventListener('aelita-work-forms-ready',register,{once:true});
  listProjects();
})();
