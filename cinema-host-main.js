'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{io}=require('socket.io-client');
const {create}=require('./cinema-library-main');
const SERVER='https://support-hub-server-v3.onrender.com';
function install({app,ipcMain,getWindow,serverUrl=SERVER}){
  const folder=path.join(app.getPath('userData'),'cinema-library'),store=create(folder);let sock=null,token='',ready=false,legacyBytes=0;
  const validSender=e=>getWindow()&&!getWindow().isDestroyed()&&getWindow().webContents===e.sender;
  async function key(bind){
    const file=path.join(folder,'origin.key');
    try{return (await fs.readFile(file,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!bind)return null;await fs.mkdir(folder,{recursive:true});
    try{await fs.writeFile(file,crypto.randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
    return (await fs.readFile(file,'utf8')).trim();
  }
  async function publish(net){
    const r=await net.timeout(12000).emitWithAck('catalog',await store.list());if(!r?.ok)throw Error(r?.error||'Каталог не подтверждён.');
    if(net!==sock||!net.connected)throw Error('ПК отключился.');legacyBytes=r.legacyBytes;ready=true;
  }
  function stop(){sock?.disconnect();sock=null;token='';ready=false;}
  let generation=0;
  async function connect(value,bind){
    if(typeof value!=='string'||!value)throw Error('Войди как Fifflaren.');
    if(sock&&token===value&&ready)return {online:true};
    const turn=++generation,id=await key(bind);if(turn!==generation)throw Error('Сессия изменилась.');
    if(!id)return {online:false};if(!/^[a-f0-9]{64}$/.test(id))throw Error('Повреждена привязка библиотеки.');
    stop();token=value;
    const net=io(serverUrl+'/cinema-origin',{auth:{token:value,hostId:id},autoConnect:false});sock=net;
    net.on('disconnect',()=>{if(sock===net)ready=false;});
    net.on('read',async(q,ack)=>{if(typeof ack!=='function')return;try{if(!ready||sock!==net)throw Error();ack(await store.read(q?.id,q?.offset));}catch{ack(null);}});
    net.on('remove',async(id,ack)=>{if(typeof ack!=='function')return;try{if(!ready||sock!==net)throw Error('ПК не подключён.');await store.remove(id);ack({ok:true});}catch(e){ack({error:e.message});}});
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('ПК не успел подключиться. Попробуй ещё раз.')),15000);
      net.on('connect',async()=>{try{await publish(net);clearTimeout(timer);resolve({online:true});}catch(e){clearTimeout(timer);if(net===sock){net.disconnect();ready=false;}reject(e);}});
      net.once('connect_error',e=>{clearTimeout(timer);reject(Error(e.message||'Не удалось подключить ПК.'));});net.connect();
    });
  }
  ipcMain.handle('cinema-pc-connect',(e,{token,bind}={})=>{if(!validSender(e))throw Error('Недоступно.');return connect(token,bind===true);});
  ipcMain.on('cinema-pc-stop',e=>{if(validSender(e)){generation++;stop();}});
  ipcMain.handle('cinema-pc-add',async(e,{source,meta}={})=>{
    if(!validSender(e)||!sock?.connected||!ready)throw Error('Подключи свой ПК к кинозалу.');
    const net=sock;await publish(net);
    const same=()=>sock===net&&net.connected&&ready;
    const film=await store.add(source,meta,legacyBytes,p=>{if(!e.sender.isDestroyed())e.sender.send('cinema-pc-progress',p);},same);
    try{await publish(net);}catch{throw Error('Фильм сохранён на ПК. Каталог обновится после переподключения.');}
    return film;
  });
  const shutdown=()=>{generation++;stop();};app.on('before-quit',shutdown);return shutdown;
}
module.exports={install};
