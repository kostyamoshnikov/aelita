(function(global){
'use strict';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={draft:'Черновик',scheduled:'По расписанию',open:'Открыта',hidden:'Скрыта'};
const chapters={I:'Вас ждут',II:'Всё связано',III:'История продолжается'};
async function mount(host,row,ctx){
 host.innerHTML='<h3>Личные QR-приглашения</h3><p>Закрытый режим. До выдачи приглашений необходима проверка гостевого маршрута. Ссылки пока не опубликованы.</p><p role="status" aria-live="polite">Загрузка…</p>';
 const status=host.querySelector('[role=status]');
 const request=(action,body={})=>ctx.api({action,id:row.id,...body});
 const write=(action,body={})=>ctx.mutate(action,{id:row.id,...body},global.crypto.randomUUID());
 const showError=e=>{if(ctx.active())status.textContent=e?.message||'Операция не выполнена';};
 let info;try{info=await request('christmas_qr_view');}catch(e){showError(e);return;}
 if(!ctx.active())return;
 const view=()=>{
  if(!info.initialized){host.innerHTML='<h3>Личные QR-приглашения</h3><p>Создайте закрытый список для подтверждённого заказа. Публикация ссылок отключена.</p><button type="button" data-init>Создать реестр</button><p role="status"></p>';
   host.querySelector('[data-init]').onclick=()=>act('christmas_qr_group_setup');return;}
  if(info.revoked){host.innerHTML='<h3>Личные QR-приглашения</h3><p>Доступ всей группы необратимо отозван. Старые QR и сеансы недействительны.</p>';return;}
  host.innerHTML='<h3>Личные QR-приглашения</h3><p>Доступ только владельцу CRM. Секрет QR отображается единственный раз при выдаче. Не публикуйте ссылки до приёмки гостевого маршрута.</p>'+
   '<p><strong>Гостей: '+info.guests.length+'</strong>. Выдано: '+info.guests.filter(g=>g.issued&&!g.revoked).length+'.</p>'+
   '<details><summary>Добавить гостей · CSV</summary><form data-roster><label>CSV UTF-8: имя; обращение (необязательно)<textarea class="ym-disable-keys" required rows="4" maxlength="5000" placeholder="Имя;обращение"></textarea></label><button type="submit">Добавить гостей</button></form></details>'+
   '<details><summary>Управление главами</summary><form data-chapter><label>Глава<select name="chapter">'+Object.entries(chapters).map(([v,t])=>'<option value="'+v+'">'+v+'. '+escape(t)+'</option>').join('')+'</select></label><label>Состояние<select name="state">'+Object.entries(labels).map(([v,t])=>'<option value="'+v+'">'+escape(t)+'</option>').join('')+'</select></label><label>Название<input class="ym-disable-keys" required name="title" maxlength="100"></label><label>Текст для гостей (без имён, ссылок на приватные медиа)<textarea class="ym-disable-keys" name="content" rows="3" maxlength="1500"></textarea></label><label>Открыть по времени (ISO UTC, только для состояния «По расписанию»)<input name="openAt" type="datetime-local"></label><button type="submit">Сохранить главу</button></form></details>'+
   '<div><h4>Приглашения</h4><ul>'+info.guests.map(g=>'<li>'+escape(g.name)+' — '+(g.revoked?'отозвано':g.issued?'QR выдан':'ещё не выдан')+'</li>').join('')+'</ul></div>'+
   (info.guests.length?'<label>Гость<select data-guest>'+info.guests.map(g=>'<option value="'+escape(g.id)+'">'+escape(g.name)+'</option>').join('')+'</select></label><p><button type="button" data-issue>Создать QR</button> <button type="button" data-revoke>Отозвать QR</button></p>':'')+
   '<div data-qr role="status" aria-live="polite"></div><p><button type="button" data-group-revoke>Отозвать всю группу без восстановления</button></p><p role="alert" aria-live="polite"></p>';
  const alert=host.querySelector('[role=alert]');
  const run=async(action,body={})=>{alert.textContent='Сохраняем…';try{await write(action,body);if(ctx.active()){info=await request('christmas_qr_view');if(ctx.active())view();}}catch(e){if(ctx.active())alert.textContent=e?.message||'Ошибка';}};
  host.querySelector('[data-roster]').onsubmit=e=>{e.preventDefault();run('christmas_qr_roster_import',{csv:e.target.querySelector('textarea').value});};
  const form=host.querySelector('[data-chapter]'),select=form.elements.chapter;
  const load=()=>{const c=info.chapters[select.value];form.elements.state.value=c.state;form.elements.title.value=c.title;form.elements.content.value=c.content;form.elements.openAt.value=c.openAt?c.openAt.slice(0,16):'';};
  select.onchange=load;load();
  form.onsubmit=e=>{e.preventDefault();const f=form.elements;run('christmas_qr_chapter_update',{chapter:f.chapter.value,state:f.state.value,title:f.title.value,content:f.content.value,openAt:f.openAt.value?new Date(f.openAt.value).toISOString():null});};
  const guestSelect=host.querySelector('[data-guest]');
  if(guestSelect){
   host.querySelector('[data-issue]').onclick=async()=>{
    alert.textContent='Создаём персональный QR…';const g=info.guests.find(g=>g.id===guestSelect.value);if(!g||g.issued&&!g.revoked){alert.textContent='Сначала отзовите ранее выданный QR.';return;}
    try{const r=await request('christmas_qr_issue',{guestId:guestSelect.value});if(!ctx.active())return;
      info=await request('christmas_qr_view');if(!ctx.active())return;
      // Do not refresh panel: the one-time token must remain available until
      // organizer explicitly closes it, without server-side storage.
      alert.textContent='QR создан, но гостевая ссылка пока не опубликована. Сохраните код безопасно.';
      const target=host.querySelector('[data-qr]');target.replaceChildren();
      const heading=document.createElement('p');heading.textContent='Однократная выдача для '+g.name;target.append(heading);
      const code=document.createElement('code');code.textContent=r.url;target.append(code);
      if(typeof global.qrcode==='function'){
       const q=global.qrcode(0,'M');q.addData(r.url);q.make();const svg=q.createSvgTag(4,4);const wrapper=document.createElement('div');wrapper.innerHTML=svg;target.append(wrapper);
       const save=document.createElement('button');save.type='button';save.textContent='Сохранить SVG для печати';save.onclick=()=>{const b=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='aelita-private-invitation.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};target.append(save);
      }
     }catch(e){if(ctx.active())alert.textContent=e?.message||'Не получилось создать QR';}
   };
   host.querySelector('[data-revoke]').onclick=()=>{if(global.confirm('Отозвать ссылку и все сеансы этого гостя?'))run('christmas_qr_revoke',{guestId:guestSelect.value});};
  }
  host.querySelector('[data-group-revoke]').onclick=()=>{if(global.confirm('Отозвать ВСЮ группу? Это необратимое действие, старые QR не восстановятся.'))run('christmas_qr_revoke_group');};
 };
 const act=async action=>{const button=host.querySelector('button');if(button)button.disabled=true;try{await write(action);info=await request('christmas_qr_view');if(ctx.active())view();}catch(e){showError(e);if(button)button.disabled=false;}};
 view();
}
global.AelitaChristmasQR={mount};
})(typeof window!=='undefined'?window:globalThis);
