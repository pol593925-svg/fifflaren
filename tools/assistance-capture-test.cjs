const {app,BrowserWindow,desktopCapturer,screen}=require('electron'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict');
app.setPath('userData',path.join(app.getPath('temp'),'support-capture-qa'));
app.whenReady().then(async()=>{
 const w=new BrowserWindow({show:false,webPreferences:{nodeIntegration:true,contextIsolation:false,backgroundThrottling:false}});
 w.webContents.session.setPermissionRequestHandler((wc,p,cb)=>cb(wc===w.webContents&&['media','display-capture'].includes(p)));
 const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}}),s=sources.find(s=>s.display_id===String(screen.getPrimaryDisplay().id));assert(s);
 const fixture=path.join(app.getPath('temp'),'support-capture-qa.html');fs.writeFileSync(fixture,'<!doctype html><title>Capture test</title>');await w.loadFile(fixture);
 const result=await w.webContents.executeJavaScript('(async()=>{const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:"desktop",chromeMediaSourceId:'+JSON.stringify(s.id)+',maxWidth:1280,maxHeight:720,maxFrameRate:12}}});const t=s.getVideoTracks()[0];const settings=t.getSettings();const video=document.createElement("video");video.muted=true;video.srcObject=s;await video.play();await new Promise(r=>video.requestVideoFrameCallback(r));const result={width:video.videoWidth,height:video.videoHeight,fps:settings.frameRate};s.getTracks().forEach(t=>t.stop());video.srcObject=null;return result;})()');
 assert(result.width>0&&result.width<=1280);assert(result.height>0&&result.height<=720);assert(result.fps<=12);
 console.log('PASS: actual Windows primary screen captured once at bounded resolution/FPS; tracks stopped; no images saved or transmitted',result);w.destroy();app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
