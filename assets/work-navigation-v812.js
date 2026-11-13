(function (root) {
  'use strict';
  const types = {contacts:'c', organizations:'o', projects:'p', tasks:'t', deals:'d'};
  const tabs = {
    crm: {workbench:'Порядок в базе',dashboard:'CRM · Обзор',calendar:'Календарь',projects:'Проекты и события',contacts:'Контакты',organizations:'Организации',tasks:'Задачи',deals:'Сделки',journal:'Журнал CRM',analytics:'Отчёты CRM',segments:'Сегменты',management:'Управление CRM',team:'Сотрудники'},
    admin: {participants:'Участники события',overview:'Обзор админки',statistics:'Статистика',orders:'Заказы',refunds:'Возвраты',shows:'Показы',invites:'Пригласительные',staff:'Контролёры',inbox:'Входящие',ai:'ИИ · Тест',news:'Рассылка',events:'Регистрации',clients:'Клиенты',money:'Подписки и карты',site:'Сайт'},
    bot: {home:'Админка бота'},
  };
  const paths={crm:'/admin/crm/',admin:'/admin/',bot:'/admin/bot/'};
  // Stable workflow order. Personal pins take precedence, never click tracking.
  const priority={
    admin:['overview','participants','shows','orders','invites','events','refunds','inbox','clients','news','statistics','money','staff','site','ai'],
    crm:['dashboard','tasks','contacts','organizations','deals','projects','calendar','segments','analytics','workbench','journal','management','team'],
  };
  function orderTabs(area,available,pins=[]){
    const allowed=[...new Set(available.filter(k=>tabValid(area,k)))],home=area==='crm'?'dashboard':'overview';
    const saved=[...new Set(pins)].filter(k=>k!==home&&allowed.includes(k)).slice(0,4);
    return [...new Set([home,...saved,...(priority[area]||[]),...allowed])].filter(k=>allowed.includes(k));
  }
  function prioritizeSections(container,spec){
    const chunks=[];let chunk;
    for(const node of [...container.children]){
      if(node.matches('p.sec-title')){chunk={title:node.textContent.trim(),tab:node.dataset.admTab,nodes:[]};chunks.push(chunk);}
      if(chunk)chunk.nodes.push(node);
    }
    for(const [tab,prefixes]of Object.entries(spec)){
      const blocks=chunks.filter(x=>x.tab===tab);if(blocks.length<2)continue;
      const rank=x=>{const n=prefixes.findIndex(p=>x.title.startsWith(p));return n<0?prefixes.length:n;};
      const marker=container.ownerDocument.createComment('working section order');blocks[0].nodes[0].before(marker);
      for(const block of [...blocks].sort((a,b)=>rank(a)-rank(b)))for(const node of block.nodes)marker.before(node);
      marker.remove();
    }
  }
  function mountNavPins(host,{area,available,labels,apply}){
    const home=area==='crm'?'dashboard':'overview',base=orderTabs(area,available),key='nav-pins:'+area;
    const choices=base.filter(k=>k!==home);let actor=null,pins=[];
    const doc=host.ownerDocument,summary=doc.createElement('summary'),intro=doc.createElement('p'),list=doc.createElement('div'),status=doc.createElement('p'),reset=doc.createElement('button');
    summary.textContent='Закрепить разделы';intro.textContent='До 4 разделов сразу после обзора. Порядок сохраняется для вашей учётной записи на этом устройстве.';intro.className='hint';list.className='work-nav-pin-options';status.setAttribute('role','status');reset.type='button';reset.textContent='Стандартный порядок';
    host.classList.add('work-nav-settings');host.append(summary,intro,list,reset,status);
    for(const k of choices){const label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.dataset.navPin=k;label.append(input,doc.createTextNode(' '+labels[k]));list.append(label);}
    const paint=()=>{for(const x of list.querySelectorAll('input'))x.checked=pins.includes(x.dataset.navPin);apply(orderTabs(area,base,pins));};
    function refresh(){const next=staff();if(next===actor)return;actor=next;const saved=read(key,{actor,durable:true});pins=Array.isArray(saved)?orderTabs(area,saved,saved).filter(k=>k!==home&&choices.includes(k)).slice(0,4):[];paint();status.textContent='';}
    function save(){const ok=write(key,pins,{actor,durable:true});paint();status.textContent=ok?'Порядок сохранён.':'Порядок применён в этой вкладке. Сохранение на устройстве недоступно.';}
    list.onchange=e=>{const k=e.target.dataset.navPin;if(!k)return;if(e.target.checked&&!pins.includes(k)){if(pins.length>=4){e.target.checked=false;status.textContent='Можно закрепить до 4 разделов.';return;}pins.push(k);}else pins=pins.filter(x=>x!==k);save();};
    reset.onclick=()=>{pins=[];save();};refresh();return{refresh};
  }
  const extraFilters={
    contacts:['city','sort','projectId','tag','contactRole','source'],
    organizations:['city','sort','projectId','organizationType'],
    projects:['city','sort','projectStatus','projectKind'],
    tasks:['projectId','status','overdue','dueWindow','openOnly'],
    deals:['projectId','pipeline','stage','venueMissing'],
    orders:['perf'], refunds:['status','perf'],
  };
  const ids=/^[a-zA-Z0-9_-]{1,120}$/;
  const recordValid=(type,id)=>Object.hasOwn(types,type)&&new RegExp('^'+types[type]+'_[a-f0-9]{24}$').test(id||'');
  const tabValid=(area,tab)=>Object.hasOwn(tabs,area)&&Object.hasOwn(tabs[area],tab);
  const tabUrl=(area,tab)=>tabValid(area,tab)?paths[area]+(area==='bot'?'':'#'+tab):'';
  const staff=()=>root.AelitaStaffSession?.read()?.user?.id||'';
  function read(key,{actor=staff(),durable=false}={}){
    if(!/^u_[a-f0-9]{24}$/.test(actor))return null;
    try{return JSON.parse((durable?root.localStorage:root.sessionStorage).getItem('aelita-work-v812:'+actor+':'+key));}catch{return null;}
  }
  function write(key,value,{actor=staff(),durable=false}={}){
    if(!/^u_[a-f0-9]{24}$/.test(actor))return false;
    try{
      const storage=durable?root.localStorage:root.sessionStorage;
      if(value==null)storage.removeItem('aelita-work-v812:'+actor+':'+key);
      else storage.setItem('aelita-work-v812:'+actor+':'+key,JSON.stringify(value));
      return true;
    }catch{return false;}
  }
  function filters(type,data,withSearch=false){
    const out={};
    const supported=extraFilters[type]||[];
    for(const key of [...(recordSection(type)?['ownerId','archived']:[]),...supported,...(withSearch?['search']:[])]){
      const value=data?.[key];
      if(key==='sort'&&value==='updated')continue;
      if(value===true)out[key]=true;
      else if(typeof value==='string'&&value.length<=160&&value.trim())out[key]=value;
    }
    return out;
  }
  const recordSection=type=>Object.hasOwn(types,type);
  const recordUrl=(type,id)=>{
    if(!recordValid(type,id))return '';
    return '/admin/crm/?workType='+type+'&workRecord='+id;
  };
  function parseRecent(kind,value){
    if(!value||typeof value!=='object')return null;
    if(kind==='order'&&typeof value.id==='string'&&ids.test(value.id))
      return {url:'/admin/?workOrder='+encodeURIComponent(value.id)+'#orders',label:'Открыть последний заказ'};
    if(kind==='newsletter'&&typeof value.id==='string'&&/^dr-[0-9a-z]{6,40}$/.test(value.id))
      return {url:'/admin/?workNewsletter='+encodeURIComponent(value.id)+'#news',label:'Продолжить черновик рассылки'};
    if(kind==='show'&&recordValid('deals',value.id))
      return {url:recordUrl('deals',value.id),label:'Открыть последний показ'};
    if(kind==='draft'){
      const url=recordUrl(value.type,value.id),recipient=value.recipient;
      if(!url||!['contacts','organizations','projects','deals'].includes(value.type))return null;
      if(!recordValid('contacts',recipient)&&!recordValid('organizations',recipient))return null;
      const q=new URLSearchParams({workDraft:recipient});
      if(recordValid('deals',value.show))q.set('workDraftShow',value.show);
      if(recordValid('organizations',value.organization))q.set('workDraftOrg',value.organization);
      if(/^ch_[a-f0-9]{24}$/.test(value.addressKey||''))q.set('workDraftChannel',value.addressKey);
      if(/^[a-f0-9]{64}$/.test(value.addressHash||''))q.set('workDraftHash',value.addressHash);
      if(!value.addressKey&&Number.isInteger(value.address)&&value.address>=0&&value.address<5)q.set('workDraftAddress',String(value.address));
      if(/^\d{13}-[a-f0-9]{24}$/.test(value.reply||''))q.set('workDraftReply',value.reply);
      return {url:url+'&'+q.toString(),label:'Продолжить черновик письма'};
    }
    return null;
  }
  function canPin(area,tab,user){
    if(!tabValid(area,tab)||!user||user.mustChange||!user.emailVerified)return false;
    if(area!=='crm')return user.adminAccess===true;
    if(['workbench','segments','management','team'].includes(tab)&&user.role!=='owner')return false;
    if(tab==='calendar')return ['tasks','deals'].some(t=>user.access?.sections?.[t]!=='none');
    return !recordSection(tab)||user.access?.sections?.[tab]!=='none';
  }
  const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
  const phone=value=>{const s=String(value||'').trim();return /^\+?[\d\s().-]+$/.test(s)&&s.replace(/\D/g,'').length>=7?s.replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7'):'';};
  function score(query,exact,heading,description){
    const q=norm(query),digits=phone(query);
    if(q.length<2)return 0;
    if(exact.some(value=>norm(value)===q||(digits&&phone(value)===digits)))return 4;
    const name=norm(heading);
    if(name===q)return 3;
    if(name.startsWith(q))return 2;
    return norm([heading,description,...exact].join(' ')).includes(q)?1:0;
  }
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function presets(area,type,options={}){
    const saved=read('presets:'+area+':'+type,{...options,durable:true});
    return Array.isArray(saved)?saved.filter(x=>x&&typeof x.name==='string'&&typeof x.id==='string').slice(0,12):[];
  }
  function savePresets(area,type,value,options={}){
    return write('presets:'+area+':'+type,value.slice(0,12),{...options,durable:true});
  }
  function mountPresets(el,{area,type,get,apply,reset,actor}){
    const options={actor};
    const button=(label,action)=>{const node=document.createElement('button');node.type='button';node.textContent=label;node.onclick=action;return node;};
    const select=document.createElement('select');
    select.setAttribute('aria-label','Сохранённые подборки');
    const feedback=document.createElement('span');feedback.setAttribute('role','status');
    const render=selected=>{
      select.replaceChildren(new Option('Сохранённые подборки',''));
      for(const p of presets(area,type,options))select.add(new Option(p.name,p.id));
      select.value=selected||'';
    };
    select.onchange=()=>{
      const value=presets(area,type,options).find(x=>x.id===select.value);
      if(value)apply(filters(type,value.filters));
    };
    const input=document.createElement('input');
    input.placeholder='Название подборки';input.maxLength=60;input.setAttribute('aria-label','Название подборки');
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent='Управление подборками';
    details.append(summary,input,button('Сохранить текущие фильтры',()=>{
      const name=input.value.trim(),current=filters(type,get());
      if(!name||!Object.keys(current).length){feedback.textContent='Укажите название и примените фильтры.';return;}
      const list=presets(area,type,options);
      const old=list.find(p=>p.name===name);
      if(!old&&list.length>=12){feedback.textContent='Удалите одну из 12 подборок.';return;}
      const id=old?.id||String(Date.now());
      if(!savePresets(area,type,[...list.filter(p=>p.id!==id),{id,name,filters:current}],options)){
        feedback.textContent='Не удалось сохранить подборку на этом устройстве.';return;
      }
      render(id);feedback.textContent='Подборка сохранена.';
    }),button('Удалить выбранную',()=>{
      const id=select.value;if(!id)return;
      if(savePresets(area,type,presets(area,type,options).filter(p=>p.id!==id),options)){
        render();feedback.textContent='Подборка удалена.';
      }
    }));
    el.classList.add('work-preset');
    el.append(select,button('Сбросить фильтры',()=>{select.value='';reset();}),details,feedback);
    render();
  }
  const api={read,write,filters,tabs,tabValid,tabUrl,recordValid,recordUrl,recordSection,parseRecent,canPin,score,norm,phone,escape,mountPresets,orderTabs,prioritizeSections,mountNavPins};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AelitaWork=api;
})(typeof window==='object'?window:globalThis);
