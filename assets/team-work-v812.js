(async function () {
  'use strict';
  const work=window.AelitaWork;
  const target=document.getElementById('team-work');
  const session=window.AelitaStaffSession?.read();
  if(!work||!target||!session?.crmToken)return;
  const currentSession=()=>window.AelitaStaffSession?.read()?.crmToken===session.crmToken;
  let user;
  try{
    const result=await fetch('https://api.aelita-production.ru/crm',{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.crmToken},
      body:JSON.stringify({action:'me'}),
    });
    if(!result.ok||!currentSession())return;
    user=(await result.json()).user;
  }catch{return;}
  if(!currentSession()||!user||user.mustChange||!user.emailVerified)return;
  const preferences={actor:user.id,durable:true};
  const allowed=(area,tab)=>work.canPin(area,tab,user);
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const link=(label,url)=>{const a=el('a',label);a.href=url;return a;};
  const group=title=>{const box=el('section');box.className='work-team-group';box.append(el('h2',title));return box;};
  for(const link of document.querySelectorAll('[data-crew-area]')){
    const area=link.dataset.crewArea;link.hidden=!allowed(area,area==='admin'?'overview':'home');
  }
  window.addEventListener('aelita-staff-session-changed',()=>{if(!currentSession())target.replaceChildren();});
  const choices=Object.entries(work.tabs).flatMap(([area,sections])=>
    Object.entries(sections).filter(([tab])=>allowed(area,tab)).map(([tab,label])=>({id:area+':'+tab,label,url:work.tabUrl(area,tab)})));
  const recent=group('Продолжить работу'), recentList=el('ul');
  for(const kind of ['draft','newsletter','show','order']){
    const value=work.read('recent:'+kind,preferences);
    const item=work.parseRecent(kind,value);
    if(!item)continue;
    if(kind==='order'&&!allowed('admin','orders')||kind==='newsletter'&&!allowed('admin','news')||kind==='show'&&!allowed('crm','deals')||
       kind==='draft'&&(!allowed('crm',value.type)||user.role==='viewer'||
       user.access?.sections?.[value.recipient.startsWith('o_')?'organizations':'contacts']==='read'||
       user.access?.sections?.[value.recipient.startsWith('o_')?'organizations':'contacts']==='none'))continue;
    const li=el('li');li.append(link(item.label,item.url));recentList.append(li);
  }
  if(recentList.childElementCount){recent.append(recentList);target.append(recent);}

  const pinned=group('Закреплённые разделы'), list=el('ul'), removalList=el('ul');
  const empty=el('p','Закрепите нужные разделы для быстрого доступа.');
  empty.className='team-work-empty';removalList.className='team-work-removals';
  const editor=el('details'),summary=el('summary','Настроить закреплённые');
  const select=el('select');select.setAttribute('aria-label','Выберите раздел для закрепления');
  const add=el('button','Закрепить');add.type='button';
  const status=el('p');status.setAttribute('role','status');
  const controls=el('div');controls.className='team-work-editor';controls.append(select,add);
  editor.append(summary,controls,removalList,status);pinned.append(list,empty,editor);
  const all=group('Все разделы'),more=el('details');
  more.append(el('summary','Открыть полный список'));
  const allList=el('ul');
  for(const x of choices){const li=el('li');li.append(link(x.label,x.url));allList.append(li);}
  more.append(allList);all.append(more);
  function current(){
    const stored=work.read('pinned',preferences);
    return (Array.isArray(stored)?stored:['crm:tasks','crm:calendar','admin:shows'])
      .filter((id,i,items)=>choices.some(x=>x.id===id)&&items.indexOf(id)===i).slice(0,4);
  }
  function save(ids){
    if(!currentSession()){target.replaceChildren();return;}
    if(!work.write('pinned',ids,preferences)){status.textContent='Не удалось сохранить выбор на этом устройстве.';return;}
    status.textContent='Список сохранён.';
    render();
    if(editor.open)(add.disabled?summary:select).focus();
  }
  function render(){
    const ids=current();list.replaceChildren();removalList.replaceChildren();empty.hidden=ids.length>0;
    select.replaceChildren(new Option('Выберите раздел',''));
    for(const x of choices){if(!ids.includes(x.id))select.add(new Option(x.label,x.id));}
    for(const id of ids){
      const x=choices.find(choice=>choice.id===id),item=el('li'),edit=el('li');
      const remove=el('button','Убрать');remove.type='button';
      remove.setAttribute('aria-label','Убрать из закреплённых: '+x.label);
      remove.onclick=()=>save(ids.filter(saved=>saved!==id));
      item.append(link(x.label,x.url));list.append(item);
      edit.append(el('span',x.label),remove);removalList.append(edit);
    }
    add.disabled=ids.length>=4||select.options.length===1;
    select.disabled=add.disabled;
  }
  add.onclick=()=>{const ids=current();if(select.value&&ids.length<4)save([...ids,select.value]);};
  render();target.append(pinned,all);
}());
