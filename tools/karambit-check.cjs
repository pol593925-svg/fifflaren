module.exports=async function(page,outputs,errors){
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
 await page.evaluate(()=>{
  const b=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0],now=Date.now();
  const players=[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'neve'}];
  __socket.receive('cs16_state',{phase:'freeze',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players,host:'Preview',freezeEnds:now+120000,roundEnds:now+120000,buyUntil:now+120000,now});
  __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
  __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[b.x+17,1.6,b.z-13]}]});
  __qa.aim(b.x+17,0,b.z-13,2.54,-.045);__qa.weapon('knife');__qa.hideMessages();
  const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();
 });
 await page.keyboard.press('b');
 await page.getByRole('button',{name:'🎒 Снаряжение',exact:true}).click();
 await page.locator('[data-melee-style="knife"]').click();
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>!!__qa.karambit().vm?.userData.karambit),false);
 await page.locator('[data-melee-style="karambit"]').click();
 await page.keyboard.press('b');await page.waitForTimeout(300);
 const report=await page.evaluate(async()=>{
  const k=__qa.karambit(),gun=k.vm,d=gun.userData.karambit,hand=gun.getObjectByName('rightHand');
  const rotor=d.rotor,geometry=[];gun.traverse(n=>{if(n.isMesh)geometry.push(n.geometry.uuid)});
  const poses=[];let pinError=0;
  for(let i=0;i<40;i++){
   await new Promise(requestAnimationFrame);gun.updateWorldMatrix(true,true);
   const pin=rotor.getWorldPosition(new THREE.Vector3()),finger=hand.localToWorld(new THREE.Vector3());
   pinError=Math.max(pinError,pin.distanceTo(finger));poses.push(rotor.rotation.x);
  }
  return {selected:k.meleeStyle,weapon:k.current,stored:localStorage.getItem('cs16-melee-style'),pinError,range:Math.max(...poses)-Math.min(...poses),geometry,triangles:__qa.snapshot().triangles};
 });
 assert.equal(report.selected,'karambit');assert.equal(report.weapon,'knife');assert.equal(report.stored,'karambit');
 assert(report.pinError<.00001,'ring must stay on the index');assert(report.range>.5,'continuous spin');
 await page.waitForFunction(()=>{const a=__qa.karambit().vm.userData.karambit.rotor.rotation.x;return a>.25&&a<.55;});
 await page.screenshot({path:path.join(outputs,'karambit-ingame.png')});
 const clip=await page.evaluate(async()=>{
  const canvas=__qa.renderer().domElement,stream=canvas.captureStream(30),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:5000000});
  const complete=new Promise(resolve=>recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()))));
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start();
  await new Promise(r=>setTimeout(r,3200));recorder.stop();stream.getTracks().forEach(t=>t.stop());return complete;
 });
 fs.writeFileSync(path.join(outputs,'karambit-spin.webm'),Buffer.from(clip));
 await page.evaluate(()=>__socket.receive('cs16_state',{...{phase:'live',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},host:'Preview',roundEnds:Date.now()+120000,now:Date.now()},players:[{id:'p1',nick:'Preview',team:'ct',money:3200,alive:true,characterId:'neve'}]}));
 await page.evaluate(()=>__qa.karambit().heavySlash());await page.waitForTimeout(170);
 const caught=await page.evaluate(()=>__qa.karambit().vm.userData.karambit.rotor.rotation.x);
 assert(Math.abs(caught%(Math.PI*2))<.001,'attack grips handle');
 await page.screenshot({path:path.join(outputs,'karambit-attack.png')});
 await page.waitForTimeout(700);
 assert(await page.evaluate(()=>__qa.karambit().vm.userData.karambit.rotor.rotation.x>.01));
 await page.evaluate(()=>{__socket.receive('cs16_pos',{nick:'Partner',team:'t',pos:[220,0,220],yaw:0,pitch:0,weapon:'knife',meleeStyle:'karambit',characterId:'neve'});});
 await page.waitForTimeout(150);
 assert(await page.evaluate(()=>!!__qa.karambit().remotes.get('Partner').gun?.userData.karambit));
 await page.evaluate(()=>{__socket.receive('cs16_pos',{nick:'Partner',team:'t',pos:[220,0,220],yaw:0,pitch:0,weapon:'knife',meleeStyle:'knife',characterId:'neve'});});
 await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>!!__qa.karambit().remotes.get('Partner').gun?.userData.karambit),false);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(outputs,'karambit-check.json'),JSON.stringify(report,null,2));
 console.log('KARAMBIT_PASS',JSON.stringify(report));
};
