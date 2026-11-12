(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AelitaOrganizationParser=factory();})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const fields={name:['название','организация','название организации','наименование','name','organization','company'],city:['город','city','населенный пункт'],website:['сайт','website','site','url'],emails:['email','e-mail','почта','электронная почта','emails'],phones:['телефон','телефоны','phone','phones','тел'],person:['контактное лицо','контакт','фио','person','contact'],personEmails:['почта сотрудника','личная почта','personemails'],personPhones:['телефон сотрудника','личный телефон','personphones'],position:['должность','position','role'],notes:['примечание','примечания','описание','notes','комментарий'],type:['тип','type']};
 const key=x=>String(x??'').trim().toLowerCase().replace(/ё/g,'е');
 function delimiter(text){const lines=text.split(/\r?\n/).filter(Boolean).slice(0,5);return ['\t',';',','].map(d=>({d,n:lines.reduce((n,l)=>n+(l.split(d).length-1),0)})).sort((a,b)=>b.n-a.n)[0].d;}
 function csv(text,sep){text=String(text).replace(/^\uFEFF/,'');sep=sep||delimiter(text);const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.trim())cell+=c;else quoted=!quoted;}else if(c===sep&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Не закрыты кавычки в CSV');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
 }
 function mapping(header){return Object.fromEntries(Object.entries(fields).map(([f,names])=>[f,header.findIndex(h=>names.includes(key(h)))]));}
 const split=v=>String(v??'').split(/[\n;,]+/).map(x=>x.trim()).filter(Boolean);
 function table(rows,map=null,headerRow=0){if(!Array.isArray(rows)||!rows.length)return {headers:[],mapping:{},items:[]};const headers=rows[headerRow].map(String),m=map||mapping(headers);return {headers,mapping:m,items:rows.slice(headerRow+1).map((row,index)=>{const get=f=>Number.isInteger(m[f])&&m[f]>=0?String(row[m[f]]??'').trim():'';return {name:get('name'),city:get('city'),website:get('website'),emails:split(get('emails')),phones:split(get('phones')),person:get('person'),personEmails:split(get('personEmails')),personPhones:split(get('personPhones')),position:get('position'),notes:get('notes'),type:get('type'),source:'Строка '+(headerRow+index+2)};}).filter(x=>Object.entries(x).some(([k,v])=>k!=='source'&&(Array.isArray(v)?v.length:!!v)))};}
 function text(source){const items=[];for(const [i,block]of String(source).split(/\n\s*\n/).entries()){
  const lines=block.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!lines.length)continue;
  const emails=[...new Set(block.match(/[\w.+%-]+@[\w.-]+\.[A-Za-zА-Яа-я]{2,}/g)||[])];
  const phones=[...new Set((block.match(/(?:\+\d|[78](?=[\s(.-]*\d{3}))[\d ()\-.]{7,}\d/g)||[]).filter(x=>x.replace(/\D/g,'').length>=10))];
  const website=(block.match(/https:\/\/[^\s,;<>]+/i)||[])[0]||'';
  const city=(block.match(/(?:город|г\.)\s*[:—-]?\s*([А-ЯЁA-Z][а-яёa-z -]{1,65})/)||[])[1]?.trim()||'';
  const person=(block.match(/(?:контактное лицо|контакт|фио)\s*[:—-]\s*([^\n;]+)/i)||[])[1]?.trim()||'';
  const position=(block.match(/(?:должность)\s*[:—-]\s*([^\n;]+)/i)||[])[1]?.trim()||'';
  const name=lines[0].replace(/^(?:организация|название)\s*[:—-]\s*/i,'').trim();
  items.push({name,city,website,emails,phones,person,position,notes:lines.slice(1).join('\n'),source:('Фрагмент '+(i+1)+' · '+block.trim()).slice(0,200)});
 }return items;}
 return {csv,delimiter,mapping,table,text,fields};
});
