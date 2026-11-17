/* Raw screenshots of the shipping WebGL scene; only match transport is mocked. */
module.exports=async function(page,outputs,errors){
 const fs=require('fs'),path=require('path'),assert=require('assert/strict'),reports=[];
 for(const map of ['dust2','inferno']){
  if(map==='inferno'){
   await page.evaluate(()=>__qa.map('inferno'));
   await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});
  }
  const house=await page.evaluate(map=>{
   const b=CS16Buildings.layout(__qa.grid(),map).buildings[map==='inferno'?1:0],now=Date.now();
   const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'neve'}];
   __socket.receive('cs16_state',{phase:'freeze',map,gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+600000,roundEnds:now+600000,buyUntil:now+600000,now});
   __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[b.x+17,0,b.z-13]}]});
   __qa.aim(b.x+17,0,b.z-13,2.54,-.045);__qa.weapon('m4a1');__qa.hideMessages();
   return b;
  },map);
  const views=[['town',house.x+17,0,house.z-13,2.54,-.045,'m4a1'],
   ['courtyard',house.x+4,0,house.z-13,-Math.PI,-.07,'ak47'],
   ['interior',house.x+7.8,.02,house.z+7.8,1.1,-.10,'usp']];
  for(const quality of ['high','low']){
   await page.evaluate(q=>{const u=__qa.ui();u.quality.value=q;u.quality.onchange()},quality);
   for(const [name,x,y,z,yaw,pitch,id] of views){
    await page.evaluate(({x,y,z,yaw,pitch,id})=>{__qa.aim(x,y,z,yaw,pitch);__qa.weapon(id);__qa.hideMessages()}, {x,y,z,yaw,pitch,id});
    await page.waitForTimeout(1600);
    await page.screenshot({path:path.join(outputs,`${map}-${name}-${quality}.png`)});
    if(name==='town'){
     const report=await page.evaluate(async({map,quality})=>{
      const samples=[];let last=performance.now();for(let i=0;i<150;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now}samples.sort((a,b)=>a-b);
      const r=__qa.renderer(),gl=r.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      return{map,quality,fps:Math.round(150000/samples.reduce((a,b)=>a+b)),p95:samples[142],...__qa.snapshot(),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};
     },{map,quality});reports.push(report);
    }
   }
  }
  await page.evaluate(b=>{
   __qa.aim(b.x+17,0,b.z-13,2.54,-.045);__qa.weapon('m4a1');
   const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();
  },house);
  await page.waitForTimeout(600);await page.mouse.click(700,450);await page.waitForTimeout(150);
  await page.mouse.down({button:'right'});await page.waitForTimeout(600);
  const ads=await page.evaluate(()=>__qa.ads());assert(ads.visible&&Math.hypot(...ads.ndc.slice(0,2))<.005,'M4 reflex sight remains aligned');
  await page.screenshot({path:path.join(outputs,`${map}-ads.png`)});await page.mouse.up({button:'right'});
  await page.evaluate(b=>{
   for(let i=0;i<9;i++)__qa.addRemote('Preview player '+i,i<4?'ct':'t',b.x+1+(i%5)*2,b.z-6-Math.floor(i/5)*2);
   const ui=__qa.ui();ui.quality.value='low';ui.quality.onchange();
  },house);
  await page.waitForTimeout(1200);
  reports.push(await page.evaluate(async map=>{
   const times=[];let last=performance.now();for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now}times.sort((a,b)=>a-b);
   return{map,test:'ten-player-low',fps:Math.round(180000/times.reduce((a,b)=>a+b)),p95:times[171],...__qa.snapshot()};
  },map));
  const traversal=await page.evaluate(()=>__qa.tacticalCheck());
  reports.push({map,traversal});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(outputs,'preview-checks.json'),JSON.stringify(reports,null,2));
 console.log('ANIME_GRAPHICS_PREVIEW_PASS',JSON.stringify(reports));
};
