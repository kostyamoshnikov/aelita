(function(root){'use strict';
const MAX=20*1024*1024,ORIGIN='https://aelita-production.ru';
const ERR={invalid_social_image:'Для обложки ссылки выберите собственное фото и описания до 500 знаков.',source_not_available:'Не удалось проверить ресурс в выбранной версии сайта. Откройте актуальные данные и повторите проверку.',bad_video:'Нужен MP4 с видео H.264 и звуком AAC (если он есть).',video_codec:'Подойдёт MP4 с видео H.264 и звуком AAC. Редактор не перекодирует видео.',video_too_large:'Видео должно быть не больше 20 МБ.',video_duration:'Видео должно быть не длиннее 10 минут.',video_dimensions:'Видео — до 4096 px по стороне.',invalid_video:'Проверьте видео, постер и субтитры.',bad_captions:'Нужен WebVTT в UTF-8 с корректным временем, до 64 КБ.',caption_missing:'Субтитры не найдены в черновике. Выберите файл снова.',too_many_captions:'До шести файлов субтитров, суммарно до 128 КБ.',duplicate_captions:'Один файл субтитров приложен дважды.',video_batch_too_large:'Новые видео одной публикации — до 20 МБ суммарно.',video_caption_unavailable:'Здесь подпись меняется отдельным текстовым фрагментом.',linked_page_no_en:'У внутренней ссылки нет английской страницы.',too_many_blocks:'На странице может быть до 20 дополнительных блоков.',page_too_large:'Страница слишком большая. Сократите текст или число блоков.'};
const message=e=>ERR[e?.code||e?.message]||root.AelitaMediaOriginals?.message(e),clone=x=>JSON.parse(JSON.stringify(x));
const check=fn=>{if(fn&&!fn())throw{code:'superseded'};};
function refs(value,prefix){const out=new Set();function scan(x){if(Array.isArray(x))x.forEach(scan);else if(x&&typeof x==='object')Object.values(x).forEach(scan);else if(typeof x==='string'&&x.startsWith(prefix))out.add(x.slice(prefix.length));}scan(value);return out;}
function encode(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s);}
function createStore(){
 const videos=new Map(),captions=new Map();
 async function uploadVideo(source,api,progress,isCurrent){
  check(isCurrent);let file=source;if(!file.type&&/\.mp4$/i.test(file.name))file=new File([file],file.name,{type:'video/mp4'});
  if(file.type!=='video/mp4')throw{code:'bad_video'};if(file.size>MAX)throw{code:'video_too_large'};
  const saved=await root.AelitaMediaOriginals.save(file,null,api,progress,isCurrent);check(isCurrent);if(videos.has(saved.id))URL.revokeObjectURL(videos.get(saved.id));videos.set(saved.id,URL.createObjectURL(file));return{src:'video:'+saved.id,width:saved.width,height:saved.height};
 }
 async function uploadCaption(file,isCurrent){
  if(file.size>65536)throw{code:'bad_captions'};const bytes=new Uint8Array(await file.arrayBuffer());check(isCurrent);let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw{code:'bad_captions'};}
  if(!/^\uFEFF?WEBVTT(?:[^\S\r\n][^\r\n]*)?\r?\n(?:\r?\n|$)/.test(text))throw{code:'bad_captions'};
  const h=await root.AelitaMediaOriginals.digest(bytes);check(isCurrent);captions.set(h,{hash:h,type:'text/vtt',data:encode(bytes)});return'caption:'+h;
 }
 function captionAssets(input){const ids=refs(input,'caption:');return[...captions.values()].filter(a=>ids.has(a.hash)).map(({type,data})=>({type,data}));}
 function snapshot(input){const ids=refs(input,'caption:');return[...captions.values()].filter(a=>ids.has(a.hash)).map(clone);}
 function restore(input){if(!Array.isArray(input)||input.length>6)return;for(const a of input)if(/^[a-f0-9]{64}$/.test(a?.hash||'')&&a.type==='text/vtt'&&typeof a.data==='string'&&a.data.length<=90000)captions.set(a.hash,clone(a));}
 async function preview(html,assets,api,isCurrent){let out=html;for(const a of assets||[]){check(isCurrent);if(!videos.has(a.hash)){const file=await root.AelitaMediaOriginals.getFile(a.hash,api,()=>{},isCurrent);check(isCurrent);videos.set(a.hash,URL.createObjectURL(file));}const url=videos.get(a.hash),p='/'+a.path;out=out.split(ORIGIN+p).join(url).split(p).join(url);}return out;}
 function clear(){for(const url of videos.values())URL.revokeObjectURL(url);videos.clear();captions.clear();}
 return{uploadVideo,uploadCaption,captionAssets,snapshot,restore,preview,clear};
}
function mountVideo(container,value,options){
 const state={src:'',poster:'',tracks:{},title:'',caption:'',...clone(value||{})};if(!state.tracks||typeof state.tracks!=='object')state.tracks={};
 let posterQuality;
 const holder=document.createElement('div');holder.className='ed-video-settings';container.append(holder);const current=()=>holder.isConnected&&(!options.isCurrent||options.isCurrent()),emit=()=>{refreshPoster();posterQuality?.update();options.onChange(clone(state));};
 function field(label,key){const l=document.createElement('label'),n=document.createElement(key==='caption'?'textarea':'input');n.className='ym-disable-keys';n.value=state[key]||'';n.maxLength=key==='caption'?1000:2000;l.append(label,n);holder.append(l);n.addEventListener('input',()=>{state[key]=n.value.trim();if(key==='src'){state.width=null;state.height=null;refresh();}emit();});return n;}
 const src=field('Видео MP4','src');src.placeholder='/images/…mp4 или https://…mp4';
 function upload(label,accept,fn){const l=document.createElement('label');l.className='ed-upload';l.append(label);const file=document.createElement('input');file.type='file';file.accept=accept;l.append(file);holder.append(l);file.addEventListener('change',async()=>{const chosen=file.files[0];file.value='';if(!chosen)return;file.disabled=true;options.busy?.(1);try{const result=await fn(chosen);if(current()){Object.assign(state,result);sync();emit();}}catch(e){if(e.code!=='superseded')options.onError?.(e);}finally{file.disabled=false;options.busy?.(-1);}});}
 async function selectedVideo(file){const before=state.src;return options.store.uploadVideo(file,options.api,options.progress,()=>current()&&state.src===before);}
 async function choose(file){options.busy?.(1);try{const result=await selectedVideo(file);if(current()){Object.assign(state,result);sync();emit();}}catch(e){if(e.code!=='superseded')options.onError?.(e);}finally{options.busy?.(-1);}}
 upload('Загрузить видео · MP4 до 20 МБ','video/mp4',selectedVideo);
 const originals=document.createElement('div');holder.append(originals);function refresh(){originals.replaceChildren();const selected=state.src;root.AelitaMediaOriginals.controls(originals,{api:options.api,value:selected,kind:'video',usages:['видео выбранного блока'],onChoose:choose,progress:options.progress,isCurrent:()=>current()&&state.src===selected});}
 const poster=field('Постер видео','poster');const posterOriginal=document.createElement('div');holder.append(posterOriginal);function refreshPoster(){posterOriginal.replaceChildren();const selected=state.poster;root.AelitaMediaOriginals.controls(posterOriginal,{api:options.api,value:selected,resolve:options.imageSource,usages:['постер выбранного видео'],onChoose:async file=>{const value=await options.onPhoto(file,()=>current()&&state.poster===selected);if(current()){state.poster=value;sync();emit();}},progress:options.progress,isCurrent:()=>current()&&state.poster===selected});}upload('Загрузить постер','image/jpeg,image/png,image/webp',async file=>{const before=state.poster;return{poster:await options.onPhoto(file,()=>current()&&state.poster===before)};});
 const trackInputs={};for(const [l,title]of [['ru','Русские субтитры'],['en','English subtitles']]){
  const label=document.createElement('label'),input=document.createElement('input');input.className='ym-disable-keys';input.value=state.tracks[l]||'';input.maxLength=2000;label.append(title,input);holder.append(label);trackInputs[l]=input;input.addEventListener('input',()=>{if(input.value.trim())state.tracks[l]=input.value.trim();else delete state.tracks[l];emit();});
  upload('Загрузить субтитры '+l.toUpperCase()+' · VTT','text/vtt,.vtt',async file=>{const before=state.tracks[l],source=await options.store.uploadCaption(file,()=>current()&&state.tracks[l]===before);return{tracks:{...state.tracks,[l]:source}};});
 }
 let title,caption;if(!options.hideText){title=field('Название видео для доступности','title');if(options.canCaption!==false)caption=field('Подпись под видео','caption');}
 const note=document.createElement('p');note.className='ed-help';note.textContent='После публикации видео будет доступно посетителям. Без автозапуска; воспроизведение — по нажатию. Изменения сначала проверьте в макете страницы.';holder.append(note);
 function sync(){src.value=state.src;poster.value=state.poster||'';for(const l of ['ru','en'])trackInputs[l].value=state.tracks[l]||'';if(title)title.value=state.title;if(caption)caption.value=state.caption;refresh();}
 if(root.AelitaImageQuality?.mountPoster)posterQuality=root.AelitaImageQuality.mountPoster(holder,{source:()=>options.imageSource?options.imageSource(state.poster||''):(state.poster||''),videoSize:()=>({width:state.width,height:state.height}),isCurrent:current,context:()=>JSON.stringify([state.src,state.poster,state.width,state.height])});
 refresh();refreshPoster();Promise.resolve().then(()=>posterQuality?.update());return{get:()=>clone(state)};
}
function mountSocial(container,initial,options){
 let enabled=initial!==undefined,state={image:'',altRu:'',altEn:'',...clone(initial||{})};
 const holder=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Обложка ссылки (OG)';holder.append(legend);container.append(holder);
 const label=document.createElement('label'),toggle=document.createElement('input');label.className='ed-check';toggle.type='checkbox';toggle.checked=enabled;label.append(toggle,'Использовать отдельную обложку');holder.append(label);
 const fields=document.createElement('div');holder.append(fields);const inputs={};
 const current=()=>holder.isConnected&&(!options.isCurrent||options.isCurrent());
 function changed(){options.onChange?.();}
 for(const [key,title]of [['image','Собственное изображение /images/… или абсолютный адрес сайта'],['altRu','Описание обложки RU'],['altEn','Description EN']]){const l=document.createElement('label'),n=document.createElement('input');n.className='ym-disable-keys';n.value=state[key];n.maxLength=key==='image'?2000:500;l.append(title,n);fields.append(l);inputs[key]=n;n.oninput=()=>{state[key]=n.value.trim();if(key==='image')refresh();changed();};}
 const picker=document.createElement('button'),select=document.createElement('select');picker.type='button';picker.className='ed-quiet';picker.textContent='Выбрать из изображений сайта';select.setAttribute('aria-label','Изображение для OG из каталога сайта');select.hidden=true;fields.append(picker,select);
 picker.onclick=async()=>{const before=state.image;picker.disabled=true;try{const result=await options.api({action:'editor_assets'});if(!current()||!enabled||state.image!==before)return;select.replaceChildren(new Option('Выберите фотографию',''));for(const value of result.images||[])if(typeof value==='string'&&/^\/images\/[a-z0-9/_.-]+\.(?:jpe?g|png|webp)$/i.test(value))select.add(new Option(value,value));select.hidden=false;}catch(e){if(current()&&e.code!=='superseded')options.onError?.(e);}finally{picker.disabled=false;}};
 select.onchange=()=>{if(!current()||!enabled||!select.value)return;state.image=select.value;inputs.image.value=state.image;refresh();changed();};
 const original=document.createElement('div');fields.append(original);
 async function choose(file){const before=state.image;options.busy?.(1);try{const value=await options.onPhoto(file,()=>current()&&state.image===before&&enabled);if(!current()||state.image!==before||!enabled)return;state.image=value;inputs.image.value=value;refresh();changed();}catch(e){if(e.code!=='superseded')options.onError?.(e);}finally{options.busy?.(-1);}}
 const upload=document.createElement('label'),file=document.createElement('input');upload.className='ed-upload';file.type='file';file.accept='image/jpeg,image/png,image/webp';upload.append('Загрузить отдельную обложку',file);fields.append(upload);file.onchange=async()=>{const selected=file.files[0];file.value='';if(!selected)return;file.disabled=true;try{await choose(selected);}finally{file.disabled=false;}};
 const help=document.createElement('p');help.className='ed-help';help.textContent='Меняется только обложка ссылки и её описание. Основное фото, его кадр и постеры видео сохраняются. Без отдельного назначения используется прежняя обложка страницы. Кэш мессенджера может обновиться позднее.';holder.append(help);
 function refresh(){fields.hidden=!enabled;original.replaceChildren();const value=state.image;if(enabled)root.AelitaMediaOriginals.controls(original,{api:options.api,value,resolve:options.imageSource,usages:['обложка ссылки RU/EN'],onChoose:choose,progress:options.progress,isCurrent:()=>current()&&state.image===value&&enabled});}
 toggle.onchange=()=>{enabled=toggle.checked;refresh();changed();};refresh();return{get:()=>enabled?clone(state):undefined};
}
const api={createStore,mountVideo,mountSocial,message,refs,MAX};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaContentMedia=api;
})(typeof window==='object'?window:globalThis);
