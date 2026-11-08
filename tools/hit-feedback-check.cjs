module.exports=async function(page,outputs,errors){
 const assert=require('node:assert/strict'),path=require('path'),fs=require('fs');
 const spot=await page.evaluate(()=>{
  const b=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0],x=b.x+17,z=b.z-13,now=Date.now();
  const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'neve'},{id:'p2',nick:'Target',team:'t',alive:true,characterId:'basalt'}];
  __socket.receive('cs16_state',{phase:'freeze',map:'dust2',gm:'classic',mode:5,round:2,scores:{t:0,ct:1},players,host:'Preview',freezeEnds:now+120000,roundEnds:now+120000,buyUntil:now+120000,now});
  __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
  __socket.receive('cs16_round_start',{round:2,scores:{t:0,ct:1},spawns:[{id:'p1',nick:'Preview',pos:[x,1.6,z]},{id:'p2',nick:'Target',pos:[x,1.6,z+6]}]});
  __qa.addRemote('Target','t',x,z+6);__qa.aim(x,0,z,Math.PI,-.08);__qa.weapon('m4a1');__qa.hideMessages();
  const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();window.__emitted=[];return {x,z};
 });
 await page.waitForTimeout(800);
 await page.evaluate(()=>__qa.fireHitTest());await page.waitForTimeout(60);
 const submitted=await page.evaluate(()=>__emitted.filter(e=>e.n==='cs16_hit'));
 assert.equal(submitted.length,1,'actual fireOne ray must hit the target');
 assert.equal(await page.locator('.cs16-hit-feedback').isVisible(),false,'prediction must not show a confirmed marker');
 const event={target:'Target',by:'Preview',weapon:'m4a1',hitId:submitted[0].d.hitId,dmg:28,hp:72,head:false,zone:'body',armorDamage:0};
 assert(Number.isSafeInteger(event.hitId),'local hit must have a correlation ID');
 const reports=[];
 for(const [kind,extra]of [['body',{}],['armor',{armorDamage:4,armorBreak:true}],['head',{head:true,zone:'head',dmg:84,hp:16}],['kill',{head:true,zone:'head',dmg:100,hp:0}]]){
  await page.evaluate(()=>__qa.hitEffects().clear());
  await page.evaluate(e=>__socket.receive('cs16_hit',e),{...event,...extra});
  await page.waitForTimeout(45);
  assert.equal(await page.locator('.cs16-hit-feedback').getAttribute('data-kind'),kind);
  assert(await page.locator('.cs16-hit-feedback').isVisible());
  const info=await page.evaluate(()=>__qa.hitEffects().metrics());assert(info.active>0,'visible confirmed target needs a world impact');reports.push({kind,...info});
  await page.screenshot({path:path.join(outputs,'anime-hit-'+kind+'.png')});
  await page.waitForTimeout(750);assert.equal(await page.locator('.cs16-hit-feedback').isVisible(),false);
 }
 // Other players' hits can create world sparks but never your personal marker.
 await page.evaluate(e=>__socket.receive('cs16_hit',{...e,by:'Other'}),event);await page.waitForTimeout(20);
 assert.equal(await page.locator('.cs16-hit-feedback').isVisible(),false);
 await page.evaluate(e=>{__qa.hitEffects().clear();__socket.receive('cs16_hit',{...e,dmg:0});},event);
 assert.equal(await page.locator('.cs16-hit-feedback').isVisible(),false);
 const resources=await page.evaluate(()=>{
  const fx=__qa.hitEffects(),root=__qa.scene().getObjectByName('Confirmed target impacts');
  const before=root.children.map(m=>[m.geometry.uuid,m.material.uuid,m.instanceMatrix.uuid||m.instanceMatrix.array.length]);
  const target={x:__qa.snapshot().position[0],y:0,z:__qa.snapshot().position[2]+6};
  for(let i=0;i<1500;i++)fx.confirm({target:'Target',by:'Preview',dmg:20,hp:80,head:i%2===0},target,true);
  fx.update();const peak=fx.metrics();
  const ui=__qa.ui();ui.quality.value='low';ui.quality.onchange();fx.update();const low=fx.metrics();
  const after=root.children.map(m=>[m.geometry.uuid,m.material.uuid,m.instanceMatrix.uuid||m.instanceMatrix.array.length]);fx.clear();
  return {before,after,peak,low};
 });
 assert.deepEqual(resources.before,resources.after);assert(resources.peak.active<=12);assert(resources.low.active<=6);assert(resources.low.counts[2]<=18);
 await page.evaluate(e=>__socket.receive('cs16_hit',e),event);
 await page.evaluate(()=>__qa.map('inferno'));await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});
 assert.equal(await page.locator('.cs16-hit-feedback').count(),1,'map rebuild must dispose the previous HUD');assert.equal(await page.locator('.cs16-hit-feedback').isVisible(),false);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(outputs,'hit-feedback-checks.json'),JSON.stringify({reports,resources},null,2));console.log('HIT_FEEDBACK_PASS: confirmed ray, body/armor/head/kill, expiry, remote hits, 1500-hit resource budget and map cleanup');
};
