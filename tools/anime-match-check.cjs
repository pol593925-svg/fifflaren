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
  if(map==='dust2')await require('./landscape-pools-check.cjs')(page,spot);
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
  await page.evaluate(({house,map})=>{
   const data=CS16Buildings.layout(__qa.grid(),map),door=data.environment.doors.find(d=>d.building===house.id);
   door.open=false;data.environment.revision++;
   __qa.aim(door.x-2,0,door.z-5,Math.atan2(-2,-5),.015);
  },{house:spot.house,map});
  await page.waitForTimeout(650);await page.screenshot({path:path.join(outputs,'anime-'+map+'-door.png')});
  await page.evaluate(()=>__qa.weapon('usp'));
  await page.waitForTimeout(650);await page.screenshot({path:path.join(outputs,'anime-'+map+'-pistol.png')});
  for(const id of ['awp','scout']){
   await page.evaluate(({house})=>__qa.aim(house.x+17,0,house.z-13,2.54,.05),spot);
   await page.evaluate(id=>__qa.weapon(id),id);await page.waitForTimeout(400);
   assert.equal(await page.evaluate(id=>CS16FieldView.supported(id),id),false,'Snipers must not attach a reflex sight');
   await page.screenshot({path:path.join(outputs,'anime-'+map+'-'+id+'.png')});
   await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});await page.waitForTimeout(850);
   const scope=await page.evaluate(()=>__qa.ads());assert(scope.scoped&&scope.scopeVisible&&!scope.vmVisible);assert(Math.abs(scope.fov-(id==='awp'?16:22))<.5);
   await page.screenshot({path:path.join(outputs,'anime-'+map+'-'+id+'-zoom.png')});
   await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>__qa.ads().scoped),false);
  }
  const arsenal=await page.evaluate(()=>__qa.arsenal());assert(!arsenal.items.some(id=>/^veh_|^rpg$/.test(id)));assert(!arsenal.classes.includes('antitank'));assert(!arsenal.front&&!arsenal.missiles&&!arsenal.ownVehicle&&arsenal.vehicles===0);
  const pool=await page.evaluate(()=>__qa.shotPool());
  for(let burst=0;burst<3;burst++){
   await page.evaluate(()=>__qa.shotBurst());const busy=await page.evaluate(()=>__qa.shotPool());
   assert(busy.active[0]<=48&&busy.active[1]<=24);assert.deepEqual(busy.visible,busy.active);assert.equal(busy.geometry,pool.geometry);assert.equal(busy.material,pool.material);
   await page.waitForTimeout(400);assert.deepEqual((await page.evaluate(()=>__qa.shotPool())).busy,[0,0]);
  }
  reports.at(-1).arsenal=arsenal;reports.at(-1).shotPool=await page.evaluate(()=>__qa.shotPool());
  if(map==='dust2'){
   const guns=(await page.evaluate(()=>__qa.snapshot().weapons)).filter(id=>id!=='smokegrenade');
   for(const id of guns){
    await page.evaluate(id=>__qa.weapon(id),id);await page.waitForTimeout(250);
    await page.screenshot({path:path.join(outputs,'arsenal-'+id+'.png')});
    if(await page.evaluate(id=>CS16FieldView.supported(id),id)){
     await page.mouse.down({button:'right'});await page.waitForTimeout(450);
     const dot=await page.evaluate(()=>__qa.ads());assert(dot.visible,'ADS missing: '+id);assert(Math.hypot(...dot.ndc.slice(0,2))<.005,'ADS off-center: '+id);
     await page.mouse.up({button:'right'});await page.waitForTimeout(200);
    }
   }
   fs.writeFileSync(path.join(outputs,'arsenal-review.html'),'<!doctype html><meta charset="utf-8"><title>Арсенал — кадры из игры</title><style>body{margin:32px;background:#111e29;color:#efe5cd;font:16px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px}figure{margin:0}img{width:100%;border-radius:12px}figcaption{padding:8px}a{color:inherit}</style><h1>Арсенал · локальная версия</h1><p>Кадры полного игрового клиента. Локальная подмена сетевого подключения.</p><main>'+guns.map(id=>'<figure><a href="arsenal-'+id+'.png"><img src="arsenal-'+id+'.png" loading="lazy"></a><figcaption>'+id.toUpperCase()+'</figcaption></figure>').join('')+'</main>');
  }
  await page.evaluate(()=>__qa.weapon('m4a1'));
  if(map==='dust2'){
   for(const id of ['m4a1','ak47','usp']){
    await page.evaluate(({id,house})=>{__qa.aim(house.x+17,0,house.z-13,2.54,-.04);__qa.weapon(id)}, {id,house:spot.house});
    await page.waitForTimeout(400);await page.keyboard.press('KeyI');await page.waitForTimeout(950);
    await page.screenshot({path:path.join(outputs,'anime-pass10-inspect-'+id+'.png')});await page.waitForTimeout(1400);
   }
   await page.evaluate(()=>__qa.weapon('m4a1'));
  }
  await page.evaluate(b=>__qa.aim(b.x+5.5,.02,b.z+2.3,-2.0,0),spot.house);
  await page.waitForTimeout(500);await page.screenshot({path:path.join(outputs,'anime-'+map+'-interior.png')});
  await page.evaluate(b=>__qa.aim(b.x+7.8,.02,b.z+7.8,1.1,-.10),spot.house);
  await page.waitForTimeout(650);await page.screenshot({path:path.join(outputs,'anime-'+map+'-furnished-room.png')});
  await page.evaluate(()=>__qa.aim(53.5*4,-3.2,67*4,-Math.PI/2,0));
  await page.waitForTimeout(500);await page.screenshot({path:path.join(outputs,'anime-'+map+'-tunnel.png')});
  await page.evaluate(()=>{__qa.aim(322,0,220,.38,-.025);__qa.weapon('ak47');});
  await page.waitForTimeout(650);await page.screenshot({path:path.join(outputs,'anime-'+map+'-site-a.png')});
  await page.evaluate(()=>__qa.tacticalOverview());
  await page.screenshot({path:path.join(outputs,'anime-'+map+'-layout.png')});
  await page.evaluate(()=>__qa.resume());
 }
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(outputs,'anime-match-checks.json'),JSON.stringify(reports,null,2));console.log('ANIME_MATCH_PASS',JSON.stringify(reports));
};
