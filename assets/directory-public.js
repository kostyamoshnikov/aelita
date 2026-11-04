(function(){'use strict';
 var en=document.documentElement.lang==='en', id=document.body.dataset.eventId, root=document.getElementById('directory-content');
 if(!id&&!root)return;
 function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
 function safePage(s){return typeof s==='string'&&/^\/(?:[a-z0-9][a-z0-9-]*\/){1,3}$/.test(s)&&!/^\/(?:admin|account|api|content|assets|images|documents|bot)\//.test(s)?s:'';}
 function safeImage(s){return typeof s==='string'&&/^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(s)&&!s.includes('..')?s:'';}
 function card(item,kind,short){
  var block=el('article','dp-card'),content=el('div','dp-card-body');block.id=short?'':'card-'+item.id;
  var img=safeImage(item.image);if(img){var picture=el('img','dp-image');picture.src=img;picture.alt=(en&&item.imageAltEn)||item.imageAlt||'';picture.loading='lazy';block.append(picture);}
  var label=kind==='person'?(en?'Person':'Участник'):(en?'Venue':'Площадка');content.append(el('p','dp-type',label));
  var name=(en&&item.nameEn)||item.name||'',title=el('h3','dp-title');if(short){var to=el('a');to.href=(en?'/en':'')+'/directory/#'+item.id;to.textContent=name;title.append(to);}else title.textContent=name;content.append(title);
  var description=(en&&item.descriptionEn)||item.description||'';if(description){var p=el('p','dp-description',description);content.append(p);}
  if(!short&&kind==='venue'&&(item.city||item.address))content.append(el('p','dp-location',[item.city,item.address].filter(Boolean).join(' · ')));
  if(!short){var page=safePage((en&&item.pageEn)||item.page);if(page){var a=el('a','dp-link',en?'Existing page →':'Страница на сайте →');a.href=page;content.append(a);}if(item.website){try{var u=new URL(item.website);if(u.protocol==='https:'&&!u.username&&!u.password){var w=el('a','dp-link',en?'Website ↗':'Сайт ↗');w.href=u.href;w.target='_blank';w.rel='noopener noreferrer';content.append(w);}}catch(_){}}}
  block.append(content);return block;
 }
 function render(data){if(!data||data.schema!=='aelita.public-directory/v1'||!Array.isArray(data.people)||!Array.isArray(data.venues)||!Array.isArray(data.bindings))throw Error();
  if(id){var binding=data.bindings.find(function(x){return x.eventId===id;});if(!binding)return;var list=[];(binding.people||[]).forEach(function(pid){var p=data.people.find(function(x){return x.id===pid;});if(p)list.push([p,'person']);});var venue=data.venues.find(function(v){return v.id===binding.venue;});if(venue)list.push([venue,'venue']);if(!list.length)return;
   var section=el('section','dp-event');section.setAttribute('aria-label',en?'People and venue':'Участники и площадка');section.append(el('h2','dp-heading',en?'People and venue':'Участники и площадка'));var grid=el('div','dp-grid');list.forEach(function(x){grid.append(card(x[0],x[1],true));});section.append(grid);var main=document.querySelector('.em-public-main');if(main)main.append(section);return;
  }
  root.replaceChildren();var groups=[[en?'People':'Люди',data.people,'person'],[en?'Venues':'Площадки',data.venues,'venue']];groups.forEach(function(g){var section=el('section','dp-group');section.append(el('h2','dp-heading',g[0]));var grid=el('div','dp-grid');g[1].forEach(function(item){grid.append(card(item,g[2],false));});if(!g[1].length)grid.append(el('p','dp-empty',en?'No public cards yet.':'Публичных карточек пока нет.'));section.append(grid);root.append(section);});
  var hash=location.hash.slice(1);if(/^(?:person|venue)-[a-f0-9]{32}$/.test(hash)){var target=document.getElementById('card-'+hash);if(target){target.scrollIntoView({block:'start'});target.classList.add('dp-highlight');}}
 }
 fetch('/content/directory-v1.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json();}).then(render).catch(function(){if(root)root.textContent=en?'Cards are temporarily unavailable. Please try again later.':'Карточки временно недоступны. Попробуйте позже.';});
})();
