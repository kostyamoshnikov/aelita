import {scenarioMap} from './bot-simulator-v1.mjs?v=171';

// Derived view only: nodes and connections are never a second content store.
export function flowGraph(content,lang='ru'){
 const map=scenarioMap(content,lang),rows=new Map();
 const nodes=map.items.map(item=>{const column=item.path===null?4:Math.min(3,item.path.length),row=rows.get(column)||0;rows.set(column,row+1);return{...item,x:24+column*270,y:28+row*112};});
 const edges=nodes.flatMap(n=>n.buttons.filter(b=>b.visible&&b.to&&!b.implicit).map(b=>({from:n.id,to:b.to,label:b.label})));
 return{nodes,edges,width:1380,height:Math.max(240,...nodes.map(n=>n.y+100)),unreachable:nodes.filter(n=>n.path===null).map(n=>n.id)};
}
export function connectionPatch(content,source,lang,buttonId,target){
 const screen=content.screens[source],button=screen?.locales[lang]?.buttons.find(b=>b.id===buttonId);
 if(!button||!Object.hasOwn(content.screens,target))throw{code:'invalid_button'};
 return{kind:'button_target',screen:source,lang,buttonId,targetKind:'screen',target};
}
export function mountFlow(root,options){
 let view=options.view,lang=options.lang==='en'?'en':'ru',source=options.screen||'welcome',target='',selected='',picking=false,pending=false,alive=true;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const note=node('p');note.setAttribute('role','status');
 const tools=node('div');tools.className='ba-flow-tools';
 function field(title,input){const label=node('label',title);label.append(input);tools.append(label);return input;}
 const language=field('Язык',node('select')),sources=field('Исходный шаг',node('select')),buttons=field('Кнопка перехода',node('select')),targets=field('Куда перейти',node('select'));
 function choices(select,items,value){select.replaceChildren();for(const [id,label]of items){const o=node('option',label);o.value=id;select.append(o);}select.value=value;}
 choices(language,[['ru','Русский'],['en','English']],lang);
 const actions=node('div');actions.className='ed-actions';
 function action(label,fn){const b=node('button',label);b.type='button';b.className='ed-quiet';b.onclick=async()=>{if(pending)return;try{await fn();}catch(e){if(alive)note.textContent=options.error(e);} };actions.append(b);return b;}
 const pick=action('Выбрать назначение на схеме',()=>{picking=true;note.textContent='Нажмите нужный шаг на схеме. Затем подтвердите сохранение перехода.';});
 action('Сохранить переход в черновик',async()=>{
  const patch=connectionPatch(view.content,source,lang,selected,target);await mutate(patch);note.textContent='Переход сохранён в черновик. Проверьте сценарий перед публикацией.';
 });
 action('Текст и материалы шага',()=>options.edit(source,lang,'text'));
 action('Кнопки и действия шага',()=>options.edit(source,lang,'menu'));
 action('Пройти с этого шага',()=>options.simulate(source,lang));
 const name=node('input');name.maxLength=80;field('Название нового шага',name);
 action('Добавить шаг',async()=>{if(!name.value.trim())throw{code:'invalid_field'};const id=options.newId();await mutate({kind:'screen_add',id,label:name.value});source=id;target='';selected='';name.value='';render();note.textContent='Шаг создан в черновике. Задайте текст и добавьте входящую кнопку перехода.';});
 const viewport=node('div');viewport.className='ba-flow-viewport';viewport.setAttribute('tabindex','0');viewport.setAttribute('aria-label','Схема шагов; прокрутка в стороны. Те же шаги доступны в списках выше.');
 root.replaceChildren(tools,actions,note,viewport);
 async function mutate(patch){
  pending=true;for(const b of root.querySelectorAll('button,select,input'))b.disabled=true;
  try{const next=await options.change(view,patch);options.changed(next);if(!alive)return;view=next;render();}
  finally{pending=false;if(alive)for(const b of root.querySelectorAll('button,select,input'))b.disabled=false;}
 }
 function render(){
  if(!alive)return;const graph=flowGraph(view.content,lang),byId=new Map(graph.nodes.map(n=>[n.id,n]));if(!byId.has(source))source='welcome';
  choices(sources,graph.nodes.map(n=>[n.id,n.label]),source);
  const list=view.content.screens[source].locales[lang].buttons;if(!list.some(b=>b.id===selected))selected='';
  choices(buttons,[['','Выберите кнопку'],...list.map(b=>[b.id,b.label+(b.visible?'':' · скрыта')])],selected);
  choices(targets,[['','Выберите назначение'],...graph.nodes.map(n=>[n.id,n.label])],target);
  const old=list.find(b=>b.id===selected);note.textContent=(old?'Текущее назначение: '+({screen:'Шаг',route:'Существующее действие',url:'Ссылка',event:'Данные события',language:'Смена языка'}[old.kind]||'Действие')+' → '+(view.content.screens[old.target]?.label||old.target)+'. Новый переход заменит только назначение этой кнопки. ':'')+'Без пути из меню: '+graph.unreachable.length+'. Возврат в меню добавляется ботом. Схема не проверяет внешние сервисы.';
  viewport.replaceChildren();const ns='http://www.w3.org/2000/svg';
  const svg=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  const canvas=svg('svg',{width:graph.width,height:graph.height,viewBox:'0 0 '+graph.width+' '+graph.height,role:'group','aria-label':'Шаги и переходы'});
  for(const edge of graph.edges){const a=byId.get(edge.from),b=byId.get(edge.to);const path=svg('path',{d:`M${a.x+220},${a.y+40} C${a.x+260},${a.y+40} ${b.x-30},${b.y+40} ${b.x},${b.y+40}`,fill:'none',stroke:'#77684f','stroke-width':1.5});const title=svg('title');title.textContent=a.label+' → '+b.label+' · '+edge.label;path.append(title);canvas.append(path);const arrow=svg('path',{d:`M${b.x-7},${b.y+36} L${b.x},${b.y+40} L${b.x-7},${b.y+44}`,fill:'none',stroke:'#d6b57a'});canvas.append(arrow);}
  for(const n of graph.nodes){const group=svg('g',{role:'button',tabindex:0,'aria-label':n.label+(n.path===null?' · путь не найден':''),'aria-pressed':n.id===source});
   const rect=svg('rect',{x:n.x,y:n.y,width:220,height:80,rx:8,fill:n.id===source?'#443925':'#1b1b1e',stroke:n.id===target?'#92cda5':n.path===null?'#d18b77':'#d6b57a'});
   const title=svg('title');title.textContent=n.label;const text=svg('text',{x:n.x+12,y:n.y+30,fill:'#e8e6e1','font-size':14});text.textContent=n.label.length>25?n.label.slice(0,24)+'…':n.label;
   const sub=svg('text',{x:n.x+12,y:n.y+55,fill:'#c9b8a3','font-size':11});sub.textContent=n.dynamic?'События из каталога':n.path===null?'Нет пути из меню':'Кнопок: '+n.buttons.filter(b=>b.visible).length;
   const activate=()=>{if(pending)return;if(picking){target=n.id;picking=false;}else{source=n.id;selected='';}render();};group.onclick=activate;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};group.append(title,rect,text,sub);canvas.append(group);
  }viewport.append(canvas);
 }
 language.onchange=()=>{lang=language.value;selected='';target='';render();};sources.onchange=()=>{source=sources.value;selected='';render();};buttons.onchange=()=>{selected=buttons.value;render();};targets.onchange=()=>{target=targets.value;render();};
 render();return{destroy:()=>{alive=false;},get:()=>({view,source,target,selected,lang}),};
}
