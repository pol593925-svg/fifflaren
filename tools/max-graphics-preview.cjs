'use strict';
module.exports=async function(page,outputs,errors){
 const fs=require('fs'),path=require('path'),assert=require('assert/strict'),reports=[];
 const maps=process.env.PREVIEW_MAPS?.split(',')||['dust2','inferno'];
 for(const map of maps){
  if(map!=='dust2'){
   await page.evaluate(name=>__qa.map(name),map);
   await page.waitForFunction(name=>__qa.snapshot().ready&&__qa.snapshot().map===name,map,{timeout:120000});
  }
  const b=await page.evaluate(map=>{
   const b=CS16Buildings.layout(__qa.grid(),map).buildings[map==='inferno'?1:0],now=Date.now();
   const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'neve'}];
   __socket.receive('cs16_state',{phase:'freeze',map,gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+600000,roundEnds:now+600000,buyUntil:now+600000,now});
   __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[b.x+17,0,b.z-13]}]});
   __qa.aim(b.x+17,0,b.z-13,2.54,-.045);__qa.weapon('m4a1');__qa.hideMessages();
   return b;
  },map);
  if(process.env.PREVIEW_NO_POST)await page.evaluate(()=>__qa.cinematic()?.setEnabled(false));
  if(process.env.MAX_OPTICS_ONLY){
   await page.evaluate(()=>{const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange()});
   await page.waitForTimeout(600);await page.mouse.click(960,540);await page.waitForTimeout(120);
   await page.mouse.down({button:'right'});await page.waitForTimeout(850);
   const ads=await page.evaluate(()=>__qa.ads());assert(ads.visible&&Math.hypot(...ads.ndc.slice(0,2))<.005,'Reflex reticle must remain centered');
   await page.screenshot({path:path.join(outputs,'m4-ads-high.png')});await page.mouse.up({button:'right'});
   assert.deepEqual(errors,[]);fs.writeFileSync(path.join(outputs,'optics.json'),JSON.stringify({ads,errors},null,2));console.log('MAX_OPTICS_PASS',JSON.stringify(ads));return;
  }
  for(const quality of (process.env.PREVIEW_QUALITY?.split(',')||['high','balanced','low'])){
   await page.evaluate(q=>{const ui=__qa.ui();ui.quality.value=q;ui.quality.onchange()},quality);
   const views=[['square',17,-13,2.54,-.045,'m4a1'],['garden',4,-7,-Math.PI,.025,'ak47'],['arcade',14,-4,2.1,.045,'m4a1']];
   for(const [name,x,z,yaw,pitch,weapon] of views){
    await page.evaluate(({b,x,z,yaw,pitch,weapon})=>{__qa.aim(b.x+x,0,b.z+z,yaw,pitch);__qa.weapon(weapon);__qa.hideMessages()}, {b,x,z,yaw,pitch,weapon});
    await page.waitForTimeout(1600);
    await page.screenshot({path:path.join(outputs,`${map}-${name}-${quality}.png`)});
    if(name==='square')reports.push(await measure(page,{map,quality,test:'scene'}));
   }
  }
  await page.evaluate(b=>{
   __qa.aim(b.x+17,0,b.z-13,2.54,-.045);__qa.weapon('m4a1');
   window.__previewActors=[];
   for(let i=0;i<9;i++){const r=__qa.addRemote('Player '+i,i<4?'ct':'t',b.x+1+(i%5)*2,b.z-6-Math.floor(i/5)*2);r.moving=true;window.__previewActors.push({r,x:r.x,z:r.z});}
  },b);
  for(const quality of (process.env.PREVIEW_QUALITY?.split(',')||['high','balanced','low'])){
   await page.evaluate(q=>{const ui=__qa.ui();ui.quality.value=q;ui.quality.onchange()},quality);
   await page.waitForTimeout(1500);reports.push(await measure(page,{map,quality,test:'ten-players'}));
  }
  reports.push({map,traversal:await page.evaluate(()=>__qa.tacticalCheck())});
 }
 fs.writeFileSync(path.join(outputs,'performance.json'),JSON.stringify({reports,errors},null,2));
 assert.deepEqual(errors,[]);console.log('MAX_PREVIEW_PASS',JSON.stringify(reports));
};
async function measure(page,meta){return page.evaluate(async meta=>{
 const samples=[],base=__qa.snapshot().position;let last=performance.now();for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;
  if(meta.test==='ten-players'){const t=i/60;__qa.aim(base[0]+Math.sin(t)*1.2,base[1],base[2]+Math.sin(t*.7)*.8,2.54+Math.sin(t)*.09,-.045);for(const [n,p]of (window.__previewActors||[]).entries()){p.r.tx=p.x+Math.sin(t+n)*1.4;p.r.tz=p.z+Math.cos(t*.8+n)*.7;p.r.yaw=t+n;}}
 }samples.sort((a,b)=>a-b);
 const r=__qa.renderer(),gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
 return{...meta,fps:Math.round(180000/samples.reduce((a,b)=>a+b)),p95:Math.round(samples[171]*10)/10,...__qa.snapshot(),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',resolution:[r.domElement.width,r.domElement.height]};
},meta);}
