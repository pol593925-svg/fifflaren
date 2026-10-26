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
</script><script src="/three.min.js"></script><script src="/GLTFLoader.js"></script><script src="/SkeletonUtils.js"></script><script src="/cs16-graphics.js"></script><script src="/cs16.js"></script><script>__cs16Open('Preview');</script>`;
const hooks = `
window.__qa={
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
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{__qa.weapon('ak47');__qa.aim(28,0,28,-.65,-.02);__qa.addRemote('Patrol','ct',36,18);__qa.hideMessages();});
  await page.waitForTimeout(600);
  const fired=await page.evaluate(()=>__qa.fire());assert.equal(fired.mag,29);assert(fired.tracers>0);
  assert(fired.kick>0);
  await page.screenshot({path:path.join(outputs,'csgo-shot-preview.png')});
  await page.waitForFunction(()=>Math.abs(__qa.effects().kick)<.001&&__qa.effects().tracers===0&&__qa.effects().flashes===0,null,{timeout:15000});const settled=await page.evaluate(()=>__qa.effects());assert.equal(settled.tracers,0);assert.equal(settled.flashes,0);assert(Math.abs(settled.kick)<.001);
  await page.screenshot({path:path.join(outputs,'csgo-dust2-preview.png')});
  const first=await page.evaluate(()=>__qa.snapshot());
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
  fs.writeFileSync(path.join(outputs,'graphics-validation.json'),JSON.stringify({first,final,dustSurfaces,infernoSurfaces,errors},null,2));
  if(process.env.KEEP_PREVIEW){console.log('PREVIEW_URL '+origin);await new Promise(()=>{});}
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
