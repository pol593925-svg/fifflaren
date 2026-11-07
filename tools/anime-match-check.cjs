module.exports=async function(page,outputs,errors){
 const fs=require('fs'),path=require('path'),assert=require('assert/strict'),reports=[];
 for(const map of ['dust2','inferno']){
  if(map==='inferno'){await page.evaluate(()=>__qa.map('inferno'));await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});}
  const traversal=await page.evaluate(()=>__qa.tacticalCheck());
  const spot=await page.evaluate(map=>{
   const b=CS16Buildings.layout(__qa.grid(),map).buildings[map==='inferno'?1:0],x=b.x+17,z=b.z-13,now=Date.now();
   const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:map==='inferno'?'pyra':'neve',petId:'fox'}];
   for(let i=0;i<9;i++)players.push({id:'test'+i,nick:'Боец '+(i+1),team:i<4?'ct':'t',alive:true,characterId:['ember','neve','jade','aurora','pyra'][i%5]});
   __socket.receive('cs16_state',{phase:'freeze',map,gm:'classic',mode:5,round:3,scores:{t:1,ct:1},players,host:'Preview',freezeEnds:now+120000,roundEnds:now+120000,buyUntil:now+120000,now});
   __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:3,scores:{t:1,ct:1},spawns:players.map((p,i)=>({id:p.id,nick:p.nick,pos:i?[x-5+(i%3)*2,0,z+7+Math.floor(i/3)*2]:[x,0,z]}))});
   __qa.aim(x,0,z,2.54,.05);__qa.weapon('m4a1');__qa.hideMessages();
   for(let i=0;i<9;i++)__qa.addRemote('Боец '+(i+1),i<4?'ct':'t',x-5+(i%3)*2,z+7+Math.floor(i/3)*2);
   const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();return {x,z,house:b};
  },map);
  await page.waitForTimeout(1600);
  reports.push({map,traversal,...await page.evaluate(()=>__qa.snapshot()),spot});
  await page.screenshot({path:path.join(outputs,'anime-'+map+'-match.png')});
  await page.mouse.click(700,450);await page.waitForTimeout(150);await page.mouse.down({button:'right'});await page.waitForTimeout(500);
  assert(await page.evaluate(()=>__qa.ads().visible),'Reflex dot must be visible while holding RMB');
  assert(await page.evaluate(()=>Math.hypot(...__qa.ads().ndc.slice(0,2)))<.005,'Reflex dot must align with the shot ray');
  await page.screenshot({path:path.join(outputs,'anime-'+map+'-aim.png')});await page.mouse.up({button:'right'});await page.waitForTimeout(350);
  await page.evaluate(({x,z,map})=>{const fire=map==='inferno',dir=[-Math.sin(2.54),0,-Math.cos(2.54)];__socket.receive('cs16_magic_fx',{by:'Preview',team:'ct',slot:'hero',id:fire?'flame':'frost',origin:[x,1.3,z],pos:fire?[x+dir[0]*7,.2,z+dir[2]*7]:[x,1.3,z],dir})},{...spot,map});
  await page.waitForTimeout(380);await page.screenshot({path:path.join(outputs,'anime-'+map+'-ability.png')});
  const surfaces=await page.evaluate(()=>__qa.surfaces());assert.deepEqual(surfaces.failures,[]);
  await page.evaluate(map=>{
   for(let i=0;i<9;i++){const pos=CS16TacticalMap.spawn(map,i<4?'ct':'t',i%5);__qa.addRemote('Боец '+(i+1),i<4?'ct':'t',pos[0],pos[2]);}
   __qa.hideMessages();
  },map);
  await page.waitForTimeout(2200);
  await page.screenshot({path:path.join(outputs,'anime-'+map+'-town.png')});
  await page.evaluate(b=>__qa.aim(b.x+5.5,.02,b.z+2.3,-2.0,0),spot.house);
  await page.waitForTimeout(500);await page.screenshot({path:path.join(outputs,'anime-'+map+'-interior.png')});
  await page.evaluate(()=>__qa.aim(53.5*4,-3.2,67*4,-Math.PI/2,0));
  await page.waitForTimeout(500);await page.screenshot({path:path.join(outputs,'anime-'+map+'-tunnel.png')});
  await page.evaluate(()=>__qa.tacticalOverview());
  await page.screenshot({path:path.join(outputs,'anime-'+map+'-layout.png')});
  await page.evaluate(()=>__qa.resume());
 }
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(outputs,'anime-match-checks.json'),JSON.stringify(reports,null,2));console.log('ANIME_MATCH_PASS',JSON.stringify(reports));
};
