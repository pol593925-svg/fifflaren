'use strict';
// This module only deletes matching cookie rows. Profile paths come from the local browser installation.
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile);
const browsers={
  chrome:{name:'Chrome',folder:'Google/Chrome/User Data',exe:'chrome.exe'},
  brave:{name:'Brave',folder:'BraveSoftware/Brave-Browser/User Data',exe:'brave.exe'},
  edge:{name:'Edge',folder:'Microsoft/Edge/User Data',exe:'msedge.exe'},
  firefox:{name:'Firefox',folder:'Mozilla/Firefox/Profiles',exe:'firefox.exe'}
};
function domain(value){
  let u;try{u=new URL(value.includes('://')?value:'https://'+value);}catch{}
  if(!u||!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||!/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(u.hostname))throw Error('Введи домен сайта, например example.com.');
  return u.hostname.toLowerCase();
}
function profiles(id){
  const b=browsers[id];if(!Object.hasOwn(browsers,id))throw Error('Браузер не поддерживается.');
  const root=path.join(id==='firefox'?process.env.APPDATA:process.env.LOCALAPPDATA,b.folder);
  if(!fs.existsSync(root))return [];
  const real=fs.realpathSync(root);
  return fs.readdirSync(real,{withFileTypes:true}).filter(e=>e.isDirectory()).flatMap(e=>{
    const file=['firefox'===id?'cookies.sqlite':'Network/Cookies',...(id==='firefox'?[]:['Cookies'])].map(p=>path.join(real,e.name,p)).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
    if(!file)return [];
    const resolved=fs.realpathSync(file),rel=path.relative(real,resolved);
    if(path.isAbsolute(rel)||rel.split(path.sep)[0]==='..')return [];
    return [{name:e.name,file:resolved}];
  });
}
async function closed(id){
  const exe=browsers[id].exe,{stdout}=await run(path.join(process.env.SystemRoot,'System32/tasklist.exe'),['/FI','IMAGENAME eq '+exe,'/FO','CSV','/NH'],{windowsHide:true,timeout:5000});
  return !stdout.toLowerCase().includes('"'+exe+'"');
}
function erase(file,firefox,site){
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(file);
  try{
    db.exec('PRAGMA busy_timeout=500; BEGIN IMMEDIATE');
    const table=firefox?'moz_cookies':'cookies',key=firefox?'host':'host_key';
    const query='DELETE FROM '+table+(site?' WHERE ltrim(lower('+key+"), '.') = ? OR ltrim(lower("+key+"), '.') LIKE ?":'');
    const result=site?db.prepare(query).run(site,'%.'+site):db.prepare(query).run();
    db.exec('COMMIT');return Number(result.changes);
  }finally{db.close();}
}
function install({ipcMain,getWindow,dialog}){
  const local=e=>getWindow()?.webContents===e.sender&&e.senderFrame===e.sender.mainFrame;
  ipcMain.handle('cookie-profiles',(e,id)=>local(e)?profiles(id).map(p=>p.name):[]);
  ipcMain.handle('clear-browser-cookies',async(e,{id,profile,site,all})=>{
    if(!local(e)||typeof profile!=='string')throw Error('Запрос недоступен.');
    const target=profiles(id).find(p=>p.name===profile);if(!target)throw Error('Профиль не найден.');
    site=all===true?null:domain(String(site||'').trim());
    const {response}=await dialog.showMessageBox(getWindow(),{type:'warning',title:'Очистка cookies',message:'Удалить cookies '+(site?'сайта '+site+' и его поддоменов':'всех сайтов')+'?',detail:browsers[id].name+' · профиль '+profile+'. Потребуется снова войти на затронутые сайты. Пароли, история и закладки сохранятся.',buttons:['Отмена','Очистить cookies'],defaultId:0,cancelId:0,noLink:true});
    if(response!==1)return {cancelled:true};
    if(!await closed(id))throw Error('Полностью закрой '+browsers[id].name+' и повтори.');
    return {count:erase(target.file,id==='firefox',site)};
  });
}
module.exports={install,domain,erase};
