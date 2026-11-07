// Work tabs do not need Three.js, maps or game input handlers. Share the engine on first use.
(function(){
  const scripts=new Map(),opening=new Map();let session=null;
  function script(src){
    if(!scripts.has(src)){
      scripts.set(src,new Promise((resolve,reject)=>{
        const el=document.createElement('script');el.src=src;
        el.onload=resolve;el.onerror=()=>{el.remove();scripts.delete(src);reject(Error('Не удалось загрузить '+src));};
        document.head.append(el);
      }));
    }
    return scripts.get(src);
  }
  async function group(name){
    for(const el of document.getElementById('game-scripts-'+name).content.querySelectorAll('script[src]'))await script(el.getAttribute('src'));
  }
  function configure(cfg){session=cfg;window.HubVoxels?.configure(cfg);window.HubRoyale?.configure(cfg);}
  async function open(id,nick){
    if(opening.has(id))return opening.get(id);
    const tab=document.getElementById('tab-'+id);
    const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Подготавливаем игру…';
    if(!scripts.has(id==='voxel'?'voxel-game.js':'cs16.js'))tab.prepend(message);
    const task=(async()=>{
      try{
        await group('engine');await group(id);
        if(!session||!tab.classList.contains('active')){message.remove();return;}
        if(id==='cs16'){window.HubRoyale?.configure(session);window.__cs16Open(nick);}
        else{window.HubVoxels.configure(session);window.HubVoxels.open();}
      }catch(e){
        message.textContent=e.message+'. ';const retry=document.createElement('button');retry.textContent='Попробовать ещё раз';
        retry.onclick=()=>{message.remove();open(id,nick);};message.append(retry);tab.prepend(message);return;
      }finally{opening.delete(id);}
      message.remove();
    })();
    opening.set(id,task);return task;
  }
  async function close(){session=null;window.HubRoyale?.close();await window.HubVoxels?.leave();}
  window.HubGames={configure,open,close};
})();
