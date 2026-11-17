module.exports=async function(page,out,errors){
 const fs=require('fs'),path=require('path'),assert=require('assert/strict'),reports={roofs:[],pets:[]};
 for(const map of ['dust2','inferno']){
  if(map==='inferno'){await page.evaluate(()=>__qa.map('inferno'));await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='inferno',null,{timeout:120000})}
  reports.roofs.push({map,shots:await page.evaluate(()=>__qa.roofCheck())});
 }
 await page.evaluate(()=>__qa.map('dust2'));await page.waitForFunction(()=>__qa.snapshot().ready&&__qa.snapshot().map==='dust2',null,{timeout:120000});
 for(const id of ['fox','dragon','owl','golem','deer']){
  const spot=await page.evaluate(id=>{
   const b=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0],now=Date.now(),x=b.x+8,z=b.z-7;
   const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'neve'},{id:'p2',nick:'Спутник',team:'ct',alive:true,characterId:'neve',petId:id}];
   __socket.receive('cs16_state',{phase:'freeze',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+600000,roundEnds:now+600000,buyUntil:now+600000,now});
   __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[x+3,0,z-6]},{id:'p2',nick:'Спутник',pos:[x,0,z]}]});
   __qa.addRemote('Спутник','ct',x,z);__socket.receive('cs16_pos',{nick:'Спутник',team:'ct',pos:[x,0,z],yaw:Math.PI,pitch:0,weapon:'m4a1',move:false,characterId:'neve'});
   __qa.aim(x+3,0,z-6,2.75,-.05);__qa.weapon('m4a1');__qa.hideMessages();const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();return{x,z};
  },id);
  await page.waitForTimeout(1700);
  const pet=await page.evaluate(({x,z})=>{
   const pet=__qa.scene().children.find(o=>o.userData.cs16SharedPet);if(!pet)throw Error('No pet');let draws=0;pet.traverse(o=>{if(o.isMesh)draws++});
   return{position:pet.position.toArray(),draws,behind:pet.position.z-z<-.9,head:pet.getObjectByName('petHead').rotation.toArray().slice(0,3)};
  },spot);assert(pet.behind&&pet.draws===1,id+' follow/draw budget');reports.pets.push({id,...pet});
  await page.screenshot({path:path.join(out,'companion-behind-'+id+'.png')});
 }
 reports.audio=await page.evaluate(async()=>{
  const context=new OfflineAudioContext(2,48000,48000),audio=CS16BattleAudio.create(context,{listener:()=>({x:0,y:1.62,z:0,yaw:0}),blocked:()=>false,indoor:()=>true});
  await audio.prepare();for(let i=0;i<28;i++)audio.shot(['m4a1','ak47','awp','mp5'][i%4],[i%3-1,1.62,-2]);
  const rendered=await context.startRendering();let peak=0,energy=0;for(let channel=0;channel<2;channel++)for(const v of rendered.getChannelData(channel)){if(!Number.isFinite(v))throw Error('Non-finite audio');peak=Math.max(peak,Math.abs(v));energy+=v*v;}
  audio.dispose();return{peak,rms:Math.sqrt(energy/96000),voices:28};
 });assert(reports.audio.peak<.98,'overlapping gunfire clips');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'companion-audio-check.json'),JSON.stringify(reports,null,2));console.log('COMPANION_AUDIO_PASS',JSON.stringify(reports));
};
