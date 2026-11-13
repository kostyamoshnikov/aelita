/* Working-form state stays in memory; no field contents are persisted or logged. */
(function(){
 'use strict';
 const states=new WeakMap(),roots=new Set(),guards=new Map();
 const selector='dialog form,.modal-box form,#inv-form,#inv-import,[data-work-guard]';
 const controls='input,textarea,select,[contenteditable="true"],[data-work-state]';
 let scheduled=false;
 const eligible=root=>root&&!root.closest('[data-work-untracked],#crm-reauth')&&!root.matches('#filters,#login');
 function visible(root){return !!root?.isConnected&&!root.closest('[hidden]')&&(!root.closest('dialog')||root.closest('dialog').open)&&root.getClientRects().length>0;}
 function elements(root){return [...(root.matches?.(controls)?[root]:[]),...root.querySelectorAll(controls)].filter(el=>!el.closest('[data-work-untracked]')&&!el.matches('button,input[type=button],input[type=submit],input[type=reset],[data-social-search]'));}
 function value(el){
  if(el.hasAttribute('data-work-state'))return el.getAttribute('data-work-state');
  const inactive=!!el.closest('fieldset:disabled');let v;
  if(el.type==='checkbox'||el.type==='radio')v=el.checked;
  else if(el.type==='file')v=[...el.files||[]].map(f=>[f.name,f.size,f.lastModified]);
  else if(el.tagName==='SELECT')v=[...el.selectedOptions].map(o=>o.value);
  else v=el.isContentEditable?el.innerHTML:el.value;
  return JSON.stringify([v,inactive]);
 }
 function baseline(root){return new Map(elements(root).map(el=>[el,value(el)]));}
 function watch(root){if(!eligible(root))return null;if(!states.has(root)){states.set(root,baseline(root));roots.add(root);}return states.get(root);}
 function dirty(root){const saved=watch(root);if(!saved)return false;const fields=elements(root);return fields.length!==saved.size||fields.some(el=>!saved.has(el)||saved.get(el)!==value(el));}
 function clean(root){if(!eligible(root))return;states.set(root,baseline(root));roots.add(root);paint(root);}
 function adopt(root,area){const saved=watch(root);if(!saved)return;for(const el of elements(area))if(!saved.has(el))saved.set(el,value(el));paint(root);}
 function feedback(message,root){let host=root?.closest('dialog')||root;if(!host||!visible(host))host=document.querySelector('#notice')||document.body;let note=host.querySelector(':scope > .work-form-status');if(!note){note=document.createElement('p');note.className='work-form-status';note.setAttribute('role','status');host.prepend(note);}if(note.textContent!==message)note.textContent=message;}
 function inScope(scope){return [...roots].filter(root=>visible(root)&&(!scope||scope===root||scope.contains(root)));}
 function busy(scope){return inScope(scope).some(root=>root.dataset.saving==='1'||root.dataset.workBusy==='1');}
 function hasChanges(scope){return inScope(scope).some(dirty)||(!scope&&[...guards.values()].some(g=>(!g.visible||g.visible())&&g.dirty?.()));}
 function canClose(scope){if(busy(scope)){feedback('Сохранение ещё выполняется. Дождитесь результата.',scope);return false;}return !hasChanges(scope)||confirm('Закрыть без сохранения изменений?');}
 function canLeave(){
  if(busy()||[...guards.values()].some(g=>(!g.visible||g.visible())&&g.busy?.())){feedback('Выполняется операция. Дождитесь результата, затем повторите переход.');return false;}
  return !hasChanges()||confirm('Есть несохранённые изменения. Уйти со страницы?');
 }
 function paint(root){
  if(!visible(root))return;const changed=dirty(root);root.toggleAttribute('data-work-dirty',changed);
  const dialog=root.closest('dialog');if(!dialog||dialog.id==='crm-reauth')return;
  let hint=dialog.querySelector(':scope > .work-dirty-hint');if(!hint){hint=document.createElement('p');hint.className='work-dirty-hint';hint.setAttribute('role','status');const head=dialog.querySelector(':scope > .row,:scope > .ed-dialog-head,h2');head?head.after(hint):dialog.prepend(hint);}
  const text=changed?'Есть несохранённые изменения':'';if(hint.textContent!==text)hint.textContent=text;hint.hidden=!changed;
 }
 function update(){scheduled=false;for(const root of [...roots])if(!root.isConnected)roots.delete(root);document.querySelectorAll(selector).forEach(root=>{watch(root);paint(root);});}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
 function prepare(e){const root=e.target.closest?.(selector);if(root)watch(root);}
 document.addEventListener('focusin',prepare,true);document.addEventListener('beforeinput',prepare,true);
 document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);
 document.addEventListener('reset',e=>queueMicrotask(()=>clean(e.target)),true);
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-close],[data-dialog-close]');if(!b)return;
  const d=(b.dataset.close&&document.getElementById(b.dataset.close))||b.closest('dialog');
  if(!d||d.id==='editor')return;
  if(!canClose(d)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 document.addEventListener('cancel',e=>{if(e.target.id==='editor')return;if(!canClose(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('beforeunload',e=>{if(hasChanges()||busy()){e.preventDefault();e.returnValue='';}});
 window.AelitaWorkForms={watch,clean,adopt,dirty,hasChanges,busy,canClose,canLeave,feedback,refresh:schedule,register:(key,guard)=>{guards.set(key,guard);return()=>guards.delete(key);}};
 function start(){update();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.dispatchEvent(new Event('aelita-work-forms-ready'));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
