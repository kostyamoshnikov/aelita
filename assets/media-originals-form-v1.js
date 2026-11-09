(function(root){'use strict';
// Adapter for existing single-photo forms. The original archive and public
// publication are still owned by AelitaMediaOriginals and each form's server.
function mount(options){
 const media=root.AelitaMediaOriginals;
 if(!media)throw new Error('media_originals_required');
 let generation=0,working=false;
 function current(){return !options.isCurrent||options.isCurrent();}
 function value(){const x=options.selection();return x.value==='asset:upload'&&x.asset?.hash?'asset:'+x.asset.hash:x.value;}
 function refresh(){
  const holder=options.holder;if(!holder)return;
  holder.replaceChildren();const initial=value(),generationAtRender=generation;
  media.controls(holder,{api:options.api,value:initial,resolve:v=>{const a=options.selection().asset;return v.startsWith('asset:')&&a?.data?'data:'+a.type+';base64,'+a.data:v;},usages:options.usages||['фото выбранной карточки'],progress:options.progress,
   isCurrent:()=>current()&&generation===generationAtRender&&value()===initial,
   onChoose:choose});
 }
 function changed(){generation++;refresh();}
 async function choose(file){
  if(!file||working||options.busy?.()||!current())return;
  const at=generation,snapshot=options.snapshot(),session=options.session();
  const valid=()=>current()&&generation===at&&options.snapshot()===snapshot&&session&&options.session()===session;
  working=true;options.setBusy(true);options.progress('Подготавливаем фотографию и сохраняем исходник…');
  try{
   const asset=await options.compress(file);if(!valid())throw{code:'superseded'};
   asset.hash=await media.digest(Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)));if(!valid())throw{code:'superseded'};
   await media.save(file,asset,options.api,options.progress,valid);if(!valid())throw{code:'superseded'};
   options.apply(asset);generation++;refresh();options.progress('Исходник сохранён. Фотография добавлена в черновик.');
  }catch(e){if(e?.code!=='superseded'&&valid())options.onError(e);}
  finally{working=false;options.setBusy(false);}
 }
 return{choose,changed,refresh};
}
const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaMediaOriginalsForm=api;
})(typeof window==='object'?window:globalThis);
