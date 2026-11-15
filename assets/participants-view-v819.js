(function(root){
 'use strict';
 const modeLabel={offline:'В зале',online:'Онлайн',unknown:'Формат не указан'};
 const sourceKind={ticket:'Билет',invite:'Пригласительный',registration:'Регистрация'};
 const basisFilterLabel={all:'Все основания',ticket:'По билетам',invite:'По пригласительным',registration:'По регистрациям'};
 const plural=new Intl.PluralRules('ru');
 const groups=n=>n+' '+({one:'группа',few:'группы',many:'групп',other:'группы'})[plural.select(n)];
 const people=n=>n+' '+(plural.select(n)==='few'?'участника':'участник'+(plural.select(n)==='one'?'':'ов'));
 const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').trim();
 const expected=r=>r.active&&!r.excluded&&!r.declined;
 function sourceLabel(source){return source.label+(source.stateLabel?' — '+source.stateLabel:'');}
 function basisTags(row){
  const kinds=new Map();
  for(const source of row.sources){
   if(!Object.hasOwn(sourceKind,source.kind))continue;
   if(!kinds.has(source.kind))kinds.set(source.kind,[]);
   kinds.get(source.kind).push(source);
  }
  return [...kinds].map(([kind,sources])=>{
   const active=sources.some(s=>s.state==='active');
   const notes=[...new Set(sources.filter(s=>s.state!=='active').map(s=>s.stateLabel||'Статус основания недоступен'))];
   return {label:sourceKind[kind],active,notes};
  });
 }
 function byBasis(row,filters,state){
  return row.sources.filter(source=>source.kind===filters.basis&&(!state||source.state===state));
 }
 function stateLabel(r,f={}){
  if(f.basis&&f.basis!=='all'&&['pending','inactive'].includes(f.status)){
   const labels=[...new Set(byBasis(r,f,f.status).map(s=>s.stateLabel).filter(Boolean))];
   if(labels.length)return labels.join('; ');
  }
  if(!r.active)return r.stateLabel||'Основание недействительно';
  if(r.excluded)return 'Ведущий / команда';
  if(r.declined)return 'Отказался';
  if(r.responseConflict)return 'Ответ требует сверки';
  return r.confirmed?'Подтвердил участие':'Ожидается — ответ не получен';
 }
 function nameOrder(a,b){return a.name.localeCompare(b.name,'ru')||a.id.localeCompare(b.id);}
 function familyOrder(a,b){
  const af=a.identity?.lastName||'',bf=b.identity?.lastName||'';
  return Number(!af)-Number(!bf)||af.localeCompare(bf,'ru')||(a.identity?.firstName||'').localeCompare(b.identity?.firstName||'','ru')||(a.identity?.middleName||'').localeCompare(b.identity?.middleName||'','ru')||nameOrder(a,b);
 }
 function select(data,f={}){
  const inStatus=r=>f.status==='all'?true:f.status==='confirmed'?expected(r)&&r.confirmed:f.status==='declined'?r.active&&!r.excluded&&r.declined:f.status==='unconfirmed'?expected(r)&&!r.confirmed:f.status==='review'?r.active&&!r.excluded&&(r.possibleDuplicate||r.identityConflict||r.responseConflict||r.modeConflict):f.status==='arrived'?r.active&&!r.excluded&&r.mode==='offline'&&r.arrivalLabel==='Вошёл по QR':f.status==='inactive'?!r.active&&!r.pending:f.status==='pending'?r.pending:f.status==='team'?r.active&&r.excluded:expected(r);
  const basis=f.basis&&f.basis!=='all';
  const sourceStatus=basis&&['pending','inactive'].includes(f.status);
  const rows=(data.rows||[]).filter(r=>{
   if(sourceStatus ? !byBasis(r,f,f.status).length : !inStatus(r))return false;
   if(basis&&!sourceStatus&&!byBasis(r,f,f.status==='all'?null:'active').length)return false;
   if(f.mode&&f.mode!=='all'&&r.mode!==f.mode)return false;
   return !f.search||norm([r.name,...r.originalNames||[],...r.sources.map(s=>s.label)].join(' ')).includes(norm(f.search));
  });
  return rows.sort(f.sort==='family'?familyOrder:f.sort==='mode'?(a,b)=>a.mode.localeCompare(b.mode)||nameOrder(a,b):nameOrder);
 }
 function scope(f={}){
  const labels={all:'Все записи',confirmed:'Подтвердили участие',declined:'Отказались',unconfirmed:'Не подтвердили участие',review:'Требует сверки',arrived:'Вошли по QR в зал',inactive:'Недействующие основания',pending:'Ожидают оплаты',team:'Команда / исключённые'};
  return (labels[f.status]||'Ожидаемые участники')+(f.basis&&f.basis!=='all'&&Object.hasOwn(basisFilterLabel,f.basis)?' · '+basisFilterLabel[f.basis]:'')+(f.mode&&f.mode!=='all'?' · '+modeLabel[f.mode]:'')+(f.search?' · поиск: '+f.search:'')+(f.sort==='family'?' · по фамилии':f.sort==='mode'?' · по формату участия':'');
 }
 function warnings(d,f={}){return [...(d.issues||[]),...(d.totals?.possibleDuplicates?['Возможные совпадения: '+groups(d.totals.possibleDuplicates)+'.']:[]),...(d.totals?.identityConflicts?['Имена в объединённых основаниях требуют сверки.']:[]),...(d.totals?.responseConflicts?['Ответы в объединённых основаниях противоречат друг другу; требуется уточнение.']:[]),...(f.sort==='family'&&select(d,f).some(r=>!r.identity?.lastName)?['Без отдельно указанной фамилии — в конце, А—Я по записи. Фамилия не угадывается.']:[])];}
 function copy(d,f={}){
  const rows=select(d,f),lines=[d.event.title,d.event.when||d.event.datetime||'Дата уточняется',d.event.venue||'',scope(f)+' · '+rows.length+' человек','Итоги события: ожидается '+d.totals.total+' · в зале '+d.totals.offline+' · онлайн '+d.totals.online+' · формат не указан '+d.totals.unknown,...(d.detailsVersion>=820?['Подтвердили: '+d.totals.confirmed+' · отказались: '+d.totals.declined]:[]),...warnings(d,f).map(x=>'Внимание: '+x),''];
  for(const mode of ['offline','online','unknown']){const items=rows.filter(r=>r.mode===mode);if(!items.length)continue;lines.push(modeLabel[mode]+' · '+items.length);items.forEach((r,i)=>lines.push((i+1)+'. '+r.name+(r.possibleDuplicate?' [проверить совпадение]':'')+(f.basis&&f.basis!=='all'&&['pending','inactive'].includes(f.status)?' ['+stateLabel(r,f)+']':!r.active?' ['+r.stateLabel+']':r.excluded?' [команда]':r.declined?' [отказался]':r.confirmed?' [подтвердил участие]':r.responseConflict?' [ответ требует сверки]':'')));lines.push('');}
  lines.push('Данные на '+d.generatedLabel);return lines.filter(x=>x!==null).join('\n');
 }
 function csv(d,f={}){
  const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const records=[['Событие',d.event.title],['Дата',d.event.when||d.event.datetime||''],['Состав',scope(f)],['Данные на',d.generatedLabel],...warnings(d,f).map(x=>['Внимание',x]),[],['№','Имя / фамилия','Участие','Состояние','Основания','Приход','Проверить','Фамилия','Имя','Отчество']];
  select(d,f).forEach((r,i)=>records.push([i+1,r.name,modeLabel[r.mode],stateLabel(r,f),r.sources.map(sourceLabel).join('; '),r.arrivalLabel,r.possibleDuplicate?'Возможное совпадение':'',r.identity?.lastName||'',r.identity?.firstName||'',r.identity?.middleName||'']));
  return '\ufeff'+records.map(r=>r.map(cell).join(';')).join('\r\n');
 }
 const api={select,scope,copy,csv,modeLabel,norm,warnings,stateLabel,sourceLabel,basisTags,basisFilterLabel,people};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaParticipantsView=api;
})(typeof window==='object'?window:globalThis);
