(function(){
 'use strict';
 const dayMs=86400000,moscowMs=10800000;
 const kinds={window:'Гастрольное окно',planned:'План',confirmed:'Подтверждённый показ',public:'Публичное событие',history:'Прежняя дата',task:'Задача',obligation:'Обязательство'};
 const statuses={window:'Обсуждается',planned:'Планируется',confirmed:'Подтверждено',published:'Опубликовано',postponed:'Перенесено',canceled:'Отменено',historical:'История',open:'Открыта',in_progress:'В работе',done:'Выполнена',cancelled:'Отменена'};
 const modes={list:'Список',week:'Неделя',month:'Месяц'};
 const conflict={confirmed:'Пересечение',time:'Проверьте время',possible:'Возможное пересечение'};
 const time=(v,zone)=>new Intl.DateTimeFormat('ru-RU',{timeStyle:'short',timeZone:zone}).format(new Date(v));
 const utc=d=>Date.parse(d+'T00:00:00Z');
 const iso=ms=>new Date(ms).toISOString().slice(0,10);
 const today=()=>iso(Date.now()+moscowMs);
 const pretty=d=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeZone:'UTC'}).format(utc(d));
 const dateOk=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(utc(d))&&iso(utc(d))===d;
 function range(mode,anchor){
  const ms=utc(dateOk(anchor)?anchor:today()),d=new Date(ms);
  if(mode==='list')return {from:iso(ms),to:iso(ms+6*dayMs)};
  if(mode==='week'){
   const start=ms-((d.getUTCDay()+6)%7)*dayMs;
   return {from:iso(start),to:iso(start+6*dayMs)};
  }
  const start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
  const end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)-dayMs;
  return {from:iso(start),to:iso(end)};
 }
 function defaults(){
  const mode=window.matchMedia('(max-width:700px)').matches?'list':'week';
  return {mode,...range(mode,today())};
 }
 function mount(root,{api,esc,lookups,filters,active,open,remember}){
  let query={...filters},items=[],result=null,generation=0;
  const option=(v,l,current)=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(l)+'</option>';
  const options=(list,value)=>option('','Все',value)+list.map(x=>option(x.id,x.label,value)).join('');
  const sel=(key,label,list)=>'<label><span>'+label+'</span><select name="'+key+'">'+options(list,query[key])+'</select></label>';
  const enumeration=o=>Object.entries(o).map(([id,label])=>({id,label}));
  const selectedDeals=()=>lookups.deals.filter(d=>d.show&&!d.archived&&(!query.projectId||d.projectId===query.projectId));
  const places=()=>lookups.organizations.filter(x=>!x.archived);
  const btn=(key,text)=>'<button type="button" data-cal-action="'+key+'">'+text+'</button>';
  function layout(){
   root.innerHTML='<h1>Календарь</h1><p class="hint">Даты и сроки по Москве. Для показа в другом часовом поясе рядом указано местное время.</p>'+
    '<div class="actions" aria-label="Режим календаря">'+Object.entries(modes).map(([k,v])=>'<button type="button" data-cal-mode="'+k+'" aria-pressed="'+(query.mode===k)+'">'+v+'</button>').join('')+'</div>'+
    '<div class="row between crm-calendar-range">'+btn('prev','‹ Предыдущий')+'<strong>'+esc(pretty(query.from))+' — '+esc(pretty(query.to))+'</strong>'+btn('next','Следующий ›')+'</div>'+
    '<details class="panel crm-calendar-filters" '+(query.filtersOpen?'open':'')+'><summary>Период и фильтры</summary><form class="form-grid">'+
    '<label><span>С даты</span><input name="from" type="date" value="'+esc(query.from)+'" required></label><label><span>По дату</span><input name="to" type="date" value="'+esc(query.to)+'" required></label>'+
    sel('projectId','Проект',lookups.projects.filter(x=>!x.archived))+sel('dealId','Показ',selectedDeals())+sel('venueId','Площадка',places())+
    '<label><span>Город</span><input name="city" maxlength="120" value="'+esc(query.city||'')+'"></label>'+
    sel('ownerId','Ответственный',lookups.staffLabels||lookups.staff)+sel('kind','Тип записи',enumeration(kinds))+sel('status','Статус',enumeration(statuses))+
    '<label class="row"><input name="overdue" type="checkbox" '+(query.overdue?'checked':'')+'>Только просроченные</label>'+
    '<label class="row"><input name="conflict" type="checkbox" '+(query.conflict?'checked':'')+'>Только пересечения</label>'+
    '<div class="actions full"><button type="submit" class="primary">Применить</button>'+btn('clear','Сбросить')+'</div></form></details>'+
    '<div data-calendar-body aria-live="polite"></div>';
   const details=root.querySelector('details'),form=details.querySelector('form');
   details.addEventListener('toggle',()=>{query.filtersOpen=details.open;remember(query);});
   form.elements.projectId.addEventListener('change',()=>{
    const pid=form.elements.projectId.value,list=lookups.deals.filter(d=>d.show&&!d.archived&&(!pid||d.projectId===pid));
    form.elements.dealId.innerHTML=options(list,form.elements.dealId.value);
   });
   form.onsubmit=ev=>{
    ev.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    if(!dateOk(data.from)||!dateOk(data.to)||utc(data.to)<utc(data.from)||utc(data.to)-utc(data.from)>=92*dayMs){
     root.querySelector('[data-calendar-body]').innerHTML='<p class="error">Выберите период до 92 дней.</p>';return;
    }
    query={mode:query.mode,...data,filtersOpen:true,overdue:!!data.overdue,conflict:!!data.conflict};update();
   };
  }
  function timeText(x){
   if(!x.at)return x.start===x.end?pretty(x.start):pretty(x.start)+' — '+pretty(x.end);
   const zone=x.timeZone||'Europe/Moscow';
   const suffix=zone!=='Europe/Moscow'?' · '+time(x.at,zone)+' '+zone:'';
   return pretty(x.start)+' · '+time(x.at,'Europe/Moscow')+(x.endAt?' — '+(x.end!==x.start?pretty(x.end)+' · ':'')+time(x.endAt,'Europe/Moscow'):'')+' МСК'+suffix;
  }
  function card(x,compact=false){
   const related=[x.project,x.cities.join(', '),x.venue,x.hall,x.owner].filter(Boolean);
   const label=[kinds[x.kind],x.overdue?'Просрочено':statuses[x.status],x.waiting?'Ждём партнёра':''].filter(Boolean).join(' · ');
   const warnings=x.conflicts||[];
   return '<article class="crm-calendar-card" data-cal-kind="'+esc(x.kind)+'"><button class="name-link" type="button" data-cal-id="'+esc(x.id)+'" data-cal-type="'+esc(x.type)+'">'+esc(x.title)+'</button>'+
    '<p class="hint">'+esc(label)+'</p><p>'+esc(timeText(x))+'</p>'+
    (related.length?'<p class="hint">'+esc(related.join(' · '))+'</p>':'')+
    (x.sources?.length?'<p class="hint">'+esc(x.sources.join(' + '))+'</p>':'')+
    (warnings.length?'<p class="password-note">'+esc(warnings.map(w=>conflict[w.severity]+(w.title?' · '+w.title:' · ресурс занят')).slice(0,compact?1:3).join('; '))+'</p>':'')+'</article>';
  }
  function render(){
   const body=root.querySelector('[data-calendar-body]');
   let markup='<p class="hint">Записей '+result.total+' · Просрочено '+result.overdue+' · С пересечениями '+result.conflicts+'</p>';
   if(!items.length){body.innerHTML=markup+'<p class="empty">На выбранный период записей нет.</p>';return;}
   if(query.mode==='list')markup+='<div class="crm-calendar-list">'+items.map(x=>card(x)).join('')+'</div>';
   else{
    const names=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],start=utc(query.from),end=utc(query.to);
    const padding=(new Date(start).getUTCDay()+6)%7;
    let cells='<div class="crm-calendar-day crm-calendar-padding" aria-hidden="true"></div>'.repeat(padding);
    for(let d=start;d<=end;d+=dayMs){
     const day=iso(d),present=items.filter(x=>x.start<=day&&x.end>=day);
     cells+='<section class="crm-calendar-day"><h2>'+esc(pretty(day))+'</h2>'+present.map(x=>card(x,true)).join('')+'</section>';
    }
    markup+='<div class="crm-calendar-scroll" tabindex="0" aria-label="Календарная сетка"><div class="crm-calendar-grid">'+
      names.map(n=>'<strong class="crm-calendar-dayname">'+n+'</strong>').join('')+cells+'</div></div>';
   }
   body.innerHTML=markup+(result.next==null?'':'<div class="actions">'+btn('more','Показать ещё')+'</div>');
  }
  async function load(more=false){
   const n=++generation,body=root.querySelector('[data-calendar-body]');
   if(!more)body.textContent='Загружаем календарь…';
   body.setAttribute('aria-busy','true');
   if(more){const button=body.querySelector('[data-cal-action=more]');if(button)button.disabled=true;}
   try{
    const {mode,filtersOpen,...values}=query;
    const data=await api({action:'calendar_list',...values,...(more?{offset:result.next,revision:result.revision}:{})});
    if(!active()||n!==generation)return;
    items=more?items.concat(data.items):data.items;result=data;render();
   }catch(err){if(active()&&n===generation)body.innerHTML='<p class="error">'+esc(err.message)+'</p>'+btn('retry','Обновить календарь');}
   finally{if(active()&&n===generation)body.removeAttribute('aria-busy');}
  }
  function update(){remember(query);layout();load();}
  root.addEventListener('click',ev=>{
   const b=ev.target.closest('button');if(!b)return;
   if(b.dataset.calId){open(b.dataset.calType,b.dataset.calId);return;}
   const mode=b.dataset.calMode;
   if(mode&&mode!==query.mode){query={...query,mode,...range(mode,query.from)};update();return;}
   switch(b.dataset.calAction){
    case 'prev':
    case 'next': {
     const current=utc(query.from),sign=b.dataset.calAction==='prev'?-1:1;
     if(query.mode==='month'){
      const d=new Date(current);Object.assign(query,range('month',iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+sign,1))));
     }else{
      const count=(utc(query.to)-current)/dayMs+1;
      query.from=iso(current+sign*count*dayMs);query.to=iso(utc(query.to)+sign*count*dayMs);
     }
     update();break;
    }
    case 'more':if(result?.next!=null)load(true);break;
    case 'retry':load();break;
    case 'clear':query=defaults();update();break;
   }
  });
  update();
 }
 window.AelitaCrmCalendar={defaults,mount};
})();
