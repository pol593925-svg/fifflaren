module.exports=async function(page,outputs,errors){
 const assert=require('assert/strict'),fs=require('fs'),path=require('path');
 await page.evaluate(()=>{
  const now=Date.now(),players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'pyra'}];
  for(let i=0;i<9;i++)players.push({id:'test'+i,nick:'Load '+i,team:i<4?'ct':'t',alive:true,characterId:['ember','neve','jade','aurora','pyra'][i%5]});
  __socket.receive('cs16_state',{phase:'freeze',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+999999,roundEnds:now+999999,buyUntil:now+999999,now});
  __socket.receive('cs16_you',{money:16000,hp:100,armor:100,team:'ct',alive:true,weapon:'ak47'});
  __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:players.map((p,i)=>({id:p.id,nick:p.nick,pos:[22+i%5*2,1.62,30-Math.floor(i/5)*3]}))});
  __qa.aim(28,0,40,0,0);__qa.weapon('m4a1');__qa.hideMessages();
  for(let i=0;i<9;i++)__qa.addRemote('Load '+i,i<4?'ct':'t',22+i%5*2,30-Math.floor(i/5)*3);
 });
 const reports=[];for(const quality of ['low','balanced','high']){
  await page.evaluate(q=>{const ui=__qa.ui();ui.quality.value=q;ui.quality.onchange()},quality);await page.waitForTimeout(900);
  reports.push(await page.evaluate(async quality=>{const dt=[];let last=performance.now();for(let i=0;i<180;i++){if(i%45===0)for(let j=0;j<10;j++){const id=Object.keys(CS16SpellEffects.styles)[j];__socket.receive('cs16_magic_fx',{by:j?'Load '+(j-1):'Preview',team:j<5?'ct':'t',id,slot:j<5?'hero':'pet',origin:[25+j*.45,1.3,32],pos:[25+j*.45,.15,28],dir:[0,0,-1]})}await new Promise(requestAnimationFrame);const now=performance.now();dt.push(now-last);last=now}dt.sort((a,b)=>a-b);return{quality,p50ms:dt[90],p95ms:dt[171],maxms:dt.at(-1),...__qa.snapshot()};},quality));
 }
 assert.equal(errors.length,0,errors.join('\n'));assert(reports.every(r=>r.players===9&&r.ready));fs.writeFileSync(path.join(outputs,'rounds-spell-performance.json'),JSON.stringify(reports,null,2));console.log('ROUND_FX_PASS',JSON.stringify(reports));
};
