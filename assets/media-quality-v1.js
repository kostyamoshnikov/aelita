(function(root){'use strict';
// Width and aspect ratio are derived from pages/blocks.css, at 1 image pixel
// per CSS pixel. This describes the large-screen block, not every device.
const WIDTH=1060,HEIGHT=Math.ceil(WIDTH*10/16);
function evaluate(width,height,mode){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const needHeight=mode==='whole'?0:HEIGHT;
 return {width,height,neededWidth:WIDTH,neededHeight:needHeight,low:width<WIDTH||height<needHeight};
}
function mount(container,options){
 const note=document.createElement('p');note.className='ed-help';note.setAttribute('role','status');container.append(note);let sequence=0;
 function update(){
  const at=++sequence,src=options.source();note.textContent='';if(!src)return;
  // Restrict loads to the same-origin image namespace or an editor's local draft.
  if((!/^\/images\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(src)||src.includes('..'))&&!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src))return;
  const img=new Image();img.onload=()=>{if(at!==sequence||!container.isConnected)return;const result=evaluate(img.naturalWidth,img.naturalHeight,options.view()?.mode);
   if(!result)return;const dims=result.width+'×'+result.height+' px';
   note.textContent=result.low?'Фото для сайта: '+dims+'. На большом экране блок может достигать 1060 CSS px в ширину'+(result.neededHeight?' (рамка 16:10 — примерно 1060×663 px при масштабе 1:1)':'')+'. Изображение может выглядеть нечётким. Проверьте макет.':'Фото для сайта: '+dims+'. Ширина блока на большом экране — до 1060 CSS px. Проверьте качество в макете.';
  };img.onerror=()=>{if(at===sequence&&container.isConnected)note.textContent='Размер изображения не удалось определить. Проверьте фото в макете.';};img.src=src;
 }
 update();return{update};
}
const api={WIDTH,HEIGHT,evaluate,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaImageQuality=api;
})(typeof window==='object'?window:globalThis);
