/* AELITA PRODUCTION · current site image; assembled locally, no server writes. */
(function (root, factory) {
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.AELITA_SiteSnapshot=api;api.mount();}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var enc=new TextEncoder();
  var table=(function(){var out=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;out[n]=c>>>0;}return out;})();
  function crc(bytes){var c=0xffffffff;for(var i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function safePath(p){return typeof p==='string'&&p.length>0&&p.length<=512&&!/[\x00-\x1f\x7f\\]/.test(p)&&p[0]!=='/'&&!/^[A-Za-z]:/.test(p)&&!p.split('/').some(function(s){return !s||s==='.'||s==='..';});}
  function base64(s){var b=atob(s),out=new Uint8Array(b.length);for(var i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out;}
  async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(function(n){return n.toString(16).padStart(2,'0');}).join('');}
  function bytesJSON(obj){return enc.encode(JSON.stringify(obj,null,2)+'\n');}
  function concat(parts,size){var out=new Uint8Array(size),offset=0;parts.forEach(function(p){out.set(p,offset);offset+=p.length;});if(offset!==size)throw new Error('snapshot_integrity');return out;}
  function Zip(){this.parts=[];this.central=[];this.names=new Set();this.offset=0;this.files=[];}
  Zip.prototype.add=function(name,data){
    if(!safePath(name)||this.names.has(name)||this.names.size>=65534)throw new Error('snapshot_unsafe_path');
    if(!(data instanceof Uint8Array))throw new Error('snapshot_integrity');
    var filename=enc.encode(name),sum=crc(data),h=new Uint8Array(30),v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(12,0x21,true);
    v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);
    var ch=new Uint8Array(46),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(14,0x21,true);
    cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,filename.length,true);cv.setUint32(42,this.offset,true);
    this.parts.push(h,filename,new Blob([data]));this.central.push(ch,filename);this.names.add(name);
    this.offset+=h.length+filename.length+data.length;
    if(this.offset>0xffffffff)throw new Error('snapshot_too_large');
  };
  Zip.prototype.finish=function(){
    var centralSize=this.central.reduce(function(n,x){return n+x.length;},0),end=new Uint8Array(22),v=new DataView(end.buffer);
    v.setUint32(0,0x06054b50,true);v.setUint16(8,this.names.size,true);v.setUint16(10,this.names.size,true);v.setUint32(12,centralSize,true);v.setUint32(16,this.offset,true);
    return new Blob(this.parts.concat(this.central,[end]),{type:'application/zip'});
  };
  var errors={
    snapshot_github_not_configured:'Не подключён репозиторий сайта. Нужны существующие настройки GitHub функции правок сайта.',
    snapshot_storage_not_configured:'Не подключено хранилище ссылок и изменений. Образ не собран: обновите настройки функции по инструкции.',
    snapshot_github_rate_or_permissions:'GitHub временно ограничил запросы или не дал доступ. Повторите позже; если ошибка сохраняется — проверьте права токена.',
    snapshot_incomplete_repository:'GitHub вернул неполный список файлов. Сборка остановлена, чтобы не выдавать неполный образ.',
    snapshot_storage_changed:'Во время выгрузки изменились ссылки, отзывы или настройки событий. Снимите образ ещё раз.',
    snapshot_server_version_changed:'Во время выгрузки обновился сервер. Снимите образ ещё раз.',
    snapshot_configuration_changed:'Во время выгрузки изменились настройки репозитория. Начните заново.',
    snapshot_too_large:'Образ слишком велик для этой выгрузки. Используйте отдельную резервную копию по инструкции.',
    snapshot_file_too_large:'В репозитории есть слишком большой файл. Образ не собран; детали ограничений — в инструкции.',
    snapshot_plan_too_large:'Список файлов слишком велик. Образ не собран; используйте резервную копию по инструкции.',
    snapshot_expired:'Время выгрузки истекло. Начните заново.',
    snapshot_integrity:'Не сошлась проверка файлов. Неполный ZIP не сохранён — повторите выгрузку.',
    snapshot_unsupported_repository_entry:'В репозитории есть ссылка на другой репозиторий или символическая ссылка. Нужна отдельная обработка; неполный образ не сохранён.',
    snapshot_lfs_not_supported:'В репозитории есть Git LFS. Нужна отдельная выгрузка больших файлов; неполный образ не сохранён.',
    snapshot_source_unavailable:'Один из источников не ответил. Неполный образ не сохранён — повторите выгрузку.',
    snapshot_invalid_runtime_json:'Один из файлов событий или ссылок повреждён. Образ не собран — нужна проверка хранилища.',
    snapshot_incomplete_storage_inventory:'Не удалось получить полный список изменений сайта. Образ не сохранён — повторите выгрузку.',
    snapshot_repository_integrity_error:'Один из файлов сайта не прошёл проверку. Образ не сохранён — повторите выгрузку.',
    snapshot_unsafe_repository_path:'В репозитории обнаружено неподдерживаемое имя файла. Образ не сохранён — нужна проверка репозитория.',
    not_authenticated:'Сессия закончилась. Войдите в админку и повторите выгрузку.',
    snapshot_bad_action:'Сервер ещё не обновлён. Сначала внедрите серверную часть апдейта.',
  };
  function filename(at,commit){
    var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at));
    var fields={};parts.forEach(function(p){fields[p.type]=p.value;});
    return 'AELITA_CURRENT_IMAGE_'+fields.year+'-'+fields.month+'-'+fields.day+'_'+fields.hour+fields.minute+fields.second+'_MSK_'+commit.slice(0,8)+'.zip';
  }
  function abortCheck(signal){if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');}
  async function build(call,signal,onProgress){
    if(!globalThis.crypto||!crypto.subtle)throw new Error('snapshot_crypto_unavailable');
    var plan=await call({action:'snapshot_start'},signal);
    if(plan.schema!=='aelita.site-snapshot/v1'||!Array.isArray(plan.entries)||!Array.isArray(plan.inlineFiles)||!plan.session)throw new Error('snapshot_integrity');
    var zip=new Zip(),files=[],omitted=[],done=0,total=plan.entries.length+plan.inlineFiles.length;
    async function add(name,bytes,expected){
      abortCheck(signal);
      var hash=await digest(bytes);if(hash!==expected)throw new Error('snapshot_integrity');
      zip.add(name,bytes);files.push({path:name,size:bytes.length,sha256:hash});
    }
    function progress(){if(onProgress)onProgress({done,total,bytes:files.reduce(function(n,e){return n+e.size;},0)});}
    for(var f of plan.inlineFiles){await add(f.path,base64(f.data),f.sha256);done++;progress();}
    var index=0;
    while(index<plan.entries.length){
      abortCheck(signal);
      var entry=plan.entries[index];
      if(entry.size>plan.limits.chunkBytes&&!(entry.source==='storage'&&entry.key.startsWith('reviews/'))){
        var chunks=[],offset=0,expectedHash=null;
        do{
          var result=await call({action:'snapshot_files',session:plan.session,requests:[{entry,offset}]},signal);
          if(!result.items||result.items.length!==1)throw new Error('snapshot_integrity');
          var item=result.items[0],part=base64(item.data||'');
          if(item.path!==entry.path||item.offset!==offset||item.size!==entry.size||part.length===0||part.length>plan.limits.chunkBytes||expectedHash&&expectedHash!==item.sha256)throw new Error('snapshot_integrity');
          expectedHash=item.sha256;chunks.push(part);offset+=part.length;
          if(item.done!==(offset===entry.size)||offset>entry.size)throw new Error('snapshot_integrity');
        }while(offset<entry.size);
        await add(entry.path,concat(chunks,entry.size),expectedHash);index++;done++;progress();
      }else{
        var requests=[],size=0;
        while(index+requests.length<plan.entries.length&&requests.length<plan.limits.batchFiles){
          var next=plan.entries[index+requests.length];
          if(next.size>plan.limits.chunkBytes||size+next.size>plan.limits.chunkBytes)break;
          requests.push({entry:next,offset:0});size+=next.size;
        }
        if(!requests.length)throw new Error('snapshot_file_too_large');
        var result=await call({action:'snapshot_files',session:plan.session,requests},signal);
        if(!Array.isArray(result.items)||result.items.length!==requests.length)throw new Error('snapshot_integrity');
        for(var i=0;i<requests.length;i++){
          var item=result.items[i],e=requests[i].entry;if(item.path!==e.path)throw new Error('snapshot_integrity');
          if(item.omitted){if(e.source!=='storage'||!e.key.startsWith('reviews/')||item.reason!=='unpublished_review')throw new Error('snapshot_integrity');omitted.push({path:item.path,reason:item.reason});}
          else{var b=base64(item.data);if(item.offset!==0||!item.done||item.size!==b.length||(!e.key||!e.key.startsWith('reviews/'))&&e.size!==b.length)throw new Error('snapshot_integrity');await add(item.path,b,item.sha256);}
          done++;progress();
        }
        index+=requests.length;
      }
    }
    var final=await call({action:'snapshot_finish',session:plan.session},signal);
    if(!final.ok||!final.runtimeUnchanged||final.expectedEntries!==plan.entries.length||done!==total)throw new Error('snapshot_integrity');
    abortCheck(signal);
    var manifest={schema:plan.schema,status:'complete',scope:'site-content-and-operational-config',startedAt:plan.startedAt,finishedAt:final.finishedAt,repository:plan.repository,runtime:plan.runtime,runtimeUnchanged:true,repositoryChangedDuringExport:!!final.repositoryChanged,latestCommit:final.latestCommit,excludedRepositoryFiles:plan.ignored,omittedRuntimeFiles:omitted,containsCustomerDatabase:false,containsServerCredentials:false,files};
    zip.add('snapshot.json',bytesJSON(manifest));
    var sums=files.map(function(f){return f.sha256+'  '+f.path;}).join('\n')+'\n';
    zip.add('SHA256SUMS.txt',enc.encode(sums));
    zip.add('00_README_RU.md',enc.encode('# АЭЛИТА ПРОДАКШЕН — текущий образ сайта\n\nСнят: '+plan.startedAt+' — '+final.finishedAt+'.\n\nВетка: '+plan.repository.branch+'; коммит: '+plan.repository.commit+'.\n\nSite/ — исходники текущей ветки репозитория: страницы, изображения, стили, скрипты и файлы. Это не подтверждение публикации всех файлов на CDN.\n\nruntime/ — каталоги событий и показов, исходники конфигурации серверной сборки, короткие ссылки, переносы/отмены и управление продажей, баннер, только опубликованные отзывы в публичном виде. Состояние хранилища проверено повторно перед завершением.\n\nСекреты сервера, заказы, кабинеты, контакты и списки зрителей не выгружались. Служебные и приватные файлы репозитория отмечены в snapshot.json; неопубликованные отзывы пропущены. Это образ для переноса контента в следующую сборку, а не полная резервная копия платёжной системы.\n\nКак использовать: пришлите этот ZIP вместе с актуальным core/deploy-паком и укажите, какие правки нужны. Сначала проверить snapshot.json и SHA256SUMS.txt, сравнить Site/ с паком, учесть runtime/ отдельно. Новые страницы/события/ссылки не удалять при сборке. Данные runtime/ не загружаются обратно автоматически.\n\n'+(final.repositoryChanged?'Во время выгрузки ветка репозитория успела измениться. Образ соответствует коммиту на начало выгрузки; для самого нового состояния снимите ещё один образ.\n':'')+'Время в полях JSON — UTC с Z; дата имени архива — Москва.\n'));
    return {blob:zip.finish(),filename:filename(plan.startedAt,plan.repository.commit),manifest};
  }
  function mount(){
    if(typeof document==='undefined')return;
    var button=document.getElementById('siteSnapshotBtn');if(!button)return;
    var cancel=document.getElementById('siteSnapshotCancel'),status=document.getElementById('siteSnapshotStatus'),progress=document.getElementById('siteSnapshotProgress'),link=document.getElementById('siteSnapshotDownload');
    var active=null,url=null;
    function discard(){if(url){URL.revokeObjectURL(url);url=null;}link.hidden=true;link.removeAttribute('href');}
    async function call(body,signal){
      for(var attempt=0;attempt<3;attempt++){
        abortCheck(signal);
        var res,data;
        try{
          res=await fetch(ADMIN_SITE_EDIT_URL,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+getToken()},body:JSON.stringify(body),signal});
          if(res.status===401){if(typeof clearToken==='function')clearToken();if(typeof showGate==='function')showGate();throw new Error('not_authenticated');}
          data=await res.json();
        }catch(e){if(e.name==='AbortError'||e.message==='not_authenticated')throw e;if(attempt===2)throw new Error('snapshot_source_unavailable');continue;}
        if(res.ok&&data.ok)return data;
        if(data.error==='missing_page')throw new Error('snapshot_bad_action');
        if(res.status>=500&&attempt<2){await new Promise(function(resolve){setTimeout(resolve,400*(attempt+1));});continue;}
        throw new Error(data.error||'snapshot_source_unavailable');
      }
    }
    button.addEventListener('click',async function(){
      if(active)return;discard();
      if(typeof ADMIN_SITE_EDIT_URL==='undefined'||!ADMIN_SITE_EDIT_URL){status.textContent='Выгрузка ещё не подключена.';return;}
      active=new AbortController();var current=active;button.disabled=true;cancel.hidden=false;progress.hidden=false;progress.value=0;status.textContent='Проверяем источники. Не закрывайте вкладку до завершения.';
      try{
        var result=await build(call,current.signal,function(p){progress.max=p.total;progress.value=p.done;status.textContent='Собираем образ: '+p.done+' из '+p.total+' файлов · '+(p.bytes/1024/1024).toFixed(1)+' МБ. Не закрывайте вкладку.';});
        url=URL.createObjectURL(result.blob);link.href=url;link.download=result.filename;link.hidden=false;link.textContent='Скачать ZIP ещё раз';link.click();
        status.textContent='Образ готов. Если загрузка не началась, нажмите «Скачать ZIP ещё раз». Пришлите архив вместе с текущим паком перед следующей доработкой.'+(result.manifest.repositoryChangedDuringExport?' Пока собирали образ, репозиторий изменился; при необходимости снимите новый.':'');
      }catch(e){discard();status.textContent=e.name==='AbortError'?'Выгрузка отменена. Неполный архив не сохранён.':errors[e.message]||(e.message==='snapshot_crypto_unavailable'?'Для проверки образа нужен современный браузер и HTTPS.':'Не удалось собрать полный образ. Повторите выгрузку.');}
      finally{active=null;button.disabled=false;cancel.hidden=true;progress.hidden=true;}
    });
    cancel.addEventListener('click',function(){if(active)active.abort();});
  }
  return {Zip,build,mount,digest,safePath};
});
