'use strict';

(() => {
  const element = (tag, text = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };
  const button = (text, click) => {
    const node = element('button', text);
    node.type = 'button';
    node.onclick = click;
    return node;
  };

  function selectMenu(select, label) {
    if (!select || select.multiple || select.required || select.dataset.crmPicker) return;
    select.dataset.crmPicker = 'true';
    let activeDialog=null;
    const current = () => select.selectedOptions[0]?.textContent || 'Выберите';
    const trigger = button(current(), () => {
      if(select.disabled||select.closest('fieldset:disabled'))return;
      const dialog = element('dialog');
      activeDialog=dialog;dialog.className = 'crm-picker';
      dialog.setAttribute('aria-label', label);
      dialog.setAttribute('closedby', 'closerequest');
      const header = element('div');
      header.className = 'crm-picker-header';
      header.append(element('h2', label), button('Закрыть', () => dialog.close()));
      const choices = element('div');
      choices.className = 'crm-picker-list';
      const options = Array.from(select.options);
      const filter = element('input');
      filter.type = 'search';
      filter.placeholder = 'Найти вариант';
      filter.setAttribute('aria-label', 'Найти вариант');
      filter.hidden = options.length < 12;
      const rows = options.map(option => {
        const choice = button(option.textContent, () => {
          if(select.disabled||select.closest('fieldset:disabled')||!select.isConnected||option.disabled||option.parentElement?.disabled===true||!select.contains(option)){dialog.close();return;}
          select.value = option.value;
          trigger.textContent = current();
          dialog.close();
          select.dispatchEvent(new Event('change', {bubbles: true}));
        });
        choice.disabled = select.disabled || option.disabled || option.parentElement?.disabled === true;
        choice.className = 'crm-picker-choice';
        choice.setAttribute('aria-pressed', String(option.selected));
        choices.append(choice);
        return choice;
      });
      const empty = element('p', 'Подходящих вариантов нет.');
      empty.hidden = true;
      choices.append(empty);
      filter.oninput = () => {
        const query = filter.value.toLocaleLowerCase('ru').trim();
        rows.forEach(row => { row.hidden = !row.textContent.toLocaleLowerCase('ru').includes(query); });
        empty.hidden = rows.some(row => !row.hidden);
      };
      dialog.append(header, filter, choices);
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        if(activeDialog===dialog)activeDialog=null;dialog.remove();
        if (trigger.isConnected) trigger.focus({preventScroll:true});
      }, {once:true});
      dialog.showModal();
      const selected = rows[select.selectedIndex];
      if (selected && !selected.disabled) {
        selected.focus({preventScroll:true});
        selected.scrollIntoView({block:'nearest'});
      }
    });
    trigger.className = 'crm-picker-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-label', label + ' · ' + current());
    const sync=()=>{trigger.textContent=current();trigger.disabled=select.disabled||!!select.closest('fieldset:disabled');trigger.setAttribute('aria-label',label+' · '+current());};
    select.addEventListener('change',sync);select.form?.addEventListener('reset',()=>setTimeout(sync,0));
    const observer=new MutationObserver(()=>{if(!select.isConnected){observer.disconnect();return;}sync();if(activeDialog?.open)activeDialog.close();});observer.observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','label','value']});sync();
    const parentFieldset=select.closest('fieldset');if(parentFieldset)observer.observe(parentFieldset,{attributes:true,attributeFilter:['disabled']});
    for(const key of ['value','selectedIndex']){let proto=Object.getPrototypeOf(select),desc;while(proto&&!desc){desc=Object.getOwnPropertyDescriptor(proto,key);proto=Object.getPrototypeOf(proto);}if(desc?.get&&desc?.set)Object.defineProperty(select,key,{configurable:true,get(){return desc.get.call(this);},set(value){desc.set.call(this,value);sync();if(activeDialog?.open)activeDialog.close();}});}
    select.hidden = true;
    select.after(trigger);
  }

  function notes(root, organization, api, actorId, formatDate) {
    const items = [];
    const list = element('div');
    const status = element('p');
    status.className = 'hint';
    status.setAttribute('role', 'status');
    const add = button('Добавить заметку', () => {
      if (items.filter(item => !item.id).length >= 30) {
        status.textContent = 'Сохраните эти заметки перед добавлением следующих.';
        return;
      }
      append({note:'',canEdit:true}).focus();
    });
    const more = button('Загрузить заметки', () => load());
    root.append(element('h3','Заметки'), list, add, more, status);
    more.hidden = !organization.id;
    let cursor = 0;

    function append(item) {
      const block = element('div');
      block.className = 'crm-inline-note';block.setAttribute('data-work-state','active');
      const label = element('label', item.id ? [item.actorName,formatDate(item.at)].filter(Boolean).join(' · ') : 'Новая заметка');
      const text = element('textarea');
      text.maxLength = 4000;
      text.rows = 2;
      text.value = item.note;
      text.readOnly = !item.canEdit;
      label.append(text);
      block.append(label);
      const state = {id:item.id,revision:item.revision,original:item.note,text};
      items.push(state);
      if (item.canEdit) {
        const marker = element('p','Заметка будет удалена при сохранении.');
        marker.hidden = true;
        const reasonLabel = element('label','Причина удаления');
        const reason = element('input');
        reason.maxLength = 400;
        reasonLabel.append(reason);
        reasonLabel.hidden = true;
        state.reason = reason;
        const remove = button('Удалить заметку', () => {
          if (!item.id) {
            items.splice(items.indexOf(state), 1);
            block.remove();root.dispatchEvent(new Event('input',{bubbles:true}));
            add.focus();
            return;
          }
          state.deleted = !state.deleted;block.setAttribute('data-work-state',state.deleted?'deleted':'active');root.dispatchEvent(new Event('input',{bubbles:true}));
          marker.hidden = !state.deleted;
          label.hidden = state.deleted;
          reasonLabel.hidden = !state.deleted || item.actorId === actorId;
          reason.required = !reasonLabel.hidden;
          remove.textContent = state.deleted ? 'Отменить удаление' : 'Удалить заметку';
        });
        block.append(marker,reasonLabel,remove);
      }
      list.append(block);
      return text;
    }

    async function load() {
      more.disabled = true;
      try {
        const result = await api({action:'entry_list',type:'organizations',id:organization.id,kind:'notes',offset:cursor});
        if (!root.isConnected) return;
        for (const item of result.items) {
          if (!items.some(existing => existing.id === item.id)){const text=append(item);window.AelitaWorkForms?.adopt(root.closest('form'),text.closest('.crm-inline-note'));}
        }
        cursor = result.next;
        more.textContent = 'Ещё заметки';
        more.hidden = cursor == null;
        status.textContent = items.length ? '' : 'Сохранённых заметок пока нет.';
      } catch (error) {
        if (root.isConnected) {
          status.textContent = error.message;
          more.textContent = 'Повторить загрузку заметок';
        }
      } finally { more.disabled = false; }
    }

    if (organization.id) load();
    return () => items.flatMap(item => {
      const text = item.text.value.trim();
      if (item.deleted) return [{action:'delete',id:item.id,revision:item.revision,reason:item.reason.value.trim()}];
      if (!item.id) return text ? [{action:'add',text}] : [];
      if (!item.text.readOnly && text !== item.original.trim()) {
        if (!text) throw Error('Введите текст заметки или удалите её.');
        return [{action:'edit',id:item.id,revision:item.revision,text}];
      }
      return [];
    });
  }

  function longMenus(root){
    for(const select of root?.querySelectorAll('select:not([multiple]):not([required])')||[]){
      if(select.options.length<8||select.disabled)continue;
      const label=select.labels?.[0];
      const title=label?.querySelector('span')?.textContent||
        Array.from(label?.childNodes||[]).find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim())?.textContent.trim();
      if(title)selectMenu(select,title);
    }
  }

  function groupEditor(form,type){
    const groups={
      contacts:[['Контакт',['name','emails','phones','city','tags']],['Связи',['organizationIds']],['Описание',['notes']]],
      organizations:[['Организация',['name','type','city','website']],['Описание',['notes']]],
      tasks:[['Задача',['title','status','priority','description']],['Срок и связи',['dueAt','contactId','organizationId','dealId','projectId']]],
      deals:[['Договорённость',['title','pipeline','stage','amountRub','closeDate','lostReason','description']],['Связи',['contactId','organizationId','projectId']],['Документы',['documentLinks']]],
      projects:[['Проект или событие',['title','kind','status','city']],['Даты и место',['startsAt','endsAt','venueOrganizationId']],['Описание',['description']]]
    };
    const grid=form.querySelector(':scope > .form-grid');if(!grid||form.dataset.grouped)return;form.dataset.grouped='true';
    for(const [label,names] of groups[type]||[]){
      const fields=names.map(name=>form.elements.namedItem(name)?.closest?.('.field')).filter(el=>el?.parentElement===grid);
      if(!fields.length)continue;const group=element('fieldset');group.className='crm-editor-group full';const legend=element('legend',label),body=element('div');body.className='form-grid';fields[0].before(group);group.append(legend,body);fields.forEach(el=>body.append(el));
    }
    const footer=form.querySelector(':scope > .actions');if(footer){footer.classList.add('crm-editor-actions');footer.id='crm-editor-actions';if(form.querySelectorAll('input,select,textarea').length>8){const jump=element('button','К сохранению');jump.type='button';jump.className='crm-editor-jump';jump.onclick=()=>{footer.scrollIntoView({block:'end'});footer.querySelector('.primary')?.focus({preventScroll:true});};form.prepend(jump);}}
  }
  function filterSummary(form,filters,remove){
    form.parentElement.querySelector('.crm-active-filters')?.remove();
    const entries=Object.entries(filters).filter(([key,value])=>value!==false&&value!=null&&value!==''&&!(key==='sort'&&value==='updated')&&!(key==='overdue'&&filters.dueWindow));
    if(!entries.length)return;const box=element('section');box.className='crm-active-filters';box.setAttribute('aria-label','Применённые фильтры');box.append(element('span','Применены:'));
    const fallback={overdue:'Просроченные задачи',followupKind:'Следующее действие',projectId:'Проект',ownerId:'Ответственный'};
    for(const [key,value] of entries){const field=form.elements.namedItem(key),label=field?.closest('label')?.textContent.trim().split('\n')[0]||fallback[key]||key;let shown=field?.tagName==='SELECT'?field.selectedOptions[0]?.textContent:typeof value==='boolean'?'':String(value);if(field?.type==='checkbox')shown='';const caption=field?.tagName==='SELECT'?(fallback[key]||field.closest('label')?.childNodes[0]?.textContent.trim()||key):label;const b=button(caption+(shown?' · '+shown:'')+' ×',()=>remove(key));b.setAttribute('aria-label','Убрать фильтр: '+caption+(shown?' · '+shown:''));box.append(b);}form.before(box);
  }

  window.AelitaCrmUsability = {selectMenu, longMenus, notes, groupEditor, filterSummary};
})();
