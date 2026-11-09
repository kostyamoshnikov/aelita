(function () {
  'use strict';
  var KEY='aelita_staff_session_v1', CRM='aelita_crm_session_v1', ADMIN='aelita_admin_token', memory=null;
  function read(){
    for(var i=0;i<2;i++){try { var raw=(i?sessionStorage:localStorage).getItem(KEY);if(raw){var x=JSON.parse(raw);if(x&&typeof x.crmToken==='string')return x;} } catch (_) {}}
    return memory;
  }
  function set(x){
    var value={crmToken:x.token||x.crmToken||'',adminToken:x.adminToken||'',user:x.user||null};memory=value;
    try { localStorage.setItem(CRM,value.crmToken);if(value.adminToken)localStorage.setItem(ADMIN,value.adminToken);else localStorage.removeItem(ADMIN);localStorage.setItem(KEY,JSON.stringify(value));sessionStorage.removeItem(KEY); }
    catch(_){try{[KEY,CRM,ADMIN].forEach(function(k){localStorage.removeItem(k);});}catch(_){}try{sessionStorage.setItem(KEY,JSON.stringify(value));}catch(_){}}
    return value;
  }
  function clear(){memory=null;for(var i=0;i<2;i++){try{var s=i?sessionStorage:localStorage;[KEY,CRM,ADMIN].forEach(function(k){s.removeItem(k);});}catch(_){}}}
  window.AelitaStaffSession={key:KEY,read:read,set:set,clear:clear};
  window.addEventListener('storage',function(e){
    if(e.key!==KEY)return;
    var old=null,next=null;try{old=e.oldValue&&JSON.parse(e.oldValue);next=e.newValue&&JSON.parse(e.newValue);}catch(_){}
    if(!next||!old||next.crmToken!==old.crmToken){memory=next;window.dispatchEvent(new CustomEvent('aelita-staff-session-changed'));if(window.location&&typeof window.location.reload==='function')window.location.reload();}
  });
}());
