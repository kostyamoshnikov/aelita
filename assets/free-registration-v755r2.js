(function(){'use strict';
  var en=document.documentElement.lang==='en',id=new URLSearchParams(location.search).get('event')||'',base='https://api.aelita-production.ru',form=document.getElementById('free-form'),status=document.getElementById('free-status'),login=document.getElementById('free-login'),submit=document.getElementById('free-submit'),account=document.getElementById('free-account');
  var texts=en?{invalid:'Event not found.',checking:'Checking registration…',closed:'Registration is closed or unavailable.',login:'Sign in or create an account by email to register.',connected:'Your verified account: ',failed:'Could not check your account. Please try again.',sending:'Registering…',success:'You are registered. Your ticket with a QR code has been emailed to ',mailFailed:'You are registered, but we could not confirm delivery of the email. Open your account to view the ticket or resend it.',already:'You may already be registered. Open your account to check.',error:'Could not complete registration. Check your details and try again.',full:'All places are taken.',consent:'Please agree to personal data processing.',phone:'Please check the phone number, or leave it blank.',refresh:'Your session expired. Sign in again.'}:{invalid:'Событие не найдено.',checking:'Проверяем регистрацию…',closed:'Регистрация закрыта или временно недоступна.',login:'Войдите или создайте кабинет по почте, чтобы записаться.',connected:'Ваш подтверждённый кабинет: ',failed:'Не удалось проверить кабинет. Попробуйте ещё раз.',sending:'Записываем…',success:'Вы зарегистрированы. Письмо с QR-билетом отправлено на ',mailFailed:'Вы зарегистрированы, но подтвердить отправку письма не удалось. Откройте билет в кабинете или отправьте его повторно.',already:'Возможно, вы уже зарегистрированы. Проверьте в личном кабинете.',error:'Не удалось записаться. Проверьте данные и попробуйте снова.',full:'Свободных мест больше нет.',consent:'Отметьте согласие на обработку персональных данных.',phone:'Проверьте телефон или оставьте поле пустым.',refresh:'Сессия закончилась. Войдите снова.'};
  function say(s){status.textContent=s;}
  if(!/^evt-[a-f0-9]{32}$/.test(id)){say(texts.invalid);return;}
  var returnPath=(en?'/en':'')+'/event-registration/?event='+encodeURIComponent(id);
  login.href=(en?'/en':'')+'/account/?next='+encodeURIComponent(returnPath);
  var token='';try{token=localStorage.getItem('aelita_account_token')||'';}catch(_){}
  function keyFor(payload){
    var k='aelita_free_registration_'+id, signature=JSON.stringify([payload.name,payload.phone,payload.lang]),old;
    try{old=JSON.parse(sessionStorage.getItem(k)||'null');}catch(_){}
    if(old&&old.signature===signature&&typeof old.id==='string')return old.id;
    var next=crypto.randomUUID();try{sessionStorage.setItem(k,JSON.stringify({id:next,signature:signature}));}catch(_){}return next;
  }
  async function init(){say(texts.checking);try{
    var probe=await fetch(base+'/events/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:id,probe:true}),cache:'no-store'});
    if(!probe.ok||(await probe.json()).open!==true){say(texts.closed);document.getElementById('free-dashboard').hidden=false;return;}
    if(!token){say(texts.login);login.hidden=false;return;}
    var me=await fetch(base+'/account/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(me.status===401){say(texts.refresh);login.hidden=false;return;}
    if(!me.ok)throw Error('account');var profile=await me.json();if(!profile.email)throw Error('account');
    if(profile.emailVerified!==true){say(en?'Confirm your email in your account before registering.':'Подтвердите почту в личном кабинете перед регистрацией.');document.getElementById('free-dashboard').hidden=false;return;}
    account.textContent=texts.connected+profile.email;form.hidden=false;say('');
  }catch(_){say(texts.failed);}}
  form.addEventListener('submit',async function(ev){ev.preventDefault();if(!form.reportValidity())return;
    var payload={event_id:id,name:document.getElementById('free-name').value.trim(),phone:document.getElementById('free-phone').value.trim(),pd_consent:document.getElementById('free-consent').checked,lang:en?'en':'ru'};
    payload.request_id=keyFor(payload);submit.disabled=true;say(texts.sending);
    try{var res=await fetch(base+'/events/register',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload),cache:'no-store'});var d=await res.json();
      if(res.status===401){say(texts.refresh);login.hidden=false;return;}
      if(!res.ok){say(d.error==='event_full'?texts.full:d.error==='already_registered'?texts.already:d.error==='pd_consent_required'?texts.consent:d.error==='invalid_phone'?texts.phone:texts.error);return;}
      form.hidden=true;say(d.mailSent===true?texts.success+d.email+'.':texts.mailFailed);document.getElementById('free-dashboard').hidden=false;
    }catch(_){say(texts.error);}finally{submit.disabled=false;}
  });
  init();
})();
