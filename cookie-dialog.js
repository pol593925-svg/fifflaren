(function(){
  const names={chrome:'Chrome',brave:'Brave',edge:'Edge',firefox:'Firefox'},ipc=require('electron').ipcRenderer;
  let dlg;
  async function open({browser,site}){
    if(dlg?.open||!Object.hasOwn(names,browser))return;
    dlg=document.createElement('dialog');dlg.className='hub-work-dialog';
    const heading=document.createElement('h3'),note=document.createElement('p'),sel=document.createElement('select'),done=document.createElement('button'),close=document.createElement('button'),status=document.createElement('p');
    heading.textContent='Очистка cookies · '+names[browser];note.textContent='Fifflaren предлагает удалить cookies '+(site?'для '+site:'для всех сайтов')+'. Выбери профиль и полностью закрой браузер. Решение принимаешь ты.';
    close.textContent='Отмена';done.textContent='Очистить cookies';done.disabled=true;sel.setAttribute('aria-label','Профиль браузера');status.setAttribute('role','status');
    dlg.append(heading,note,sel,done,close,status);document.body.append(dlg);const active=dlg;active.onclose=()=>{active.remove();if(dlg===active)dlg=null;};
    close.onclick=()=>active.close();active.showModal();close.focus();
    try{const profiles=await ipc.invoke('cookie-profiles',browser);for(const p of profiles)sel.add(new Option(p,p));done.disabled=!profiles.length;if(!profiles.length)status.textContent='Профиль с cookies не найден.';}catch{status.textContent='Не удалось открыть список профилей.';}
    done.onclick=async()=>{done.disabled=true;try{
      const r=await ipc.invoke('clear-browser-cookies',{id:browser,profile:sel.value,site,all:!site});
      if(r.cancelled){active.close();return;}status.textContent='Удалено записей cookies: '+r.count;close.textContent='Готово';
    }catch(e){status.textContent=e.message;done.disabled=false;}};
  }
  window.HubCookieDialog={open};
})();
