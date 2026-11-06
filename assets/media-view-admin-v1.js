(function(root){'use strict';
// Shared, local controls. Publication still uses each editor's existing preview.
function mount(container,value,options={}){
 const initial=value?JSON.parse(JSON.stringify(value)):undefined;let touched=false,reset=false;
 const details=document.createElement('details');details.className='ed-media-settings';const summary=document.createElement('summary');summary.textContent='Кадр и мобильное фото';details.append(summary);
 const grid=document.createElement('div');grid.className='ed-media-fields';details.append(grid);container.append(details);
 const emit=()=>{touched=true;reset=false;options.onChange?.(get());};
 function label(text,node){const l=document.createElement('label');l.append(document.createTextNode(text),node);grid.append(l);return node;}
 function select(text,items,selected){const n=document.createElement('select');for(const [v,t]of items)n.add(new Option(t,v));n.value=selected;n.addEventListener('change',emit);return label(text,n);}
 const mode=select('Основное изображение',[['cover','Заполнить рамку'],['whole','Показать целиком']],value?.mode||'cover');
 function point(title,position){
  const box=document.createElement('fieldset');box.className='ed-media-point';const legend=document.createElement('legend');legend.textContent=title;box.append(legend);grid.append(box);
  const nums=/^(\d+)% (\d+)%$/.exec(position||'')||[null,'50','50'];const sliders=[],labels=[];
  for(const [i,title]of ['По горизонтали','По вертикали'].entries()){const l=document.createElement('label'),name=document.createElement('span'),n=document.createElement('input');n.type='range';n.min='0';n.max='100';n.step='1';n.value=nums[i+1];const update=()=>{name.textContent=title+' · '+n.value+'%';};update();n.addEventListener('input',()=>{update();emit();});l.append(name,n);box.append(l);sliders.push(n);labels.push(update);}
  return{get:()=>sliders.map(n=>n.value+'%').join(' '),set:v=>{const p=/^(\d+)% (\d+)%$/.exec(v||'')||[null,'50','50'];sliders.forEach((n,i)=>{n.value=p[i+1];labels[i]();});},enable:v=>sliders.forEach(n=>n.disabled=!v),box};
 }
 const main=point('Положение основного кадра',value?.position||options.defaultPosition||'50% 50%');
 const mobile=document.createElement('input');mobile.type='text';mobile.className='ym-disable-keys';mobile.maxLength=2000;mobile.placeholder='То же фото, что на компьютере';mobile.value=value?.mobileImage||'';if(options.imageList)mobile.setAttribute('list',options.imageList);label('Фото для телефона (необязательно)',mobile);mobile.addEventListener('input',emit);
 const upload=document.createElement('label');upload.className='ed-upload';upload.append('Загрузить отдельное фото для телефона');const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';upload.append(file);grid.append(upload);
 async function choose(source){const value=await options.onMobileFile?.(source);if(value){mobile.value=value;refreshOriginal();emit();}}
 file.addEventListener('change',async()=>{const f=file.files[0];file.value='';if(!f)return;file.disabled=true;try{await choose(f);}catch(e){options.onError?.(e);}finally{file.disabled=false;}});
 const originalHolder=document.createElement('div');originalHolder.className='ed-original-holder';grid.append(originalHolder);
 function refreshOriginal(){originalHolder.replaceChildren();const selected=mobile.value;if(root.AelitaMediaOriginals&&options.api)root.AelitaMediaOriginals.controls(originalHolder,{api:options.api,value:selected,onChoose:choose,progress:options.progress,isCurrent:()=>selected===mobile.value&&(!options.isCurrent||options.isCurrent())});}
 refreshOriginal();mobile.addEventListener('change',refreshOriginal);
 const mobileMode=select('Кадр на телефоне',[['inherit','Как на компьютере'],['cover','Заполнить рамку'],['whole','Показать целиком']],value?.mobileMode||'inherit');
 const inherit=document.createElement('input');inherit.type='checkbox';inherit.checked=!value?.mobilePosition;const inheritedLabel=document.createElement('label');inheritedLabel.className='ed-check';inheritedLabel.append(inherit,document.createTextNode('Положение кадра как на компьютере'));grid.append(inheritedLabel);
 const mobilePoint=point('Положение мобильного кадра',value?.mobilePosition||value?.position||options.defaultPosition||'50% 50%');mobilePoint.enable(!inherit.checked);inherit.addEventListener('change',()=>{mobilePoint.enable(!inherit.checked);emit();});
 const hint=document.createElement('p');hint.className='ed-help';hint.textContent='Пустое мобильное фото наследует основное. Итоговый кадр — в макете страницы: «Телефон» и «Компьютер».';grid.append(hint);
 const restore=document.createElement('button');restore.type='button';restore.className='ed-quiet';restore.textContent='Вернуть оформление шаблона';restore.onclick=()=>{mode.value='cover';main.set(options.defaultPosition||'50% 50%');mobile.value='';mobileMode.value='inherit';inherit.checked=true;mobilePoint.set(options.defaultPosition||'50% 50%');mobilePoint.enable(false);refreshOriginal();reset=true;touched=true;options.onChange?.(get());};grid.append(restore);
 function get(){if(reset)return options.forceMode?{mode:'cover'}:initial?null:undefined;if(!touched)return initial||(options.forceMode?{mode:'cover'}:undefined);return{mode:mode.value,position:main.get(),...(mobile.value.trim()?{mobileImage:mobile.value.trim()}:{}),...(mobileMode.value!=='inherit'?{mobileMode:mobileMode.value}:{}),...(!inherit.checked?{mobilePosition:mobilePoint.get()}:{})};}
 return{get};
}
const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.AelitaMediaView=api;
})(typeof window==='object'?window:globalThis);
