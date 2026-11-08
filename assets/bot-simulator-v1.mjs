// Read-only bot menu simulation. The source of button layout and event facts
// remains the same domain model as the published bot; no network or I/O here.
import {screenView,currentEvent,normalizeEventCatalog,legacyPlain,renderTemplate,afishaAnnouncements,renderAfisha} from './bot-admin-domain.mjs?v=179';

// Matches publicHandle's routeScreen in _tools/Bot/Admin/controller.mjs.
export const ROUTE_SCREENS=Object.freeze({back:'welcome',lang_toggle:'welcome',meetings:'community',tickets_menu:'tickets_menu',afisha:'afisha',shows:'shows',shop:'shop',community:'community',book_concierge:'book_concierge',gift_card:'gift_card',about:'about',docs:'docs',collab:'collab',collab_business:'collab_business',collab_event:'collab_event',collab_venues:'collab_venues',collab_partners:'collab_partners',collab_investors:'collab_investors',collab_artists:'collab_artists',socials:'socials'});
const clone=x=>JSON.parse(JSON.stringify(x));

// A map of configured buttons, not a guarantee that external services or
// existing forms are available. Paths stay in the chosen language; changing
// language returns to the other language's main menu in the real bot.
export function scenarioMap(content,language='ru'){
 const lang=language==='en'?'en':'ru',screens=content?.screens;
 if(!screens||!Object.hasOwn(screens,'welcome'))throw{code:'screen_not_found'};
 const ids=Object.keys(screens),items=ids.map(id=>{
  const screen=screens[id],local=screen.locales[lang];
  const buttons=local.buttons.map((b,index)=>{
   let to=null,missing=false;
   if(b.kind==='screen'||b.kind==='route'&&Object.hasOwn(ROUTE_SCREENS,b.target)){
    const target=b.kind==='screen'?b.target:ROUTE_SCREENS[b.target];
    if(Object.hasOwn(screens,target))to=target;else missing=true;
   }
   return{label:b.label,kind:b.kind,target:b.target,visible:b.visible,to,missing,row:b.row,index,implicit:false};
  }).sort((a,b)=>a.row-b.row||a.index-b.index);
  // keyboard() inserts this return even when all configured buttons are hidden.
  if(id!=='welcome'&&!buttons.some(b=>b.visible&&b.kind==='route'&&b.target==='back'))
   buttons.push({label:lang==='en'?'Main menu':'Главное меню',kind:'route',target:'back',visible:true,to:'welcome',missing:false,implicit:true});
  return{id,label:screen.label,dynamic:!!screen.dynamic,buttons,path:null};
 });
 const byId=new Map(items.map(x=>[x.id,x])),queue=['welcome'];byId.get('welcome').path=[];
 for(let i=0;i<queue.length;i++){
  const current=byId.get(queue[i]);
  for(const b of current.buttons){
   if(!b.visible||!b.to)continue;
   const next=byId.get(b.to);if(next.path!==null)continue;
   next.path=[...current.path,{label:b.label,to:b.to}];queue.push(next.id);
  }
 }
 return{lang,items,reachable:items.filter(x=>x.path!==null).length};
}
export function createSimulation(content,{screen='welcome',lang='ru',now=()=>Date.now()}={}){
 const data=clone(content);let id=Object.hasOwn(data.screens,screen)?screen:'welcome',locale=lang==='en'?'en':'ru',catalog=null;
 if(!data.screens.welcome)throw{code:'screen_not_found'};
 function setCatalog(raw){catalog=normalizeEventCatalog(raw);}
 function reset(next='welcome',language=locale){id=Object.hasOwn(data.screens,next)?next:'welcome';locale=language==='en'?'en':'ru';}
 function get(){
  const source=data.screens[id],found=source.eventId&&catalog?.events.find(x=>x.id===source.eventId);
  if(source.eventId&&!found)return{id,lang:locale,kind:'event_unavailable',title:source.label,text:'Данные связанного события не загружены или событие не найдено. Обновите события для проверки.',media:null,buttons:[],events:[],hasCatalog:!!catalog};
  const event=found?currentEvent(found,now()):null,s=screenView(data,id,locale,event);
  const editedAfisha=s.dynamic&&afishaAnnouncements(data,locale)!==null;
  const text=editedAfisha?(catalog?renderAfisha(data,catalog,locale,now()):'События не загружены. Нажмите «Загрузить события», чтобы проверить полную афишу.\n\n'+(afishaAnnouncements(data,locale)||'Анонсы без даты скрыты.')):s.dynamic?'Афиша формируется в работающем боте из событий и анонсов. Ниже показана проверка датированных событий; старые анонсы здесь не воспроизводятся.':s.format==='Markdown'?legacyPlain(s.text):s.text||'Перевод пока не заполнен.';
  let events=[];
  if(s.dynamic&&!editedAfisha&&catalog){events=catalog.events.filter(x=>!x.canceled&&x.datetime&&Date.parse(x.endsAt||x.datetime)>now()).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime)).slice(0,4).map(raw=>{const e=currentEvent(raw,now()),v=e[locale];return{id:e.id,title:v.title,date:renderTemplate('{{event.date}} · {{event.time}} {{event.timezone}}',e,locale),city:v.city,status:v.status,details:v.pageURL};});}
  return{id,lang:locale,kind:editedAfisha?'afisha_text':s.dynamic?'afisha':'screen',title:s.label,text,...(s.entities?.length?{entities:s.entities}:{}),media:s.media?{type:s.media.type,name:s.media.name}:null,buttons:s.keyboard.inline_keyboard,events,hasCatalog:!!catalog};
 }
 function activate(button){
  const view=get(),all=view.buttons.flat();
  const allowed=all.find(x=>x.text===button?.text&&x.callback_data===button?.callback_data&&x.url===button?.url);
  if(!allowed)return{type:'unavailable'};
  if(allowed.url)return{type:'url',url:allowed.url};
  const raw=allowed.callback_data||'',index=raw.lastIndexOf('|');if(index<0)return{type:'unavailable'};
  const route=raw.slice(0,index),language=raw.slice(index+1)==='en'?'en':'ru';
  const target=route.startsWith('bc1:')?route.slice(4):ROUTE_SCREENS[route];
  if(target){reset(target,language);return{type:'screen',screen:id,lang:locale};}
  return{type:'action',name:route};
 }
 function details(eventId){const match=get().events.find(e=>e.id===eventId);return match?{type:'url',url:match.details}:{type:'unavailable'};}
 return{get,reset,activate,setCatalog,details};
}
