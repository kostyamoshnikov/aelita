window.AelitaReadOrganizationFile=async function(file,{sheet=0,encoding='utf-8'}={}){
 if(file.size>15*1024*1024)throw Error('Файл больше 15 МБ. Разделите его на части.');
 const bytes=await file.arrayBuffer(),ext=file.name.toLowerCase().split('.').pop(),parser=window.AelitaOrganizationParser;
 if(['txt','csv','tsv'].includes(ext)){
  const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
  if(ext==='txt')return {kind:'text',text,items:parser.text(text)};
  return {kind:'table',rows:parser.csv(text,ext==='tsv'?'\t':null)};
 }
 if(['xlsx','docx'].includes(ext)){
  const zip=await JSZip.loadAsync(bytes);let total=0;
  for(const f of Object.values(zip.files)){if(f.dir)continue;const size=f._data?.uncompressedSize||0;total+=size;if(size>8*1024*1024||total>50*1024*1024||Object.keys(zip.files).length>2000)throw Error('Слишком большой объём распакованного документа.');}
  const xml=async name=>{const entry=zip.file(name);if(!entry)throw Error('В документе нет '+name);const text=await entry.async('string');if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML с внешними сущностями не поддерживается.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Повреждён XML документа');return doc;};
  const elements=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
  if(ext==='docx'){const doc=await xml('word/document.xml');const text=elements(doc,'p').map(p=>elements(p,'t').map(x=>x.textContent).join('')).join('\n');return {kind:'text',text,items:parser.text(text)};}
  const book=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels'),sheets=elements(book,'sheet').map(x=>({name:x.getAttribute('name'),id:x.getAttribute('r:id')}));
  const chosen=sheets[sheet];if(!chosen)throw Error('Выберите существующий лист');const rel=elements(rels,'Relationship').find(x=>x.getAttribute('Id')===chosen.id);let target=rel?.getAttribute('Target')||'';
  if(!target||/\.\.|^https?:|^\/\//i.test(target))throw Error('Недопустимая связь листа');target=target.startsWith('/')?target.slice(1):'xl/'+target;
  const strings=zip.file('xl/sharedStrings.xml')?elements(await xml('xl/sharedStrings.xml'),'si').map(x=>elements(x,'t').map(t=>t.textContent).join('')):[];
  const doc=await xml(target),rows=[];for(const row of elements(doc,'row')){const result=[];for(const cell of elements(row,'c')){const address=cell.getAttribute('r')||'',letters=address.match(/^[A-Z]+/)?.[0];let index=letters?[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1:result.length;if(index>2000)throw Error('Слишком много столбцов');const type=cell.getAttribute('t'),v=elements(cell,'v')[0]?.textContent||'';result[index]=type==='s'?strings[Number(v)]||'':type==='inlineStr'?elements(cell,'t').map(x=>x.textContent).join(''):v;}rows.push(Array.from(result,x=>x||''));if(rows.length>50000)throw Error('В файле больше 50000 строк');}
  return {kind:'table',rows,sheets:sheets.map(x=>x.name),sheet,sheetName:chosen.name};
 }
 if(ext==='pdf'){
  const pdfjs=await import('/assets/vendor-v814/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/assets/vendor-v814/pdfjs/pdf.worker.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,cMapUrl:'/assets/vendor-v814/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/assets/vendor-v814/pdfjs/standard_fonts/'});
  const pdf=await task.promise;try{if(pdf.numPages>200)throw Error('В PDF больше 200 страниц. Разделите документ.');const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();let text='';for(const item of content.items)if('str'in item)text+=item.str+(item.hasEOL?'\n':' ');pages.push(text);if(pages.join('').length>2*1024*1024)throw Error('Слишком много текста в PDF.');}
   const text=pages.join('\n\n');if(text.trim().length<10)throw Error('В PDF нет текстового слоя. Для скана сначала нужно распознавание текста (OCR).');return {kind:'text',text,items:pages.flatMap((text,i)=>parser.text(text).map(x=>({...x,source:'Страница '+(i+1)+' · '+x.source})))};
  }finally{await pdf.destroy();}
 }
 throw Error('Поддерживаются CSV, TSV, XLSX, TXT, DOCX и PDF с текстовым слоем. XLS сначала сохраните как XLSX.');
};
