'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function matchState(now=Date.now()){
 return {phase:'freeze',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players:[{id:'p1',nick:'Preview',team:'ct',money:16000,kills:0,deaths:0}],host:'Preview',freezeEnds:now+600000,roundEnds:now+600000,buyUntil:now+600000,now};
}
async function enterMatch(page){
 await page.evaluate(state=>{window.__nextState=state;__socket.receive('cs16_state',state);__socket.receive('cs16_you',{money:16000,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});__socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[230,1.62,38]}]});__qa.hideMessages();},matchState());
}
module.exports=async function(page,outputs,errors){
 await enterMatch(page);
 const shop=await page.evaluate(()=>__qa.vehicleQA('shop'));
 assert.equal(shop.length,2);for(const button of shop){assert(button.text.includes('3200'));assert.equal(button.disabled,false,JSON.stringify({shop,errors}));}
 await page.screenshot({path:path.join(outputs,'vehicle-shop.png')});
 await page.evaluate(()=>{__qa.ui().buy.style.display='none';});
 const reports={shop,vehicles:{},remote:{}};
 let observer,observerContext;
 try{
  observerContext=await page.context().browser().newContext({viewport:{width:1440,height:900}});
  observer=await observerContext.newPage();
  observer.on('pageerror',e=>errors.push('observer: '+e.message));
  observer.on('console',m=>{if(m.type()==='error')errors.push('observer: '+m.text());});
  await observer.route('**/*',route=>{if(route.request().url().startsWith(new URL(page.url()).origin)||route.request().url().startsWith('blob:'))return route.continue();return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,balance:0,owned:[],equipped:''})});});
  await observer.goto(new URL('/',page.url()).href,{waitUntil:'load'});
  await observer.waitForFunction(()=>window.__qa&&__qa.snapshot().ready,null,{timeout:120000});
  await enterMatch(observer);
  for(const kind of ['tank','heli']){
   const bought=await page.evaluate(kind=>__qa.vehicleQA('buy',kind),kind);
   assert(bought?.real,kind+' must use the adapted CC0 model');assert.equal(bought.variant,kind);assert.equal(bought.hp,kind==='tank'?1000:600);
   await page.waitForTimeout(450);await page.screenshot({path:path.join(outputs,kind+'-delivered.png')});
   const entered=await page.evaluate(kind=>__qa.vehicleQA('enter',kind),kind);assert(entered?.inside,kind+' must accept the driver');
   const moved=await page.evaluate(kind=>__qa.vehicleQA('move',kind),kind);assert(moved.packets.length>0,kind+' must emit network transforms');
   assert(Math.hypot(...moved.after.pos.map((n,i)=>n-moved.before[i]))>.05,kind+' must move');
   if(kind==='heli')assert(moved.after.pos[1]>moved.before[1]+1,'helicopter must gain altitude');
   await page.waitForTimeout(500);await page.screenshot({path:path.join(outputs,kind+'-driving.png')});
   const packet=moved.packets.at(-1).d;
   const remote=await observer.evaluate(({kind,packet})=>{__qa.vehicleQA('clear');__socket.receive('cs16_veh',{...packet,by:'RemotePilot',kind,variant:kind,team:'ct',hp:kind==='tank'?1000:600,max:kind==='tank'?1000:600});const result=__qa.vehicleQA('snapshot').remote[0];__qa.aim(packet.pos[0]-10,0,packet.pos[2]+10,-Math.PI/4,-.08);return result;},{kind,packet});
   assert(remote?.real,kind+' must appear as the real model at the second client');assert.equal(remote.variant,kind);
   await observer.waitForTimeout(500);await observer.screenshot({path:path.join(outputs,kind+'-remote.png')});
   reports.vehicles[kind]={bought,entered,moved};reports.remote[kind]=remote;
  }
  const performanceReport=await page.evaluate(async()=>{
   const renderer=__qa.renderer(),gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
   const gpu=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),frames=[];
   let previous=await new Promise(requestAnimationFrame);
   await new Promise(resolve=>{function frame(now){frames.push(now-previous);previous=now;if(frames.length>=90)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
   const stable=frames.slice(5),average=stable.reduce((a,b)=>a+b,0)/stable.length;
   return {gpu,fps:+(1000/average).toFixed(1),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  });
  assert(!/swiftshader|llvmpipe/i.test(performanceReport.gpu),'vehicle test must use a real GPU');assert(performanceReport.fps>=55,'vehicle scene must sustain 60 fps class rendering');reports.performance=performanceReport;
  const snapshot=await page.evaluate(()=>__qa.vehicleQA('snapshot'));assert.equal(snapshot.errors,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(outputs,'vehicles.json'),JSON.stringify({...reports,errors},null,2));console.log('REAL_VEHICLES_PASS',JSON.stringify({shop,reports,snapshot,errors}));
 }finally{await observerContext?.close();await page.evaluate(()=>__qa.vehicleQA('clear'));}
};
