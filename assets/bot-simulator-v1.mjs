// Read-only bot menu simulation. The source of button layout and event facts
// remains the same domain model as the published bot; no network or I/O here.
import {screenView,currentEvent,normalizeEventCatalog,legacyPlain,renderTemplate} from './bot-admin-domain.mjs?v=167';

// Matches publicHandle's routeScreen in _tools/Bot/Admin/controller.mjs.
export const ROUTE_SCREENS=Object.freeze({back:'welcome',lang_toggle:'welcome',meetings:'community',tickets_menu:'tickets_menu',afisha:'afisha',shows:'shows',shop:'shop',community:'community',book_concierge:'book_concierge',gift_card:'gift_card',about:'about',docs:'docs',collab:'collab',collab_business:'collab_business',collab_event:'collab_event',collab_venues:'collab_venues',collab_partners:'collab_partners',collab_investors:'collab_investors',collab_artists:'collab_artists',socials:'socials'});
const clone=x=>JSON.parse(JSON.stringify(x));
export function createSimulation(content,{screen='welcome',lang='ru',now=()=>Date.now()}={}){
 const data=clone(content);let id=Object.hasOwn(data.screens,screen)?screen:'welcome',locale=lang==='en'?'en':'ru',catalog=null;
 if(!data.screens.welcome)throw{code:'screen_not_found'};
 function setCatalog(raw){catalog=normalizeEventCatalog(raw);}
 function reset(next='welcome',language=locale){id=Object.hasOwn(data.screens,next)?next:'welcome';locale=language==='en'?'en':'ru';}
 function get(){
  const source=data.screens[id],found=source.eventId&&catalog?.events.find(x=>x.id===source.eventId);
  if(source.eventId&&!found)return{id,lang:locale,kind:'event_unavailable',title:source.label,text:'Данные связанного события не загружены или событие не найдено. Обновите события для проверки.',media:null,buttons:[],events:[],hasCatalog:!!catalog};
  const event=found?currentEvent(found,now()):null,s=screenView(data,id,locale,event);
  const text=s.dynamic?'Афиша формируется в работающем боте из событий и анонсов. Ниже показана проверка датированных событий; старые анонсы здесь не воспроизводятся.':s.format==='Markdown'?legacyPlain(s.text):s.text||'Перевод пока не заполнен.';
  let events=[];
  if(s.dynamic&&catalog){events=catalog.events.filter(x=>!x.canceled&&x.datetime&&Date.parse(x.endsAt||x.datetime)>now()).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime)).slice(0,4).map(raw=>{const e=currentEvent(raw,now()),v=e[locale];return{id:e.id,title:v.title,date:renderTemplate('{{event.date}} · {{event.time}} {{event.timezone}}',e,locale),city:v.city,status:v.status,details:v.pageURL};});}
  return{id,lang:locale,kind:s.dynamic?'afisha':'screen',title:s.label,text,media:s.media?{type:s.media.type,name:s.media.name}:null,buttons:s.keyboard.inline_keyboard,events,hasCatalog:!!catalog};
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
