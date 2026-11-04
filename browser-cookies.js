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
function preferredProfile(id,root){
  try{
    if(id!=='firefox')return JSON.parse(fs.readFileSync(path.join(root,'Local State'),'utf8')).profile?.last_used||'Default';
    const ini=fs.readFileSync(path.join(root,'..','profiles.ini'),'utf8');
    const sections=ini.split(/^\[/m).map(s=>s.split(/\r?\n/));
    const install=sections.find(lines=>/^Install[^\]]+\]/i.test(lines[0])&&lines.some(l=>/^Default=Profiles[\\/]/i.test(l)));
    const profile=sections.find(lines=>/^Profile\d+\]/i.test(lines[0])&&lines.includes('Default=1'));
    const entry=install?.find(l=>l.startsWith('Default='))||profile?.find(l=>l.startsWith('Path='));
    return entry?path.win32.basename(entry.slice(entry.indexOf('=')+1).trim()):'';
  }catch{return id==='firefox'?'':'Default';}
}
function selectProfile(id){
  const b=browsers[id];if(!Object.hasOwn(browsers,id))throw Error('Браузер не поддерживается.');
  const root=path.join(id==='firefox'?process.env.APPDATA:process.env.LOCALAPPDATA,b.folder);
  if(!fs.existsSync(root))return null;
  const real=fs.realpathSync(root);
  const preferred=preferredProfile(id,real);
  const dirs=fs.readdirSync(real,{withFileTypes:true}).filter(e=>e.isDirectory());
  const current=dirs.find(d=>d.name===preferred);
  const profiles=(current?[current]:dirs).flatMap(e=>{
    const files=id==='firefox'?['cookies.sqlite']:['Network/Cookies','Cookies'];
    const file=files.map(p=>path.join(real,e.name,p)).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
    if(!file)return [];
    const resolved=fs.realpathSync(file),rel=path.relative(real,resolved);
    if(path.isAbsolute(rel)||rel.split(path.sep)[0]==='..')return [];
    return [{name:e.name,file:resolved,mtime:fs.statSync(resolved).mtimeMs}];
  });
  return profiles.find(p=>id==='firefox'?p.name.endsWith('.default-release'):p.name==='Default')||
    profiles.sort((a,b)=>b.mtime-a.mtime||a.name.localeCompare(b.name))[0]||null;
}
async function closed(id){
  const exe=browsers[id].exe,{stdout}=await run(path.join(process.env.SystemRoot,'System32/tasklist.exe'),['/FI','IMAGENAME eq '+exe,'/FO','CSV','/NH'],{windowsHide:true,timeout:5000});
  return !stdout.toLowerCase().includes('"'+exe+'"');
}
function erase(file,firefox,site){
  site=domain(site);
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(file);
  try{
    db.exec('PRAGMA busy_timeout=500; BEGIN IMMEDIATE');
    const table=firefox?'moz_cookies':'cookies',key=firefox?'host':'host_key';
    const query='DELETE FROM '+table+' WHERE ltrim(lower('+key+"), '.') = ? OR ltrim(lower("+key+"), '.') LIKE ?";
    const result=db.prepare(query).run(site,'%.'+site);
    db.exec('COMMIT');return Number(result.changes);
  }finally{db.close();}
}
function install({ipcMain,getWindow,dialog,isClosed=closed}){
  const local=e=>getWindow()?.webContents===e.sender&&e.senderFrame===e.sender.mainFrame;
  ipcMain.handle('clear-browser-cookies',async(e,{id,site})=>{
    if(!local(e)||!Object.hasOwn(browsers,id))throw Error('Запрос недоступен.');
    site=domain(String(site||'').trim());
    const target=selectProfile(id),name=browsers[id].name,win=getWindow();
    if(win.isMinimized())win.restore();
    if(!win.isVisible())win.show();
    const {response}=await dialog.showMessageBox(win,{
      type:'question',title:'Запрос от Fifflaren',
      message:'Удалить cookies сайта '+site+' и его поддоменов в '+name+'?',
      detail:(target?'Профиль: '+target.name+'. ':'')+'Перед ответом «Да» полностью закрой '+name+'. После очистки может потребоваться повторный вход на сайт.',
      buttons:['Да','Нет'],defaultId:1,cancelId:1,noLink:true
    });
    if(response!==0||!local(e))return {cancelled:true};
    if(!target)return {count:0};
    if(!await isClosed(id))throw Error('Очистка отменена: браузер '+name+' открыт. Закрой его и запроси очистку снова.');
    if(!local(e))return {cancelled:true};
    if(!fs.existsSync(target.file)||fs.realpathSync(target.file)!==target.file)throw Error('Профиль браузера изменился. Запроси очистку снова.');
    return {count:erase(target.file,id==='firefox',site)};
  });
}
module.exports={install,domain,erase};
