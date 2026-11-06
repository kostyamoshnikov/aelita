(function(root){'use strict';
const MAX=20*1024*1024,ORIGIN='https://aelita-production.ru';
const ERR={bad_video:'Нужен MP4 с видео H.264 и звуком AAC (если он есть).',video_codec:'Подойдёт MP4 с видео H.264 и звуком AAC. Редактор не перекодирует видео.',video_too_large:'Видео должно быть не больше 20 МБ.',video_duration:'Видео должно быть не длиннее 10 минут.',video_dimensions:'Видео — до 4096 px по стороне.',invalid_video:'Проверьте видео, постер и субтитры.',bad_captions:'Нужен WebVTT в UTF-8 с корректным временем, до 64 КБ.',caption_missing:'Субтитры не найдены в черновике. Выберите файл снова.',too_many_captions:'До шести файлов субтитров, суммарно до 128 КБ.',duplicate_captions:'Один файл субтитров приложен дважды.',video_batch_too_large:'Новые видео одной публикации — до 20 МБ суммарно.',video_caption_unavailable:'Здесь подпись меняется отдельным текстовым фрагментом.',linked_page_no_en:'У внутренней ссылки нет английской страницы.',too_many_blocks:'На странице может быть до 20 дополнительных блоков.',page_too_large:'Страница слишком большая. Сократите текст или число блоков.'};
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
 const holder=document.createElement('div');holder.className='ed-video-settings';container.append(holder);const current=()=>holder.isConnected&&(!options.isCurrent||options.isCurrent()),emit=()=>options.onChange(clone(state));
 function field(label,key){const l=document.createElement('label'),n=document.createElement(key==='caption'?'textarea':'input');n.className='ym-disable-keys';n.value=state[key]||'';n.maxLength=key==='caption'?1000:2000;l.append(label,n);holder.append(l);n.addEventListener('input',()=>{state[key]=n.value.trim();if(key==='src'){state.width=null;state.height=null;refresh();}emit();});return n;}
 const src=field('Видео MP4','src');src.placeholder='/images/…mp4 или https://…mp4';
 function upload(label,accept,fn){const l=document.createElement('label');l.className='ed-upload';l.append(label);const file=document.createElement('input');file.type='file';file.accept=accept;l.append(file);holder.append(l);file.addEventListener('change',async()=>{const chosen=file.files[0];file.value='';if(!chosen)return;file.disabled=true;options.busy?.(1);try{const result=await fn(chosen);if(current()){Object.assign(state,result);sync();emit();}}catch(e){if(e.code!=='superseded')options.onError?.(e);}finally{file.disabled=false;options.busy?.(-1);}});}
 async function selectedVideo(file){const before=state.src;return options.store.uploadVideo(file,options.api,options.progress,()=>current()&&state.src===before);}
 async function choose(file){options.busy?.(1);try{const result=await selectedVideo(file);if(current()){Object.assign(state,result);sync();emit();}}catch(e){if(e.code!=='superseded')options.onError?.(e);}finally{options.busy?.(-1);}}
 upload('Загрузить видео · MP4 до 20 МБ','video/mp4',selectedVideo);
 const originals=document.createElement('div');holder.append(originals);function refresh(){originals.replaceChildren();const selected=state.src;root.AelitaMediaOriginals.controls(originals,{api:options.api,value:selected,kind:'video',onChoose:choose,progress:options.progress,isCurrent:()=>current()&&state.src===selected});}
 const poster=field('Постер видео','poster');upload('Загрузить постер','image/jpeg,image/png,image/webp',async file=>{const before=state.poster;return{poster:await options.onPhoto(file,()=>current()&&state.poster===before)};});
 const trackInputs={};for(const [l,title]of [['ru','Русские субтитры'],['en','English subtitles']]){
  const label=document.createElement('label'),input=document.createElement('input');input.className='ym-disable-keys';input.value=state.tracks[l]||'';input.maxLength=2000;label.append(title,input);holder.append(label);trackInputs[l]=input;input.addEventListener('input',()=>{if(input.value.trim())state.tracks[l]=input.value.trim();else delete state.tracks[l];emit();});
  upload('Загрузить субтитры '+l.toUpperCase()+' · VTT','text/vtt,.vtt',async file=>{const before=state.tracks[l],source=await options.store.uploadCaption(file,()=>current()&&state.tracks[l]===before);return{tracks:{...state.tracks,[l]:source}};});
 }
 let title,caption;if(!options.hideText){title=field('Название видео для доступности','title');if(options.canCaption!==false)caption=field('Подпись под видео','caption');}
 const note=document.createElement('p');note.className='ed-help';note.textContent='После публикации видео будет доступно посетителям. Без автозапуска; воспроизведение — по нажатию. Изменения сначала проверьте в макете страницы.';holder.append(note);
 function sync(){src.value=state.src;poster.value=state.poster||'';for(const l of ['ru','en'])trackInputs[l].value=state.tracks[l]||'';if(title)title.value=state.title;if(caption)caption.value=state.caption;refresh();}
 refresh();return{get:()=>clone(state)};
}
const api={createStore,mountVideo,message,refs,MAX};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaContentMedia=api;
})(typeof window==='object'?window:globalThis);
