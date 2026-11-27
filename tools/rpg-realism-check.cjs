'use strict';
module.exports=async function(page,outputs,errors){
 const fs=require('fs'),path=require('path'),assert=require('assert/strict');
 fs.mkdirSync(outputs,{recursive:true});
 await page.evaluate(()=>{const u=__qa.ui();u.quality.value='high';u.quality.onchange();});
 const setup=await page.evaluate(()=>__qa.rpg('setup'));
 assert.equal(setup.weapon,'rpg');assert.equal(setup.model,'RPG detailed PBR');assert(setup.meshes>=40);assert(setup.materials>=7);assert(setup.hands.every(Boolean));assert.deepEqual(setup.ammo,{mag:1,reserve:3});assert.equal(setup.viewmodels,1);
 await page.waitForTimeout(1200);await page.screenshot({path:path.join(outputs,'rpg-first-person-high.png')});
 const remote=await page.evaluate(()=>__qa.rpg('remote'));assert.equal(remote.model,'RPG detailed PBR');assert(remote.meshes>=40);assert.equal(remote.weapon,'rpg');assert(remote.grip?.right&&remote.grip?.left);
 const shots=[];
 for(let i=0;i<4;i++){
  const fired=await page.evaluate(()=>__qa.rpg('fire'));shots.push(fired);
  assert.equal(fired.packets.filter(p=>p.n==='cs16_rpg').length,1);assert.equal(fired.packets.filter(p=>['cs16_shoot','cs16_hit','cs16_vehhit'].includes(p.n)).length,0);
  assert.equal(fired.yawDelta,0);assert.equal(fired.pitchDelta,0);assert.equal(fired.info.ammo.mag,0);assert(fired.kick>5&&fired.kick<=34);
  if(i===0){await page.waitForTimeout(60);await page.screenshot({path:path.join(outputs,'rpg-shot-high.png')});}
  const reload=await page.evaluate(()=>__qa.rpg('reload'));
  if(i<3){assert.equal(reload.during,true);assert.deepEqual(reload.after.ammo,{mag:1,reserve:2-i});assert.equal(reload.after.magazineVisible,true);}
 }
 assert.deepEqual(shots.at(-1).info.ammo,{mag:0,reserve:0});
 const switched=await page.evaluate(()=>__qa.rpg('switch'));assert.equal(switched.weapon,'rpg');assert.equal(switched.viewmodels,1);assert(switched.meshes>=40);
 // Return a loaded rocket for the close-up screenshot after the four-shot cycle.
 await page.evaluate(()=>{__qa.weapon('rpg');});await page.waitForTimeout(500);
 const flight=await page.evaluate(()=>{
  const flight=__qa.rpg('missile');let distance=0;
  window.__rpgFlight=setInterval(()=>{distance+=55*.09;const pos=flight.pos.map((v,i)=>v+flight.dir[i]*distance);__socket.receive('cs16_missile_frame',[[901,...pos.map(v=>Math.round(v*10)),...flight.dir.map(v=>Math.round(v*100))]]);},90);
  return flight;
 });
 await page.waitForTimeout(650);
 const trail=await page.evaluate(()=>{const points=__qa.scene().getObjectByName('RPG smoke trail');return {active:__qa.scene().children.filter(o=>o.name==='RPG smoke trail').length,points:points?.geometry.drawRange.count||0};});
 assert.equal(trail.active,1);assert(trail.points>=8&&trail.points<=24);
 await page.screenshot({path:path.join(outputs,'rpg-missile-trail-high.png')});
 const boom=await page.evaluate(()=>{clearInterval(window.__rpgFlight);__socket.receive('cs16_missile_end',{id:901});return __qa.rpg('boom');});
 assert(boom.shake>0);assert.equal(boom.effects.active,1);await page.waitForTimeout(70);await page.screenshot({path:path.join(outputs,'rpg-explosion-high.png')});
 await page.waitForTimeout(430);await page.screenshot({path:path.join(outputs,'rpg-explosion-smoke-high.png')});
 const stress=await page.evaluate(()=>__qa.rpg('stress'));assert.equal(stress.active,8);assert.equal(stress.pooled,8);assert.equal(stress.capacity,8);
 assert.equal(await page.evaluate(()=>__qa.rpg('reset')),0);
 const quality=await page.evaluate(()=>{const sun=__qa.scene().getObjectByName('CS16 sun'),r=__qa.renderer();return {quality:r.userData.cs16Quality,shadow:sun.shadow.mapSize.x,pixelRatio:r.getPixelRatio(),maxAnisotropy:r.capabilities.getMaxAnisotropy()};});
 assert.equal(quality.quality,'high');assert.equal(quality.shadow,4096);
 await page.evaluate(()=>__qa.rpg('boom'));
 const performance=await page.evaluate(async()=>{const samples=[];let last=performance.now();for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}samples.sort((a,b)=>a-b);const r=__qa.renderer(),gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {fps:Math.round(120000/samples.reduce((a,b)=>a+b,0)),p95:Math.round(samples[114]*10)/10,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',memory:{...r.info.memory},calls:r.info.render.calls,triangles:r.info.render.triangles};});
 assert.equal(await page.evaluate(()=>__qa.rpg('reset')),0);assert.deepEqual(errors,[]);
 const report={setup,remote,shots:shots.map(s=>({ammo:s.info.ammo,packets:s.packets.map(p=>p.n),kick:s.kick})),trail,boom,quality,performance,errors};
 fs.writeFileSync(path.join(outputs,'report.json'),JSON.stringify(report,null,2));
 console.log('RPG_REALISM_PASS',JSON.stringify(report));
};
