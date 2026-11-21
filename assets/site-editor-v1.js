(function(){'use strict';
const API='https://api.aelita-production.ru/admin/site-edit',$=id=>document.getElementById(id),S={pages:[],read:null,changes:new Map(),assets:new Map(),kind:'text',shown:30,epoch:0,edit:0,previewJob:0,historyJob:0,review:null,images:null,imageTarget:null,range:null,rich:null,saved:null,media:window.AelitaContentMedia.createStore()};let saveTimer;
const errors={invalid_image_alt:'Описание обложки — обычный текст до 500 знаков.',invalid_media_view:'Проверьте положение кадра (0–100%) и адрес мобильного фото.',editor_reload_required:'Обновите редактор: появились новые настройки изображения. Скачайте текущий черновик перед обновлением.',editor_disabled:'Редактор страниц отключён на сервере. Список страниц и история редакций появятся после включения.',editor_not_configured:'У функции редактора не заданы настройки репозитория или сессии.',not_authenticated:'Сессия закончилась. Войдите в админку снова.',page_not_found:'Страница не найдена в репозитории. Проверьте ветку и настройки публикации.',page_not_available:'Страница защищена или пока не входит в каталог редактора.',github_rejected:'Сервис публикации отклонил запрос. Проверьте настройки репозитория.',text_too_long:'Фрагмент слишком длинный. Сократите его перед проверкой.',content_conflict:'Версия сайта изменилась. Закройте макет и повторите проверку. Если изменилась сама страница, скачайте черновик, обновите страницу и перенесите нужные фрагменты.',preview_required:'Сначала проверьте свежий макет страницы.',preview_expired:'Проверка устарела. Откройте макет ещё раз.',github_unreachable:'Нет ответа от сервера публикации. Проверьте связь и повторите.',github_limited:'Доступ к сервису публикации ограничен. Проверьте права ключа или повторите после снятия лимита.',publication_unknown:'Ответ на публикацию не получен. Повторите ту же публикацию: редактор проверит, успела ли она выполниться.',bad_url:'Нужен адрес сайта /страница/, https://…, mailto:… или tel:….',unsupported_markup:'В этом фрагменте есть неподдерживаемое оформление. Вставьте текст без форматирования.',image_too_large:'Изображение слишком большое после обработки. Выберите меньший файл.',bad_image:'Не удалось прочитать изображение. Подойдёт JPG, PNG или WebP.',overlapping_fields:'Два изменения затрагивают один фрагмент. Проверьте текст и вложенную ссылку по отдельности.',empty_text:'Фрагмент пустой. Введите текст; для скрытия редакторского блока используйте «Показывать этот фрагмент».',no_change:'Изменений для публикации нет.',field_not_available:'Структура страницы изменилась. Загрузите её заново.'};
function staffScope(){return window.AelitaStaffSession?.adminScope ? window.AelitaStaffSession.adminScope() : 'legacy';}
const editorScope=staffScope();
function token(){try{return editorScope&&editorScope===staffScope()?localStorage.getItem('aelita_admin_token'):null;}catch{return null;}}
function draftKey(){return 'aelita_site_editor_draft_v830:'+editorScope+':'+S.read.page.page;}
function status(text,bad=false){$('ed-status').textContent=text||'';$('ed-status').className=bad?'ed-error':'ed-ok';}
function previewStatus(text,bad=false){
 const feedback=$('ed-preview-feedback');
 feedback.textContent=text;
 feedback.className=bad?'ed-error':'ed-ok';
 if(bad)feedback.focus();
}
function message(e){return window.AelitaContentMedia?.message(e)||errors[e.code||e.message]||'Не получилось выполнить действие. Проверьте соединение и повторите.';}
async function api(body,epoch=S.epoch){body={...body,reviewVersion:4};const t=token();if(!t){gate();throw{code:'not_authenticated'};}let r;try{r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+t},cache:'no-store',body:JSON.stringify(body)});}catch{throw{code:'github_unreachable'};}if(token()!==t||epoch!==S.epoch)throw{code:'superseded'};let d;try{d=await r.json();}catch{throw{code:'github_unreachable'};}if(token()!==t||epoch!==S.epoch)throw{code:'superseded'};if(r.status===401)gate();if(!r.ok||d.error)throw{code:d.error||'editor_failed'};return d;}
function gate(){if(S.read)saveDraft();clearTimeout(saveTimer);S.saved=null;S.epoch++;S.uploading=0;S.media.clear();S.read=null;S.review=null;$('ed-app').hidden=true;$('ed-gate').hidden=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function safeURL(v){v=String(v||'').trim();if(!v||/[\x00-\x20\x7f\\<>"']/.test(v))return null;if(v.startsWith('/')&&!v.startsWith('//'))return v;if(/^#[A-Za-z0-9_а-яА-ЯЁё:.-]+$/.test(v)||/^(mailto:[^?\s@]+@[^?\s@]+|tel:\+?[0-9().-]+)$/.test(v))return v;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function cleanHTML(html){const doc=new DOMParser().parseFromString('<body>'+String(html||''),'text/html'),out=document.createElement('div');function append(n,to){if(n.nodeType===3){to.append(document.createTextNode(n.textContent));return;}if(n.nodeType!==1)return;let tag=n.tagName.toLowerCase();if(tag==='div'||tag==='p'){if(to.childNodes.length)to.append(document.createElement('br'));n.childNodes.forEach(c=>append(c,to));return;}if(!['br','a','b','strong','em','i','u','s','small'].includes(tag)){to.append(document.createTextNode(n.textContent));return;}const el=document.createElement(tag);if(tag==='a'){const u=safeURL(n.getAttribute('href'));if(!u){to.append(document.createTextNode(n.textContent));return;}el.setAttribute('href',u);}n.childNodes.forEach(c=>append(c,el));to.append(el);}doc.body.childNodes.forEach(n=>append(n,out));return out.innerHTML;}
function value(f){return Object.assign({},f,S.changes.get(f.id)||{});}
function invalidate(){S.edit++;S.review=null;$('ed-publish').disabled=true;previewStatus('');}
function update(f,patch){const c=Object.assign({id:f.id},S.changes.get(f.id)||{},patch);for(const k of['value','alt','hidden','view','poster','caption','title','tracks','width','height'])if(c[k]===f[k]||['view','tracks'].includes(k)&&JSON.stringify(c[k])===JSON.stringify(f[k]))delete c[k];if(Object.keys(c).length===1)S.changes.delete(f.id);else S.changes.set(f.id,c);invalidate();dirty();clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,350);}
function dirty(){const n=S.changes.size;$('ed-dirty').textContent=n?'Изменено полей: '+n+' · черновик сохраняется в этой вкладке':'Изменений нет';for(const id of['ed-preview','ed-export','ed-reset'])$(id).disabled=!n;}
function payload(){const changes=[...S.changes.values()],needed=window.AelitaContentMedia.refs(changes,'asset:');return{page:S.read.page.page,sha:S.read.sha,changes,assets:[...S.assets.values()].filter(a=>needed.has(a.hash)).map(({type,data})=>({type,data})),captions:S.media.captionAssets(changes)};}
function draftData(){const p=payload(),used=window.AelitaContentMedia.refs(p.changes,'asset:');return{version:1,page:p.page,sha:p.sha,changes:p.changes.map(c=>({...c,label:S.read.fields.find(f=>f.id===c.id)?.label||'Редакторский фрагмент'})),storedAssets:[...S.assets.values()].filter(a=>used.has(a.hash)),storedCaptions:S.media.snapshot(p.changes),time:Date.now()};}

function saveDraft(){
 if(!S.read||!S.changes.size&&S.saved)return true;
 try{
  if(!S.changes.size)sessionStorage.removeItem(draftKey());
  else sessionStorage.setItem(draftKey(),JSON.stringify(draftData()));
  return true;
 }catch{
  if(!S.changes.size)return true;
  $('ed-dirty').textContent='Черновик не сохранился в браузере. Скачайте его файлом.';
  return false;
 }
}
function validDraft(d,page){
 return d?.version===1&&d.page===page&&typeof d.sha==='string'&&Array.isArray(d.changes)&&
  d.changes.every(f=>f&&typeof f.id==='string')&&(d.storedAssets==null||Array.isArray(d.storedAssets));
}
function showSavedDraft(d,source){
 S.saved=d;
 S.savedSource=source;
 $('ed-draft').hidden=!d;
 if(!d)return;
 const same=d.sha===S.read.sha;
 $('ed-draft-text').textContent=(source==='file'?'Из файла':'В этой вкладке')+' · фрагментов: '+d.changes.length+'.'+
  (same?'':' Черновик относится к прежней версии. Сначала сопоставьте фрагменты с актуальной страницей.');
 $('ed-restore-draft').disabled=!same;
 $('ed-delete-draft').textContent=source==='file'?'Закрыть черновик из файла':'Удалить черновик из вкладки';
 const list=document.createDocumentFragment();
 for(const c of d.changes){
  const label=document.createElement('label');
  label.textContent=c.label||S.read.fields.find(f=>f.id===c.id)?.label||'Сохранённый фрагмент';
  const text=document.createElement('textarea');
  text.readOnly=true;text.rows=3;
  text.value=typeof c.value==='string'?(c.value.startsWith('asset:')?'Новое изображение сохранено в файле черновика.':new DOMParser().parseFromString(c.value,'text/html').body.textContent):(c.hidden?'Фрагмент скрыт':'Фрагмент виден');
  label.append(text);list.append(label);
 }
 $('ed-saved-fields').replaceChildren(list);
}
function checkDraft(){
 let saved=null;
 try{
  const candidate=JSON.parse(sessionStorage.getItem(draftKey())||'null');
  if(validDraft(candidate,S.read.page.page))saved=candidate;
 }catch{}
 showSavedDraft(saved,'stored');
}
function restoreDraft(){
 const d=S.saved;
 if(!d||!S.read||d.sha!==S.read.sha)return;
 const known=new Set(S.read.fields.map(f=>f.id));
 const changes=d.changes.map(c=>{
  if(known.has(c.id))return c;
  const field=S.read.fields.find(f=>f.legacyId===c.id);
  return field?{...c,id:field.id}:null;
 });
 if(changes.some(c=>!c)){status('Часть полей черновика не поддерживается текущей структурой. Скачайте его перед ручным переносом.',true);return;}
 if(S.changes.size&&!confirm('Заменить текущие неопубликованные правки этим черновиком?'))return;
 S.changes=new Map(changes.map(c=>[c.id,c]));
 S.assets=new Map((d.storedAssets||[]).filter(x=>x&&/^[a-f0-9]{64}$/.test(x.hash)).map(x=>[x.hash,x]));
 S.media.restore(d.storedCaptions);
 showSavedDraft(null,'stored');
 clearTimeout(saveTimer);
 invalidate();dirty();renderFields();
 const saved=saveDraft();
 status(saved?'Черновик восстановлен. Проверьте макет перед публикацией.':'Черновик открыт. Скачайте файл, чтобы сохранить его вне вкладки.',!saved);
}
function removeSavedDraft(){
 if(!S.saved||!S.read)return;
 if(S.savedSource==='file'){checkDraft();return;}
 if(!confirm('Удалить сохранённый черновик из этой вкладки?'))return;
 try{
  sessionStorage.removeItem(draftKey());
  showSavedDraft(null,'stored');
 }catch{status('Браузер не разрешил удалить черновик.',true);}
}
function fillPages(){const q=$('ed-search').value.trim().toLowerCase(),lang=$('ed-locale').value,current=$('ed-page').value,frag=document.createDocumentFragment(),empty=document.createElement('option');empty.value='';empty.textContent='Выберите страницу';frag.append(empty);for(const p of S.pages.filter(p=>(!lang||p.locale===lang)&&(!q||(p.title+' '+p.page).toLowerCase().includes(q)))){const o=document.createElement('option');o.value=p.page;o.textContent=(p.locale==='en'?'EN · ':'')+p.title.replace(/\s*[—–]\s*AELITA PRODUCTION.*$/i,'')+' · /'+(p.page==='__root__'?'':p.page);frag.append(o);}$('ed-page').replaceChildren(frag);$('ed-page').value=current;}
const recentKey='editor:page';
function showRecentPage(){
 const button=$('ed-recent-page');
 const recent=window.AelitaWork?.read(recentKey,{durable:true});
 const page=S.pages.find(p=>p.page===recent);
 button.hidden=!!S.read||!page;
 button.textContent=page?'Продолжить: '+page.title.replace(/\s*[—–]\s*AELITA PRODUCTION.*$/i,''):'';
 button.onclick=page?()=>{
  $('ed-search').value='';$('ed-locale').value='';
  fillPages();$('ed-page').value=page.page;
  return loadPage(page.page);
 }:null;
}
async function loadPage(page){
 if(!page)return false;
 clearTimeout(saveTimer);
 if(S.read&&!saveDraft()&&!confirm('Черновик не сохранился в браузере. Продолжить без сохранения текущих правок?')){
  $('ed-page').value=S.read.page.page;
  if(!$('ed-page').value){
   $('ed-search').value='';$('ed-locale').value='';
   fillPages();$('ed-page').value=S.read.page.page;
  }
  status('Правки остаются открыты. Скачайте черновик, прежде чем менять страницу.',true);
  return false;
 }
 $('ed-recent-page').hidden=true;
 S.saved=null;
 const epoch=++S.epoch;
 invalidate();S.read=null;S.changes.clear();S.assets.clear();S.media.clear();S.uploading=0;
 $('ed-workspace').hidden=true;$('ed-draft').hidden=true;
 status('Загружаем актуальную страницу…');
 try{
  const d=await api({action:'editor_read',page},epoch);
  S.read=d;
  document.body.classList.add('ed-has-page');
  $('ed-page-filters').open=false;
  const heading=d.fields.find(f=>f.kind==='block'&&f.tag==='h1')?.text;
  $('ed-page-title').textContent=(d.page.locale==='en'?'English · ':'')+(heading||d.page.title.replace(/\s*[—–]\s*AELITA PRODUCTION.*$/i,''));
  $('ed-open-page').href='https://aelita-production.ru/'+(page==='__root__'?'':page+'/');
  $('ed-workspace').hidden=false;$('ed-find').value='';S.shown=30;
  dirty();renderFields();mediaBoundaries();checkDraft();
  window.AelitaWork?.write(recentKey,page,{durable:true});
  history.replaceState(null,'','?page='+encodeURIComponent(page));
  status('Страница загружена. Неопубликованные изменения остаются в черновике.');
  return true;
 }catch(error){
  if(error.code!=='superseded'&&token()){status(message(error),true);showRecentPage();}
  return false;
 }
}
function input(label,initial,change,multiline=false,max=12000){const l=document.createElement('label');l.append(document.createTextNode(label));const i=document.createElement(multiline?'textarea':'input');i.value=initial||'';i.maxLength=max;if(multiline)i.rows=4;i.addEventListener('input',()=>change(i.value));l.append(i);return l;}
function btn(text,fn,quiet=false){const b=document.createElement('button');b.type='button';b.textContent=text;if(quiet)b.className='ed-quiet';b.addEventListener('click',fn);return b;}
function rememberRange(rich){const s=getSelection();if(s&&s.rangeCount&&rich.contains(s.anchorNode)){S.range=s.getRangeAt(0).cloneRange();S.rich=rich;}}
function insertPlain(rich,text){const sel=getSelection();if(!sel||!sel.rangeCount)return;const r=sel.getRangeAt(0);if(!rich.contains(r.commonAncestorContainer))return;r.deleteContents();const n=document.createTextNode(text);r.insertNode(n);r.setStartAfter(n);r.collapse(true);sel.removeAllRanges();sel.addRange(r);rich.dispatchEvent(new Event('input',{bubbles:true}));}
function richField(f,v,body){const tools=document.createElement('div');tools.className='ed-toolbar';const rich=document.createElement('div');rich.className='ed-rich';rich.contentEditable='true';rich.setAttribute('role','textbox');rich.setAttribute('aria-multiline','true');rich.setAttribute('aria-label',f.label);rich.innerHTML=cleanHTML(v.value);rich.addEventListener('input',()=>update(f,{value:cleanHTML(rich.innerHTML)}));rich.addEventListener('paste',e=>{e.preventDefault();insertPlain(rich,e.clipboardData.getData('text/plain'));});rich.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.execCommand('insertLineBreak');}});rich.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});for(const [name,command]of[['Жирный','bold'],['Курсив','italic']]){const b=btn(name,()=>{rich.focus();document.execCommand('styleWithCSS',false,false);document.execCommand(command,false,null);rich.dispatchEvent(new Event('input',{bubbles:true}));});b.addEventListener('pointerdown',e=>e.preventDefault());tools.append(b);}const link=btn('Ссылка',()=>{rememberRange(rich);if(!S.range||S.rich!==rich){rich.focus();const r=document.createRange();r.selectNodeContents(rich);r.collapse(false);S.range=r;S.rich=rich;}$('ed-link-text').value=S.range.toString();$('ed-link-url').value='';$('ed-link-error').textContent='';$('ed-link-dialog').showModal();});link.addEventListener('pointerdown',e=>{rememberRange(rich);e.preventDefault();});tools.append(link);body.append(tools,rich);const l=document.createElement('label');l.className='ed-check';const cb=document.createElement('input');cb.type='checkbox';cb.checked=!v.hidden;cb.addEventListener('change',()=>update(f,{hidden:!cb.checked}));l.append(cb,document.createTextNode('Показывать этот фрагмент'));body.append(l);}
function imageSource(v){if(v.startsWith('asset:')){const a=S.assets.get(v.slice(6));return a?'data:'+a.type+';base64,'+a.data:'';}return safeURL(v)||'';}
async function compress(file){if(!file||file.size>20*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw{code:'bad_image'};const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject({code:'bad_image'});i.src=url;});if(img.width>20000||img.height>20000||img.width*img.height>40000000)throw{code:'image_dimensions'};let side=1800,quality=.86,blob;const type=file.type==='image/png'?'image/png':'image/jpeg';for(let j=0;j<7;j++){const canvas=document.createElement('canvas'),k=Math.min(1,side/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*k));canvas.height=Math.max(1,Math.round(img.height*k));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);blob=await new Promise(r=>canvas.toBlob(r,type,quality));if(blob&&blob.size<=512*1024)break;side=Math.floor(side*.78);quality=Math.max(.55,quality-.08);}if(!blob||blob.size>512*1024)throw{code:'image_too_large'};const bytes=new Uint8Array(await blob.arrayBuffer()),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');let raw='';for(let i=0;i<bytes.length;i+=16384)raw+=String.fromCharCode(...bytes.subarray(i,i+16384));return{hash,type:blob.type,data:btoa(raw)};}finally{URL.revokeObjectURL(url);}}
async function preparePhoto(file,epoch,isCurrent){
 S.uploading=(S.uploading||0)+1;invalidate();status('Готовим фото и сохраняем исходник…');
 try{const a=await compress(file);if(epoch!==S.epoch||!isCurrent())throw{code:'superseded'};await window.AelitaMediaOriginals.save(file,a,api,status,()=>epoch===S.epoch&&isCurrent());if(epoch!==S.epoch||!isCurrent())throw{code:'superseded'};S.assets.set(a.hash,a);return 'asset:'+a.hash;}
 finally{if(epoch===S.epoch)S.uploading=Math.max(0,S.uploading-1);}
}
function mediaUses(source){
 const key=x=>{try{const u=new URL(x,'https://aelita-production.ru/');return u.origin==='https://aelita-production.ru'?u.pathname:x;}catch{return x;}};
 const rows=[];for(const f of (S.read?.fields||[]).filter(x=>['image','seo-image','video'].includes(x.kind))){const v=value(f),label=(f.kind==='seo-image'?'OG':f.kind==='video'?'видео':'фото')+' · '+f.label;
  for(const [src,suffix]of [[v.value,''],[v.view?.mobileImage,' · телефон'],[v.poster,' · постер']])if(src&&key(src)===key(source))rows.push(label+suffix);
 }return [...new Set(rows)];
}
function mediaBoundaries(){
 const holder=$('ed-media-boundaries');if(!holder)return;holder.replaceChildren();const rows=S.read?.mediaBoundaries||[];holder.hidden=!rows.length;if(!rows.length)return;
 const title=document.createElement('summary');title.textContent='Медиа с ограничением редактирования: '+rows.length;holder.append(title);
 const reasons={protected_or_generated:'Защищённый или генерируемый фрагмент: используйте его штатный редактор.',unmanaged_picture:'Сторонний адаптивный picture: нужен отдельный проверяемый адаптер.',unsupported_video_structure:'Несколько источников или неподдерживаемые дорожки: нужен отдельный адаптер.',unsupported_video_resource:'Адрес или параметры видео не поддержаны.',unsupported_caption_structure:'Сложная подпись видео: нужен отдельный адаптер.'};
 for(const row of rows){const p=document.createElement('p');p.textContent=(row.value||row.id)+' — '+(reasons[row.reason]||row.reason);holder.append(p);}
}
function imageField(f,v,body){
 const epoch=S.epoch,current=()=>epoch===S.epoch&&body.isConnected,seo=f.kind==='seo-image';let selected=v.value;
 const source=value=>{if(seo&&value.startsWith('https://aelita-production.ru/'))value=new URL(value).pathname;return imageSource(value);};
 const img=document.createElement('img');img.className='ed-image-thumb';img.alt=seo?'Обложка ссылки':v.alt||'Фотография';img.src=source(v.value);
 body.append(img,input('Адрес изображения',v.value,x=>{update(f,{value:x});selected=x;img.src=source(x);refreshOriginal();}));
 body.append(input(seo?'Описание обложки для соцсетей':'Подпись для доступности (alt)',v.alt,x=>update(f,{alt:x}),true,500));
 async function choose(file){const before=selected;const valid=()=>current()&&selected===before;const value=await preparePhoto(file,epoch,valid);if(!valid())return;update(f,{value});renderFields();status('Исходник сохранён. Фото добавлено в черновик.');}
 const label=document.createElement('label');label.className='ed-upload';label.append('Загрузить фото с телефона');const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.onchange=async()=>{const f=file.files[0];file.value='';if(!f)return;file.disabled=true;try{await choose(f);}catch(e){if(e.code!=='superseded')status(message(e),true);}finally{file.disabled=false;}};label.append(file);
 body.append(label,btn('Выбрать из изображений сайта',async()=>{S.imageTarget={field:f,epoch:S.epoch};try{if(!S.images)S.images=(await api({action:'editor_assets'})).images;fillImages();$('ed-images-dialog').showModal();}catch(e){status(message(e),true);}},true));
 const originalHolder=document.createElement('div');body.append(originalHolder);function refreshOriginal(){originalHolder.replaceChildren();const value=selected;window.AelitaMediaOriginals.controls(originalHolder,{api,value,resolve:source,usages:()=>mediaUses(value),onChoose:choose,progress:status,isCurrent:()=>current()&&selected===value});}refreshOriginal();
 if(seo){const note=document.createElement('p');note.className='ed-help';note.textContent='Выбранная группа OG меняется отдельно от фото страницы, постера и Twitter-обложки. После публикации мессенджер может показывать прежнюю картинку из своего кэша. Макет страницы не имитирует карточку конкретного мессенджера.';body.append(note);return;}
 window.AelitaMediaView.mount(body,v.view,{resolve:source,defaultPosition:f.position,onChange:view=>update(f,{view}),api,progress:status,isCurrent:current,onMobileFile:async file=>preparePhoto(file,epoch,current),onError:e=>{if(e.code!=='superseded')status(message(e),true);}});
}

function videoField(f,v,body){const epoch=S.epoch,current=()=>epoch===S.epoch&&body.isConnected;window.AelitaContentMedia.mountVideo(body,{src:v.value,poster:v.poster,title:v.title,caption:v.caption,tracks:v.tracks,...(v.width!==undefined?{width:v.width,height:v.height}:{})},{api,store:S.media,imageSource,isCurrent:current,canCaption:f.canCaption,progress:status,busy:delta=>{if(epoch!==S.epoch)return;S.uploading=Math.max(0,(S.uploading||0)+delta);if(delta>0){invalidate();dirty();}},onPhoto:(file,selected)=>preparePhoto(file,epoch,()=>current()&&(!selected||selected())),onError:e=>status(message(e),true),onChange:x=>{const {src,...rest}=x;update(f,{value:src,...rest});}});}
function renderFields(){if(!S.read)return;const q=$('ed-find').value.toLowerCase().trim(),kind=S.kind,all=S.read.fields.filter(f=>(kind==='text'?['block','text'].includes(f.kind):kind==='seo'?f.kind.startsWith('seo-'):f.kind===kind)&&(!q||(f.label+' '+f.section+' '+(f.text||f.value)).toLowerCase().includes(q)));const frag=document.createDocumentFragment();if(!all.length){const p=document.createElement('p');p.textContent='Подходящих полей нет. Выберите другую категорию или измените поиск.';frag.append(p);}for(const f of all.slice(0,S.shown)){const v=value(f),card=document.createElement('details');card.className='ed-field';card.dataset.field=f.id;const summary=document.createElement('summary');summary.textContent=f.label;const sub=document.createElement('span');sub.textContent=f.section+(S.changes.has(f.id)?' · изменено':'');summary.append(sub);card.append(summary);const body=document.createElement('div');body.className='ed-field-body';if(f.kind==='block')richField(f,v,body);else if(f.kind==='image'||f.kind==='seo-image')imageField(f,v,body);else if(f.kind==='video')videoField(f,v,body);else body.append(input(f.kind==='link'?'Адрес ссылки':f.kind==='seo-title'?'Название для поиска и соцсетей':f.kind==='seo-description'?'Описание для поиска и соцсетей':f.kind==='seo-image'?'Адрес изображения для соцсетей':'Текст',v.value,x=>update(f,{value:x}),!['link','seo-title','seo-image'].includes(f.kind),f.kind==='seo-title'?180:f.kind==='seo-description'?700:12000));card.append(body);frag.append(card);}$('ed-fields').replaceChildren(frag);$('ed-more').hidden=all.length<=S.shown;}
function fillImages(){const q=$('ed-image-search').value.toLowerCase(),list=$('ed-image-list');list.replaceChildren();for(const path of(S.images||[]).filter(x=>x.toLowerCase().includes(q))){const o=document.createElement('option');o.value=path;o.textContent=path.split('/').pop();list.append(o);}$('ed-image-select').disabled=true;$('ed-image-preview').hidden=true;}
function frame(html){$('ed-frame').style.width=$('ed-width').value+'px';$('ed-frame').srcdoc=html;}
async function showPreview(){
 if(S.uploading){previewStatus('Дождитесь сохранения исходника.',true);return;}
 if(!S.read||!S.changes.size)return;
 saveDraft();
 const edit=S.edit,epoch=S.epoch,job=++S.previewJob,changes=payload();
 const current=()=>edit===S.edit&&epoch===S.epoch&&job===S.previewJob;
 $('ed-preview').disabled=true;
 previewStatus('Собираем макет и проверяем изменения…');
 try{
  const result=await api({action:'editor_preview',...changes},epoch);
  if(!current())return;
  result.after=await S.media.preview(result.after,result.videoAssets,api,current);
  if(!current())return;
  S.review={...result,payload:changes,edit,epoch};
  $('ed-preview-versions').hidden=false;
  $('ed-publish').hidden=false;
  $('ed-before').setAttribute('aria-pressed','false');$('ed-after').setAttribute('aria-pressed','true');
  frame(result.after);
  $('ed-preview-summary').textContent='Изменено фрагментов: '+result.summary.length+'. Публикация изменит только выбранную страницу и добавленные медиафайлы.';
  $('ed-publish-status').textContent='';
  $('ed-publish').disabled=false;
  $('ed-preview-dialog').showModal();
  previewStatus('Макет готов.');
 }catch(error){if(current()&&error.code!=='superseded')previewStatus(message(error),true);}
 finally{if(current())dirty();}
}
async function publish(){const r=S.review;if(!r||r.edit!==S.edit||r.epoch!==S.epoch)return;$('ed-publish').disabled=true;$('ed-publish-status').textContent='Публикуем выбранные изменения…';try{const d=await api({action:'editor_publish',...r.payload,previewToken:r.previewToken},r.epoch);$('ed-publish-status').textContent=d.alreadyPublished?'Эти изменения уже опубликованы. Сайт обновится после сборки.':'Изменения сохранены. Сайт обновится после сборки.';const page=S.read.page.page;if(r.payload.assets.length)S.images=null;S.changes.clear();S.assets.clear();S.saved=null;clearTimeout(saveTimer);saveDraft();S.review=null;dirty();$('ed-preview-dialog').close();const loaded=await loadPage(page);if(loaded)status('Изменения сохранены. Сайт обновится после сборки.');}catch(e){if(e.code!=='superseded')$('ed-publish-status').textContent=message(e);if(['content_conflict','preview_expired','preview_required'].includes(e.code)){S.review=null;$('ed-publish').disabled=true;}else if(S.review===r)$('ed-publish').disabled=false;}}
async function showHistory(){
 if(!S.read)return;
 const dialog=$('ed-history-dialog'),read=S.read,epoch=S.epoch;
 if(dialog.open)return;
 ++S.previewJob;dirty();
 const list=$('ed-history-list'),feedback=$('ed-history-status');
 const page=read.page.page;
 let request=++S.historyJob;
 const current=()=>dialog.open&&epoch===S.epoch&&S.read===read&&request===S.historyJob;
 const format=new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'});
 feedback.textContent='Загружаем историю…';
 list.replaceChildren();dialog.showModal();

 async function openRevision(revision,restore){
  if(!current())return;
  const chosen=++S.historyJob;
  request=chosen;
  const stillSelected=()=>current()&&chosen===S.historyJob;
  feedback.textContent='Загружаем выбранную версию…';
  try{
   const previous=await api({action:'editor_revision',page,revision:revision.sha},epoch);
   if(!stillSelected())return;
   if(!restore){
    S.review=null;
    $('ed-preview-versions').hidden=true;
    $('ed-publish').disabled=true;$('ed-publish').hidden=true;
    frame(previous.preview);
    $('ed-preview-summary').textContent='Просмотр исторической версии.';
    $('ed-publish-status').textContent='';
    feedback.textContent='';
    $('ed-preview-dialog').showModal();
    return;
   }
   if(previous.structure!==read.structure){
    feedback.textContent='Структура версии отличается. Доступен просмотр. Для переноса скопируйте нужное содержание вручную.';
    return;
   }
   if(S.changes.size&&!confirm('Заменить неопубликованные правки в совпадающих полях содержанием этой версии?')){
    feedback.textContent='Текущие правки сохранены в редакторе.';
    return;
   }
   for(const field of read.fields){
    const old=previous.fields.find(value=>value.id===field.id&&value.kind===field.kind);
    if(!old)continue;
    const patch={value:old.value};
    if(field.kind==='seo-image')patch.alt=old.alt||'';
    if(field.kind==='image'){patch.alt=old.alt;patch.view=old.view||null;}
    if(field.kind==='video'){
     for(const key of ['poster','caption','title','tracks'])patch[key]=old[key];
     patch.width=old.width??null;patch.height=old.height??null;
    }
    if(field.kind==='block')patch.hidden=old.hidden;
    update(field,patch);
   }
   clearTimeout(saveTimer);
   const saved=saveDraft();
   renderFields();
   dialog.close();
   status(saved?'Содержимое версии перенесено в черновик. Проверьте макет.':'Содержимое версии открыто. Скачайте черновик, чтобы сохранить его вне вкладки.',!saved);
  }catch(error){if(stillSelected()&&error.code!=='superseded')feedback.textContent=message(error);}
 }

 try{
  const data=await api({action:'editor_history',page},epoch);
  if(!current())return;
  for(const revision of data.history){
   const article=document.createElement('article'),caption=document.createElement('p');
   const at=new Date(revision.date||'');
   caption.textContent=(Number.isFinite(at.getTime())?format.format(at)+' МСК · ':'')+revision.message;
   article.append(caption,btn('Посмотреть версию',()=>openRevision(revision,false),true),
    btn('Взять содержание в черновик',()=>openRevision(revision,true),true));
   list.append(article);
  }
  feedback.textContent=data.history.length?'':'История страницы пока пустая.';
 }catch(error){if(current()&&error.code!=='superseded')feedback.textContent=message(error);}
}
$('ed-import').addEventListener('change',async event=>{
 const file=event.target.files[0],opened=S.read,owner=token();
 event.target.value='';
 if(!file||!opened||!owner)return;
 try{
  if(file.size>4*1024*1024)throw Error('size');
  const draft=JSON.parse(await file.text());
  if(opened!==S.read||owner!==token())return;
  if(!validDraft(draft,opened.page.page))throw Error('draft');
  showSavedDraft(draft,'file');
  if(draft.sha===opened.sha)restoreDraft();
  else status('Открыт черновик прежней версии. Фрагменты можно сверить в блоке черновика.',true);
 }catch{
  if(opened===S.read&&owner===token())status('Не удалось открыть черновик этой страницы.',true);
 }
});
$('ed-search').addEventListener('input',fillPages);$('ed-locale').addEventListener('change',fillPages);$('ed-page').addEventListener('change',()=>loadPage($('ed-page').value));$('ed-find').addEventListener('input',()=>{S.shown=30;renderFields();});document.querySelectorAll('[data-ed-kind]').forEach(b=>b.addEventListener('click',()=>{S.kind=b.dataset.edKind;S.shown=30;document.querySelectorAll('[data-ed-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderFields();}));$('ed-more').addEventListener('click',()=>{S.shown+=30;renderFields();});$('ed-preview').addEventListener('click',showPreview);$('ed-publish').addEventListener('click',publish);$('ed-history').addEventListener('click',showHistory);$('ed-reset').addEventListener('click',()=>{if(S.changes.size&&!confirm('Сбросить текущие неопубликованные изменения страницы?'))return;clearTimeout(saveTimer);S.saved=null;S.changes.clear();S.assets.clear();S.media.clear();invalidate();saveDraft();renderFields();dirty();});$('ed-export').addEventListener('click',()=>{const d=draftData();window.AelitaMobileFiles.save(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),'aelita-page-'+S.read.page.page.replace(/[^a-z0-9_-]/gi,'-')+'-draft.json',{guardToken:token(),after:document.querySelector('.ed-bottom')});});$('ed-reload').addEventListener('click',()=>{if(S.read)loadPage(S.read.page.page);});$('ed-download-saved').addEventListener('click',()=>{if(S.saved)window.AelitaMobileFiles.save(new Blob([JSON.stringify(S.saved,null,2)],{type:'application/json'}),'aelita-saved-draft.json',{guardToken:token(),after:$('ed-draft')});});$('ed-restore-draft').addEventListener('click',restoreDraft);$('ed-delete-draft').addEventListener('click',removeSavedDraft);
for(const id of['ed-before','ed-after'])$(id).addEventListener('click',()=>{if(!S.review)return;document.querySelectorAll('#ed-before,#ed-after').forEach(b=>b.setAttribute('aria-pressed',String(b.id===id)));frame(id==='ed-before'?S.review.before:S.review.after);});$('ed-width').addEventListener('change',()=>{$('ed-frame').style.width=$('ed-width').value+'px';});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('ed-link-apply').addEventListener('click',()=>{const u=safeURL($('ed-link-url').value),t=$('ed-link-text').value.trim();if(!u||!t){$('ed-link-error').textContent='Укажите текст и корректный адрес ссылки.';return;}if(S.rich&&S.rich.isConnected&&S.range){const a=document.createElement('a');a.href=u;a.textContent=t;S.range.deleteContents();S.range.insertNode(a);S.rich.dispatchEvent(new Event('input',{bubbles:true}));}$('ed-link-dialog').close();});$('ed-image-search').addEventListener('input',fillImages);$('ed-image-list').addEventListener('change',()=>{const u=$('ed-image-list').value;$('ed-image-preview').src=safeURL(u)||'';$('ed-image-preview').hidden=!u;$('ed-image-select').disabled=!u;});$('ed-image-select').addEventListener('click',()=>{const t=S.imageTarget;if(t&&t.epoch===S.epoch){update(t.field,{value:$('ed-image-list').value});renderFields();}$('ed-images-dialog').close();});
window.addEventListener('pagehide',saveDraft);window.addEventListener('storage',e=>{if(e.key==='aelita_admin_token'&&!token())gate();});window.addEventListener('focus',()=>{if(!token())gate();});
async function loadCatalog() {
  if (!token()) { gate(); return; }
  const retry = $('ed-retry-list');
  if (retry.disabled) return;
  retry.disabled = true;
  retry.hidden = true;
  $('ed-recent-page').hidden = true;
  $('ed-app').hidden = false;
  status('Подключаем редактор…');
  try {
    const capability = await api({action:'editor_capabilities'});
    if (!capability.configured) throw {code:'editor_not_configured'};
    S.pages = (await api({action:'editor_list'})).pages;
    fillPages();
    showRecentPage();
    status(S.pages.length ? 'Выберите страницу. Доступно страниц: '+S.pages.length : 'Каталог редактора пока пуст.');
    const page = new URLSearchParams(location.search).get('page');
    if (S.pages.some(p => p.page === page)) {
      $('ed-page').value = page;
      await loadPage(page);
    }
  } catch (error) {
    if (error.code === 'superseded' || $('ed-app').hidden) return;
    status(errors[error.code] || message(error), true);
    retry.hidden = false;
  } finally {
    retry.disabled = false;
  }
}
$('ed-retry-list').onclick = loadCatalog;
void loadCatalog();

function registerWorkGuard(){window.AelitaWorkForms?.register('site-editor-v1.js',{dirty:()=>!!(S.changes.size>0),busy:()=>!!(S.uploading>0),visible:()=>!!(!!S.read)});}if(window.AelitaWorkForms)registerWorkGuard();else window.addEventListener('aelita-work-forms-ready',registerWorkGuard,{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted&&!token())gate();});
})();
