(function(){
 'use strict';
 document.documentElement.classList.add('admin-calm');
 const dirty=new WeakSet(),menus=new Set();let scheduled=false;
 function urlError(form,path,message){
  let field;
  if(path?.startsWith('socialLinks.'))field=form.querySelectorAll('[data-social-row] input[type=url]')[Number(path.split('.')[1])];
  else{const names={'venueDetails.riderUrl':'v_riderUrl','show.contractUrl':'s_contractUrl','show.riderUrl':'s_riderUrl','show.pressKitUrl':'s_pressKitUrl'};field=form.elements.namedItem(names[path]||path);}
  if(!field?.focus)return false;
  markError(field,message);field.focus();field.scrollIntoView({block:'center'});return true;
 }
 function markError(field,message){
  field.setAttribute('aria-invalid','true');let note=field.parentElement.querySelector('.work-field-error');
  if(!note){note=document.createElement('span');note.className='work-field-error';note.id='work-error-'+Math.random().toString(36).slice(2);field.after(note);}
  note.textContent=message;field.setAttribute('aria-describedby',[...new Set((field.getAttribute('aria-describedby')||'').split(/\s+/).filter(x=>x&&!x.startsWith('work-error-')).concat(note.id))].join(' '));
 }
 function validateURLs(form){
  let first;
  for(const field of form.querySelectorAll('input[type=url],textarea[name=documentLinks]')){
   field.removeAttribute('aria-invalid');field.parentElement.querySelector('.work-field-error')?.remove();
   const lines=field.tagName==='TEXTAREA'?field.value.split(/[\n,;]+/):[field.value];
   for(const value of lines){if(!value.trim())continue;let valid=false;try{const u=new URL(value.trim());valid=u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{}
    if(!valid){markError(field,'Укажите полный адрес https://… без логина и пароля.');first??=field;break;}
   }
  }
  if(first){first.focus();first.scrollIntoView({block:'center'});return false;}return true;
 }
 window.AelitaWorkUI={validateURLs,urlError};
 function service(){const head=document.querySelector('#dataScreen .data-actions');if(!head||head.querySelector('.calm-service'))return;const details=document.createElement('details');details.className='calm-service';const summary=document.createElement('summary');summary.textContent='Сеанс';details.append(summary);for(const id of ['adminWho','loadedAt','logoutBtn']){const node=document.getElementById(id);if(node)details.append(node);}head.append(details);}
 function fitMenu(d){
  const list=d.querySelector('.adm-menu-list'),trigger=d.querySelector('summary');if(!list||!trigger)return;
  d.classList.remove('flip-l','flip-r','flip-fit');
  if(!d.open){menus.delete(d);if(typeof list.hidePopover==='function'&&list.matches(':popover-open'))list.hidePopover();return;}
  menus.add(d);for(const other of menus)if(other!==d)other.open=false;
  if(typeof list.showPopover==='function'){list.setAttribute('popover','manual');if(!list.matches(':popover-open'))try{list.showPopover();}catch{}}
  const vv=window.visualViewport,left=vv?.offsetLeft||0,top=vv?.offsetTop||0,w=vv?.width||innerWidth,h=vv?.height||innerHeight,r=trigger.getBoundingClientRect();
  Object.assign(list.style,{position:'fixed',inset:'auto',right:'auto',bottom:'auto',minWidth:'0',width:Math.min(300,w-24)+'px',maxHeight:Math.max(44,h-24)+'px',left:(left+12)+'px',top:(top+12)+'px'});
  const height=list.getBoundingClientRect().height,width=list.getBoundingClientRect().width;
  const below=top+h-r.bottom-8,above=r.top-top-8;
  const y=below>=height?r.bottom+6:above>=height?r.top-height-6:top+12;
  list.style.left=Math.max(left+12,Math.min(r.left,left+w-width-12))+'px';list.style.top=Math.max(top+12,y)+'px';
 }
 document.addEventListener('toggle',e=>{if(e.target.matches?.('details.adm-menu'))fitMenu(e.target);},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const d=[...menus].find(x=>x.open);if(d){e.preventDefault();d.open=false;d.querySelector('summary')?.focus();}}});
 document.addEventListener('click',e=>{for(const d of menus)if(d.open&&(!d.contains(e.target)||e.target.closest('.adm-menu-list :is(button,a)')))d.open=false;});
 function viewport(){document.documentElement.style.setProperty('--work-vh',(window.visualViewport?.height||innerHeight)+'px');for(const d of menus)if(d.open)fitMenu(d);}
 window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);window.addEventListener('scroll',()=>{for(const d of menus)if(d.open)fitMenu(d);},{passive:true});
 // Deliberately retain actual controls; typing/IME/autofill never replaces input DOM.
 const watched='dialog form,.modal-box form,#inv-form,.ed-wrap form';
 document.addEventListener('input',e=>{const f=e.target.closest(watched);if(f)dirty.add(f);if(e.target.hasAttribute('aria-invalid')){e.target.removeAttribute('aria-invalid');e.target.parentElement.querySelector('.work-field-error')?.remove();}},true);
 document.addEventListener('change',e=>{const f=e.target.closest(watched);if(f)dirty.add(f);},true);
 document.addEventListener('reset',e=>dirty.delete(e.target),true);
 document.addEventListener('submit',e=>{const f=e.target;if(f.matches(watched)&&!validateURLs(f)){e.preventDefault();e.stopImmediatePropagation();}},true);
 function changed(){return [...document.querySelectorAll(watched)].some(f=>f.isConnected&&f.offsetParent!==null&&dirty.has(f));}
 window.AelitaWorkCanLeave=()=>{if(window.AelitaCrmCanLeave&&!AelitaCrmCanLeave())return false;return !changed()||confirm('Есть несохранённые изменения. Уйти без сохранения?');};
 // Native Android calls this before history or closing a child WebView.
 window.AelitaWorkBack=()=>{
  const ds=[...document.querySelectorAll('dialog[open]')],d=ds.at(-1);
  if(d){const ev=new Event('cancel',{cancelable:true});if(d.dispatchEvent(ev))d.close();return true;}
  const menu=[...document.querySelectorAll('details[open]')].reverse().find(x=>x.matches('.adm-menu,.calm-service,.crm-header-more'));
  if(menu){menu.open=false;menu.querySelector('summary')?.focus();return true;}return false;
 };
 document.addEventListener('cancel',e=>{const d=e.target;if(d.id==='editor')return;const forms=[...d.querySelectorAll('form')];if(forms.some(f=>dirty.has(f))&&!confirm('Закрыть форму без сохранения изменений?')){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('beforeunload',e=>{if(changed()){e.preventDefault();e.returnValue='';}});
 function update(){
  scheduled=false;service();
  const select=document.getElementById('inv-event');if(select){let note=document.getElementById('inv-selected-description');if(!note){note=document.createElement('p');note.id='inv-selected-description';note.className='work-selection';select.after(note);select.setAttribute('aria-describedby',note.id);select.addEventListener('change',schedule);}const text=select.selectedOptions[0]?.textContent||'';if(note.textContent!==text)note.textContent=text;}
  const index=document.getElementById('admSectionIndex');if(index){const links=[...index.querySelectorAll('a')].filter(a=>!a.hidden);const hide=links.length<=1;if(index.hidden!==hide){index.hidden=hide;window.AelitaSectionNavigation?.init(index)?.refresh();}}
  for(const table of document.querySelectorAll('table'))if(!table.closest('.work-table-scroll')&&!table.closest('[role=grid]')){const wrap=document.createElement('div');wrap.className='work-table-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',table.getAttribute('aria-label')||'Таблица · прокрутка по горизонтали');table.before(wrap);wrap.append(table);}
  for(const file of document.querySelectorAll('input[type=file]'))if(!file.dataset.workFile){file.dataset.workFile='true';const note=document.createElement('p');note.className='hint';note.setAttribute('role','status');file.after(note);file.addEventListener('change',()=>{note.textContent=[...file.files].map(x=>x.name+' · '+Math.ceil(x.size/1024)+' КБ').join('; ')||'Файл не выбран';});}
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
 function about(){if(!location.pathname.startsWith('/admin/team/'))return;const box=document.createElement('details');box.className='work-about';const summary=document.createElement('summary');summary.textContent='О приложении AELITA CREW';const text=document.createElement('p');text.textContent='APK: '+(navigator.userAgent.match(/AelitaCrew\/([\d.]+)/)?.[1]||'открыто в браузере')+' · ресурсы страницы: 215 · '+(navigator.onLine?'есть подключение':'нет подключения')+'. Изменения сайта появятся после публикации; APK обновляется отдельно. Выгрузки в приложении — до 32 МБ.';const copy=document.createElement('button');copy.type='button';copy.textContent='Скопировать диагностику';copy.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({application:'AELITA CREW',apk:navigator.userAgent.match(/AelitaCrew\/([\d.]+)/)?.[1]||null,resources:215,webview:navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]||null,online:navigator.onLine,width:innerWidth,height:innerHeight},null,2));copy.textContent='Скопировано';}catch{copy.textContent='Копирование недоступно';}};box.append(summary,text,copy);(document.querySelector('main')||document.body).append(box);if(/AelitaCrew\//.test(navigator.userAgent))for(const install of document.querySelectorAll('[data-install],#installBtn,#install-button'))install.hidden=true;}
 function start(){update();about();viewport();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
