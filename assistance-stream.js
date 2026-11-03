'use strict';
const QUALITY={economy:{width:960,height:540,fps:8,bitrate:650000,jpeg:800,interval:330},balanced:{width:1280,height:720,fps:12,bitrate:1500000,jpeg:960,interval:220},sharp:{width:1600,height:900,fps:15,bitrate:2500000,jpeg:1280,interval:250}};
class AssistanceStream{
 constructor({id,worker,rpc,source,onVideo=()=>{},onState=()=>{},onError=()=>{}}){
  Object.assign(this,{id,worker,rpc,source,onVideo,onState,onError});this.quality='balanced';this.closed=false;this.ice=[];this.seq=0;this.signals=Promise.resolve();
  try{
   this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}],bundlePolicy:'max-bundle'});
   this.pc.onicecandidate=e=>{if(e.candidate&&!this.closed)this.send({type:'ice',candidate:e.candidate.toJSON()}).catch(()=>{});};
   this.pc.ontrack=e=>{if(!this.closed)this.onVideo(e.streams[0]||new MediaStream([e.track]));};
   this.pc.onconnectionstatechange=()=>{if(this.closed)return;const fast=this.pc.connectionState==='connected';this.onState(fast?'Прямой видеопоток':'Экономичный канал');};
  }catch{this.pc=null;}
 }
 send(d){return this.rpc('signal',{id:this.id,...d});}
 async capture(){
  const source=await this.source();if(this.closed)return;
  const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:source.id,maxWidth:1600,maxHeight:900,maxFrameRate:15}}});
  if(this.closed){media.getTracks().forEach(t=>t.stop());return;}
  this.media=media;const track=media.getVideoTracks()[0];track.contentHint='detail';track.onended=()=>{if(!this.closed)this.onError(Error('Передача экрана остановлена'));};
  this.preview=document.createElement('video');this.preview.muted=true;this.preview.srcObject=media;
  await this.preview.play();await this.setQuality(this.quality);
 }
 async start(){
  if(this.closed||!this.media)return;
  this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false});
  void this.relay();
  try{
   if(!this.pc)return;this.sender=this.pc.addTrack(this.media.getVideoTracks()[0],this.media);
   await this.pc.setLocalDescription(await this.pc.createOffer());if(this.closed)return;
   await this.send({type:'offer',sdp:this.pc.localDescription.sdp});await this.setQuality(this.quality);
  }catch{if(!this.closed)this.onState('Экономичный канал');}
 }
 signal(d){
  this.signals=this.signals.then(async()=>{
   if(this.closed||!this.pc)return;
   if(d.type==='ice'){if(this.pc.remoteDescription)await this.pc.addIceCandidate(d.candidate);else this.ice.push(d.candidate);return;}
   await this.pc.setRemoteDescription({type:d.type,sdp:d.sdp});
   for(const c of this.ice.splice(0))await this.pc.addIceCandidate(c);
   if(d.type==='offer'){
    await this.pc.setLocalDescription(await this.pc.createAnswer());if(this.closed)return;
    await this.send({type:'answer',sdp:this.pc.localDescription.sdp});
   }
  }).catch(()=>{if(!this.closed)this.onState('Экономичный канал');});
 }
 async setQuality(name){
  if(!QUALITY[name])return;this.quality=name;const q=QUALITY[name];
  try{await this.media?.getVideoTracks()[0]?.applyConstraints({width:{max:q.width},height:{max:q.height},frameRate:{max:q.fps}});}catch{}
  try{if(this.sender){const p=this.sender.getParameters();if(!p.encodings?.length)p.encodings=[{}];p.encodings[0].maxBitrate=q.bitrate;p.encodings[0].maxFramerate=q.fps;p.degradationPreference='balanced';await this.sender.setParameters(p);}}catch{}
 }
 async relay(){
  if(this.closed)return;const started=performance.now(),q=QUALITY[this.quality];
  // One encoded frame in flight, acknowledged only after it has been decoded by the viewer.
  if(this.pc?.connectionState!=='connected'&&this.preview?.readyState>=2){
   try{
    const w=Math.min(q.jpeg,this.preview.videoWidth),h=Math.max(1,Math.round(w*this.preview.videoHeight/this.preview.videoWidth));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    this.ctx.drawImage(this.preview,0,0,w,h);
    const blob=await new Promise(r=>this.canvas.toBlob(r,'image/jpeg',.58));
    if(!this.closed&&blob&&blob.size<=180000){const bytes=await blob.arrayBuffer();if(!this.closed)await this.rpc('frame',{id:this.id,seq:++this.seq,bytes});}
   }catch{}
  }
  if(!this.closed)this.timer=setTimeout(()=>this.relay(),Math.max(160,q.interval-(performance.now()-started)));
 }
 close(){
  this.closed=true;clearTimeout(this.timer);this.pc?.close();this.media?.getTracks().forEach(t=>t.stop());
  if(this.preview){this.preview.pause();this.preview.srcObject=null;}this.canvas=null;this.ctx=null;this.ice=[];
 }
}
module.exports={AssistanceStream,QUALITY};
