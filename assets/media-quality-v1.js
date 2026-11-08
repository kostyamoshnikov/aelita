(function(root){'use strict';
// Width and aspect ratio are derived from pages/blocks.css, at 1 image pixel
// per CSS pixel. This describes the large-screen block, not every device.
const WIDTH=1060,HEIGHT=Math.ceil(WIDTH*10/16);
const MOBILE_WIDTH=600-2*16,MOBILE_HEIGHT=Math.ceil(MOBILE_WIDTH*10/16);
// Named control frames, derived from each public template's own CSS.
// These are 1:1 checks of the public copy, not of the archived original.
const USAGES=Object.freeze({
 eventCover:Object.freeze({title:'Обложка страницы события',frames:Object.freeze([
  Object.freeze({label:'компьютер, окно 1240 CSS px',width:505,height:618}),
  Object.freeze({label:'телефон, окно 700 CSS px',width:668,height:440})
 ]),note:'Для карточек главной, афиши и OG проверьте отдельный макет.'}),
 directoryCard:Object.freeze({title:'Карточка на странице справочника',frames:Object.freeze([
  Object.freeze({label:'компьютер, окно 1280 CSS px',width:1178,height:210}),
  Object.freeze({label:'телефон, окно 700 CSS px',width:666,height:210})
 ]),note:'Расчёт для группы с одной карточкой на /directory/. Несколько карточек в ряд занимают меньше места; связанные страницы проверьте отдельно.'})
});
function evaluateUsage(width,height,usage){
 const profile=USAGES[usage];if(!profile||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const frames=profile.frames.map(frame=>({...frame,low:width<frame.width||height<frame.height}));
 return{width,height,frames,low:frames.some(frame=>frame.low)};
}
function evaluate(width,height,mode,target='desktop'){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const neededWidth=target==='mobile'?MOBILE_WIDTH:WIDTH,needHeight=mode==='whole'?0:target==='mobile'?MOBILE_HEIGHT:HEIGHT;
 return {width,height,neededWidth,neededHeight:needHeight,low:width<neededWidth||height<needHeight};
}
function mount(container,options){
 const note=document.createElement('p');note.className='ed-help';note.setAttribute('role','status');container.append(note);let sequence=0;
 function update(){
  const at=++sequence,src=options.source(),mobile=options.target==='mobile',prefix=mobile?'Фото для телефона ('+(options.inherited?.()?'наследуется основное':'отдельное')+'): ':'',context=options.context?.(),profile=USAGES[options.usage];
  const valid=()=>at===sequence&&container.isConnected&&(!options.isCurrent||options.isCurrent())&&(!options.context||options.context()===context);
  note.textContent='';if(!src||!valid())return;
  // Restrict loads to the same-origin image namespace or an editor's local draft.
  if((!/^\/images\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(src)||src.includes('..'))&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)){if(mobile||profile)note.textContent=prefix+(mobile?'размер':'Размер')+' не проверен: адрес вне локального каталога. Проверьте макет.';return;}
  if(profile)note.textContent='Определяю размер подготовленной копии фото…';
  const img=new Image();img.onload=()=>{if(!valid())return;
   if(profile){const result=evaluateUsage(img.naturalWidth,img.naturalHeight,options.usage);if(!result){note.textContent='Размер изображения не удалось определить. Проверьте фото в макете.';return;}
    note.textContent=profile.title+': '+result.width+'×'+result.height+' px (копия для сайта). '+result.frames.map(f=>'Контрольная рамка — '+f.label+': '+f.width+'×'+f.height+' px; '+(f.low?'разрешения может не хватать.':'увеличения при масштабе 1:1 не требуется.')).join(' ')+' '+profile.note+' На экранах с высокой плотностью пикселей проверьте чёткость в макете.';return;
   }
   const result=evaluate(img.naturalWidth,img.naturalHeight,options.view()?.mode,options.target);
   if(!result)return;const dims=result.width+'×'+result.height+' px';
   if(mobile){note.textContent=prefix+dims+'. Контрольная ширина окна — 600 CSS px, фото внутри блока — до 568 px'+(result.neededHeight?' (рамка 16:10 — 568×355 px при масштабе 1:1)':' (режим целиком)')+'. '+(result.low?'Разрешения может не хватать; проверьте чёткость в макете.':'Проверьте качество в макете.');return;}
   note.textContent=result.low?'Фото для сайта: '+dims+'. На большом экране блок может достигать 1060 CSS px в ширину'+(result.neededHeight?' (рамка 16:10 — примерно 1060×663 px при масштабе 1:1)':'')+'. Изображение может выглядеть нечётким. Проверьте макет.':'Фото для сайта: '+dims+'. Ширина блока на большом экране — до 1060 CSS px. Проверьте качество в макете.';
  };img.onerror=()=>{if(valid())note.textContent=prefix+'Размер изображения не удалось определить. Проверьте фото в макете.';};img.src=src;
 }
 update();return{update};
}
function mountVariants(container,options){
 const main=mount(container,options),mobile=mount(container,{target:'mobile',source:()=>{const v=options.view()||{};return v.mobileImage?options.resolve(v.mobileImage):options.source();},view:()=>{const v=options.view()||{};return{mode:v.mobileMode&&v.mobileMode!=='inherit'?v.mobileMode:v.mode};},inherited:()=>!options.view()?.mobileImage});
 return{update(){main.update();mobile.update();}};
}
const api={WIDTH,HEIGHT,MOBILE_WIDTH,MOBILE_HEIGHT,USAGES,evaluateUsage,evaluate,mount,mountVariants};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaImageQuality=api;
})(typeof window==='object'?window:globalThis);
