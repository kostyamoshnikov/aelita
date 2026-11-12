/* Explicit final check shared by CRM letters and newsletters. No transport. */
(() => {
  'use strict';
  let open = false;
  window.AelitaConfirmMail = async function ({title='Проверка письма', facts=[], previews=[], warnings=[], label='Отправить письмо', check='Я проверил письмо и получателей', valid=()=>true}={}) {
    if (open) return false;
    open = true;
    const dialog=document.createElement('dialog');
    dialog.className='mail-confirm';
    dialog.setAttribute('aria-labelledby','mail-confirm-title');
    const add=(parent,tag,text,cls)=>{
      const node=document.createElement(tag);
      if(text!=null)node.textContent=text;
      if(cls)node.className=cls;
      parent.append(node);return node;
    };
    add(dialog,'h2',title).id='mail-confirm-title';
    const list=add(dialog,'dl',null,'mail-confirm-facts');
    facts.forEach(([name,value])=>{add(list,'dt',name);add(list,'dd',String(value??'—'));});
    warnings.forEach(text=>add(dialog,'p',text,'mail-confirm-warning'));
    previews.forEach((preview,index)=>{
      const section=add(dialog,'section',null,'mail-confirm-preview');
      add(section,'h3',preview.title||preview.subject||'Письмо');
      if(preview.html){
        const frame=add(section,'iframe');
        frame.title=preview.title||'Предпросмотр письма '+(index+1);
        frame.setAttribute('sandbox','');frame.setAttribute('referrerpolicy','no-referrer');
        frame.srcdoc=preview.html;
      }else add(section,'div',preview.text||'','mail-confirm-text');
      if(preview.attachments?.length)add(section,'p','Вложения: '+preview.attachments.map(x=>x.name).join(', '));
      if(preview.link)add(section,'p','Ссылка: '+preview.link);
    });
    const agreement=add(dialog,'label',null,'mail-confirm-check');
    const checkbox=add(agreement,'input');checkbox.type='checkbox';
    add(agreement,'span',check);
    const error=add(dialog,'p','','mail-confirm-error');error.setAttribute('role','status');
    const actions=add(dialog,'div',null,'mail-confirm-actions');
    const back=add(actions,'button','Вернуться к проверке');back.type='button';
    const send=add(actions,'button',label,'mail-confirm-send');send.type='button';send.disabled=true;
    checkbox.onchange=()=>{send.disabled=!checkbox.checked;};
    // showModal makes the editor inert. Enter never accepts the dialog.
    dialog.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target!==send){event.preventDefault();}});
    return new Promise(resolve=>{
      let settled=false;
      const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();open=false;resolve(value);};
      back.onclick=()=>finish(false);
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      dialog.addEventListener('close',()=>finish(false));
      send.onclick=()=>{
        if(!checkbox.checked)return;
        if(!valid()){error.textContent='Письмо или аудитория изменились. Вернитесь и выполните проверку заново.';send.disabled=true;return;}
        send.disabled=true;finish(true);
      };
      document.body.append(dialog);
      try{dialog.showModal();back.focus();}catch(_){finish(false);}
    });
  };
})();
