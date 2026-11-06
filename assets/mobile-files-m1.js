(function () {
 'use strict';
 var currentUrl=null,timer=null,lastTrigger=null,en=document.documentElement.lang==='en';
 function currentToken(){try{return /^\/(?:en\/)?admin(?:\/|$)/.test(location.pathname)?localStorage.getItem('aelita_admin_token'):localStorage.getItem('aelita_account_token');}catch(_){return null;}}
 function clear(){clearTimeout(timer);timer=null;if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=null;var old=document.getElementById('m1-download-ready');if(old)old.remove();}
 function save(blob,filename,opts){
  opts=opts||{};var token=currentToken();
  if(!token||opts.guardToken!==undefined&&token!==opts.guardToken)return false;
  clear();var url=URL.createObjectURL(blob),box=document.createElement('section'),label=document.createElement('p'),link=document.createElement('a');
  box.id='m1-download-ready';box.className='m1-download-ready';box.setAttribute('aria-label',en?'Prepared file':'Подготовленный файл');
  label.textContent=en?'Your file is ready. This download link is available for 15 minutes on this page.':'Файл готов. На этой странице ссылка доступна 15 минут.';
  filename=String(filename||'aelita-file').split(/[\\/]/).pop().replace(/[\x00-\x1f]/g,'').slice(0,200);
  link.href=url;link.download=filename;link.textContent=(en?'Download ':'Скачать ')+filename;box.append(label,link);
  var source=opts.after||lastTrigger,target=source&&source.isConnected&&source!==document.body?source.closest('.purchase-item,.reg-item,.ev-group,.cust-item')||source.parentElement:null;
  if(target&&target!==document.body)target.insertAdjacentElement('afterend',box);else(document.getElementById('content')||document.querySelector('main')||document.body).prepend(box);
  currentUrl=url;timer=setTimeout(clear,15*60000);if(opts.auto!==false)link.click();return url;
 }
 document.addEventListener('click',function(event){var t=event.target.closest&&event.target.closest('button,a,[role=button]');if(t&&!t.closest('#m1-download-ready'))lastTrigger=t;},true);
 window.addEventListener('storage',function(e){if(e.key==='aelita_account_token')clear();});window.addEventListener('pagehide',clear);
 window.AelitaMobileFiles=Object.freeze({save:save,clear:clear});
})();
