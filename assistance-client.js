(function(){
'use strict';
const ipc=require('electron').ipcRenderer,{AssistanceStream}=require('./assistance-stream'),{KEYS}=require('./assistance-protocol');
let config,socket,session,peer,dialog,img,video,stage,status,toolbar,quality,worker=false,ready=false,frameAt=0,objectUrl=null,move=null,moveTimer=null,healthTimer=null,requestVersion=0,frameCallback=null,composing=false;
const rpc=(name,data={})=>new Promise((resolve,reject)=>{
 if(!socket?.connected)return reject(Error('Нет связи'));
 socket.timeout(name==='start'?16000:5000).emit(name,data,(e,r)=>e||!r?.ok?reject(Error(r?.error||'Сервер не ответил')):resolve(r));
});
const text=message=>{if(status)status.textContent=message;};
const mods=e=>({ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,meta:e.metaKey});
function release(){move=null;if(session&&!worker&&socket?.connected)rpc('command',{id:session.id,kind:'release'}).catch(()=>{});}
async function end(send=true,message='Сеанс завершён.'){
 ++requestVersion;const id=session?.id;session=null;ready=false;worker=false;
 clearInterval(moveTimer);clearInterval(healthTimer);moveTimer=healthTimer=null;move=null;
 peer?.close();peer=null;
 if(video){if(frameCallback!=null)video.cancelVideoFrameCallback?.(frameCallback);frameCallback=null;video.pause();video.srcObject=null;}
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 if(img)img.removeAttribute('src');
 if(toolbar)toolbar.hidden=true;
 try{await ipc.invoke('assistance-stop',{id});}catch{}
 if(send&&socket?.connected)rpc('stop',id?{id}:{}).catch(()=>{});
 text(message);
}
function enabled(){return session&&!worker&&ready&&Date.now()-frameAt<6000;}
function command(d){if(d.kind!=='release'&&!enabled())return;return rpc('command',{id:session?.id,...d}).catch(e=>text(e.message));}
function frameLoop(id){
 if(session?.id!==id)return;frameAt=Date.now();
 if(video.requestVideoFrameCallback)frameCallback=video.requestVideoFrameCallback(()=>frameLoop(id));
}
function viewer(data){
 session=data;worker=false;ready=true;
 if(!peer)peer=new AssistanceStream({id:data.id,worker:false,rpc,onVideo:stream=>{
  if(session?.id!==data.id)return;video.srcObject=stream;video.hidden=false;img.hidden=true;
  video.play().then(()=>{if(session?.id===data.id){video.hidden=false;img.hidden=true;frameLoop(data.id);text('In work · '+data.worker+' · прямой видеопоток');}}).catch(()=>{});
 },onState:mode=>text('In work · '+data.worker+' · '+mode)});
 toolbar.hidden=false;stage.focus();
 if(!moveTimer)moveTimer=setInterval(()=>{
  if(!move||!enabled()||!socket?.connected||socket.io?.engine?.transport?.writable===false)return;
  const p=move;move=null;socket.volatile.emit('pointer',{id:session.id,kind:'move',...p});
 },33);
 if(!healthTimer)healthTimer=setInterval(()=>{const stale=!enabled();stage.classList.toggle('assistance-stale',stale);if(stale)release();},1500);
 rpc('quality',{id:data.id,quality:quality.value}).catch(()=>{});
}
async function paste(){
 if(!enabled())return;
 try{const id=session.id,value=await ipc.invoke('assistance-clipboard');if(session?.id!==id)return;if(!value){text('В буфере обмена нет текста.');return;}await command({kind:'paste',text:value});stage.focus();}catch(e){text(e.message);}
}
function setup(){
 if(dialog)return;
 dialog=document.createElement('dialog');dialog.className='hub-assistance';
 dialog.innerHTML='<header><div><strong>Удалённое управление</strong><span role="status"></span></div><div class="assistance-actions"><button data-panel title="Показать или скрыть панель">Панель</button><button data-full>⛶ Весь экран</button><button data-close>Завершить ✕</button></div></header><div class="assistance-toolbar" hidden><input aria-label="Ссылка для сотрудника" placeholder="https://…"><button data-url>Открыть ссылку</button><button data-paste>Вставить текст · Ctrl+V</button><select aria-label="Качество передачи"><option value="economy">Экономичный</option><option value="balanced" selected>Сбалансированный</option><option value="sharp">Чёткий текст</option></select><small>Кликни по экрану, чтобы печатать. Работают перетаскивание, двойной клик и сочетания клавиш. Ctrl+Alt+F12 — завершить.</small></div><div class="assistance-screen" tabindex="0" aria-label="Экран сотрудника. Кликните для управления мышью и клавиатурой"><video muted autoplay playsinline hidden></video><img draggable="false" alt="Экран сотрудника"></div>';
 document.body.append(dialog);
 img=dialog.querySelector('img');video=dialog.querySelector('video');stage=dialog.querySelector('.assistance-screen');status=dialog.querySelector('[role=status]');toolbar=dialog.querySelector('.assistance-toolbar');quality=dialog.querySelector('select');
 dialog.querySelector('[data-close]').onclick=()=>{end();dialog.close();};
 dialog.addEventListener('cancel',()=>end());
 dialog.querySelector('[data-full]').onclick=()=>ipc.invoke('assistance-view',true).catch(e=>text(e.message));
 dialog.querySelector('[data-panel]').onclick=()=>dialog.classList.toggle('assistance-compact');
 dialog.querySelector('[data-paste]').onclick=paste;
 quality.onchange=()=>{if(session)rpc('quality',{id:session.id,quality:quality.value}).catch(e=>text(e.message));};
 dialog.querySelector('[data-url]').onclick=async()=>{
  try{const url=new URL(dialog.querySelector('input').value);if(!['http:','https:'].includes(url.protocol))throw Error('Нужна ссылка HTTP или HTTPS');await command({kind:'url',url:url.href});stage.focus();}catch(e){text(e.message);}
 };
 function coords(e,clamp=false){
  const media=video.hidden?img:video,r=media.getBoundingClientRect(),nw=video.hidden?img.naturalWidth:video.videoWidth,nh=video.hidden?img.naturalHeight:video.videoHeight;
  if(!nw||!nh||!r.width||!r.height)return null;
  const scale=Math.min(r.width/nw,r.height/nh),w=nw*scale,h=nh*scale;
  let x=(e.clientX-r.left-(r.width-w)/2)/w,y=(e.clientY-r.top-(r.height-h)/2)/h;
  if(clamp){x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));}
  return x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null;
 }
 stage.addEventListener('pointermove',e=>{const p=coords(e,!!e.buttons);if(p&&enabled())move=p;});
 stage.addEventListener('pointerdown',e=>{
  const p=coords(e);if(!p||!enabled()||e.button>2)return;
  e.preventDefault();stage.focus();stage.setPointerCapture(e.pointerId);move=null;
  command({kind:'down',button:e.button,...p,...mods(e)});
 });
 stage.addEventListener('pointerup',e=>{
  const p=coords(e,true);move=null;if(p&&e.button<=2)command({kind:'up',button:e.button,...p,...mods(e)});
  if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
 });
 stage.addEventListener('lostpointercapture',release);stage.addEventListener('pointercancel',release);
 stage.addEventListener('contextmenu',e=>e.preventDefault());
 stage.addEventListener('wheel',e=>{e.preventDefault();const p=coords(e);if(p)command({kind:'wheel',delta:-Math.sign(e.deltaY)*Math.min(6,Math.max(1,Math.round(Math.abs(e.deltaY)/100))),...p});},{passive:false});
 stage.addEventListener('keydown',e=>{
  e.preventDefault();e.stopImmediatePropagation();
  if(e.ctrlKey&&e.altKey&&e.code==='F12'){end();dialog.close();return;}
  if(!enabled()||composing||e.isComposing||['Control','Shift','Alt','Meta','AltGraph'].includes(e.key))return;
  if(e.ctrlKey&&!e.altKey&&e.code==='KeyV'){if(!e.repeat)paste();return;}
  if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&Array.from(e.key).length===1){command({kind:'text',text:e.key});return;}
  if(Object.hasOwn(KEYS,e.code))command({kind:'key',code:e.code,...mods(e)});
 },true);
 stage.addEventListener('keyup',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
 stage.addEventListener('compositionstart',()=>composing=true);
 stage.addEventListener('compositionend',e=>{composing=false;if(e.data)command({kind:'text',text:e.data.slice(0,256)});});
 stage.addEventListener('blur',release);window.addEventListener('blur',release);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
 video.addEventListener('timeupdate',()=>{if(!video.requestVideoFrameCallback)frameAt=Date.now();});
}
async function configure(options){
 if(config?.token===options.token&&socket)return;
 await end();socket?.disconnect();config=options;if(!config.token)return;
 socket=config.io(config.server+'/assistance',{auth:{token:config.token,protocol:2},transports:['websocket','polling']});
 socket.on('begin',async data=>{
  await end(false);session=data;worker=true;
  try{
   const local=await ipc.invoke('assistance-begin',data);if(!local?.id||session?.id!==data.id)return;
   peer=new AssistanceStream({id:data.id,worker:true,rpc,source:()=>ipc.invoke('assistance-source',{id:data.id}),onError:e=>end(true,e.message)});
   const owned=peer;await owned.capture();if(session?.id!==data.id){owned.close();return;}
   await rpc('ready',{id:data.id});if(session?.id===data.id)await owned.start();
  }catch(e){if(session?.id===data.id)end(true,e.message);}
 });
 socket.on('ready',data=>{if(dialog?.open&&!worker)viewer(data);});
 socket.on('signal',d=>{if(session?.id===d.id)peer?.signal(d);});
 socket.on('quality',d=>{if(worker&&session?.id===d.id)peer?.setQuality(d.quality);});
 socket.on('frame',async(d,ack)=>{
  if(session?.id!==d.id||!img||worker){ack?.({seq:d.seq});return;}
  let url;try{
   if(peer?.pc?.connectionState==='connected'&&video.readyState>=2){ack?.({seq:d.seq});return;}
   url=URL.createObjectURL(new Blob([d.bytes],{type:'image/jpeg'}));
   const decoded=new Image();decoded.src=url;await decoded.decode();
   if(session?.id!==d.id||(peer?.pc?.connectionState==='connected'&&video.readyState>=2))return;
   const old=objectUrl;objectUrl=url;url=null;img.src=objectUrl;img.hidden=false;video.hidden=true;
   if(old)URL.revokeObjectURL(old);frameAt=Date.now();text('In work · '+session.worker+' · экономичный канал');
  }catch{}finally{if(url)URL.revokeObjectURL(url);ack?.({seq:d.seq});}
 });
 socket.on('command',d=>{if(!worker||session?.id!==d.id)return;ipc.invoke('assistance-command',d).catch(e=>end(true,e.message));});
 socket.on('ended',d=>{if(session?.id===d.id)end(false);});
 socket.on('disconnect',()=>end(false,'Соединение прервано. Подключись заново.'));
 socket.on('connect_error',e=>text(e.message));
}
ipc.on('assistance-ended-local',(_,d)=>{if(session?.id===d.id)end();});
document.addEventListener('DOMContentLoaded',()=>document.getElementById('logoutBtn')?.addEventListener('click',()=>{end();socket?.disconnect();socket=null;config=null;}));
window.HubAssistance={configure,stop:end,async request(target){
 await end();setup();const version=++requestVersion;
 if(!dialog.open)dialog.showModal();dialog.classList.remove('assistance-compact');
 toolbar.hidden=true;video.hidden=true;img.hidden=false;frameAt=0;text('Подключение к '+target+'…');
 try{
  await ipc.invoke('assistance-view',true);
  const d=await rpc('start',{target});
  if(version!==requestVersion||!dialog.open){rpc('stop',{id:d.session.id}).catch(()=>{});return;}
  session=d.session;if(!ready)text('Подготовка управления у '+target+'…');
 }catch(e){await end(false,e.message);}
}};
})();
