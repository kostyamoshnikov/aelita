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
  const s=value.screens[id],original=Object.hasOwn(seed.screens,id)?seed.screens[id]:null;
  if(!s||s.id!==id||(!original&&!/^s[a-f0-9]{12}$/.test(id)))problem('invalid_screen');
  const next={id,label:string(s.label,'label',80),builtin:!!original,dynamic:!!original?.dynamic,locales:{}};
  if(s.eventId!==undefined&&s.eventId!==''){if(next.dynamic)problem('invalid_event');next.eventId=eventId(s.eventId);}
  for(const lang of ['ru','en']){
   const l=s.locales?.[lang];if(!l)problem('invalid_locale');
   const text=next.dynamic?'':string(l.text,lang+'.text',LIMITS.text,lang==='en');
   if(!Number.isSafeInteger(l.revision)||l.revision<0||!Number.isSafeInteger(l.translationOf)||l.translationOf<0)problem('invalid_locale');
   if(!Array.isArray(l.buttons)||l.buttons.length>LIMITS.buttons)problem('too_many_buttons');
   const seen=new Set();const buttons=l.buttons.map(b=>{
    if(!b||typeof b.id!=='string'||! /^(?:b\d{1,3}|b[a-f0-9]{12})$/.test(b.id)||seen.has(b.id))problem('invalid_button');seen.add(b.id);
    if(!['route','url','screen','language','event'].includes(b.kind)||typeof b.visible!=='boolean'||!Number.isSafeInteger(b.row)||b.row<0||b.row>29)problem('invalid_button');
    let target;
    if(b.kind==='event'){if(!next.eventId||!['details','buy'].includes(b.target))problem('invalid_event_button');target=b.target;}
    else if(b.kind==='url')target=safeURL(b.target);
    else if(b.kind==='route'){if(!seed.routes.includes(b.target))problem('invalid_route');target=b.target;}
    else if(b.kind==='language'){if(b.target!=='toggle')problem('invalid_route');target='toggle';}
    else {if(!ids.includes(b.target))problem('screen_not_found');target=b.target;}
    return{id:b.id,label:string(b.label,'button.label',60),kind:b.kind,target,row:b.row,visible:b.visible};
   });
   // No more than two controls across, including inherited seed menus.
   for(const row of new Set(buttons.filter(b=>b.visible).map(b=>b.row)))if(buttons.filter(b=>b.visible&&b.row===row).length>2)problem('too_many_columns');
   if(l.template!==undefined&&typeof l.template!=='boolean')problem('invalid_template');
   if(l.template){if(next.dynamic||l.format!=='Plain')problem('invalid_template');validateTemplate(text,!!next.eventId);for(const b of buttons){validateTemplate(b.label,!!next.eventId);if(b.kind==='url'&&/[{}]{2}/.test(b.target))problem('invalid_variable');}}
   next.locales[lang]={text,format:original&&text===original.locales[lang].text&&l.format==='Markdown'?'Markdown':'Plain',revision:l.revision,translationOf:l.translationOf,media:normalizeMedia(l.media),buttons,...(l.template?{template:true}:{})};
  }
  screens[id]=next;
 }
 const result={schema:CONTENT_SCHEMA,screens,routes:[...seed.routes]};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>LIMITS.contentBytes)problem('content_too_large',413);
 return result;
}
export function keyboard(content,screenId,lang='ru',event=null){
 const s=Object.hasOwn(content.screens,screenId)?content.screens[screenId]:null;if(!s)problem('screen_not_found',404);
 const l=s.locales[lang],rows=new Map();
 for(const b of l.buttons){if(!b.visible)continue;const out={text:l.template?renderTemplate(b.label,event,lang):b.label};if(out.text.length>60)problem('rendered_button_too_long');
  if(b.kind==='event'){const url=event&&event[lang]?.[b.target==='buy'?'buyURL':'pageURL'];if(!url||(b.target==='buy'&&!event.salesOpen))continue;out.url=url;}
  else if(b.kind==='url')out.url=b.target;
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
export function screenView(content,id,lang='ru',event=null){
 const s=Object.hasOwn(content.screens,id)?content.screens[id]:null;if(!s)problem('screen_not_found',404);
 const local=s.locales[lang],fallback=lang==='en'&&!local.text&&!s.dynamic,l=fallback?s.locales.ru:local;
 return{id,label:s.label,text:l.template?renderTemplate(l.text,event,fallback?'ru':lang):l.text,format:l.format,media:l.media,dynamic:s.dynamic,fallback,translationStale:lang==='en'&&s.locales.en.translationOf<s.locales.ru.revision,keyboard:keyboard(content,id,lang,event),...(s.eventId?{eventId:s.eventId}:{})};
}
export function applyChange(input,patch,seed){
 const content=normalizeContent(input,seed);if(!patch||typeof patch!=='object')problem('invalid_change');
 if(patch.kind==='screen_add'){
  if(!/^s[a-f0-9]{12}$/.test(patch.id||'')||content.screens[patch.id])problem('invalid_screen');
  content.screens[patch.id]={id:patch.id,label:string(patch.label,'label',80),builtin:false,dynamic:false,locales:{ru:{text:'Новый раздел',format:'Plain',revision:0,translationOf:0,media:null,buttons:[]},en:{text:'',format:'Plain',revision:0,translationOf:0,media:null,buttons:[]}}};return normalizeContent(content,seed);
 }
 const s=Object.hasOwn(content.screens,patch.screen)?content.screens[patch.screen]:null;if(!s)problem('screen_not_found',404);const lang=patch.lang==='en'?'en':'ru',l=s.locales[lang];
 if(patch.kind==='event_bind'){if(s.dynamic)problem('dynamic_text_locked');if(patch.eventId)s.eventId=eventId(patch.eventId);else delete s.eventId;return normalizeContent(content,seed);}
 if(patch.kind==='template_text'){
  if(s.dynamic)problem('dynamic_text_locked');if(typeof patch.template!=='boolean')problem('invalid_template');
  if(patch.eventId) s.eventId=eventId(patch.eventId);else delete s.eventId;
  l.text=string(patch.text,'text',LIMITS.text,lang==='en');l.format='Plain';if(patch.template)l.template=true;else delete l.template;l.revision++;
 }
 else if(patch.kind==='text'){if(s.dynamic)problem('dynamic_text_locked');l.text=string(patch.text,'text',LIMITS.text,lang==='en');l.format='Plain';l.revision++;}
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

// B2: optional templates preserve byte-compatible normalization of old B1 content.
export const BOT_CONTENT_RUNTIME=2;
export const EVENT_FACTS_SCHEMA='aelita.bot-event-facts/v1';
export const EVENT_FACTS_URL='https://api.aelita-production.ru/tickets/performances-list?bot=1';
export const BOT_RUNTIME_STATUS_URL='https://aelita-bot.kostyamoshnikov.workers.dev/notify/status';
export const TEMPLATE_VARIABLES=Object.freeze({
 'company.name':'Название компании','site.url':'Сайт на выбранном языке',
 'event.title':'Название события','event.date':'Дата','event.time':'Время','event.timezone':'Часовой пояс',
 'event.city':'Город','event.venue':'Площадка','event.address':'Адрес','event.format':'Формат участия',
 'event.price':'Цена из каталога','event.status':'Статус продажи','event.page_url':'Страница события','event.buy_url':'Ссылка покупки'
});
export function eventId(value){const s=string(value,'eventId',120);if(!/^[a-z][a-z0-9-]{1,119}$/i.test(s))problem('invalid_event');return s;}
export function validateTemplate(text,hasEvent=false){
 const found=[];const remaining=String(text).replace(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g,(_m,key)=>{if(!Object.hasOwn(TEMPLATE_VARIABLES,key))problem('unknown_variable',400,key);if(key.startsWith('event.')&&!hasEvent)problem('event_required');found.push(key);return'';});
 if(remaining.includes('{{')||remaining.includes('}}'))problem('invalid_variable');return found;
}
export function normalizeEventCatalog(value){
 if(!value||value.schema!==EVENT_FACTS_SCHEMA||!Array.isArray(value.events)||value.events.length>250||new TextEncoder().encode(JSON.stringify(value)).byteLength>1024*1024)problem('event_source_invalid',502);
 const ids=new Set();const events=value.events.map(e=>{
  if(!e||typeof e!=='object')problem('event_source_invalid',502);const id=eventId(e.id);if(ids.has(id)||e.timeZone!=='Europe/Moscow'||typeof e.salesOpen!=='boolean'||typeof e.canceled!=='boolean')problem('event_source_invalid',502);ids.add(id);
  if(e.canceled&&e.salesOpen||e.datetime===null&&e.salesOpen)problem('event_source_invalid',502);
  for(const key of ['datetime','endsAt'])if(e[key]!==null&&(typeof e[key]!=='string'||!Number.isFinite(Date.parse(e[key]))))problem('event_source_invalid',502);
  const next={id,datetime:e.datetime,endsAt:e.endsAt,timeZone:e.timeZone,canceled:e.canceled,salesOpen:e.salesOpen,ru:{},en:{}};
  for(const lang of ['ru','en']){
   const l=e[lang];if(!l||typeof l!=='object'||Array.isArray(l))problem('event_source_invalid',502);
   for(const [k,max]of Object.entries({title:180,city:80,venue:180,address:220,format:160,price:100,status:120}))next[lang][k]=string(l[k],lang+'.'+k,max,k!=='title');
   next[lang].pageURL=safeURL(l.pageURL);if(new URL(next[lang].pageURL).origin!=='https://aelita-production.ru')problem('event_source_invalid',502);
   if(l.fallbackFields!==undefined){if(!Array.isArray(l.fallbackFields)||l.fallbackFields.length>4||l.fallbackFields.some(k=>!['title','city','venue','address'].includes(k)))problem('event_source_invalid',502);if(l.fallbackFields.length)next[lang].fallbackFields=[...new Set(l.fallbackFields)].sort();}
   next[lang].buyURL=l.buyURL?safeURL(l.buyURL):'';if(!next.salesOpen&&next[lang].buyURL)problem('event_source_invalid',502);
  }return next;
 });return{schema:EVENT_FACTS_SCHEMA,events};
}
export function currentEvent(event,now=Date.now()){
 const copyEvent=clone(event),end=Date.parse(event.endsAt),start=Date.parse(event.datetime);
 if(event.canceled){copyEvent.salesOpen=false;copyEvent.ru.buyURL='';copyEvent.en.buyURL='';}
 else if(!Number.isFinite(start)||event.salesOpen&&Number.isFinite(end)&&now>=end){copyEvent.salesOpen=false;for(const lang of ['ru','en']){copyEvent[lang].buyURL='';copyEvent[lang].status=Number.isFinite(start)?(lang==='en'?'Booking closed':'Продажа закрыта'):(lang==='en'?'Date to be announced':'Дата будет объявлена');}}
 return copyEvent;
}
export function renderTemplate(text,event,lang='ru'){
 const keys=validateTemplate(text,!!event),local=event?.[lang],en=lang==='en',date=event?.datetime?new Date(event.datetime):null;
 const values={'company.name':'AELITA PRODUCTION','site.url':'https://aelita-production.ru/'+(en?'en/':''),
  'event.title':local?.title,'event.date':date?new Intl.DateTimeFormat(en?'en-GB':'ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'}).format(date):(en?'Date to be announced':'Дата будет объявлена'),
  'event.time':date?new Intl.DateTimeFormat(en?'en-GB':'ru-RU',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Europe/Moscow'}).format(date):'',
  'event.timezone':en?'MSK (UTC+3)':'МСК (UTC+3)', 'event.city':local?.city,'event.venue':local?.venue,'event.address':local?.address,'event.format':local?.format,'event.price':local?.price,'event.status':local?.status,'event.page_url':local?.pageURL,'event.buy_url':local?.buyURL};
 for(const k of keys)if(values[k]===undefined)problem('event_source_unavailable',503);
 const result=String(text).replace(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g,(_m,key)=>values[key]);if(result.length>LIMITS.text)problem('rendered_text_too_long');return result;
}
export function requiredRuntime(content){return Object.values(content.screens).some(s=>s.eventId||Object.values(s.locales).some(l=>l.template||l.buttons.some(b=>b.kind==='event')))?2:1;}
export function eventRefs(content){return[...new Set(Object.values(content.screens).filter(s=>s.eventId).map(s=>s.eventId))].sort();}
export function selectedFacts(content,catalog){
 const normalized=normalizeEventCatalog(catalog);return eventRefs(content).map(id=>{const e=normalized.events.find(e=>e.id===id);if(!e)problem('event_not_found',409,id);return e;});
}
export function validateEventViews(content,catalog,now=Date.now()){
 const events=selectedFacts(content,catalog).map(e=>currentEvent(e,now));for(const s of Object.values(content.screens))for(const lang of ['ru','en'])screenView(content,s.id,lang,s.eventId?currentEvent(events.find(e=>e.id===s.eventId),now):null);return events;
}
