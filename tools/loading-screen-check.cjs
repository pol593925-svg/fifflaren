module.exports=async function(page,outputs,errors){
 const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
 if(process.env.GENERATE_LOADING_ART){
  for(const map of ['dust2','inferno']){
   if(map==='inferno'){await page.evaluate(()=>__qa.map('inferno'));await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});}
   await page.evaluate(map=>{
    __qa.pause();const ui=__qa.ui();ui.lobby.style.display='none';ui.hud.style.display='none';ui.loading.style.display='none';ui.canvas.style.display='block';ui.canvas.dataset.loadingCapture='true';
    const b=CS16Buildings.layout(__qa.grid(),map).buildings[map==='inferno'?1:0];
    __qa.view(b.x+17,2.6,b.z-13,b.x,4.5,b.z+5);
    const draw=()=>{__qa.renderer().render(__qa.scene(),__qa.camera());window.__loadingArtFrame=requestAnimationFrame(draw);};draw();
   },map);
   await page.locator('[data-loading-capture]').screenshot({path:path.join(__dirname,'../assets/cs16/loading-'+map+'.jpg'),type:'jpeg',quality:88});
   await page.evaluate(()=>cancelAnimationFrame(window.__loadingArtFrame));
  }
  assert.deepEqual(errors,[]);console.log('LOADING_PANORAMAS_CAPTURED_FROM_GAME');return;
 }
 const players=[
  {id:'p1',nick:'Preview',team:'t',characterId:'zephyr',percent:100,stage:'ready',ready:true},
  {id:'p2',nick:'knyaz',team:'t',characterId:'ember',percent:76,stage:'models',ready:false},
  {id:'p3',nick:'orix',team:'t',characterId:'jade',percent:94,stage:'shaders',ready:false},
  {id:'p4',nick:'Aurora',team:'t',characterId:'aurora',percent:100,stage:'ready',ready:true},
  {id:'b1',nick:'Страж ветра',team:'t',characterId:'helio',bot:true,percent:100,stage:'ready',ready:true},
  {id:'p5',nick:'obia',team:'ct',characterId:'tide',percent:63,stage:'models',ready:false},
  {id:'p6',nick:'barsychara',team:'ct',characterId:'pyra',percent:100,stage:'ready',ready:true},
  {id:'p7',nick:'Deftones',team:'ct',characterId:'neve',percent:89,stage:'shaders',ready:false},
  {id:'b2',nick:'Страж камня',team:'ct',characterId:'basalt',bot:true,percent:100,stage:'ready',ready:true},
  {id:'b3',nick:'Солнечный дозор',team:'ct',characterId:'helio',bot:true,percent:100,stage:'ready',ready:true}
 ];
 function payload(map='dust2',id='match-1'){return {phase:'loading',map,gm:'classic',mode:5,round:0,scores:{t:0,ct:0},host:'Preview',
  players,loading:{id,map,now:Date.now(),deadline:Date.now()+120000,startAt:0,players},now:Date.now()};}
 await page.evaluate(s=>{window.__emitted=[];__socket.receive('cs16_state',s);},payload());
 await page.waitForTimeout(350);
 assert.equal(await page.locator('.csload-player').count(),10);
 assert.equal(await page.locator('.csload-t .csload-player').count(),5);
 assert.equal(await page.locator('.csload-ct .csload-player').count(),5);
 let reports=await page.evaluate(()=>__emitted.filter(e=>e.n==='cs16_load_progress'));
 assert(reports.some(e=>e.d.ready&&e.d.percent===100&&e.d.id==='match-1'),'cached world must acknowledge a fresh match');
 assert(await page.locator('.cs16-loading').isVisible(),'100% locally must not dismiss the team barrier');
 const before=await page.evaluate(()=>__qa.snapshot().position);
 await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');
 assert.deepEqual(await page.evaluate(()=>__qa.snapshot().position),before,'loading does not simulate movement');
 await page.screenshot({path:path.join(outputs,'match-loading-teams.png')});
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(100);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const box=await page.locator('.csload-footer').boundingBox();assert(box.y+box.height<=720,'footer must fit a small laptop');
 await page.screenshot({path:path.join(outputs,'match-loading-laptop.png')});
 const complete=payload();complete.loading.players=players.map(p=>({...p,percent:100,ready:true,stage:'ready'}));
 complete.loading.startAt=Date.now()+3000;
 await page.evaluate(d=>__socket.receive('cs16_load_state',d),complete.loading);
 await page.screenshot({path:path.join(outputs,'match-loading-ready.png')});
 await page.evaluate(()=>__socket.receive('disconnect'));
 assert.equal(await page.locator('.csload-count').textContent(),'Связь потеряна');
 await page.evaluate(s=>__socket.receive('cs16_state',{...s,phase:'lobby',loading:null}),payload());
 assert(!(await page.locator('.cs16-loading').isVisible()));
 await page.evaluate(()=>__socket.receive('cs16_load_error','Не все игроки успели загрузить карту. Повторите старт.'));
 assert(await page.locator('.cs16-loading').isVisible());assert.equal(await page.locator('.csload-count').textContent(),'Подготовка остановлена');
 await page.getByRole('button',{name:'Выйти в лобби',exact:true}).click();
 assert(!(await page.locator('.cs16-loading').isVisible()));
 // Real map rebuild: no ready packet until the new world and shader warmup finish.
 await page.evaluate(s=>{window.__emitted=[];__socket.receive('cs16_state',s);},payload('inferno','match-2'));
 await page.waitForFunction(()=>__emitted.some(e=>e.n==='cs16_load_progress'&&e.d.id==='match-2'&&e.d.ready),null,{timeout:120000});
 reports=await page.evaluate(()=>__emitted.filter(e=>e.n==='cs16_load_progress'));
 assert(reports.length>3,'expected real staged loading reports');
 assert(!reports.some(e=>e.d.id==='match-1'),'no stale readiness report for previous match');
 assert(reports.slice(0,-1).every(e=>!e.d.ready&&e.d.percent<100));
 assert.equal(reports.at(-1).d.percent,100);
 assert(await page.locator('.cs16-loading').isVisible());
 await page.evaluate(s=>__socket.receive('cs16_state',{...s,phase:'freeze',loading:null,freezeEnds:Date.now()+6000,roundEnds:Date.now()+121000,buyUntil:Date.now()+21000}),payload('inferno','match-2'));
 assert(!(await page.locator('.cs16-loading').isVisible()),'server round start releases overlay');
 // Long names are text, never HTML; reduced viewport keeps both sides usable.
 const compact=payload('inferno','match-3');compact.players=compact.loading.players=players.map((p,i)=>({...p,nick:i===1?'<img src=x onerror=alert(1)>':p.nick}));
 await page.evaluate(s=>__socket.receive('cs16_state',s),compact);
 await page.setViewportSize({width:550,height:850});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.locator('.csload-player img[src=x]').count(),0);
 assert.equal(await page.locator('.csload-player').count(),10);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(outputs,'loading-screen-report.json'),JSON.stringify({passed:true,progress:reports.map(r=>r.d),screenshots:['match-loading-teams.png','match-loading-laptop.png','match-loading-ready.png']},null,2));
 console.log('MATCH_LOADING_UI_PASS',JSON.stringify({players:10,progressReports:reports.length,ready:reports.at(-1).d.percent,errors}));
};
