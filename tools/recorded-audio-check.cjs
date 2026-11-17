// Run with Electron. Exercises the packaged app's file:// XHR/decoder/mixer path.
const {app,BrowserWindow}=require('electron'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.GRAPHICS_OUTPUT||path.join(root,'graphics-qa');
fs.mkdirSync(out,{recursive:true});
app.disableHardwareAcceleration();app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const html=path.join(out,'audio-file-check.html'),reportFile=path.join(out,'recorded-audio-check.json');
fs.writeFileSync(html,`<!doctype html><base href="${pathToFileURL(root+path.sep).href}"><script src="cs16-sound-bank.js"></script><script src="cs16-battle-audio.js"></script><script src="cs16-footsteps.js"></script>`);
let window,finished=false;const diagnostics=[];
function finish(error,report={}){
 if(finished)return;finished=true;clearTimeout(watchdog);
 const result={passed:!error,...report,diagnostics,...(error?{error:error.stack||String(error)}:{})};
 fs.writeFileSync(reportFile,JSON.stringify(result,null,2));
 console[error?'error':'log'](error?'RECORDED_AUDIO_FAIL':'RECORDED_AUDIO_PASS',JSON.stringify(result));
 if(window&&!window.isDestroyed())window.destroy();app.exit(error?1:0);
}
const watchdog=setTimeout(()=>finish(Error('Electron audio check exceeded 30 seconds')),30000);
process.on('uncaughtException',finish);process.on('unhandledRejection',finish);
app.whenReady().then(async()=>{
 window=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});
 window.webContents.on('console-message',event=>{if(event.level==='error'||event.level===3)diagnostics.push(event.message);});
 window.webContents.on('render-process-gone',(_event,details)=>finish(Error('Audio renderer exited: '+JSON.stringify(details))));
 let report;
 try{
  await window.loadFile(html);
  report=await window.webContents.executeJavaScript(`(async()=>{
   const start=performance.now(),requests=[],decodeCalls=[],fetchCalls=[];
   const nativeOpen=XMLHttpRequest.prototype.open;
   XMLHttpRequest.prototype.open=function(method,url,...args){requests.push(String(url));return nativeOpen.call(this,method,url,...args);};
   window.fetch=(...args)=>{fetchCalls.push(args[0]);throw Error('file:// audio must use local XHR');};
   const context=new OfflineAudioContext(2,48000,48000),nativeDecode=context.decodeAudioData.bind(context);
   context.decodeAudioData=async bytes=>{const decoded=await nativeDecode(bytes);decodeCalls.push(decoded);return decoded;};
   const bank=CS16SoundBank.create(context),prepared=await Promise.all([bank.prepare('battle'),bank.prepare('steps')]);
   const unique=new Map();
   for(const [key,names]of Object.entries(CS16SoundBank.files))for(let variant=0;variant<names.length;variant++){
    const sample=bank.get(key,variant);if(!sample)throw Error('Recording not decoded: '+names[variant]);
    if(unique.has(names[variant])&&unique.get(names[variant]).sample!==sample)throw Error('Duplicate decode: '+names[variant]);
    unique.set(names[variant],{sample,key,variant});
   }
   const clips=[...unique].map(([file,{sample,key,variant}])=>({file,key,variant,duration:sample.duration,channels:sample.numberOfChannels,sampleRate:sample.sampleRate}));
   const audio=CS16BattleAudio.create(context,{listener:()=>({x:0,y:1.62,z:0,yaw:0}),blocked:()=>false,indoor:()=>true}),steps=CS16Footsteps.create(context);
   await Promise.all([audio.prepare(),steps.prepare()]);const requestsBeforePlay=requests.length;
   for(let i=0;i<28;i++)audio.shot(['m4a1','ak47','awp','mp5'][i%4],[0,1.62,-2]);
   for(let i=0;i<8;i++)steps.play(['stone','grass','wood','earth','metal'][i%5],1);
   const rendered=await context.startRendering();let peak=0,energy=0;
   for(let c=0;c<2;c++)for(const sample of rendered.getChannelData(c)){if(!Number.isFinite(sample))throw Error('Non-finite sample');peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
   audio.dispose();steps.dispose();bank.dispose();
   const stress={protocol:location.protocol,prepared,clips,uniqueFiles:unique.size,uniqueDecodedBuffers:new Set(decodeCalls).size,decodeCalls:decodeCalls.length,requests:requests.length,requestsBeforePlay,fetchCalls:fetchCalls.length,peak,rms:Math.sqrt(energy/96000),elapsedMs:performance.now()-start};
   // Produce a short actual engine render: sole contact, AK burst, M4 burst, sniper, then walking.
   const previewContext=new OfflineAudioContext(2,48000*8,48000);
   const previewAudio=CS16BattleAudio.create(previewContext,{listener:()=>({x:0,y:1.62,z:0,yaw:0}),blocked:()=>false,indoor:()=>false}),previewSteps=CS16Footsteps.create(previewContext);
   await Promise.all([previewAudio.prepare(),previewSteps.prepare()]);
   const events=[
    [.12,()=>previewSteps.play('stone',.65,-.12)],[.5,()=>previewSteps.play('stone',.65,.12)],
    ...[1.1,1.2,1.3,1.4].map(t=>[t,()=>previewAudio.shot('ak47',[-.3,1.62,-1])]),
    ...[2.65,2.75,2.85,2.95].map(t=>[t,()=>previewAudio.shot('m4a1',[.3,1.62,-1])]),
    [4.25,()=>previewAudio.shot('awp',[0,1.62,-1])],
    [6.05,()=>previewSteps.play('grass',.7,-.12)],[6.43,()=>previewSteps.play('grass',.7,.12)],
    [6.81,()=>previewSteps.play('wood',.7,-.12)],[7.19,()=>previewSteps.play('metal',.7,.12)],
   ];
   const pauses=events.map(([at])=>previewContext.suspend(at)),rendering=previewContext.startRendering();
   for(let i=0;i<events.length;i++){await pauses[i];events[i][1]();await previewContext.resume();}
   const preview=await rendering;previewAudio.dispose();previewSteps.dispose();
   const bytes=new ArrayBuffer(44+preview.length*4),view=new DataView(bytes),put=(at,text)=>{for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));};
   put(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);put(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);put(36,'data');view.setUint32(40,bytes.byteLength-44,true);
   let previewPeak=0;for(let i=0;i<preview.length;i++)for(let c=0;c<2;c++){const sample=preview.getChannelData(c)[i];previewPeak=Math.max(previewPeak,Math.abs(sample));view.setInt16(44+(i*2+c)*2,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);}
   let binary='';const values=new Uint8Array(bytes);for(let i=0;i<values.length;i+=8192)binary+=String.fromCharCode(...values.subarray(i,i+8192));
   return {stress,preview:{durationSeconds:8,channels:2,sampleRate:48000,peak:previewPeak,base64:btoa(binary)}};
  })()`,true);
  const {stress,preview}=report;
  assert.equal(stress.protocol,'file:');assert(stress.prepared.every(x=>x.loaded===x.total));
  assert.equal(stress.uniqueFiles,41);assert.equal(stress.uniqueDecodedBuffers,41);assert.equal(stress.decodeCalls,41);
  assert.equal(stress.requests,41);assert.equal(stress.requestsBeforePlay,41);assert.equal(stress.fetchCalls,0);
  assert(stress.peak<1,'overlapping recordings clip: '+stress.peak);assert(stress.rms>.001,'render unexpectedly silent');assert(preview.peak<1);
  const previewFile=path.join(out,'recorded-preview.wav');fs.writeFileSync(previewFile,Buffer.from(preview.base64,'base64'));delete preview.base64;preview.file=previewFile;
  finish(null,{...stress,preview});
 }catch(error){if(report?.preview)delete report.preview.base64;finish(error,report?{...report.stress,preview:report.preview}:{});}
}).catch(finish);
