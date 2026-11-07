// Actual match renderer, with nine remote actors and repeated ten-ability bursts.
module.exports=async function(page,outputs,errors){
 const assert=require('assert/strict'),fs=require('fs'),path=require('path'),reports=[];
 for(const map of ['dust2','inferno']){
  if(map==='inferno'){
   await page.evaluate(()=>__qa.map('inferno'));
   await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000});
  }
  const spot=await page.evaluate(map=>{
   const b=CS16Buildings.layout(__qa.grid(),map).buildings[0],x=b.x+17,z=b.z-13,now=Date.now();
   const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'pyra'}];
   for(let i=0;i<9;i++)players.push({id:'test'+i,nick:'Load '+i,team:i<4?'ct':'t',alive:true,characterId:['ember','neve','jade','aurora','pyra'][i%5]});
   __socket.receive('cs16_state',{phase:'freeze',map,gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+999999,roundEnds:now+999999,buyUntil:now+999999,now});
   __socket.receive('cs16_you',{money:16000,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:players.map((p,i)=>({id:p.id,nick:p.nick,pos:i?[x-2+i%3*3,0,z+8+Math.floor(i/3)*3]:[x,0,z]}))});
   __qa.aim(x,0,z,2.54,.05);__qa.weapon('m4a1');__qa.hideMessages();
   for(let i=0;i<9;i++)__qa.addRemote('Load '+i,i<4?'ct':'t',x-2+i%3*3,z+8+Math.floor(i/3)*3);
   return {x,z};
  },map);
  for(const quality of ['low','balanced','high']){
   await page.evaluate(q=>{const ui=__qa.ui();ui.quality.value=q;ui.quality.onchange()},quality);
   await page.waitForTimeout(1000);
   reports.push(await page.evaluate(async({quality,x,z})=>{
    const dt=[],spikes=[];let last=performance.now();
    for(let i=0;i<240;i++){
     if(i%45===0)for(let j=0;j<10;j++)__socket.receive('cs16_magic_fx',{
      by:j?'Load '+(j-1):'Preview',team:j<5?'ct':'t',id:Object.keys(CS16SpellEffects.styles)[j],
      slot:j<5?'hero':'pet',origin:[x-4+j*.45,1.3,z+6],pos:[x-4+j*.45,.15,z+10],dir:[0,0,1]});
     await new Promise(requestAnimationFrame);const now=performance.now(),elapsed=now-last;dt.push(elapsed);if(elapsed>50)spikes.push({frame:i,ms:elapsed});last=now;
    }
    const average=dt.reduce((a,b)=>a+b,0)/dt.length;dt.sort((a,b)=>a-b);
    const gl=__qa.renderer().getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {quality,fps:Math.round(1000/average),p50ms:dt[120],p95ms:dt[228],maxms:dt.at(-1),spikes,
     gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',antialias:gl.getContextAttributes().antialias,...__qa.snapshot()};
   },{quality,...spot}));
  }
 }
 assert.equal(errors.length,0,errors.join('\n'));assert(reports.every(r=>r.players===9&&r.ready));
 fs.writeFileSync(path.join(outputs,'rounds-spell-performance.json'),JSON.stringify(reports,null,2));
 console.log('ROUND_FX_PASS',JSON.stringify(reports));
};
