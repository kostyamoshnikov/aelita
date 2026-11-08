import {scenarioMap} from './bot-simulator-v1.mjs?v=181';

export const FLOW_LIMIT=12000;
const ZOOMS=[['0.5','50%'],['0.75','75%'],['1','100%'],['1.25','125%'],['1.5','150%']];
// Reuse the existing shortest paths. Geometry is common to RU/EN and never
// rewrites transitions; a back button or cycle cannot create an infinite rank.
export function rankedPositions(content){
 const maps=['ru','en'].map(lang=>scenarioMap(content,lang)),depths=new Map();
 for(const map of maps)for(const item of map.items)if(item.path!==null)depths.set(item.id,Math.min(depths.get(item.id)??Infinity,item.path.length));
 const detached=Math.max(0,...depths.values())+1,rows=new Map(),out={};
 const ids=Object.keys(content.screens).sort((a,b)=>(depths.get(a)??detached)-(depths.get(b)??detached)||(a<b?-1:a>b?1:0));
 for(const id of ids){const depth=depths.get(id)??detached,row=rows.get(depth)||0;rows.set(depth,row+1);out[id]={x:24+depth*270,y:28+row*112};}
 return layoutPositions(out,ids);
}
const folded=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
export function searchFlow(content,query){
 const terms=folded(query).trim().slice(0,120).split(/\s+/).filter(Boolean);if(!terms.length)return[];
 return Object.keys(content.screens).filter(id=>{const s=content.screens[id],text=folded([id,s.label,...['ru','en'].flatMap(lang=>[s.locales[lang].text,...s.locales[lang].buttons.map(b=>b.label)])].join(' '));return terms.every(term=>text.includes(term));}).sort();
}
export function fitFlow(graph,width,height){
 const nodes=graph?.nodes;if(!Array.isArray(nodes)||!nodes.length||!Number.isFinite(width)||!Number.isFinite(height)||width<=48||height<=48||nodes.some(n=>!Number.isFinite(n.x)||!Number.isFinite(n.y)))return null;
 const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y)),right=Math.max(...nodes.map(n=>n.x+220)),bottom=Math.max(...nodes.map(n=>n.y+80));
 const zoom=Math.min(1,(width-48)/(right-x+48),(height-48)/(bottom-y+48));
 return{zoom,left:Math.max(0,x*zoom-24),top:Math.max(0,y*zoom-24)};
}
export function layoutPositions(value,ids){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>40)throw{code:'invalid_flow_layout'};
 const allowed=new Set(ids);return Object.fromEntries(Object.keys(value).sort().map(id=>{const p=value[id];if(!allowed.has(id))throw{code:'flow_layout_content_changed'};if(!p||Object.keys(p).sort().join(',')!=='x,y'||!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x<0||p.y<0||p.x>FLOW_LIMIT||p.y>FLOW_LIMIT)throw{code:'invalid_flow_layout'};return[id,{x:p.x,y:p.y}];}));
}
// Geometry does not create another content/transition store.
export function flowGraph(content,lang='ru',positions={}){
 const map=scenarioMap(content,lang),rows=new Map(),manual=layoutPositions(positions,Object.keys(content.screens));
 const nodes=map.items.map(item=>{const column=item.path===null?4:Math.min(3,item.path.length),row=rows.get(column)||0;rows.set(column,row+1);return{...item,x:manual[item.id]?.x??24+column*270,y:manual[item.id]?.y??28+row*112};});
 const edges=nodes.flatMap(n=>n.buttons.filter(b=>b.visible&&b.to&&!b.implicit).map(b=>({from:n.id,to:b.to,label:b.label})));
 return{nodes,edges,width:Math.max(1380,...nodes.map(n=>n.x+244)),height:Math.max(240,...nodes.map(n=>n.y+100)),unreachable:nodes.filter(n=>n.path===null).map(n=>n.id)};
}
// Bounded orthogonal candidates; routing affects only SVG geometry.
export function routeFlowEdge(nodes,edge){
 const a=nodes.find(n=>n.id===edge.from),b=nodes.find(n=>n.id===edge.to);if(!a||!b)return null;
 const start={x:a.x+220,y:a.y+40},end={x:b.x,y:b.y+40},out={x:start.x+12,y:start.y},entry={x:end.x-12,y:end.y};
 const fallback={clear:false,d:`M${start.x},${start.y} C${start.x+40},${start.y} ${end.x-30},${end.y} ${end.x},${end.y}`,points:[]};
 if(entry.x<0)return fallback;
 const blocked=(p,q,n)=>{const l=n.x-6,r=n.x+226,t=n.y-6,b=n.y+86;return p.x===q.x?p.x>l&&p.x<r&&Math.max(p.y,q.y)>t&&Math.min(p.y,q.y)<b:p.y===q.y?p.y>t&&p.y<b&&Math.max(p.x,q.x)>l&&Math.min(p.x,q.x)<r:true;};
 const compact=points=>points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);
 const valid=points=>points.every(p=>p.x>=0&&p.y>=0)&&points.slice(1).every((q,i)=>!nodes.some(n=>(i!==0||n.id!==a.id)&&(i!==points.length-2||n.id!==b.id)&&blocked(points[i],q,n)));
 const candidates=[],add=middle=>{const points=compact([start,out,...middle,entry,end]);candidates.push({points,length:points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0)});};
 add([{x:entry.x,y:out.y}]);add([{x:out.x,y:entry.y}]);
 const lanes=(values,origin)=>[...new Set(values)].filter(v=>v>=0).sort((x,y)=>Math.abs(x-origin)-Math.abs(y-origin)||x-y).slice(0,14);
 for(const y of lanes(nodes.flatMap(n=>[n.y-12,n.y+92]),out.y))add([{x:out.x,y},{x:entry.x,y}]);
 for(const x of lanes(nodes.flatMap(n=>[n.x-12,n.x+232]),out.x))add([{x,y:out.y},{x,y:entry.y}]);
 candidates.sort((x,y)=>x.length-y.length||x.points.length-y.points.length);
 const found=candidates.find(c=>valid(c.points));if(!found)return fallback;
 return{clear:true,points:found.points,d:found.points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')};
}

export function flowNeighborhood(graph,id){const incoming=graph.edges.filter(e=>e.to===id),outgoing=graph.edges.filter(e=>e.from===id);return{incoming,outgoing,nodes:new Set([id,...incoming.map(e=>e.from),...outgoing.map(e=>e.to)])};}
export function connectionPatch(content,source,lang,buttonId,target){
 const screen=content.screens[source],button=screen?.locales[lang]?.buttons.find(b=>b.id===buttonId);
 if(!button||!Object.hasOwn(content.screens,target))throw{code:'invalid_button'};
 return{kind:'button_target',screen:source,lang,buttonId,targetKind:'screen',target};
}
export function mountFlow(root,options){
 let view=options.view,lang=options.lang==='en'?'en':'ru',source=options.screen||'welcome',target='',selected='',picking=false,pending=false,alive=true;
 let focusLinks=false;
 let positions={},base={},revision=0,remote=null,ready=false,loading=false,moving=false,zoom=1,operation=null,suppress=false,drag=null,scene=null,beforeArrange=null;
 const copy=x=>JSON.parse(JSON.stringify(x)),ids=()=>Object.keys(view.content.screens),clean=p=>layoutPositions(p,ids()),same=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b)),dirty=()=>!same(positions,base);
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const note=node('p');note.setAttribute('role','status');
 const tools=node('div');tools.className='ba-flow-tools';
 function field(title,input){const label=node('label',title);label.append(input);tools.append(label);return input;}
 const language=field('Язык',node('select')),sources=field('Исходный шаг',node('select')),buttons=field('Кнопка перехода',node('select')),targets=field('Куда перейти',node('select'));
 function choices(select,items,value){select.replaceChildren();for(const [id,label]of items){const o=node('option',label);o.value=id;select.append(o);}select.value=value;}
 choices(language,[['ru','Русский'],['en','English']],lang);
 const actions=node('div');actions.className='ed-actions';
 function action(label,fn){const b=node('button',label);b.type='button';b.className='ed-quiet';b.onclick=async()=>{if(pending||!alive)return;try{await fn();}catch(e){if(alive)note.textContent=options.error(e);} };actions.append(b);return b;}
 action('Выбрать назначение на схеме',()=>{picking=true;moving=false;renderControls();note.textContent='Нажмите нужный шаг на схеме. Затем подтвердите сохранение перехода.';});
 action('Сохранить переход в черновик',async()=>{await mutate(connectionPatch(view.content,source,lang,selected,target));note.textContent='Переход сохранён в черновик. Проверьте сценарий перед публикацией.';});
 action('Текст и материалы шага',()=>options.edit(source,lang,'text'));
 action('Кнопки и действия шага',()=>options.edit(source,lang,'menu'));
 action('Пройти с этого шага',()=>options.simulate(source,lang));
 const name=node('input');name.maxLength=80;name.className='ym-disable-keys';field('Название нового шага',name);
 const search=field('Найти исходный шаг',node('input'));search.type='search';search.maxLength=120;search.className='ym-disable-keys';search.placeholder='Название, текст или подпись кнопки';
 const searchResults=node('div');searchResults.className='ba-flow-search-results';tools.append(searchResults);
 action('Добавить шаг',async()=>{if(!name.value.trim())throw{code:'invalid_field'};const id=options.newId();await mutate({kind:'screen_add',id,label:name.value});source=id;target='';selected='';name.value='';render();note.textContent='Шаг создан в черновике. Задайте текст и добавьте входящую кнопку перехода.';});
 const moveMode=action('Перемещать шаги',()=>{moving=!moving;picking=false;renderControls();note.textContent=moving?'Перетащите шаг или выберите его и используйте стрелки (Shift — быстрее). Сохранение расположения отдельно.':'Перемещение выключено. Схему можно прокручивать.';});
 const x=field('Координата X выбранного шага',node('input')),y=field('Координата Y выбранного шага',node('input'));for(const n of [x,y]){n.type='number';n.min='0';n.max=String(FLOW_LIMIT);n.step='10';n.className='ym-disable-keys';}
 action('Переместить выбранный шаг',()=>{move(source,Number(x.value),Number(y.value));});
 const scale=field('Масштаб схемы',node('select'));choices(scale,ZOOMS,String(zoom));scale.onchange=()=>{zoom=Number(scale.value);render();};
 function setZoom(value){zoom=value;const key=String(value);choices(scale,ZOOMS.some(x=>x[0]===key)?ZOOMS:[...ZOOMS,[key,'Вся схема · ≈'+Math.round(value*1000)/10+'%']],key);}
 function centerStep(){const n=flowGraph(view.content,lang,positions).nodes.find(n=>n.id===source);viewport.scrollTo?.({left:Math.max(0,n.x*zoom-viewport.clientWidth/2+110*zoom),top:Math.max(0,n.y*zoom-viewport.clientHeight/2+40*zoom),behavior:'auto'});}
 action('Показать выбранный шаг',centerStep);
 const fit=action('Вся схема',()=>{const v=fitFlow(flowGraph(view.content,lang,positions),viewport.clientWidth,viewport.clientHeight);if(!v)throw{code:'invalid_field'};setZoom(v.zoom);render();viewport.scrollTo?.({left:v.left,top:v.top,behavior:'auto'});note.textContent='Показаны все шаги. Для чтения отдельного шага найдите его по названию или тексту.';});
 const focusToggle=action('Выделить связи выбранного шага',()=>{focusLinks=!focusLinks;render();});
 const neighbors=node('div');neighbors.className='ba-flow-neighbors';tools.append(neighbors);
 const importFile=field('Загрузить расположение из JSON',node('input'));importFile.type='file';importFile.accept='application/json,.json';
 importFile.onchange=async()=>{const file=importFile.files?.[0];importFile.value='';if(!file||pending||loading)return;try{if(file.size>64*1024)throw{code:'invalid_flow_layout'};const d=JSON.parse(await file.text());if(!alive)return;if(d.schema!=='aelita.bot-flow-local/v1')throw{code:'invalid_flow_layout'};positions=clean(d.positions);changed();render();note.textContent='Расположение из файла загружено в эту вкладку. Сверьте и сохраните отдельно.';}catch(e){if(alive)note.textContent=options.error(e.code?e:{code:'invalid_flow_layout'});}};
 const savedNote=node('p');savedNote.setAttribute('role','status');savedNote.className='ed-note';tools.append(savedNote);
 const saveLayout=action('Сохранить расположение',async()=>{
  if(options.canSaveLayout===false)throw{code:'bot_access_denied'};if(!ready||!options.saveLayout)throw{code:'flow_layout_unavailable'};if(!dirty())return;
  const payload=clean(positions);operation??={id:options.newOperation(),revision,positions:copy(payload)};
  pending=true;renderControls();try{const d=await options.saveLayout(copy(operation));if(!alive)return;accept(d);options.local?.clear();render();note.textContent=d.alreadyApplied?'Операция уже учтена. Загружено текущее сохранённое расположение.':'Расположение сохранено. Содержание и публикация бота не менялись.';}finally{pending=false;if(alive)renderControls();}
 });
 const loadSaved=action('Взять сохранённое расположение',async()=>{await load(true);});
 action('Автоматическая раскладка',()=>{positions={};changed();render();note.textContent='Автоматическая раскладка в этой вкладке. Для сохранения нажмите «Сохранить расположение».';});
 const arrange=action('Разложить по переходам',()=>{if(loading)throw{code:'flow_layout_unavailable'};beforeArrange=copy(positions);positions=rankedPositions(view.content);changed(true);render();note.textContent='Шаги разложены по уровням без наложения узлов. Линии могут пересекаться. Расположение изменено только в этой вкладке: можно отменить или сохранить отдельно.';});
 const undoArrange=action('Отменить раскладку',()=>{if(beforeArrange===null)return;positions=clean(beforeArrange);beforeArrange=null;changed();render();note.textContent='Восстановлено расположение до раскладки. Сохранение отдельно.';});
 const restore=action('Восстановить локальное расположение',()=>{const d=options.local?.read();if(!d||d.schema!=='aelita.bot-flow-local/v1')throw{code:'invalid_flow_layout'};positions=clean(d.positions);changed();render();note.textContent='Локальное расположение восстановлено. Сверьте схему перед сохранением.';});
 const download=action('Скачать расположение',()=>options.download?.({schema:'aelita.bot-flow-local/v1',revision,positions:clean(positions)}));
 const history=node('div');history.className='ed-actions';tools.append(history);
 action('История расположения',()=>{history.replaceChildren();for(const h of remote?.history||[]){const b=node('button','Ревизия '+h.revision+(h.savedAt?' · '+new Date(h.savedAt).toLocaleString('ru-RU'): ' · автоматическая'));b.type='button';b.className='ed-quiet';b.onclick=()=>{if(pending||!alive)return;positions=clean(h.positions);changed();render();note.textContent='Прежнее расположение загружено в эту вкладку. Сохранение отдельно.';};history.append(b);}if(!history.children.length)history.textContent='Прежних сохранённых расположений пока нет.';});
 const viewport=node('div');viewport.className='ba-flow-viewport';viewport.setAttribute('tabindex','0');viewport.setAttribute('aria-label','Схема шагов. Прокручивайте или включите перемещение. Шаги и координаты доступны в списках выше.');
 root.replaceChildren(tools,actions,note,viewport);
 function backup(){options.local?.write({schema:'aelita.bot-flow-local/v1',revision,positions:clean(positions)});}
 function changed(keepArrangement=false){if(!keepArrangement)beforeArrange=null;operation=null;backup();renderControls();}
 function move(id,nx,ny){if(loading)throw{code:'flow_layout_unavailable'};if(!ids().includes(id)||!Number.isFinite(nx)||!Number.isFinite(ny)||nx<0||ny<0||nx>FLOW_LIMIT||ny>FLOW_LIMIT||!Number.isInteger(nx)||!Number.isInteger(ny))throw{code:'invalid_flow_layout'};positions={...positions,[id]:{x:nx,y:ny}};changed();render();}
 function accept(d){if(d.layoutVersion!==1||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.history))throw{code:'flow_layout_unavailable'};positions=clean(d.positions);base=copy(positions);revision=d.revision;remote=d;operation=null;beforeArrange=null;ready=true;}
 async function load(explicit=false){
  if(!options.loadLayout)return;loading=true;renderControls();try{const d=await options.loadLayout();if(!alive)return;accept(d);render();if(explicit)note.textContent='Сохранённое расположение загружено. Несохранённую локальную копию можно восстановить отдельно.';}catch(e){if(alive){ready=false;note.textContent=options.error(e);}}finally{loading=false;if(alive)renderControls();}
 }
 function renderControls(){
  focusToggle.setAttribute('aria-pressed',String(focusLinks));focusToggle.disabled=pending||loading;
  moveMode.setAttribute('aria-pressed',String(moving));viewport.setAttribute('data-move',String(moving));
  savedNote.textContent=(dirty()?'Расположение изменено только в этой вкладке. ':'')+(ready?'Сохранённая ревизия: '+revision+(remote?.savedAt?' · '+new Date(remote.savedAt).toLocaleString('ru-RU'):'')+'.':loading?'Читаем расположение…':'Сохранение расположения недоступно. Можно скачать локальную копию.')+' Общее для RU/EN; переходы и тексты сохраняются отдельно.';
  saveLayout.disabled=pending||loading||!ready||!dirty()||options.canSaveLayout===false;loadSaved.disabled=pending||loading||!options.loadLayout;restore.disabled=pending||loading||!options.local?.read();download.disabled=pending||!options.download;moveMode.disabled=pending||loading;importFile.disabled=pending||loading;x.disabled=y.disabled=pending||loading;
  arrange.disabled=pending||loading;undoArrange.disabled=pending||loading||beforeArrange===null;fit.disabled=pending||loading;search.disabled=pending;
 }
 async function mutate(patch){pending=true;for(const b of root.querySelectorAll('button,select,input'))b.disabled=true;try{const next=await options.change(view,patch);options.changed(next);if(!alive)return;view=next;beforeArrange=null;render();}finally{pending=false;if(alive){for(const b of root.querySelectorAll('button,select,input'))b.disabled=false;renderControls();}}}
 function renderSearch(){
  searchResults.replaceChildren();const ids=searchFlow(view.content,search.value),summary=node('p',search.value.trim()?'Найдено шагов: '+ids.length+'.':'Поиск по RU/EN: выберите результат, чтобы показать исходный шаг.');summary.setAttribute('role','status');searchResults.append(summary);
  for(const id of ids){const b=node('button',view.content.screens[id].label);b.type='button';b.className='ed-quiet';b.setAttribute('aria-pressed',String(id===source));b.disabled=pending;b.onclick=()=>{if(!alive||pending||!view.content.screens[id])return;source=id;selected='';picking=false;if(zoom<.5)setZoom(1);render();centerStep();viewport.scrollIntoView?.({block:'nearest'});scene.groups.get(id)?.focus?.({preventScroll:true});};searchResults.append(b);}
 }
 search.oninput=renderSearch;
 function render(){
  if(!alive)return;const graph=flowGraph(view.content,lang,positions),byId=new Map(graph.nodes.map(n=>[n.id,n]));if(!byId.has(source))source='welcome';
  const neighborhood=flowNeighborhood(graph,source);neighbors.replaceChildren();const connectionInfo=node('p','Связи шага «'+byId.get(source).label+'»: входящих '+neighborhood.incoming.length+', исходящих '+neighborhood.outgoing.length+'. Показаны видимые переходы текущего языка; автоматический возврат в меню здесь не учитывается.');connectionInfo.setAttribute('role','status');neighbors.append(connectionInfo);
  for(const [direction,edges]of [['Входящий',neighborhood.incoming],['Исходящий',neighborhood.outgoing]])for(const edge of edges){const next=direction==='Входящий'?edge.from:edge.to,b=node('button',direction+': '+byId.get(next).label+' · '+edge.label);b.type='button';b.className='ed-quiet';b.disabled=pending||loading;b.onclick=()=>{if(!alive||pending||loading)return;source=next;selected='';picking=false;if(zoom<.5)setZoom(1);render();centerStep();scene.groups.get(next)?.focus?.({preventScroll:true});};neighbors.append(b);}
  choices(sources,graph.nodes.map(n=>[n.id,n.label]),source);const list=view.content.screens[source].locales[lang].buttons;if(!list.some(b=>b.id===selected))selected='';
  choices(buttons,[['','Выберите кнопку'],...list.map(b=>[b.id,b.label+(b.visible?'':' · скрыта')])],selected);choices(targets,[['','Выберите назначение'],...graph.nodes.map(n=>[n.id,n.label])],target);
  const old=list.find(b=>b.id===selected);note.textContent=(old?'Текущее назначение: '+({screen:'Шаг',route:'Существующее действие',url:'Ссылка',event:'Данные события',language:'Смена языка'}[old.kind]||'Действие')+' → '+(view.content.screens[old.target]?.label||old.target)+'. Новый переход заменит только назначение этой кнопки. ':'')+'Без пути из меню: '+graph.unreachable.length+'. Возврат в меню добавляется ботом. Схема не проверяет внешние сервисы.';
  x.value=String(byId.get(source).x);y.value=String(byId.get(source).y);renderControls();renderSearch();
  viewport.replaceChildren();const ns='http://www.w3.org/2000/svg',svg=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  const canvas=svg('svg',{width:graph.width*zoom,height:graph.height*zoom,viewBox:'0 0 '+graph.width+' '+graph.height,role:'group','aria-label':'Шаги и переходы'}),edgeNodes=[],groups=new Map();
  const routingNote=node('p');routingNote.className='ed-note';routingNote.setAttribute('role','status');neighbors.append(routingNote);
  function geometry(quick=false){let unresolved=0;const routes=new Map();for(const [id,g]of groups){const n=byId.get(id);g.setAttribute('transform',`translate(${n.x} ${n.y})`);}for(const {edge,path,arrow}of edgeNodes){const a=byId.get(edge.from),b=byId.get(edge.to),key=edge.from+'\0'+edge.to;let route=routes.get(key);if(!route){route=quick?null:routeFlowEdge(graph.nodes,edge);routes.set(key,route);}path.setAttribute('d',route?.d||`M${a.x+220},${a.y+40} C${a.x+260},${a.y+40} ${b.x-30},${b.y+40} ${b.x},${b.y+40}`);path.setAttribute('stroke-dasharray',route&&!route.clear?'5 4':'none');if(route&&!route.clear)unresolved++;arrow.setAttribute('d',`M${b.x-7},${b.y+36} L${b.x},${b.y+40} L${b.x-7},${b.y+44}`);}routingNote.textContent=quick?'Во время перемещения показаны упрощённые линии.':unresolved?'Для '+unresolved+' переходов свободный маршрут не найден — они показаны пунктиром. Раздвиньте карточки. Пересечения линий между собой возможны.':'Линии проложены в обход карточек с зазором. Пересечения линий между собой возможны.';}
  for(const edge of graph.edges){const a=byId.get(edge.from),b=byId.get(edge.to),active=edge.from===source||edge.to===source,path=svg('path',{fill:'none',stroke:focusLinks&&active?'#f0cc88':'#77684f','stroke-width':focusLinks&&active?3:1.5,opacity:focusLinks&&!active?0.15:1}),title=svg('title');title.textContent=a.label+' → '+b.label+' · '+edge.label;path.append(title);canvas.append(path);const arrow=svg('path',{fill:'none',stroke:'#d6b57a',opacity:focusLinks&&!active?0.15:1});canvas.append(arrow);edgeNodes.push({edge,path,arrow});}
  for(const n of graph.nodes){const group=svg('g',{opacity:focusLinks&&!neighborhood.nodes.has(n.id)?0.45:1,role:'button',tabindex:0,'aria-label':n.label+(n.path===null?' · путь не найден':''),'aria-pressed':n.id===source});groups.set(n.id,group);
   const rect=svg('rect',{x:0,y:0,width:220,height:80,rx:8,fill:n.id===source?'#443925':'#1b1b1e',stroke:n.id===target?'#92cda5':n.path===null?'#d18b77':'#d6b57a'}),title=svg('title');title.textContent=n.label;
   const text=svg('text',{x:12,y:30,fill:'#e8e6e1','font-size':14});text.textContent=n.label.length>25?n.label.slice(0,24)+'…':n.label;const sub=svg('text',{x:12,y:55,fill:'#c9b8a3','font-size':11});sub.textContent=n.dynamic?'События из каталога':n.path===null?'Нет пути из меню':'Кнопок: '+n.buttons.filter(b=>b.visible).length;
   const activate=()=>{if(pending||suppress||!alive)return;if(picking){target=n.id;picking=false;}else{source=n.id;selected='';}render();scene.groups.get(n.id)?.focus?.();};group.onclick=activate;
   group.onkeydown=e=>{if(pending||loading||!alive)return;if(moving&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();source=n.id;const step=e.shiftKey?50:10;move(n.id,Math.max(0,Math.min(FLOW_LIMIT,n.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),Math.max(0,Math.min(FLOW_LIMIT,n.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0))));scene.groups.get(n.id)?.focus?.();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};
   const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*graph.width/r.width,y:(e.clientY-r.top)*graph.height/r.height};};
   group.onpointerdown=e=>{if(!moving||picking||pending||loading||drag||e.button!==0||e.isPrimary===false||!alive)return;const p=point(e);drag={id:n.id,pointer:e.pointerId,start:p,x:n.x,y:n.y,moved:false,original:positions[n.id]?copy(positions[n.id]):null};group.setPointerCapture?.(e.pointerId);e.preventDefault();};
   group.onpointermove=e=>{if(!drag||drag.id!==n.id||drag.pointer!==e.pointerId||!alive)return;const p=point(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<4)return;drag.moved=true;source=n.id;positions={...positions,[n.id]:{x:Math.max(0,Math.min(FLOW_LIMIT,Math.round((drag.x+dx)/10)*10)),y:Math.max(0,Math.min(FLOW_LIMIT,Math.round((drag.y+dy)/10)*10))}};Object.assign(n,positions[n.id]);geometry(true);x.value=String(n.x);y.value=String(n.y);renderControls();e.preventDefault();};
   const finish=(e,cancel=false)=>{if(!drag||drag.id!==n.id||drag.pointer!==e.pointerId)return;const d=drag;drag=null;group.releasePointerCapture?.(e.pointerId);if(!alive)return;if(cancel){if(d.original)positions={...positions,[n.id]:d.original};else{positions={...positions};delete positions[n.id];}}else if(d.moved)changed();if(d.moved){suppress=true;setTimeout(()=>{suppress=false;},0);render();scene.groups.get(n.id)?.focus?.();note.textContent=cancel?'Перемещение отменено.':'Шаг перемещён в этой вкладке. Сохранение расположения отдельно.';}};
   group.onpointerup=e=>finish(e);group.onpointercancel=e=>finish(e,true);group.onlostpointercapture=e=>finish(e,true);
   group.append(title,rect,text,sub);canvas.append(group);
  }geometry();viewport.append(canvas);scene={canvas,groups};
 }
 language.onchange=()=>{lang=language.value;selected='';target='';render();};sources.onchange=()=>{source=sources.value;selected='';render();};buttons.onchange=()=>{selected=buttons.value;render();};targets.onchange=()=>{target=targets.value;render();};
 render();const loaded=options.loadLayout?load():Promise.resolve();return{ready:loaded,destroy:()=>{alive=false;drag=null;},get:()=>({view,source,target,selected,lang,positions:copy(positions),revision,dirty:dirty(),moving,zoom,focusLinks}),};
}
