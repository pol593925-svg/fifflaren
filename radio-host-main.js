'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{io}=require('socket.io-client');
function install({app,ipcMain,getWindow,serverUrl='https://support-hub-server-v3.onrender.com'}){
  const store=require('./radio-library-main').create(path.join(app.getPath('userData'),'radio-library'));let socket=null,token='',generation=0;
  const valid=e=>getWindow()&&!getWindow().isDestroyed()&&e.sender===getWindow().webContents;
  function stop(){generation++;socket?.disconnect();socket=null;token='';}
  ipcMain.handle('radio-pc-connect',async(e,value)=>{
    if(!valid(e)||typeof value!=='string'||!value)throw Error('Войди в Support Hub.');
    if(socket?.connected&&token===value&&socket.ready)return {online:true};
    stop();const turn=generation;const dir=path.join(app.getPath('userData'),'cinema-library'),file=path.join(dir,'origin.key');await fs.mkdir(dir,{recursive:true});
    try{await fs.writeFile(file,crypto.randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(err){if(err.code!=='EEXIST')throw err;}
    const hostId=(await fs.readFile(file,'utf8')).trim();if(generation!==turn)throw Error('Сессия изменилась.');
    const net=io(serverUrl+'/radio-origin',{auth:{token:value,hostId},autoConnect:false});socket=net;token=value;
    net.on('disconnect',()=>{net.ready=false;});
    for(const name of ['start','part','finish','read'])net.on(name,async(q,ack)=>{
      if(typeof ack!=='function')return;try{if(socket!==net||!net.connected||!net.ready)throw Error('ПК переподключается.');
        const result=name==='start'?await store.start(q):name==='part'?await store.part(q.id,q.n,q.bytes):name==='finish'?await store.finish(q.id):await store.read(q.id,q.offset);
        ack({ok:true,result});
      }catch(err){ack({error:err.status?err.message:'Не удалось прочитать или сохранить трек на ПК.',status:err.status||503});}
    });
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('ПК не успел подключиться к радио.')),15000);
      net.on('connect',async()=>{try{const r=await net.timeout(12000).emitWithAck('catalog',await store.list());if(!r?.ok)throw Error(r?.error||'Каталог радио не принят.');
        if(socket!==net||!net.connected)throw Error('ПК отключён.');net.ready=true;clearTimeout(timer);resolve({online:true});
      }catch(err){clearTimeout(timer);net.disconnect();reject(err);}});
      net.once('connect_error',err=>{clearTimeout(timer);reject(Error(err.message));});net.connect();
    });
  });
  ipcMain.on('radio-pc-stop',e=>{if(valid(e))stop();});app.on('before-quit',stop);return stop;
}
module.exports={install};
