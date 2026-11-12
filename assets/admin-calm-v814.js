(function(){
 'use strict';
 document.documentElement.classList.add('admin-calm');
 const excluded='[role="alert"],[role="status"],[aria-live],.error,.err,.bad,.password-note,.mail-confirm,.crm-mail-preview';
 function structure(node){if(node.dataset.calm||node.childElementCount||node.closest(excluded)||node.textContent.trim().length<260)return;const text=node.textContent.trim(),parts=text.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/u);if(parts.length<2)return;node.dataset.calm='true';const content=document.createElement('span');content.className='calm-explanation';const ul=document.createElement('span');ul.setAttribute('role','list');for(const part of parts){const li=document.createElement('span');li.setAttribute('role','listitem');li.className='calm-list-item';li.textContent=part;ul.append(li);}content.append(ul);node.replaceChildren(content);}
 function service(){const head=document.querySelector('#dataScreen .data-actions');if(!head||head.querySelector('.calm-service'))return;const details=document.createElement('details');details.className='calm-service';const summary=document.createElement('summary');summary.textContent='Сеанс';details.append(summary);for(const id of ['adminWho','loadedAt','logoutBtn']){const node=document.getElementById(id);if(node)details.append(node);}head.append(details);}
 let scheduled=false;
 function update(){scheduled=false;service();document.querySelectorAll('p.ed-note,p.ed-intro,p.hint,p.nl2-meta,.sales-extra .sales-line').forEach(structure);}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{update();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});});else{update();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
})();
