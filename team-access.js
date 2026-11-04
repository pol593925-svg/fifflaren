(function(){
  const $=id=>document.getElementById(id);
  let session, handling=false;
  async function offer(reload=true){
    if(handling)return;handling=true;
    localStorage.removeItem('sh_auth');localStorage.removeItem('support_hub_user');localStorage.removeItem('global_worker_nick');
    try{await require('electron').ipcRenderer.invoke('offer-support-hub-removal');}finally{if(reload)location.reload();else handling=false;}
  }
  async function api(path,data){const r=await fetch(session.server+'/api/owner/'+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:data&&JSON.stringify(data),signal:AbortSignal.timeout(15000)});if(!r.ok){let msg;try{msg=(await r.json()).message;}catch{}throw Error(msg||'Не удалось выполнить действие ('+r.status+').');}return r.json();}
  async function refresh(){
    if(session?.username.toLowerCase()!=='fifflaren')return;
    try{const {users}=await api('employees'),sel=$('offboardUser'),prev=sel.value;sel.replaceChildren(new Option('Выбрать сотрудника',''));
      users.forEach(n=>sel.add(new Option(n,n)));sel.value=prev;
    }catch(e){$('accessStatus').textContent=e.message;}
  }
  function start(cfg){session=cfg;const owner=cfg.username.toLowerCase()==='fifflaren';$('ownerAccess').hidden=!owner;if(!owner)return;
    $('adminTabBtn').addEventListener('click',refresh);
    async function cookies(local){try{
      const browser=$('cookieBrowser').value,raw=$('cookieSite').value.trim(),u=new URL(raw.includes('://')?raw:'https://'+raw),site=u.hostname;
      if(!/^([a-z0-9-]+\.)+[a-z0-9-]+$/.test(site)||u.username||u.password||!['http:','https:'].includes(u.protocol))throw Error('Проверь домен рабочего сайта.');
      if(local){await HubCookieDialog.open({browser,site});return;}
      const username=$('offboardUser').value;if(!username)throw Error('Сначала выбери сотрудника.');
      await api('cookie-request',{browser,site,username});$('accessStatus').textContent='Запрос отправлен · '+username+'. Очистку подтверждает сотрудник.';
    }catch(e){$('accessStatus').textContent=e.message;}}
    $('cookieHere').onclick=()=>cookies(true);$('cookieOffer').onclick=()=>cookies(false);
    $('offboardBtn').onclick=async()=>{
      const name=$('offboardUser').value;
      if(!name||!confirm('Закрыть доступ для '+name+' и предложить ему удалить Support Hub?'))return;
      $('offboardBtn').disabled=true;
      try{await api('offboard',{username:name});$('accessStatus').textContent='Доступ закрыт · '+name;await refresh();}catch(e){$('accessStatus').textContent=e.message;}finally{$('offboardBtn').disabled=false;}
    };
  }
  function subscribe(socket){
    socket.on('account_offboarded',()=>offer());socket.on('cookie_offer',data=>HubCookieDialog.open(data));
    const send=()=>{if(session?.token)socket.emit('account_subscribe',session.token);};
    socket.on('connect',send);if(socket.connected)send();
  }
  window.HubAccess={start,subscribe,offer,authorization:()=>session?.token?'Bearer '+session.token:''};
})();
