(function(root){
 'use strict';
 const modeLabel={offline:'В зале',online:'Онлайн',unknown:'Формат не указан'};
 const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').trim();
 function select(data,f={}){
  const inStatus=r=>f.status==='all'?true:f.status==='confirmed'?r.active&&!r.excluded&&r.confirmed:f.status==='arrived'?r.active&&!r.excluded&&r.mode==='offline'&&r.arrivalLabel==='Вошёл по QR':f.status==='inactive'?!r.active&&!r.pending:f.status==='pending'?r.pending:f.status==='team'?r.active&&r.excluded:r.active&&!r.excluded;
  return (data.rows||[]).filter(r=>inStatus(r)&&(!f.mode||f.mode==='all'||r.mode===f.mode)&&(!f.search||norm([r.name,...r.sources.map(s=>s.label)].join(' ')).includes(norm(f.search)))).sort((a,b)=>f.sort==='mode'?a.mode.localeCompare(b.mode)||a.name.localeCompare(b.name,'ru'):a.name.localeCompare(b.name,'ru'));
 }
 function scope(f={}){return (f.status==='all'?'Все записи':f.status==='confirmed'?'Подтвердили участие':f.status==='arrived'?'Вошли по QR в зал':f.status==='inactive'?'Недействующие основания':f.status==='pending'?'Ожидают оплаты':f.status==='team'?'Команда / исключённые':'Ожидаемые участники')+(f.mode&&f.mode!=='all'?' · '+modeLabel[f.mode]:'')+(f.search?' · поиск: '+f.search:'');}
 function warnings(d){return [...(d.issues||[]),...(d.totals?.possibleDuplicates?['Возможные совпадения: '+d.totals.possibleDuplicates+' групп. Число людей требует сверки.']:[])];}
 function copy(d,f={}){
  const rows=select(d,f),lines=[d.event.title,d.event.when||d.event.datetime||'Дата уточняется',d.event.venue||'',scope(f)+' · '+rows.length+' человек','Итоги события: ожидается '+d.totals.total+' · в зале '+d.totals.offline+' · онлайн '+d.totals.online+' · формат не указан '+d.totals.unknown,...warnings(d).map(x=>'Внимание: '+x),''];
  for(const mode of ['offline','online','unknown']){const items=rows.filter(r=>r.mode===mode);if(!items.length)continue;lines.push(modeLabel[mode]+' · '+items.length);items.forEach((r,i)=>lines.push((i+1)+'. '+r.name+(r.possibleDuplicate?' [проверить совпадение]':'')+(!r.active?' ['+r.stateLabel+']':r.excluded?' [команда]':'')));lines.push('');}
  lines.push('Данные на '+d.generatedLabel);return lines.filter(x=>x!==null).join('\n');
 }
 function csv(d,f={}){
  const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const records=[['Событие',d.event.title],['Дата',d.event.when||d.event.datetime||''],['Состав',scope(f)],['Данные на',d.generatedLabel],...warnings(d).map(x=>['Внимание',x]),[],['№','Имя / фамилия','Участие','Состояние','Основания','Приход','Проверить']];
  select(d,f).forEach((r,i)=>records.push([i+1,r.name,modeLabel[r.mode],r.excluded?'Команда / исключён':r.active?r.confirmed?'Участие подтверждено':'Ожидается':r.stateLabel,r.sources.map(s=>s.label).join('; '),r.arrivalLabel,r.possibleDuplicate?'Возможное совпадение':'']));
  return '\ufeff'+records.map(r=>r.map(cell).join(';')).join('\r\n');
 }
 const api={select,scope,copy,csv,modeLabel,norm,warnings};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaParticipantsView=api;
})(typeof window==='object'?window:globalThis);
