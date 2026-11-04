// Shared validation and rendering data. No network, credentials or customer records.
export const CONTENT_SCHEMA='aelita.bot-content/v1';
export const LIMITS=Object.freeze({screens:40,buttons:30,text:4000,contentBytes:128*1024,mediaBytes:10*1024*1024,members:12,history:60});
export function problem(code,status=400,field){throw Object.assign(new Error(code),{code,status,field});}
export function clone(v){return JSON.parse(JSON.stringify(v));}
export function string(v,field,max,empty=false){if(typeof v!=='string'||(!empty&&!v.trim())||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))problem('invalid_field',400,field);return v.trim();}
export function safeURL(value){const s=string(value,'url',700);let u;try{u=new URL(s);}catch{problem('invalid_url');}if(u.protocol!=='https:'||u.username||u.password||/[\s<>"'\\]/.test(s))problem('invalid_url');return u.href;}
export function normalizeMedia(v){
 if(v===null||v===undefined)return null;
 if(!v||!['photo','document'].includes(v.type)||typeof v.fileId!=='string'||!/^[A-Za-z0-9_-]{6,512}$/.test(v.fileId)||!Number.isSafeInteger(v.size)||v.size<1||v.size>LIMITS.mediaBytes)problem('invalid_media');
 return{type:v.type,fileId:v.fileId,uniqueId:string(v.uniqueId||'','uniqueId',150,true),name:string(v.name||'','name',120,true),mime:string(v.mime||'','mime',120,true),size:v.size};
}
export function normalizeContent(value,seed){
 if(!value||value.schema!==CONTENT_SCHEMA||!value.screens||typeof value.screens!=='object'||Array.isArray(value.screens))problem('invalid_content');
 const ids=Object.keys(value.screens).sort();if(ids.length<1||ids.length>LIMITS.screens)problem('too_many_screens');
 for(const id of Object.keys(seed.screens))if(!ids.includes(id))problem('builtin_screen_required',400,id);
 const screens={};
 for(const id of ids){
  const s=value.screens[id],original=seed.screens[id];
  if(!s||s.id!==id||(!original&&!/^s[a-f0-9]{12}$/.test(id)))problem('invalid_screen');
  const next={id,label:string(s.label,'label',80),builtin:!!original,dynamic:!!original?.dynamic,locales:{}};
  for(const lang of ['ru','en']){
   const l=s.locales?.[lang];if(!l)problem('invalid_locale');
   const text=next.dynamic?'':string(l.text,lang+'.text',LIMITS.text,lang==='en');
   if(!Number.isSafeInteger(l.revision)||l.revision<0||!Number.isSafeInteger(l.translationOf)||l.translationOf<0)problem('invalid_locale');
   if(!Array.isArray(l.buttons)||l.buttons.length>LIMITS.buttons)problem('too_many_buttons');
   const seen=new Set();const buttons=l.buttons.map(b=>{
    if(!b||typeof b.id!=='string'||! /^(?:b\d{1,3}|b[a-f0-9]{12})$/.test(b.id)||seen.has(b.id))problem('invalid_button');seen.add(b.id);
    if(!['route','url','screen','language'].includes(b.kind)||typeof b.visible!=='boolean'||!Number.isSafeInteger(b.row)||b.row<0||b.row>29)problem('invalid_button');
    let target;
    if(b.kind==='url')target=safeURL(b.target);
    else if(b.kind==='route'){if(!seed.routes.includes(b.target))problem('invalid_route');target=b.target;}
    else if(b.kind==='language'){if(b.target!=='toggle')problem('invalid_route');target='toggle';}
    else {if(!ids.includes(b.target))problem('screen_not_found');target=b.target;}
    return{id:b.id,label:string(b.label,'button.label',60),kind:b.kind,target,row:b.row,visible:b.visible};
   });
   // No more than two controls across, including inherited seed menus.
   for(const row of new Set(buttons.filter(b=>b.visible).map(b=>b.row)))if(buttons.filter(b=>b.visible&&b.row===row).length>2)problem('too_many_columns');
   next.locales[lang]={text,format:original&&text===original.locales[lang].text&&l.format==='Markdown'?'Markdown':'Plain',revision:l.revision,translationOf:l.translationOf,media:normalizeMedia(l.media),buttons};
  }
  screens[id]=next;
 }
 const result={schema:CONTENT_SCHEMA,screens,routes:[...seed.routes]};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>LIMITS.contentBytes)problem('content_too_large',413);
 return result;
}
export function keyboard(content,screenId,lang='ru'){
 const s=Object.hasOwn(content.screens,screenId)?content.screens[screenId]:null;if(!s)problem('screen_not_found',404);
 const l=s.locales[lang],rows=new Map();
 for(const b of l.buttons){if(!b.visible)continue;const out={text:b.label};
  if(b.kind==='url')out.url=b.target;
  else if(b.kind==='language')out.callback_data='lang_toggle|'+(lang==='en'?'ru':'en');
  else if(b.kind==='screen')out.callback_data='bc1:'+b.target+'|'+lang;
  else out.callback_data=b.target+'|'+lang;
  if(out.callback_data&&new TextEncoder().encode(out.callback_data).byteLength>64)problem('invalid_button');
  if(!rows.has(b.row))rows.set(b.row,[]);rows.get(b.row).push(out);
 }
 const result=[...rows].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
 if(screenId!=='welcome'&&!result.some(row=>row.some(b=>b.callback_data==='back|'+lang)))result.push([{text:lang==='en'?'Main menu':'Главное меню',callback_data:'back|'+lang}]);
 return{inline_keyboard:result};
}
export function screenView(content,id,lang='ru'){
 const s=Object.hasOwn(content.screens,id)?content.screens[id]:null;if(!s)problem('screen_not_found',404);
 const local=s.locales[lang],fallback=lang==='en'&&!local.text&&!s.dynamic,l=fallback?s.locales.ru:local;
 return{id,label:s.label,text:l.text,format:l.format,media:l.media,dynamic:s.dynamic,fallback,translationStale:lang==='en'&&s.locales.en.translationOf<s.locales.ru.revision,keyboard:keyboard(content,id,lang)};
}
export function applyChange(input,patch,seed){
 const content=normalizeContent(input,seed);if(!patch||typeof patch!=='object')problem('invalid_change');
 if(patch.kind==='screen_add'){
  if(!/^s[a-f0-9]{12}$/.test(patch.id||'')||content.screens[patch.id])problem('invalid_screen');
  content.screens[patch.id]={id:patch.id,label:string(patch.label,'label',80),builtin:false,dynamic:false,locales:{ru:{text:'Новый раздел',format:'Plain',revision:0,translationOf:0,media:null,buttons:[]},en:{text:'',format:'Plain',revision:0,translationOf:0,media:null,buttons:[]}}};return normalizeContent(content,seed);
 }
 const s=Object.hasOwn(content.screens,patch.screen)?content.screens[patch.screen]:null;if(!s)problem('screen_not_found',404);const lang=patch.lang==='en'?'en':'ru',l=s.locales[lang];
 if(patch.kind==='text'){if(s.dynamic)problem('dynamic_text_locked');l.text=string(patch.text,'text',LIMITS.text,lang==='en');l.format='Plain';l.revision++;}
 else if(patch.kind==='label')s.label=string(patch.label,'label',80);
 else if(patch.kind==='translation_checked'){s.locales.en.translationOf=s.locales.ru.revision;}
 else if(patch.kind==='media'){l.media=normalizeMedia(patch.media);l.revision++;}
 else if(patch.kind==='button_add'){
  if(!patch.button||!/^b[a-f0-9]{12}$/.test(patch.button.id||''))problem('invalid_button');
  let row=l.buttons.length?Math.max(...l.buttons.map(b=>b.row))+1:0;
  if(row>=LIMITS.buttons){const rows=[...new Set(l.buttons.map(b=>b.row))].sort((a,b)=>a-b);for(const b of l.buttons)b.row=rows.indexOf(b.row);row=rows.length;}
  l.buttons.push({...patch.button,row,visible:true});l.revision++;
 } else {
  const i=l.buttons.findIndex(b=>b.id===patch.buttonId);if(i<0)problem('button_not_found',404);const b=l.buttons[i];
  if(patch.kind==='button_label')b.label=string(patch.label,'button.label',60);
  else if(patch.kind==='button_target'){b.kind=patch.targetKind;b.target=patch.target;}
  else if(patch.kind==='button_edit'){b.label=string(patch.label,'button.label',60);b.kind=patch.targetKind;b.target=patch.target;if(typeof patch.visible!=='boolean')problem('invalid_change');b.visible=patch.visible;}
  else if(patch.kind==='button_toggle'){if(typeof patch.visible!=='boolean')problem('invalid_change');b.visible=patch.visible;}
  else if(patch.kind==='button_remove')l.buttons.splice(i,1);
  else if(patch.kind==='button_move'){
   if(![-1,1].includes(patch.delta))problem('invalid_change');const j=i+patch.delta;if(j<0||j>=l.buttons.length)problem('button_at_edge');
   const ri=b.row,rj=l.buttons[j].row;[l.buttons[i],l.buttons[j]]=[l.buttons[j],l.buttons[i]];l.buttons[i].row=ri;l.buttons[j].row=rj;
  }else problem('invalid_change');
  l.revision++;
 }
 return normalizeContent(content,seed);
}
export function permissions(role){return{read:['owner','editor','sender','viewer'].includes(role),edit:['owner','editor'].includes(role),publish:['owner','editor'].includes(role),members:role==='owner',newsletter:['owner','sender'].includes(role),applications:role==='owner'};}
export function validatePublication(content){
 for(const lang of ['ru','en'])if(!content.screens.welcome.locales[lang].buttons.some(b=>b.visible))problem('main_menu_empty');
 return content;
}
export function legacyPlain(text){return String(text||'').replace(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g,'$1 — $2').replace(/\*([^*]+)\*/g,'$1').replace(/_([^_\n]+)_/g,'$1').replace(/\\([_*\[\]()`])/g,'$1');}
export function contentSummary(before,after){
 const changed=[];
 for(const id of Object.keys(after.screens))if(JSON.stringify(before.screens[id])!==JSON.stringify(after.screens[id]))changed.push({id,label:after.screens[id].label});
 return changed;
}
