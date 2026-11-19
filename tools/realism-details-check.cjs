'use strict';
module.exports=async(page,outputs,errors)=>{
 const fs=require('fs'),path=require('path'),assert=require('assert/strict');
 const report={};
 const b=await page.evaluate(()=>{
  const b=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0],now=Date.now();
  __socket.receive('cs16_state',{phase:'freeze',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players:[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'classic'}],host:'Preview',freezeEnds:now+600000,roundEnds:now+600000,buyUntil:now+600000,now});
  __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
  __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[b.x+17,0,b.z-13]}]});
  __qa.aim(b.x+17,0,b.z-13,2.54,-.045);__qa.weapon('m4a1');__qa.hideMessages();
  const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();return b;
 });
 report.materials=await page.evaluate(()=>{
  const m=__qa.world().surface('ground'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});canvas.width=canvas.height=64;
  const mean=texture=>{ctx.drawImage(texture.image,0,0,64,64);const d=ctx.getImageData(0,0,64,64).data,sum=[0,0,0];for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)sum[c]+=d[i+c];return sum.map(v=>v/(64*64));};
  return {source:m.userData.source,realistic:m.userData.cs16Realistic,normal:mean(m.normalMap),orm:mean(m.roughnessMap),bistro:!!__qa.scene().getObjectByName('ORCA Bistro adapted architecture')};
 });
 assert(report.materials.realistic&&report.materials.bistro,'Real licensed geometry and material must be in the actual client');
 assert(report.materials.normal[2]>180,'BC5 positive Z must be reconstructed');
 assert(report.materials.orm[0]>128,'Missing AO must not black out daylight');
 await page.waitForTimeout(1000);report.unchangedHudMutations=await page.evaluate(()=>__qa.hudStable());assert.equal(report.unchangedHudMutations,0,'Static HUD should not rebuild text');
 await page.mouse.click(960,540);
 for(const weapon of ['m4a1','ak47']){
  await page.evaluate(w=>__qa.weapon(w),weapon);await page.waitForTimeout(400);
  await page.mouse.down({button:'right'});await page.waitForTimeout(850);const ads=await page.evaluate(()=>__qa.ads());
  assert(ads.visible&&Math.hypot(...ads.ndc.slice(0,2))<.005,weapon+' optic not aligned');report[weapon]=ads;
  await page.screenshot({path:path.join(outputs,weapon+'-ads.png')});await page.mouse.up({button:'right'});await page.waitForTimeout(500);
  report[weapon].shooting=await page.evaluate(w=>__qa.shotCheck(w),weapon);
  assert.equal(report[weapon].shooting.yawDelta,0);assert.equal(report[weapon].shooting.pitchDelta,0);
 }
 await page.evaluate(()=>__qa.weapon('awp'));await page.waitForTimeout(400);await page.mouse.click(960,540,{button:'right'});await page.waitForTimeout(900);
 report.sniper=await page.evaluate(()=>__qa.ads());assert(report.sniper.scoped&&report.sniper.scopeVisible&&report.sniper.fov<17&&!report.sniper.vmVisible,'Sniper must use zoom scope');
 await page.mouse.click(960,540,{button:'right'});await page.waitForTimeout(500);
 await page.evaluate(b=>{__qa.weapon('m4a1');__qa.aim(b.x+5.9,.02,b.z+5.4,0,-.03);__qa.hideMessages()},b);await page.waitForTimeout(1000);
 await page.screenshot({path:path.join(outputs,'interior-m4.png')});
 await page.evaluate(b=>{__qa.aim(b.x+4,7.2,b.z+7,-1.6,-.035);__qa.hideMessages()},b);await page.waitForTimeout(1000);
 await page.screenshot({path:path.join(outputs,'rooftop-m4.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(outputs,'details.json'),JSON.stringify({report,errors},null,2));console.log('REALISM_DETAILS_PASS',JSON.stringify(report));
};
