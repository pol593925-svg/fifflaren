const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),http=require('http');
const root=path.resolve(__dirname,'..'),base=path.resolve(root,'..'),deps=path.join(base,'servertest/node_modules'),{Server}=require(path.join(deps,'socket.io'));
const install=require(path.join(base,'support-hub-server/assistance-service'));
app.on('window-all-closed',()=>{});app.setPath('userData',path.join(app.getPath('temp'),'support-assistance-qa'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));const windows=[],inputs=[],errors=[],views=[],captures=[];let service,server,io;
async function until(fn,label,timeout=20000){const at=Date.now();while(!await fn()){if(Date.now()-at>timeout)throw Error('Timeout: '+label);await wait(100);}}
app.whenReady().then(async()=>{
 server=http.createServer();io=new Server(server,{cors:{origin:'*'}});service=install({io,authenticate:async t=>({a:{username:'admin',role:'admin'},w:{username:'worker',role:'user'}}[t])});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 ipcMain.handle('assistance-stop',()=>true);ipcMain.handle('assistance-begin',(_,d)=>({id:d.id}));
 ipcMain.handle('assistance-source',(_,d)=>{captures.push(d.id);return {id:'fixture'};});
 ipcMain.handle('assistance-view',(_,v)=>{views.push(v);return {fullscreen:v};});
 ipcMain.handle('assistance-clipboard',()=> 'Привет из буфера\nВторая строка');
 ipcMain.handle('assistance-command',(_,d)=>{inputs.push(d);return true;});
 async function windowFor(token,relay=false){
  const w=new BrowserWindow({show:false,width:1280,height:800,webPreferences:{nodeIntegration:true,contextIsolation:false,backgroundThrottling:false}});windows.push(w);
  w.webContents.on('console-message',(...args)=>{const message=args[0].message||args[2],level=args[0].level??args[1];if(level==='error'||level>=3){errors.push(message);console.log('RENDERER',message);}});
  const css=fs.readFileSync(path.join(root,'app-theme.css'),'utf8').slice(fs.readFileSync(path.join(root,'app-theme.css'),'utf8').indexOf('/* Remote control'));
  fs.mkdirSync(path.join(root,'graphics-qa'),{recursive:true});const fixture=path.join(root,'graphics-qa/assistance-fixture.html');fs.writeFileSync(fixture,'<meta charset="utf-8"><style>body{margin:0;font-family:Arial}'+css+'</style>');await w.loadFile(fixture);
  await w.webContents.executeJavaScript('window.__require=require; window.require=n=>__require(n.startsWith("./assistance-")?'+JSON.stringify(root.replace(/\\/g,'/'))+'+"/"+n.slice(2):n);void 0;');
  await w.webContents.executeJavaScript('window.__clients=[];window.io=(...args)=>{const s=__require('+JSON.stringify(path.join(deps,'socket.io-client'))+').io(...args);__clients.push(s);return s};'+
   'window.__PC=RTCPeerConnection;window.__peers=[];window.RTCPeerConnection=function(o){const p=new __PC({iceServers:[]});__peers.push(p);return p;};'+
   (relay?'window.RTCPeerConnection=function(){throw Error("blocked for relay test")};':'')+
   'navigator.mediaDevices.getUserMedia=async()=>{window.__canvas=document.createElement("canvas");__canvas.width=1280;__canvas.height=720;const c=__canvas.getContext("2d");let n=0;window.__draw=setInterval(()=>{c.fillStyle="#18374c";c.fillRect(0,0,1280,720);c.fillStyle="#55dda8";c.fillRect((++n*7)%1100,180,100,250);c.fillStyle="white";c.font="32px Arial";c.fillText("Support Hub · remote test",50,80);},70);return __canvas.captureStream(12);};void 0;');
  await w.webContents.executeJavaScript(fs.readFileSync(path.join(root,'assistance-client.js'),'utf8'));
  await w.webContents.executeJavaScript('HubAssistance.configure({token:'+JSON.stringify(token)+',server:'+JSON.stringify(url)+',io});');
  await until(()=>w.webContents.executeJavaScript('__clients[0]?.connected'),'socket');return w;
 }
 const worker=await windowFor('w'),admin=await windowFor('a');
 await admin.webContents.executeJavaScript('HubAssistance.request("worker")');
 await until(()=>admin.webContents.executeJavaScript('document.querySelector("video").videoWidth>0&&!document.querySelector("video").hidden'),'real WebRTC video');
 const video=await admin.webContents.executeJavaScript('({width:document.querySelector("video").videoWidth,height:document.querySelector("video").videoHeight,states:__peers.map(p=>p.connectionState)})');assert(video.states.includes('connected'));assert.equal(captures.length,1);
 await admin.webContents.executeJavaScript('const st=document.querySelector(".assistance-screen"),r=st.getBoundingClientRect(),opt={bubbles:true,clientX:r.left+r.width*.4,clientY:r.top+r.height*.4,pointerId:1,button:0};st.setPointerCapture=()=>{};st.hasPointerCapture=()=>false;st.dispatchEvent(new PointerEvent("pointerdown",opt));st.dispatchEvent(new PointerEvent("pointermove",{...opt,clientX:r.left+r.width*.6,buttons:1}));st.dispatchEvent(new PointerEvent("pointerup",{...opt,clientX:r.left+r.width*.6}));st.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:"Ж",code:"Semicolon"}));st.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:"a",code:"KeyA",ctrlKey:true}));st.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:"v",code:"KeyV",ctrlKey:true}));');
 await until(()=>inputs.some(d=>d.kind==='paste'),'paste');
 assert(inputs.some(d=>d.kind==='down'));assert(inputs.some(d=>d.kind==='up'));assert(inputs.some(d=>d.kind==='text'&&d.text==='Ж'));assert(inputs.some(d=>d.kind==='key'&&d.code==='KeyA'&&d.ctrl));
 assert.equal(inputs.find(d=>d.kind==='paste').text,'Привет из буфера\nВторая строка');
 assert(views.includes(true));
 const metrics=await admin.webContents.executeJavaScript('(()=>{const d=document.querySelector("dialog").getBoundingClientRect(),s=document.querySelector(".assistance-screen").getBoundingClientRect();return {dialogWidth:d.width,viewport:innerWidth,screenHeight:s.height}})()');assert.equal(metrics.dialogWidth,metrics.viewport);assert(metrics.screenHeight>500);
 fs.mkdirSync(path.join(root,'graphics-qa'),{recursive:true});fs.writeFileSync(path.join(root,'graphics-qa/assistance-3441.png'),(await admin.webContents.capturePage()).toPNG());
 console.log('PASS: real WebRTC two Electron renderers, single capture, full-window viewer, drag/Cyrillic/shortcuts/paste routed. Video:',video);
 await admin.webContents.executeJavaScript('HubAssistance.stop()');await wait(200);assert.equal(service.sessions.size,0);
 const closed=await worker.webContents.executeJavaScript('__peers.every(p=>p.connectionState==="closed")');assert(closed);
 // New sockets avoid the intentional start throttle. Force WebRTC unavailable to exercise binary fallback.
 for(const w of [admin,worker]){await w.webContents.executeJavaScript('__clients.forEach(s=>s.disconnect());clearInterval(window.__draw)');w.destroy();}
 const relayWorker=await windowFor('w',true),relayAdmin=await windowFor('a',true);
 await relayAdmin.webContents.executeJavaScript('HubAssistance.request("worker")');
 await until(()=>relayAdmin.webContents.executeJavaScript('document.querySelector("img").naturalWidth>0'),'binary relay');
 const rel=await relayAdmin.webContents.executeJavaScript('({w:document.querySelector("img").naturalWidth,text:document.querySelector("[role=status]").textContent})');assert(rel.w<=960);assert(rel.text.includes('экономичный'));
 await relayAdmin.webContents.executeJavaScript('HubAssistance.stop()');await wait(100);
 assert.equal(service.sessions.size,0);assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: fallback binary JPEG, decoded-frame acknowledgement, bounded resolution, stream/connection cleanup; no renderer errors');
 service.stop();await new Promise(r=>io.close(r));windows.forEach(w=>{if(!w.isDestroyed())w.destroy();});app.exit(0);
}).catch(async e=>{console.error(e);console.log('CAPTURES',captures,'INPUTS',inputs.length,'SESSIONS',service?.sessions.size);for(const w of windows){if(!w.isDestroyed())try{console.log('STATE',await w.webContents.executeJavaScript('({text:document.body.innerText,peers:window.__peers?.map(p=>({state:p.connectionState,ice:p.iceConnectionState,local:p.localDescription?.type,remote:p.remoteDescription?.type})),streams:window.__canvas?.width})'));}catch{}}service?.stop();windows.forEach(w=>{if(!w.isDestroyed())w.destroy();});app.exit(1);});
