'use strict';
const helper=require('./assistance-input'),{validate,KEYS}=require('./assistance-protocol');
function install({ipcMain,BrowserWindow,screen,shell,clipboard,desktopCapturer,globalShortcut,app,getMain,spawn=require('child_process').spawn}){
 let active=null,banner=null,child=null,timer=null,moveTimer=null,pendingMove=null,viewer=false,previousFullscreen=false,previousThrottle=true;
 const watched=new WeakSet();
 function sender(e){return getMain()&&!getMain().isDestroyed()&&e.sender===getMain().webContents;}
 function write(d){if(!child?.stdin?.writable)throw Error('Управление недоступно');if(child.stdin.writableLength>65536)throw Error('Канал ввода перегружен');child.stdin.write(JSON.stringify(d)+'\n');}
 function restoreView(){if(!viewer)return;viewer=false;const w=getMain();if(w&&!w.isDestroyed())w.setFullScreen(previousFullscreen);}
 function stop(){
  const id=active;active=null;if(id&&getMain()&&!getMain().isDestroyed())getMain().webContents.setBackgroundThrottling(previousThrottle);clearTimeout(timer);timer=null;clearTimeout(moveTimer);moveTimer=null;pendingMove=null;
  if(child){const old=child;child=null;try{old.stdin.write('{"kind":"release"}\n');old.stdin.end();}catch{}const kill=setTimeout(()=>old.kill(),700);kill.unref();old.once('exit',()=>clearTimeout(kill));}
  if(banner&&!banner.isDestroyed())banner.destroy();banner=null;
  globalShortcut.unregister('Control+Alt+F12');restoreView();
  if(id)getMain()?.webContents.send('assistance-ended-local',{id});
 }
 function watchWindow(){const wc=getMain().webContents;if(!watched.has(wc)){watched.add(wc);wc.on('render-process-gone',stop);wc.on('destroyed',stop);}}
 ipcMain.handle('assistance-begin',async(event,data)=>{
  if(!sender(event)||typeof data?.id!=='string'||data.id.length>60||typeof data.admin!=='string')throw Error('Недоступный источник');
  stop();watchWindow();active=data.id;previousThrottle=getMain().webContents.getBackgroundThrottling();getMain().webContents.setBackgroundThrottling(false);
  const {bounds}=screen.getPrimaryDisplay();
  const ownBanner=banner=new BrowserWindow({width:510,height:58,x:bounds.x+Math.round((bounds.width-510)/2),y:bounds.y+bounds.height-84,frame:false,alwaysOnTop:true,resizable:false,movable:true,skipTaskbar:true,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  ownBanner.setAlwaysOnTop(true,'screen-saver');ownBanner.setMenu(null);
  const name=data.admin.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  await ownBanner.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<style>body{margin:0;background:#17272e;color:#e5f5f2;font:13px Segoe UI;display:flex;align-items:center;gap:14px;padding:10px 16px}b{color:#80e4ba}small{font-size:10px;color:#a0b8bc}button{margin-left:auto;background:#bd5356;border:0;border-radius:7px;color:white;padding:9px;cursor:pointer}</style><div><b>● In work</b> · '+name+'<br><small>Мышь и клавиатура · Ctrl+Alt+F12 — остановить</small></div><button onclick="location.href=\'https://support-hub-stop.invalid/\'">Остановить</button>'));
  if(active!==data.id||banner!==ownBanner||ownBanner.isDestroyed())return {id:null};
  ownBanner.webContents.on('will-navigate',(e,url)=>{e.preventDefault();if(url==='https://support-hub-stop.invalid/')stop();});
  ownBanner.on('closed',()=>{if(banner===ownBanner&&active)stop();});ownBanner.showInactive();
  if(!globalShortcut.register('Control+Alt+F12',stop)){stop();throw Error('Не удалось включить клавишу остановки');}
  child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-InputFormat','Text','-OutputFormat','Text','-EncodedCommand',Buffer.from(helper,'utf16le').toString('base64')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const owned=child;
  child.on('error',()=>{if(child===owned)stop();});child.on('exit',()=>{if(child===owned&&active)stop();});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{if(child===owned)stop();});
  try{await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Не удалось запустить управление')),12000);let output='';
   owned.stdout.on('data',buf=>{output=(output+buf.toString()).slice(-1024);if(output.includes('READY')){clearTimeout(timeout);resolve();}});
   owned.once('error',()=>{clearTimeout(timeout);reject(Error('Ошибка запуска управления'));});
   owned.once('exit',()=>{clearTimeout(timeout);reject(Error('Управление остановлено'));});
  });}catch(e){if(child===owned)stop();throw e;}
  if(active!==data.id)return {id:null};timer=setTimeout(stop,600000);return {id:active};
 });
 ipcMain.handle('assistance-source',async(e,d)=>{
  if(!sender(e)||!active||d?.id!==active)throw Error('Сеанс завершён');
  const id=active,sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0},fetchWindowIcons:false});
  if(active!==id)throw Error('Сеанс завершён');
  const primary=String(screen.getPrimaryDisplay().id),source=sources.find(s=>s.display_id===primary);
  if(!source)throw Error('Основной экран недоступен');return {id:source.id};
 });
 ipcMain.handle('assistance-view',(e,enabled)=>{
  if(!sender(e))throw Error('Недоступный источник');
  if(enabled){watchWindow();if(!viewer){previousFullscreen=getMain().isFullScreen();viewer=true;}getMain().setFullScreen(true);}
  else restoreView();return {fullscreen:!!enabled};
 });
 ipcMain.handle('assistance-clipboard',e=>{
  if(!sender(e)||!viewer)throw Error('Открой удалённое управление');
  const text=clipboard.readText();if(text.length>20000)throw Error('Вставляй не более 20 000 символов за раз');return text;
 });
 ipcMain.handle('assistance-command',async(e,d)=>{
  if(!sender(e)||!active||d?.id!==active)throw Error('Управление остановлено');
  const c=validate(d);
  if(c.kind==='url'){await shell.openExternal(c.url);return true;}
  if(c.kind==='move'){
   const b=screen.getPrimaryDisplay().bounds,p=screen.dipToScreenPoint({x:b.x+Math.round(c.x*(b.width-1)),y:b.y+Math.round(c.y*(b.height-1))});
   pendingMove={kind:'move',x:p.x,y:p.y};
   if(!moveTimer)moveTimer=setTimeout(()=>{moveTimer=null;const m=pendingMove;pendingMove=null;if(m&&active)try{write(m);}catch{stop();}},16);
   return true;
  }
  clearTimeout(moveTimer);moveTimer=null;pendingMove=null;
  if(c.kind==='paste'){clipboard.writeText(c.text);write({kind:'key',vk:KEYS.KeyV,ctrl:true});return true;}
  if(c.kind==='key'){write({...c,vk:KEYS[c.code]});return true;}
  if(['down','up','click','right','wheel'].includes(c.kind)){
   const b=screen.getPrimaryDisplay().bounds,p=screen.dipToScreenPoint({x:b.x+Math.round(c.x*(b.width-1)),y:b.y+Math.round(c.y*(b.height-1))});c.x=p.x;c.y=p.y;
  }
  write(c);return true;
 });
 ipcMain.handle('assistance-stop',(e,d)=>{if(sender(e)&&(!d?.id||active===d.id||viewer))stop();});
 app.on('before-quit',stop);
 return {stop,canCapture:wc=>!!active&&getMain()?.webContents===wc};
}
module.exports={install,helper};
