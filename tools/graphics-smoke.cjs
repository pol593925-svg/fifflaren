const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const root = process.env.GRAPHICS_REPO || path.resolve(__dirname, '..');
const outputs = process.env.GRAPHICS_OUTPUT || path.resolve(root, 'graphics-qa');
fs.mkdirSync(outputs,{recursive:true});
const mime = {'.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const harness = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/cs16-graphics.css"><style>body{margin:0;background:#101b24}#tab-cs16{height:100vh!important;min-height:100vh!important}</style><div id="tab-cs16"></div><script>
window.io=()=>{const handlers={};window.__socket={connected:true,on(n,f){handlers[n]=f;return this},emit(n,d){(window.__emitted||=[]).push({n,d});return this},receive(n,d){if(handlers[n])handlers[n](d)}};return window.__socket};
</script><script src="/three.min.js"></script><script src="/GLTFLoader.js"></script><script src="/SkeletonUtils.js"></script><script src="/cs16-combat.js"></script><script src="/cs16-characters.js"></script><script src="/cs16-magic.js"></script><script src="/cs16-magic-client.js"></script><script src="/cs16-footsteps.js"></script><script src="/cs16-weapon-finish.js"></script><script src="/cs16-landscape.js"></script><script src="/cs16-graphics.js"></script><script src="/cs16-buildings.js"></script><script src="/cs16-classes.js"></script><script src="/cs16-props.js"></script><script src="/cs16-conquest-ui.js"></script><script src="/cs16.js"></script><script>__cs16Open('Preview');</script>`;
const hooks = `
window.__qa={
 presentationPreview:()=>{
  state.phase='lobby';ui.lobby.style.display='none';ui.canvas.style.display='block';ui.hud.style.display='none';resize3();
  let spot;for(let z=14;z<MH-14&&!spot;z++)for(let x=14;x<MW-14;x++){
   if(grid[z][x]!==1||grid[z][x-1]!==0||grid[z+1][x]!==0||grid[z][x+1]!==1||grid[z-1][x]!==1)continue;
   if(grid[z+3][x-2]===0&&grid[z+2][x-1]===0){spot={x:x*4,z:(z+1)*4};break;}
  }
  if(!spot)throw Error('No facade preview fixture');
  P.x=spot.x-7;P.z=spot.z+10;P.y=0;P.yaw=Math.atan2(-14,18);P.pitch=0;
  camera.position.set(P.x,1.75,P.z);camera.lookAt(spot.x+7,2.1,spot.z-8);
  current='awp';mySkin='neon';scoped=false;me.alive=true;me.team='ct';updateViewmodel(.016,performance.now());
  state.players=[{nick:myNick,alive:true,team:'ct',characterId:'zephyr',petId:'fox'}];
  magicView.update(.016,performance.now());for(let i=0;i<6;i++)fieldProps.update(.05,camera);
  worldGraphics.update(camera,performance.now());renderer3.render(scene,camera);
  const mats=[];vm.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))mats.push({name:m.name,painted:m.map===skinTex('neon')});});
  const pet=scene.children.find(o=>o.children.some(c=>c.name==='pet_fox'));
  return {spot,position:[P.x,P.y,P.z],mats,pet:pet?.position.toArray(),calls:renderer3.info.render.calls,triangles:renderer3.info.render.triangles};
 },
 landscapePreview:(building=false)=>{state.phase='lobby';ui.lobby.style.display='none';ui.canvas.style.display='block';ui.hud.style.display='none';resize3();const b=CS16Buildings.layout(grid,curMap).buildings[0],item=fieldProps.items.find(i=>i.zone==='forest'&&i.kind==='tree'&&i.x>60&&i.z>90)||fieldProps.items.find(i=>i.kind==='tree');const x=building?b.x+5:item.x,z=building?b.z:item.z;let px=x+11,pz=z-12;if(!building){for(let i=0;i<24;i++){const a=i*Math.PI/12,tx=x+Math.sin(a)*10,tz=z+Math.cos(a)*10;if(grid[Math.floor(tz/4)]?.[Math.floor(tx/4)]===0&&!CS16Buildings.contains(grid,curMap,tx,tz,1)){px=tx;pz=tz;break;}}}camera.position.set(px,building?3.1:2.2,pz);camera.lookAt(x,building?3:1.8,z+5);for(let i=0;i<6;i++)fieldProps.update(.05,camera);worldGraphics.update(camera,performance.now());renderer3.render(scene,camera);return {x,z,calls:renderer3.info.render.calls,triangles:renderer3.info.render.triangles,pools:scene.getObjectByName('Evolution detailed vegetation').children.map(o=>({name:o.name,count:o.count}))};},

 magicPreview:()=>{state.phase='freeze';state.players=[{nick:myNick,alive:true,team:'ct',characterId:'pyra',petId:'fox'}];me.alive=true;me.team='ct';const pos=[P.x,P.y,P.z];for(const[i,id]of ['pyra','neve','zephyr','basalt','helio'].entries()){const nick='Magic '+i,r=addRemote(nick,'ct',id);r.x=r.tx=P.x+(i-2)*1.6;r.y=r.ty=P.y;r.z=r.tz=P.z-5;r.group.position.set(r.x,r.y,r.z);r.alive=true;state.players.push({nick,alive:true,team:'ct',characterId:id,petId:['fox','dragon','owl','golem','deer'][i]});}ui.lobby.style.display='none';ui.hud.style.display='block';magicView.set({heroReady:Date.now()+70000,petReady:0,hp:100});magicView.fx({id:'flame',pos:[P.x,P.y,P.z-5]});magicView.update(.016,performance.now());return state.players.length;},
 characters:()=>{
   const results=[];for(const id of Object.keys(CS16Characters.profiles)){const root=CS16Graphics.createOperator('ct',id);if(!root)throw Error('Missing '+id);for(const n of ['torso','head','legL','legR','armL','armR'])if(!root.getObjectByName(n))throw Error(id+' missing '+n);results.push(id);}return results;
 },
 remoteCharacter:()=>{const r=addRemote('HeroSync','t','ember');r.alive=true;r.x=r.tx=30;r.z=r.tz=24;window.__socket.receive('cs16_pos',{nick:'HeroSync',team:'t',pos:[30,0,24],yaw:0,pitch:0,weapon:'ak47',move:false,characterId:'tide'});const changed=remotes.get('HeroSync');return {id:changed.characterId,alive:changed.alive,x:changed.x,head:!!changed.head};},
 combatChecks:()=>{
   for(const r of remotes.values())scene.remove(r.group);remotes.clear();
   let cell;for(let z=2;z<MH-2&&!cell;z++)for(let x=2;x<MW-2;x++)if(grid[z][x]===0){cell=[x,z];break;}
   P.x=(cell[0]+.5)*CELL;P.z=(cell[1]+.5)*CELL;P.y=0;P.yaw=0;P.pitch=Math.atan2(1.72-eyeH(),1.2);P.onGround=true;
   me.alive=true;me.team='ct';state.phase='live';current='ak47';reloading=0;scoped=false;bloom=0;sprayN=0;
   for(const k in keys)keys[k]=false;
   ammo.ak47={mag:30,reserve:90};
   const r=addRemote('AimTarget','t');r.alive=true;r.x=P.x;r.z=P.z-1.2;r.y=0;r.tx=P.x+20;r.tz=P.z+20;
   const random=Math.random;Math.random=()=>0;
   try {
     window.__emitted=[];fireOne();
     const head=__emitted.find(e=>e.n==='cs16_hit')?.d;
     const shot=__emitted.find(e=>e.n==='cs16_shoot')?.d;
     spawnSmoke([P.x,0,P.z]);stepSmokes();
     P.yaw=0;P.pitch=Math.atan2(1.72-eyeH(),1.2);bloom=0;sprayN=0;window.__emitted=[];fireOne();
     const smokeHit=__emitted.find(e=>e.n==='cs16_hit')?.d;
     const particles=smokes.at(-1).mesh.children.length,opacity=Number(ui.smokeVeil.style.opacity);
     r.crouched=true;
     const duck=Combat.playerHit([P.x,1.72,P.z],[0,0,-1],r,10);
     for(let z=2;z<MH-2;z++)for(let x=2;x<MW-2;x++)if(grid[z][x]===0&&grid[z][x+1]===1){
       P.x=(x+.5)*CELL;P.z=(z+.5)*CELL;r.x=P.x+4;r.z=P.z;r.crouched=false;
       const wall=rayWall(P.x,1.1,P.z,1,0,0,10);
       const blocked=rayPlayers(P.x,1.1,P.z,[1,0,0],wall?wall.t:10);
       return {head,shot,smokeHit,particles,opacity,duck,wall:!!wall,blocked,ammo:ammo.ak47.mag};
     }
     throw Error('No wall fixture');
   }finally{Math.random=random;}
 },
 fire:()=>{state.phase='live';lastShot=-Infinity;tryShoot();return {mag:ammo[current]?.mag,tracers:tracers.length,kick:vmKickVelocity};},
 effects:()=>({tracers:tracers.length,flashes:shotFlashes.length,kick:vmKick,z:vm?.position.z}),
 lobby:(nick,players,host)=>{myNick=nick;state={...state,phase:'lobby',players,host};renderLobby();},
 snapshot:()=>({map:curMap,ready:worldReady,errors:window.__cs16Err||0,players:remotes.size,calls:renderer3.info.render.calls,triangles:renderer3.info.render.triangles,memory:{...renderer3.info.memory},position:[P.x,P.y,P.z],weapons:Object.keys(WEAPONS)}),
 aim:(x,y,z,yaw,pitch=0)=>{P.x=x;P.y=y;P.z=z;P.yaw=yaw;P.pitch=pitch;},
 weapon:(id)=>{current=id;primary=id;ammo[id]={mag:WEAPONS[id].mag,reserve:WEAPONS[id].reserve};},
 map:(name)=>rebuildWorld(name),
 hideMessages:()=>{ui.banner.style.display='none';ui.centerMsg.style.display='none';},
 ui:()=>ui,
 menu:()=>openEsc(), closeMenu:()=>closeEsc(),
 grid:()=>grid,
 floor:(x,z)=>floorAt(cellAt(x,z),x,z),
 view:(x,y,z,tx,ty,tz)=>{camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);worldGraphics.update(camera,performance.now());renderer3.render(scene,camera);},
 pause:()=>{state.phase='lobby';},
 resume:()=>{state.phase='freeze';},
 world:()=>worldGraphics,
 scene:()=>scene,
 renderer:()=>renderer3,
 camera:()=>camera,
 addRemote:(nick,team,x,z)=>{const r=addRemote(nick,team);r.alive=true;r.x=r.tx=x;r.z=r.tz=z;return r;},
 surfaces:async()=>{
   const model=await worldGraphics.ready,ray=new THREE.Raycaster(), failures=[],counts={};
   for(let z=0;z<MH;z++)for(let x=0;x<MW;x++){
     const c=grid[z][x];if(c===1||c===2||c===3||(counts[c]||0)>=5)continue;
     counts[c]=(counts[c]||0)+1;
     const wx=(x+.5)*CELL,wz=(z+.5)*CELL,expected=floorAt(c,wx,wz);
     ray.set(new THREE.Vector3(wx,expected+.25,wz),new THREE.Vector3(0,-1,0));
     ray.far=1;const hits=ray.intersectObject(model,true);
     if(!hits.length||Math.abs(hits[0].point.y-expected)>.06)failures.push({x,z,c,expected,actual:hits[0]?.point.y});
   }
   return {counts,failures};
 },
};
`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(harness);return;}
 const name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!name.startsWith(root+path.sep)){res.statusCode=403;res.end();return;}
 if(!fs.existsSync(name)){res.statusCode=404;res.end('Not found');return;}
 res.setHeader('Content-Type',mime[path.extname(name)]||'application/octet-stream');
 if(name===path.join(root,'cs16.js')){res.end(fs.readFileSync(name,'utf8').replace(/\}\)\(\);\s*$/,hooks+'})();'));return;}
 fs.createReadStream(name).pipe(res);
});
const state=(map='dust2')=>({phase:'freeze',map,gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players:[{id:'p1',nick:'Preview',team:'ct',money:16000,kills:0,deaths:0},{id:'p2',nick:'Alpha',team:'ct',money:800},{id:'p3',nick:'Bravo',team:'t',money:800}],host:'Preview',freezeEnds:Date.now()+1800000,roundEnds:Date.now()+1800000,buyUntil:Date.now()+1800000,now:Date.now()});
function begin(map='dust2'){
 window.__socket.receive('cs16_state',JSON.parse(JSON.stringify(window.__nextState)));
 window.__socket.receive('cs16_you',{money:16000,hp:100,armor:100,team:'ct',alive:true,weapon:'ak47'});
 window.__socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',pos:[82,1.62,12]},{id:'p2',pos:[75,1.62,9]},{id:'p3',pos:[88,1.62,9]}]});
 window.__qa.hideMessages();
}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/*',route=>{if(route.request().url().startsWith(origin)||route.request().url().startsWith('blob:'))return route.continue();return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,balance:0,owned:[],equipped:''})});});
 try{
  await page.goto(origin,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__qa&&__qa.snapshot().ready,null,{timeout:120000});
  if(process.env.PRESENTATION_ONLY){
   for(const map of ['dust2','inferno']){
    if(map==='inferno'){await page.evaluate(()=>__qa.map('inferno'));await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});}
    const preview=await page.evaluate(()=>__qa.presentationPreview());
    assert(preview.mats.some(m=>m.painted));assert(preview.mats.filter(m=>!m.name.startsWith('Weapon finish /')).every(m=>!m.painted));
    console.log('PRESENTATION',map,JSON.stringify(preview));await page.screenshot({path:path.join(outputs,'presentation-'+map+'.png')});
   }
   assert.equal(errors.length,0,errors.join('\n'));return;
  }
  if(process.env.LANDSCAPE_ONLY){for(const building of [false,true]){console.log('LANDSCAPE',await page.evaluate(b=>__qa.landscapePreview(b),building));await page.screenshot({path:path.join(outputs,building?'buildings-evolution.png':'field-evolution.png')});}assert.equal(errors.length,0,errors.join('\n'));return;}
  assert.deepEqual(await page.evaluate(()=>__qa.characters()),['ember','tide','jade','aurora','pyra','neve','zephyr','basalt','helio','classic']);
  await page.evaluate(()=>__qa.lobby('Preview',[{nick:'Preview',team:null,characterId:'classic'}],'Preview'));
  for(const id of ['ember','tide','jade','aurora','pyra','neve','zephyr','basalt','helio','classic']){
   await page.locator('[data-character="'+id+'"]').click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_character',d:id});
   await page.evaluate(id=>__socket.receive('cs16_character_selected',{id}),id);assert.equal(await page.locator('[data-character="'+id+'"]').getAttribute('aria-pressed'),'true');
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('cs16-character')),'classic');
  assert.equal(await page.locator('.cs16-pet-choice').count(),5);for(const [i,id]of ['fox','dragon','owl','golem','deer'].entries()){await page.locator('.cs16-pet-choice').nth(i).click();assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_pet',d:id});await page.evaluate(id=>__socket.receive('cs16_pet_selected',{id}),id);assert.equal(await page.locator('.cs16-pet-choice').nth(i).getAttribute('aria-pressed'),'true');}
  assert.equal(await page.evaluate(()=>localStorage.getItem('cs16-pet')),'deer');
  await page.screenshot({path:path.join(outputs,'cs16-character-selection.png')});
  if(process.env.LOBBY_ONLY){
   const players=[{nick:'knyaz',team:null},{nick:'Fifflaren',team:null},{nick:'Alpha',team:'t'},{nick:'Bravo',team:'ct'}];
   await page.evaluate(p=>__qa.lobby('Fifflaren',p,'knyaz'),players);
   await page.getByRole('button',{name:'Забрать хост себе',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_sethost',d:'Fifflaren'});
   page.once('dialog',d=>d.accept());
   await page.getByRole('button',{name:'Кикнуть хоста',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_kick',d:'knyaz'});
   const spectator=page.locator('.cs16-spectator').filter({hasText:'knyaz'});
   await spectator.getByRole('button',{name:'Хост',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_sethost',d:'knyaz'});
   page.once('dialog',d=>d.accept());
   await spectator.getByRole('button',{name:'Кик',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>__emitted.at(-1)),{n:'cs16_kick',d:'knyaz'});
   await page.screenshot({path:path.join(outputs,'cs16-lobby-preview.png')});
   await page.setViewportSize({width:550,height:850});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.evaluate(p=>__qa.lobby('Fifflaren',p,'Fifflaren'),players);
   assert.equal(await page.locator('.cs16-takeHost').count(),0);
   await page.evaluate(p=>__qa.lobby('knyaz',p,'knyaz'),players);
   assert.equal(await page.locator('.cs16HostBtn,.cs16KickBtn').count(),0);
   assert.equal(errors.length,0,errors.join('\n'));
   console.log('LOBBY PASS: take host, kick host, spectator controls, ordinary player permissions, narrow layout');return;
  }
  await page.evaluate(s=>window.__nextState=s,state());await page.evaluate(begin);
  assert.deepEqual(await page.evaluate(()=>__qa.remoteCharacter()),{id:'tide',alive:true,x:30,head:true});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{__qa.weapon('ak47');__qa.aim(28,0,28,-.65,-.02);__qa.addRemote('Patrol','ct',36,18);__qa.hideMessages();});
  await page.waitForTimeout(600);
  const fired=await page.evaluate(()=>__qa.fire());assert.equal(fired.mag,29);assert(fired.tracers>0);
  assert(fired.kick>0);
  await page.screenshot({path:path.join(outputs,'csgo-shot-preview.png')});
  await page.waitForFunction(()=>Math.abs(__qa.effects().kick)<.001&&__qa.effects().tracers===0&&__qa.effects().flashes===0,null,{timeout:15000});const settled=await page.evaluate(()=>__qa.effects());assert.equal(settled.tracers,0);assert.equal(settled.flashes,0);assert(Math.abs(settled.kick)<.001);
  await page.screenshot({path:path.join(outputs,'csgo-dust2-preview.png')});
  const first=await page.evaluate(()=>__qa.snapshot());
  const qualityCheck=await page.evaluate(()=>{const world=__qa.world(),renderer=__qa.renderer(),sun=__qa.scene().getObjectByName('CS16 sun');world.setQuality('high');renderer.render(__qa.scene(),__qa.camera());const highMap=!!sun.shadow.map,highSize=sun.shadow.mapSize.x;world.setQuality('low');renderer.render(__qa.scene(),__qa.camera());const lowMap=!!sun.shadow.map,shadows=renderer.shadowMap.enabled;world.setQuality('balanced');return {highMap,highSize,lowMap,shadows,balancedSize:sun.shadow.mapSize.x};});assert.deepEqual(qualityCheck,{highMap:true,highSize:2048,lowMap:false,shadows:false,balancedSize:1024});console.log('QUALITY_BUDGET',JSON.stringify(qualityCheck));
  console.log('DUST2',JSON.stringify(first));assert.equal(first.errors,0);assert.equal(first.ready,true);assert(first.triangles>1000);
  const dustSurfaces=await page.evaluate(()=>__qa.surfaces());console.log('DUST2_SURFACES',JSON.stringify(dustSurfaces));assert.deepEqual(dustSurfaces.failures,[]);
  // Actual input path: open/close shop and pause, change quality, retain actions.
  await page.keyboard.press('b');await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>__qa.ui().buy.style.display),'block');
  await page.keyboard.press('b');
  await page.evaluate(()=>{document.exitPointerLock();__qa.menu();});
  await page.selectOption('.cs16-quality select','balanced');
  await page.evaluate(()=>__qa.closeMenu());
  await page.evaluate(s=>{window.__socket.receive('cs16_state',s)},state('inferno'));
  await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});
  await page.evaluate(()=>{__qa.aim(82,0,18,-.6,-.03);__qa.weapon('m4a1');__qa.addRemote('Patrol','ct',77,12);__qa.hideMessages();});
  await page.waitForTimeout(700);await page.screenshot({path:path.join(outputs,'csgo-inferno-preview.png')});
  console.log('INFERNO',JSON.stringify(await page.evaluate(()=>__qa.snapshot())));
  const infernoSurfaces=await page.evaluate(()=>__qa.surfaces());console.log('INFERNO_SURFACES',JSON.stringify(infernoSurfaces));assert.deepEqual(infernoSurfaces.failures,[]);
  // Rapid map changes exercise stale GLB callbacks.
  await page.evaluate(()=>{__qa.map('dust2');__qa.map('inferno');__qa.map('dust2');});
  await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='dust2',null,{timeout:120000});
  await page.waitForTimeout(700);
  const final=await page.evaluate(()=>__qa.snapshot());console.log('FINAL',JSON.stringify(final));
  assert.equal(final.errors,0);assert.equal(errors.length,0,errors.join('\n'));
  const combat=await page.evaluate(()=>__qa.combatChecks());
  assert.equal(combat.head?.zone,'head');assert.equal(combat.smokeHit?.zone,'head');
  assert.equal(combat.shot.origin[1],1.62);assert.equal(combat.shot.distance,combat.head.dist);
  assert.equal(combat.particles,32);assert(combat.opacity>.9);assert.equal(combat.duck,null);
  assert(combat.wall);assert.equal(combat.blocked,null);assert.equal(combat.ammo,28);
  console.log('LIVE_COMBAT',JSON.stringify(combat));
  fs.writeFileSync(path.join(outputs,'graphics-validation.json'),JSON.stringify({first,final,dustSurfaces,infernoSurfaces,errors},null,2));
  if(process.env.KEEP_PREVIEW){console.log('PREVIEW_URL '+origin);await new Promise(()=>{});}
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
