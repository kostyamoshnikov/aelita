(function(){
 'use strict';
 var token=new URLSearchParams(location.hash.slice(1)).get('token');
 try{history.replaceState(null,'',location.pathname);}catch(_){}
 var status=document.getElementById('access-status'),form=document.getElementById('access-form'),fields=document.getElementById('access-passwords'),button=document.getElementById('access-submit'),done=document.getElementById('access-done');
 function message(s){status.textContent=s;}
 async function call(action,extra){
  var r=await fetch('https://api.aelita-production.ru/crm',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify(Object.assign({action:action,token:token},extra||{}))});
  var d=await r.json();if(!r.ok)throw Error(d.message||'Не удалось проверить ссылку. Попробуйте позже.');return d;
 }
 var purpose='';
 async function load(){
  if(!token||!/^u_[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(token)){message('Откройте ссылку из письма с приглашением или подтверждением почты.');return;}
  try{
   var d=await call('staff_access_info');purpose=d.purpose;
   document.getElementById('access-name').textContent=d.name;
   document.getElementById('access-identity').textContent='Логин: '+d.login+' · Почта: '+d.email;
   message(purpose==='email'?'Подтвердите эту почту для входа по логину или email.':'Задайте личный пароль для входа по логину или email.');
   fields.hidden=purpose==='email';Array.from(fields.querySelectorAll('input')).forEach(function(x){x.disabled=purpose==='email';});
   button.textContent=purpose==='email'?'Подтвердить почту':'Сохранить пароль';form.hidden=false;
  }catch(e){message(e.message);}
 }
 form.addEventListener('submit',async function(e){
  e.preventDefault();button.disabled=true;
  try{
   if(purpose!=='email'&&form.elements.namedItem('password').value!==form.elements.namedItem('repeat').value)throw Error('Пароли не совпадают.');
   await call('staff_access_accept',purpose==='email'?{}:{password:form.elements.namedItem('password').value});
   if(window.AelitaStaffSession)window.AelitaStaffSession.clear();
   form.reset();form.hidden=true;token=null;done.hidden=false;message(purpose==='email'?'Почта подтверждена. Войдите по своему логину или этой почте.':'Пароль сохранён, почта подтверждена. Теперь можно войти в рабочие разделы.');
  }catch(err){message(err.message);}finally{button.disabled=false;}
 });
 load();
}());
