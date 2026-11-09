(function(root){'use strict';
const MAX=20*1024*1024,SHA=/^[a-f0-9]{64}$/;
const ERR={editor_disabled:'Архив исходников отключён: включите редактор сайта или конструктор страниц и повторите.',media_not_configured:'Архив исходников недоступен: у редактора не настроено хранилище.',media_storage_unavailable:'Не удалось сохранить исходник. Проверьте связь и повторите загрузку.',media_index_invalid:'Архив исходников требует проверки. Уже опубликованное фото сохранено.',media_library_full:'Архив исходников заполнен. Откройте «Исходники» и очистите незавершённые загрузки.',media_ticket:'Срок загрузки закончился или вход изменился. Выберите файл снова.',media_upload_missing:'Загрузка прервалась. Выберите тот же файл, чтобы продолжить.',media_hash_mismatch:'Файл передан с ошибкой. Повторите загрузку.',media_part_conflict:'Получена другая часть файла. Выберите исходник заново.',media_part_missing:'Исходник загружен не полностью. Повторите загрузку того же файла.',media_part_invalid:'Не удалось проверить файл. Повторите загрузку.',media_missing:'Этот исходник не найден в архиве.',media_busy:'Архив сейчас изменяется. Повторите действие.',media_identity_conflict:'Параметры файла изменились. Выберите файл заново.',media_derivative_limit:'У этого исходника слишком много подготовленных вариантов.',image_dimensions:'Изображение слишком большое: до 20 000 px по стороне и 40 мегапикселей.',media_name:'Не удалось прочитать имя файла. Переименуйте его и повторите.'};
const message=e=>ERR[e?.code||e?.message];
const current=fn=>!fn||fn();
function bindSession(fn){if(typeof window!=='object')return fn;let token;try{token=root.localStorage.getItem('aelita_admin_token');}catch{return()=>false;}return()=>{try{return !!token&&token===root.localStorage.getItem('aelita_admin_token')&&current(fn);}catch{return false;}};}
const check=fn=>{if(!current(fn))throw{code:'superseded'};};
async function digest(bytes){const value=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,'0')).join('');}
function encode(bytes){let s='';for(let at=0;at<bytes.length;at+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(at,at+0x8000));return btoa(s);}
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const size=n=>n<1024*1024?Math.ceil(n/1024)+' КБ':(n/1024/1024).toLocaleString('ru-RU',{maximumFractionDigits:1})+' МБ';
function imageId(value){let s=String(value||'');if(s.startsWith('asset:')&&SHA.test(s.slice(6)))return s.slice(6);if(s.startsWith('video:')&&SHA.test(s.slice(6)))return s.slice(6);if(/^https:\/\//i.test(s)&&!/^https:\/\/(?:www\.)?aelita-production\.ru\//i.test(s))return null;s=s.split(/[?#]/)[0];return /^(?:https:\/\/(?:www\.)?aelita-production\.ru)?\/(?:images|videos)\/editorial\/([a-f0-9]{64})\.(?:jpg|png|webp|mp4)$/i.exec(s)?.[1]?.toLowerCase()||null;}
async function request(api,body,isCurrent){for(let attempt=0;;attempt++){check(isCurrent);try{return await api(body);}catch(e){if(attempt>=2||!['github_unreachable','media_storage_unavailable'].includes(e?.code))throw e;check(isCurrent);await new Promise(r=>setTimeout(r,250*(attempt+1)));}}}
async function save(file,prepared,api,progress=()=>{},isCurrent){
 isCurrent=bindSession(isCurrent);
 if(!file||file.size>MAX||!['image/jpeg','image/png','image/webp','video/mp4'].includes(file.type))throw{code:'bad_image'};
 check(isCurrent);const raw=new Uint8Array(await file.arrayBuffer()),hash=await digest(raw),derivativeHash=prepared?.data?await digest(decode(prepared.data)):hash;check(isCurrent);
 progress('Сохраняем исходник…');
 const start=await request(api,{action:'media_start',requestId:crypto.randomUUID(),hash,size:raw.length,type:file.type,name:file.name,derivativeHash},isCurrent);
 check(isCurrent);if(start.ready)return start.original;
 for(let i=0;i<start.count;i++){
  check(isCurrent);const data=encode(raw.subarray(i*start.chunkBytes,Math.min(raw.length,(i+1)*start.chunkBytes)));
  await request(api,{action:'media_part',uploadToken:start.uploadToken,index:i,data},isCurrent);
  progress('Сохраняем исходник · '+Math.round((i+1)/start.count*100)+'%');
 }
 check(isCurrent);const done=await request(api,{action:'media_finish',uploadToken:start.uploadToken},isCurrent);check(isCurrent);return done.original;
}
async function getFile(id,api,progress=()=>{},isCurrent){
 isCurrent=bindSession(isCurrent);
 const chunks=[];let original,count;
 for(let index=0;index===0||index<count;index++){
  check(isCurrent);const part=await request(api,{action:'media_download_part',id,index},isCurrent);
  if(index===0){original=part.original;count=part.count;if(!original||original.id!==id||!Number.isInteger(count)||count<1||count>80||original.size>MAX)throw{code:'media_part_invalid'};}
  if(part.index!==index||part.count!==count||part.original.id!==id)throw{code:'media_part_invalid'};
  const data=decode(part.data);if(await digest(data)!==part.hash)throw{code:'media_hash_mismatch'};chunks.push(data);progress('Загружаем исходник · '+Math.round((index+1)/count*100)+'%');
 }
 const all=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}
 if(all.length!==original.size||await digest(all)!==id)throw{code:'media_hash_mismatch'};check(isCurrent);
 return new File([all],original.name,{type:original.type});
}
function download(file){if(root.AelitaMobileFiles?.save){let token;try{token=root.localStorage.getItem('aelita_admin_token');}catch{return;}root.AelitaMobileFiles.save(file,file.name,{guardToken:token,after:document.activeElement?.closest('.ed-original-controls')||document.body});return;}const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function button(label,fn){const b=document.createElement('button');b.type='button';b.className='ed-quiet';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}finally{b.disabled=false;}};return b;}
async function library({api,onChoose,progress=()=>{},isCurrent,kind='image'}){
 isCurrent=bindSession(isCurrent);check(isCurrent);
 const dialog=document.createElement('dialog');dialog.className='ed-dialog ed-original-dialog';dialog.setAttribute('aria-label',kind==='video'?'Видеофайлы':'Исходники фотографий');
 const header=document.createElement('div');header.className='ed-actions';const title=document.createElement('h2');title.textContent=kind==='video'?'Видеофайлы':'Исходники фотографий';header.append(title,button('Закрыть',()=>dialog.close()));
 const list=document.createElement('div'),state=document.createElement('p');state.setAttribute('role','status');dialog.append(header,state,list);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 const active=()=>dialog.isConnected&&current(isCurrent);let busy=false;
 async function page(offset=0){
  if(!active())return;try{
  state.textContent='Загружаем…';const r=await api({action:'media_list',offset,kind});if(!active())return;list.replaceChildren();state.textContent=r.total?'Всего исходников: '+r.total:'Пока нет сохранённых исходников.';
  for(const x of r.items){const row=document.createElement('section');row.className='ed-original-row';const label=document.createElement('p');label.textContent=x.name+' · '+x.width+'×'+x.height+' · '+size(x.size);const actions=document.createElement('div');actions.className='ed-actions';
   async function use(choose){if(busy)return;busy=true;try{const file=await getFile(x.id,api,t=>{if(active())state.textContent=t;},active);if(!active())return;if(choose){dialog.close();await onChoose(file);}else{download(file);state.textContent='Исходник скачан.';}}catch(e){if(active())state.textContent=message(e)||'Не удалось загрузить исходник.';}finally{busy=false;}}
   actions.append(button(kind==='video'?'Использовать видео':'Использовать фото',()=>use(true)),button('Скачать',()=>use(false)));row.append(label,actions);list.append(row);
  }
  const pages=document.createElement('div');pages.className='ed-actions';if(offset)pages.append(button('Назад',()=>page(Math.max(0,offset-20))));if(r.next!==null)pages.append(button('Дальше',()=>page(r.next)));list.append(pages);
  if(r.unfinished){const clean=button('Очистить незавершённые загрузки',async()=>{if(!active()||!confirm('Удалить незавершённые загрузки старше суток? Сохранённые исходники и фотографии сайта останутся.')||!active())return;try{const result=await api({action:'media_cleanup',confirm:true});if(active()){await page(offset);state.textContent=result.pending?'Часть загрузок пока не удалось очистить. Повторите позже.':'Незавершённые загрузки очищены.';}}catch(e){if(active())state.textContent=message(e)||'Не удалось очистить загрузки. Повторите позже.';}});list.append(clean);}
  }catch(e){if(active())state.textContent=message(e)||'Архив недоступен. Повторите открытие.';}
 }
 try{await page();}catch(e){if(active())state.textContent=message(e)||'Архив недоступен.';}
}
function controls(container,{api,value,onChoose,progress=()=>{},isCurrent,kind='image',resolve,usages}){
 isCurrent=bindSession(isCurrent);
 const wrap=document.createElement('div');wrap.className='ed-original-controls';const note=document.createElement('p');note.className='ed-help';note.textContent='';wrap.append(note);
 wrap.append(button(kind==='video'?'Видеофайлы':'Исходники фотографий',()=>library({api,onChoose,progress,isCurrent,kind})));container.append(wrap);
 const info=document.createElement('p');info.className='ed-help';info.setAttribute('role','status');wrap.append(info);
 const url=typeof resolve==='function'?resolve(value):value;
 const external=typeof url==='string'&&/^https:\/\//i.test(url)&&!/^https:\/\/(?:www\.)?aelita-production\.ru\//i.test(url);
 info.textContent=external?'Внешний ресурс: наличие и формат сервером не подтверждены.':'Параметры подготовленной копии пока не определены.';
 if(kind==='image'&&typeof url==='string'&&(/^(?:\/(?!\/)|https:\/\/|data:image\/(?:jpeg|png|webp);base64,|blob:)/i.test(url))&&typeof root.Image==='function'){
  const image=new root.Image();image.referrerPolicy='no-referrer';
  image.onload=()=>{if(!current(isCurrent)||!wrap.isConnected)return;const format=/^data:image\/(jpeg|png|webp)/i.exec(url)?.[1]||/\.(jpe?g|png|webp)(?:[?#]|$)/i.exec(url)?.[1];info.textContent='Подготовленная копия · '+image.naturalWidth+'×'+image.naturalHeight+(format?' · '+format.toUpperCase()+(/^data:/i.test(url)?'':' (по адресу)'):' · формат не подтверждён')+(external?' · внешний ресурс, сервером не проверен':'');};
  image.onerror=()=>{if(current(isCurrent)&&wrap.isConnected)info.textContent=external?'Внешний ресурс не удалось отобразить; сервер его не проверяет.':'Подготовленную копию не удалось прочитать. Проверьте файл и макет.';};image.src=url;
 }
 if(usages){const places=document.createElement('p');places.className='ed-help';const rows=typeof usages==='function'?usages():usages;places.textContent='Использование в открытом черновике: '+(rows?.length?rows.join('; '):'выбранное назначение')+'. Другие страницы здесь не проверялись.';wrap.append(places);}
 const id=imageId(value);if(!id){note.textContent=external?'Связь с исходником не подтверждена.':'Для этого ресурса связь с архивным исходником не подтверждена.';return;}
 api({action:'media_info',id}).then(r=>{if(!current(isCurrent)||!wrap.isConnected)return;const x=r.original;if(kind==='video')info.textContent='Подготовленный MP4 · '+x.width+'×'+x.height+' · '+size(x.size);note.textContent='Исходник сохранён · '+x.width+'×'+x.height+' · '+size(x.size);wrap.append(button('Скачать исходник',async()=>{try{const file=await getFile(x.id,api,progress,isCurrent);if(current(isCurrent))download(file);}catch(e){if(current(isCurrent))progress(message(e)||'Не удалось скачать исходник.',true);}}));}).catch(e=>{if(current(isCurrent)&&wrap.isConnected)note.textContent=e?.code==='media_missing'?'Для этой фотографии исходник в архиве не найден.':message(e)||'Не удалось проверить исходник.';});
}
const exported={save,getFile,controls,library,imageId,digest,message,MAX};if(typeof module==='object'&&module.exports)module.exports=exported;else root.AelitaMediaOriginals=exported;
})(typeof window==='object'?window:globalThis);
