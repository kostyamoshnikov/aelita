(function(){
 'use strict';
 const cats={sponsor:'Спонсорское',rights:'Права',other:'Другое'},docs={contract:'Договор',requirements:'Требования',material:'Материал',proof:'Подтверждение',other:'Другое'};
 const states={open:'Открыто',in_progress:'В работе',done:'Выполнено',cancelled:'Отменено'};
 const related=(state,id)=>state.lookups.organizations.find(x=>x.id===id)?.label||'';
 const btn=(attr,text)=>'<button type="button" '+attr+'>'+text+'</button>';
 function editor(x,{input,select,options}){
  const o=x.obligation||{};
  const row=(d={})=>'<div class="form-grid" data-obligation-doc>'+select('od_kind','Тип',options(docs,d.kind||'contract'))+
   input('od_version','Версия или дата',d.version)+input('od_label','Название документа',d.label,'text',true)+input('od_url','HTTPS-ссылка',d.url,'url',true)+
   btn('data-obligation-doc-remove','Убрать документ')+'</div>';
  const html='<fieldset class="full production-editor" data-obligation-editor '+(x.commitment?'':'hidden disabled')+'><legend>Детали обязательства</legend><div class="form-grid">'+
   '<p class="hint full">Выберите контрагента в поле «Организация», контакт и срок в основной части формы.</p>'+
   select('o_scope','Применимость',options({project:'Весь проект',shows:'Выбранные показы'},o.scope||(x.dealId?'shows':'project')))+
   '<label class="field full" data-obligation-shows><span>Показы проекта</span><select multiple name="o_shows"></select></label>'+
   input('o_expected','Что нужно сделать',o.expected,'textarea',true)+input('o_result','Фактический результат',o.result,'textarea',true)+
   '<label class="field full"><span><input type="checkbox" name="o_waiting" '+(o.waiting?'checked':'')+'> Ждём партнёра</span></label>'+
   '<details class="full"><summary>Действие прав и согласование</summary><div class="form-grid">'+input('o_validFrom','Действует с',o.validFrom,'date')+
   input('o_validTo','Действует до',o.validTo,'date')+input('o_territory','Территория',o.territory)+input('o_formats','Форматы',o.formats)+
   input('o_constraints','Ограничения',o.constraints,'textarea',true)+input('o_reviewedOn','Дата последней сверки',o.reviewedOn,'date')+'</div></details>'+
   '<div class="full"><h3>Документы</h3><div data-obligation-docs>'+(o.documents||[]).map(row).join('')+'</div>'+
   btn('data-obligation-doc-add','+ Добавить документ')+'</div></div></fieldset>';
  return {html,row};
 }
 function wire(form,x,state,template,esc){
  const fieldset=form.querySelector('[data-obligation-editor]'),category=form.elements.namedItem('commitment');
  if(!fieldset||!category)return;
  const scope=form.elements.namedItem('o_scope'),shows=form.elements.namedItem('o_shows'),project=form.elements.namedItem('projectId'),deal=form.elements.namedItem('dealId');
  const reconcile=(initial=false)=>{
   fieldset.hidden=fieldset.disabled=!category.value;
   shows.closest('label').hidden=scope.value!=='shows';
   const pid=project.value||state.lookups.deals.find(d=>d.id===deal.value)?.projectId;
   const selected=initial?(x.obligation?.showIds||(x.dealId?[x.dealId]:[])):[...shows.selectedOptions].map(o=>o.value);
   const choices=state.lookups.deals.filter(d=>d.show&&d.projectId===pid&&(!d.archived||selected.includes(d.id)));
   shows.innerHTML=choices.map(d=>'<option value="'+esc(d.id)+'" '+(selected.includes(d.id)?'selected':'')+'>'+esc(d.label)+'</option>').join('')+
    selected.filter(id=>!choices.some(x=>x.id===id)).map(id=>'<option selected value="'+esc(id)+'">Сохранённая связь вне текущего списка</option>').join('');
  };
  for(const el of [category,scope,project,deal])el.addEventListener('change',()=>reconcile());
  reconcile(true);
  fieldset.addEventListener('click',e=>{
   if(e.target.closest('[data-obligation-doc-remove]'))e.target.closest('[data-obligation-doc]').remove();
   if(e.target.closest('[data-obligation-doc-add]')){
    const rows=fieldset.querySelector('[data-obligation-docs]');
    if(rows.children.length<12){rows.insertAdjacentHTML('beforeend',template.row());rows.lastElementChild.querySelector('select')?.focus();}
   }
  });
 }
 function collect(form,data,x){
  const rows=[...form.querySelectorAll('[data-obligation-doc]')];
  data.obligation=data.commitment?{
   scope:data.o_scope,showIds:[...form.elements.o_shows.selectedOptions].map(o=>o.value),expected:data.o_expected,result:data.o_result,waiting:!!data.o_waiting,
   validFrom:data.o_validFrom,validTo:data.o_validTo,territory:data.o_territory,formats:data.o_formats,constraints:data.o_constraints,reviewedOn:data.o_reviewedOn,
   documents:rows.map(row=>Object.fromEntries([...row.querySelectorAll('input,select')].map(el=>[el.name.slice(3),el.value]))).filter(row=>row.url||row.label||row.version),
  }:null;
  if(x.id&&x.commitment&&!x.obligation&&data.obligation){
   const {scope,showIds,documents,waiting,...fields}=data.obligation;
   if(!documents.length&&!waiting&&!Object.values(fields).some(Boolean)&&(!showIds.length||showIds.length===1&&showIds[0]===x.dealId))delete data.obligation;
  }
  for(const k of Object.keys(data))if(k.startsWith('o_')||k.startsWith('od_'))delete data[k];
 }
 function detail(x,esc,date,link){
  const o=x.obligation;if(!o)return '';
  const list=rows=>'<ul class="production-list">'+rows.map(d=>'<li><a href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">'+esc(d.label)+'</a> · '+esc(docs[d.kind])+(d.version?' · '+esc(d.version):'')+'</li>').join('')+'</ul>';
  const rows=[['Категория',cats[x.commitment]],['Применимость',o.scope==='project'?'Весь проект':'Выбранные показы'],['Ожидаемый результат',o.expected],['Фактический результат',o.result],
   ['Действие',[o.validFrom,o.validTo].filter(Boolean).join(' — ')],['Территория',o.territory],['Форматы',o.formats],['Ограничения',o.constraints],['Проверено',o.reviewedOn]];
  return '<section class="panel production-panel"><h2>Обязательство</h2>'+(o.waiting?'<p class="eyebrow">Ждём партнёра</p>':'')+
   '<dl>'+rows.filter(([,v])=>v).map(([k,v])=>'<dt>'+k+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>'+
   o.showIds.map(id=>link('deals',id)).join('')+(o.documents.length?'<h3>Документы</h3>'+list(o.documents):'')+
   (x.obligationHistory?.length?'<details><summary>Прежние версии документов</summary>'+x.obligationHistory.slice().reverse().map(v=>'<p class="hint">'+esc(date(v.at))+' · '+esc(v.actorName)+'</p>'+list(v.documents)).join('')+'</details>':'')+'</section>';
 }
 async function mount(root,type,x,{state,active,api,esc,date}){
  root.innerHTML='<h2>Обязательства</h2><div aria-live="polite">Загружаем…</div>';
  const list=root.querySelector('[aria-live]');
  try{
   const {items}=await api({action:'obligation_workspace',type,id:x.id});
   if(!active())return;
   if(!items.length){list.textContent='Обязательств пока нет.';return;}
   root.insertAdjacentHTML('beforeend','<label class="field"><span>Категория</span><select data-obligation-kind><option value="">Все</option>'+Object.entries(cats).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>'+
    '<label class="field"><span>Статус</span><select data-obligation-status><option value="">Все</option>'+Object.entries(states).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>');
   const kind=root.querySelector('[data-obligation-kind]'),status=root.querySelector('[data-obligation-status]');
   const paint=()=>{
    const rows=items.filter(t=>(!kind.value||kind.value===t.category)&&(!status.value||status.value===t.status));
    list.innerHTML=rows.length?'<ul class="production-list">'+rows.map(t=>'<li><button type="button" class="name-link" data-open="'+esc(t.id)+'" data-type="tasks">'+esc(t.title)+'</button><p class="hint">'+
     esc([cats[t.category],states[t.status],t.scope==='project'?'По всему проекту':'',related(state,t.organizationId),date(t.dueAt),t.waiting?'Ждём партнёра':'',t.review?'Сверить права':''].filter(Boolean).join(' · '))+'</p></li>').join('')+'</ul>':'<p class="hint">По этим условиям записей нет.</p>';
   };
   kind.onchange=paint;status.onchange=paint;paint();
  }catch(err){if(active())list.textContent=err.message;}
 }
 window.AelitaCrmObligations={editor,wire,collect,detail,mount};
})();
