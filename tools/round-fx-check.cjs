// Actual match renderer, with nine remote actors and repeated ten-ability bursts.
module.exports=async function(page,outputs,errors){
 const assert=require('assert/strict'),fs=require('fs'),path=require('path'),reports=[];
 const profiler=process.env.PROFILE_FX?await page.context().newCDPSession(page):null;
 if(profiler)await profiler.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-v8.gc',transferMode:'ReturnAsStream'});
 if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
 for(const map of ['dust2','inferno']){
  if(map==='inferno'){
   await page.evaluate(()=>__qa.map('inferno'));
   await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});
  }
  const spot=await page.evaluate(({map,rifles})=>{
   const b=CS16Buildings.layout(__qa.grid(),map).buildings[0],x=b.x+17,z=b.z-13,now=Date.now();
   const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'pyra'}];
   for(let i=0;i<9;i++)players.push({id:'test'+i,nick:'Load '+i,team:i<4?'ct':'t',alive:true,characterId:['ember','neve','jade','aurora','pyra'][i%5]});
   __socket.receive('cs16_state',{phase:'freeze',map,gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+999999,roundEnds:now+999999,buyUntil:now+999999,now});
   __socket.receive('cs16_you',{money:16000,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:players.map((p,i)=>({id:p.id,nick:p.nick,pos:i?[x-2+i%3*3,0,z+8+Math.floor(i/3)*3]:[x,0,z]}))});
   __qa.aim(x,0,z,2.54,.05);__qa.weapon('m4a1');__qa.hideMessages();
   for(let i=0;i<9;i++){
    const r=__qa.addRemote('Load '+i,i<4?'ct':'t',x-2+i%3*3,z+8+Math.floor(i/3)*3);
    if(rifles)r.weapon=['m4a1','ak47','awp'][i%3];
   }
   return {x,z};
  },{map,rifles:!!process.env.RIFLE_LOAD});
  for(const quality of (process.env.WEAK_PC?['low']:['low','balanced','high'])){
   await page.evaluate(q=>{const ui=__qa.ui();ui.quality.value=q;ui.quality.onchange()},quality);
   await page.waitForTimeout(1000);
   reports.push(await page.evaluate(async({quality,x,z})=>{
    window.__programCounts={};
    const dt=[],spikes=[];let last=performance.now();
    for(let i=0;i<240;i++){
     if(i%6===0)for(let j=0;j<9;j++)__socket.receive('cs16_shoot',{nick:'Load '+j,weapon:['m4a1','ak47','awp'][j%3],origin:[x-2+j%3*3,1.5,z+8+Math.floor(j/3)*3],dir:[0,0,-1],distance:18});
     if(i%45===0)for(let j=0;j<10;j++)__socket.receive('cs16_magic_fx',{
      by:j?'Load '+(j-1):'Preview',team:j<5?'ct':'t',id:Object.keys(CS16SpellEffects.styles)[j],
      slot:j<5?'hero':'pet',origin:[x-4+j*.45,1.3,z+6],pos:[x-4+j*.45,.15,z+10],dir:[0,0,1]});
     await new Promise(requestAnimationFrame);const now=performance.now(),elapsed=now-last;dt.push(elapsed);if(elapsed>50)spikes.push({frame:i,ms:elapsed});last=now;
    }
    const average=dt.reduce((a,b)=>a+b,0)/dt.length;dt.sort((a,b)=>a-b);
    const gl=__qa.renderer().getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {quality,fps:Math.round(1000/average),p50ms:dt[120],p95ms:dt[228],maxms:dt.at(-1),spikes,
     gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',antialias:gl.getContextAttributes().antialias,
     programCounts:window.__programCounts,...__qa.snapshot()};
   },{quality,...spot}));
  }
 }
 assert.equal(errors.length,0,errors.join('\n'));assert(reports.every(r=>r.players===9&&r.ready));
 // Three shares its internal depth material across rigid/skinned/instanced shadow
 // casters. Check our colour-pass materials here; retain depth counts in the report.
 if(process.env.TRACE_PROGRAMS)for(const r of reports)
  assert(Object.entries(r.programCounts).filter(([key])=>!key.startsWith('MeshDepthMaterial/')).reduce((n,[,v])=>n+v,0)<240,
   'Colour shader variants should settle after loading: '+JSON.stringify(r.programCounts));
 if(process.env.WEAK_PC){for(const r of reports){r.cpuThrottle=4;r.emulatedMemoryGB=4;assert.equal(r.antialias,false,'weak-PC startup disables multisampling');}}
 fs.writeFileSync(path.join(outputs,process.env.WEAK_PC?'rounds-spell-weak-cpu.json':'rounds-spell-performance.json'),JSON.stringify(reports,null,2));
 if(profiler){
  const {profile}=await profiler.send('Profiler.stop');fs.writeFileSync(path.join(outputs,'rounds-spell-cpu.json'),JSON.stringify(profile));
  const finished=new Promise(resolve=>profiler.once('Tracing.tracingComplete',resolve));await profiler.send('Tracing.end');
  const {stream}=await finished;let trace='';for(;;){const chunk=await profiler.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}await profiler.send('IO.close',{handle:stream});
  fs.writeFileSync(path.join(outputs,'rounds-spell-trace.json'),trace);await profiler.detach();
 }
 console.log('ROUND_FX_PASS',JSON.stringify(reports));
};
