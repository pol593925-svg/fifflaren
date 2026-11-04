(function(){
  const ipc=require('electron').ipcRenderer;
  const pending=new Map();
  let next=Promise.resolve();
  function notice(text){
    const n=document.createElement('p');
    n.className='cookie-result';
    n.setAttribute('role','status');
    n.textContent=text;
    document.body.append(n);
    setTimeout(()=>n.remove(),8000);
  }
  function open({browser,site}){
    const key=browser+'|'+site;
    if(pending.has(key))return pending.get(key);
    next=next.then(async()=>{
      try{
        const result=await ipc.invoke('clear-browser-cookies',{id:browser,site});
        if(!result.cancelled)notice(result.count?'Cookies для '+site+' очищены.':'Сохранённых cookies для '+site+' нет.');
      }catch(e){notice(e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}
    }).finally(()=>pending.delete(key));
    pending.set(key,next);
    return next;
  }
  window.HubCookieDialog={open};
})();
