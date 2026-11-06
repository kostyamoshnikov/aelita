(function(root){'use strict';
const LABEL={text:'Текст',photo:'Фотография',video:'Видео',buttons:'Кнопки'},clone=x=>JSON.parse(JSON.stringify(x));
const id=()=> 'bl-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
function validate(initial){if(initial===undefined)return;const ids=new Set();if(!Array.isArray(initial)||initial.length>20)throw{code:'bad_page_draft'};for(const b of initial){if(!b||!Object.hasOwn(LABEL,b.type)||!/^bl-[a-f0-9]{32}$/.test(b.id||'')||ids.has(b.id))throw{code:'bad_page_draft'};ids.add(b.id);for(const l of ['ru','en'])if(b[l]!==undefined&&(!b[l]||typeof b[l]!=='object'||Array.isArray(b[l])||Object.values(b[l]).some(v=>typeof v!=='string')))throw{code:'bad_page_draft'};if(b.links!==undefined&&(!Array.isArray(b.links)||b.links.some(l=>!l||typeof l!=='object'||['url','ru','en'].some(k=>typeof l[k]!=='string'))))throw{code:'bad_page_draft'};}}
function mount(container,initial,options){
 validate(initial);
 let touched=false,items=clone(initial||[]),removed=null;const rows=new Map();
 function button(text,fn){const b=document.createElement('button');b.type='button';b.className='ed-quiet';b.textContent=text;if(text==='↑'||text==='↓')b.setAttribute('aria-label',text==='↑'?'Переместить кнопку выше':'Переместить кнопку ниже');b.onclick=fn;return b;}
 const bar=document.createElement('div');bar.className='ed-actions';const select=document.createElement('select');select.setAttribute('aria-label','Тип нового блока');for(const [v,t]of Object.entries(LABEL))select.add(new Option(t,v));
 const add=button('Добавить блок',()=>{if(items.length>=20){options.onError?.({code:'too_many_blocks'});return;}const type=select.value,b={id:id(),type,visible:true,ru:{},en:{}};for(const l of ['ru','en'])b[l]=type==='text'?{title:'',body:''}:type==='photo'?{alt:'',caption:''}:type==='video'?{title:'',caption:''}:{title:''};if(type==='photo')b.image='';if(type==='video')Object.assign(b,{src:'',poster:'',tracks:{}});if(type==='buttons')b.links=[{url:'',ru:'',en:''}];items.push(b);row(b,true);changed();position();});
 bar.append(select,add);const list=document.createElement('div');list.className='pb-block-editor-list';const note=document.createElement('p');note.setAttribute('role','status');note.className='ed-help';
 const undo=button('Вернуть удалённый блок',()=>{if(!removed)return;if(items.length>=20){options.onError?.({code:'too_many_blocks'});return;}const {b,index}=removed;items.splice(Math.min(index,items.length),0,b);row(b,true);order();removed=null;undo.hidden=true;changed();});undo.hidden=true;container.append(bar,note,list,undo);
 function changed(){touched=true;options.onChange?.();}
 function position(){for(const [i,b]of items.entries()){const r=rows.get(b.id);if(!r)continue;r.up.disabled=i===0;r.down.disabled=i===items.length-1;r.summary.textContent=(i+1)+'. '+LABEL[b.type]+(b.ru?.title?' · '+b.ru.title:'')+(b.visible===false?' · скрыт':'');}note.textContent=items.length?'Блоков: '+items.length+' из 20. Скрытые блоки сохраняют содержание.':'Дополнительных блоков пока нет.';}
 function order(){for(const b of items)list.append(rows.get(b.id).element);position();}
 function move(b,by){const i=items.indexOf(b),j=i+by;if(j<0||j>=items.length)return;items.splice(i,1);items.splice(j,0,b);order();rows.get(b.id).summary.focus();changed();note.textContent='Блок перемещён: '+(j+1)+' из '+items.length+'.';}
 function field(parent,label,value,onChange,multi=false,max=240){const l=document.createElement('label'),n=document.createElement(multi?'textarea':'input');n.className='ym-disable-keys';n.value=value||'';n.maxLength=max;if(multi)n.rows=4;l.append(label,n);parent.append(l);n.addEventListener('input',()=>{onChange(n.value);changed();position();});return n;}
 function langs(parent,b,fields){const grid=document.createElement('div');grid.className='pb-two';for(const lang of ['ru','en']){b[lang]??={};const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=lang==='ru'?'Русский':'English';box.append(legend);grid.append(box);for(const [k,title,multi,max]of fields)field(box,title,b[lang][k],v=>b[lang][k]=v,multi,max);}parent.append(grid);}
 function row(b,open=false){
  const card=document.createElement('details');card.className='pb-block-editor';card.open=open;card.dataset.blockId=b.id;const summary=document.createElement('summary');card.append(summary);const actions=document.createElement('div');actions.className='ed-actions';
  const up=button('↑ Выше',()=>move(b,-1)),down=button('↓ Ниже',()=>move(b,1)),visibility=document.createElement('label'),show=document.createElement('input');show.type='checkbox';show.checked=b.visible!==false;visibility.className='ed-check';visibility.append(show,'Показывать');show.addEventListener('change',()=>{b.visible=show.checked;changed();position();});
  actions.append(up,down,visibility,button('Удалить блок',()=>{const index=items.indexOf(b);removed={b:clone(b),index};items.splice(index,1);rows.delete(b.id);card.remove();undo.hidden=false;changed();position();}));card.append(actions);rows.set(b.id,{element:card,summary,up,down});list.append(card);
  const current=()=>card.isConnected&&rows.has(b.id)&&(!options.isCurrent||options.isCurrent());
  async function photo(file,isCurrent=current){options.busy?.(1);try{return await options.onPhoto(file,isCurrent);}finally{options.busy?.(-1);}}
  if(b.type==='text')langs(card,b,[['title','Подзаголовок',false,240],['body','Текст: абзацы, ## заголовок, - список, **жирный**, [ссылка](/адрес/)',true,20000]]);
  if(b.type==='photo'){
   const image=field(card,'Фотография',b.image,v=>{b.image=v;refresh();},false,500),upload=document.createElement('label');upload.className='ed-upload';upload.append('Загрузить фотографию');const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';upload.append(file);card.append(upload);
   async function choose(source){const before=b.image,value=await photo(source,()=>current()&&b.image===before);if(!current())return;b.image=value;image.value=value;refresh();changed();}
   file.addEventListener('change',async()=>{const selected=file.files[0];file.value='';if(!selected)return;file.disabled=true;try{await choose(selected);}catch(e){if(e.code!=='superseded')options.onError?.(e);}finally{file.disabled=false;}});
   const original=document.createElement('div');card.append(original);function refresh(){original.replaceChildren();const selected=b.image;root.AelitaMediaOriginals.controls(original,{api:options.api,value:selected,onChoose:choose,progress:options.progress,isCurrent:()=>current()&&b.image===selected});}refresh();
   root.AelitaMediaView.mount(card,b.view,{api:options.api,progress:options.progress,isCurrent:current,onChange:v=>{if(v)b.view=v;else delete b.view;changed();},onMobileFile:file=>photo(file,current),onError:options.onError});
   langs(card,b,[['alt','Описание фотографии (alt)',false,240],['caption','Подпись',true,1000]]);
  }
  if(b.type==='video'){root.AelitaContentMedia.mountVideo(card,b,{...options,hideText:true,isCurrent:current,onPhoto:photo,onChange:v=>{for(const k of ['src','poster','tracks','width','height'])if(v[k]!==undefined)b[k]=v[k];changed();}});langs(card,b,[['title','Название видео',false,240],['caption','Подпись под видео',true,1000]]);}
  if(b.type==='buttons'){
   langs(card,b,[['title','Подзаголовок',false,240]]);b.links??=[];const links=document.createElement('div');card.append(links);
   function renderLinks(){links.replaceChildren();for(const [i,l]of b.links.entries()){const item=document.createElement('div');item.className='pb-block-button';for(const [k,title,max]of [['url','Адрес',500],['ru','Надпись RU',60],['en','Label EN',60]])field(item,title,l[k],v=>l[k]=v,false,max);const a=document.createElement('div');a.className='ed-actions';a.append(button('↑',()=>{if(!i)return;[b.links[i-1],b.links[i]]=[b.links[i],b.links[i-1]];renderLinks();changed();}),button('↓',()=>{if(i===b.links.length-1)return;[b.links[i+1],b.links[i]]=[b.links[i],b.links[i+1]];renderLinks();changed();}),button('Убрать кнопку',()=>{b.links.splice(i,1);renderLinks();changed();}));item.append(a);links.append(item);}}
   renderLinks();card.append(button('Добавить кнопку',()=>{if(b.links.length>=6)return;b.links.push({url:'',ru:'',en:''});renderLinks();changed();}));
  }position();
 }
 items.forEach(b=>row(b));position();return{get:()=>initial===undefined&&!touched?undefined:clone(items)};
}
const api={mount,validate};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaPageBlocks=api;
})(typeof window==='object'?window:globalThis);
