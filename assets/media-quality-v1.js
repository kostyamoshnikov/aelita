(function(root){'use strict';
// Width and aspect ratio are derived from pages/blocks.css, at 1 image pixel
// per CSS pixel. This describes the large-screen block, not every device.
const WIDTH=1060,HEIGHT=Math.ceil(WIDTH*10/16);
const MOBILE_WIDTH=600-2*16,MOBILE_HEIGHT=Math.ceil(MOBILE_WIDTH*10/16);
function evaluate(width,height,mode,target='desktop'){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const neededWidth=target==='mobile'?MOBILE_WIDTH:WIDTH,needHeight=mode==='whole'?0:target==='mobile'?MOBILE_HEIGHT:HEIGHT;
 return {width,height,neededWidth,neededHeight:needHeight,low:width<neededWidth||height<needHeight};
}
function mount(container,options){
 const note=document.createElement('p');note.className='ed-help';note.setAttribute('role','status');container.append(note);let sequence=0;
 function update(){
  const at=++sequence,src=options.source(),mobile=options.target==='mobile',prefix=mobile?'Фото для телефона ('+(options.inherited?.()?'наследуется основное':'отдельное')+'): ':'';note.textContent='';if(!src)return;
  // Restrict loads to the same-origin image namespace or an editor's local draft.
  if((!/^\/images\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(src)||src.includes('..'))&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)){if(mobile)note.textContent=prefix+'размер не проверен: адрес вне локального каталога. Проверьте макет.';return;}
  const img=new Image();img.onload=()=>{if(at!==sequence||!container.isConnected)return;const result=evaluate(img.naturalWidth,img.naturalHeight,options.view()?.mode,options.target);
   if(!result)return;const dims=result.width+'×'+result.height+' px';
   if(mobile){note.textContent=prefix+dims+'. Контрольная ширина окна — 600 CSS px, фото внутри блока — до 568 px'+(result.neededHeight?' (рамка 16:10 — 568×355 px при масштабе 1:1)':' (режим целиком)')+'. '+(result.low?'Разрешения может не хватать; проверьте чёткость в макете.':'Проверьте качество в макете.');return;}
   note.textContent=result.low?'Фото для сайта: '+dims+'. На большом экране блок может достигать 1060 CSS px в ширину'+(result.neededHeight?' (рамка 16:10 — примерно 1060×663 px при масштабе 1:1)':'')+'. Изображение может выглядеть нечётким. Проверьте макет.':'Фото для сайта: '+dims+'. Ширина блока на большом экране — до 1060 CSS px. Проверьте качество в макете.';
  };img.onerror=()=>{if(at===sequence&&container.isConnected)note.textContent=prefix+'Размер изображения не удалось определить. Проверьте фото в макете.';};img.src=src;
 }
 update();return{update};
}
function mountVariants(container,options){
 const main=mount(container,options),mobile=mount(container,{target:'mobile',source:()=>{const v=options.view()||{};return v.mobileImage?options.resolve(v.mobileImage):options.source();},view:()=>{const v=options.view()||{};return{mode:v.mobileMode&&v.mobileMode!=='inherit'?v.mobileMode:v.mode};},inherited:()=>!options.view()?.mobileImage});
 return{update(){main.update();mobile.update();}};
}
const api={WIDTH,HEIGHT,MOBILE_WIDTH,MOBILE_HEIGHT,evaluate,mount,mountVariants};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaImageQuality=api;
})(typeof window==='object'?window:globalThis);
