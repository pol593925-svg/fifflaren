'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_AGE=30*86400000;
function create({file,safeStorage,now=Date.now}){
 const available=()=>safeStorage.isEncryptionAvailable()&&!(process.platform==='linux'&&safeStorage.getSelectedStorageBackend?.()==='basic_text');
 const clear=()=>{try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}};
 function read(){
  try{
   if(!available())return null;
   const bytes=fs.readFileSync(file);if(bytes.length>16384){clear();return null;}
   const data=JSON.parse(safeStorage.decryptString(bytes));
   if(!valid(data)||data.expiresAt<=now()){clear();return null;}
   return data;
  }catch{clear();return null;}
 }
 function valid(v){return v&&typeof v.username==='string'&&v.username.length>0&&v.username.length<=100&&/^[A-Za-z0-9_-]{43}$/.test(v.token)&&Number.isFinite(v.expiresAt);}
 function save(input){
  if(!available())return {saved:false};
  const data={username:String(input?.username||'').trim(),token:input?.callsToken,expiresAt:Math.min(Number(input?.sessionExpiresAt)||now()+MAX_AGE,now()+MAX_AGE)};
  if(!valid(data)||data.expiresAt<=now())throw Error('Invalid session');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp';fs.writeFileSync(tmp,safeStorage.encryptString(JSON.stringify(data)),{mode:0o600});fs.renameSync(tmp,file);
  return {saved:true};
 }
 return {read,save,clear,profile(){const d=read();return d?{username:d.username,expiresAt:d.expiresAt}:null;}};
}
function install({app,ipcMain,safeStorage,getWindow}){
 let vault;const get=()=>vault||(vault=create({file:path.join(app.getPath('userData'),'login-session.bin'),safeStorage}));
 const handler=(name,fn)=>ipcMain.handle(name,(event,data)=>{
  const win=getWindow();if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Unauthorized login request');
  return fn(data);
 });
 handler('auth-profile',()=>({profile:get().profile(),version:app.getVersion()}));
 handler('auth-save',data=>get().save(data));
 handler('auth-session-read',()=>get().read());
 handler('auth-forget',()=>{get().clear();return true;});
}
module.exports={create,install};
