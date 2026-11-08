module.exports=async function(page,out,errors){
 const assert=require('assert/strict'),fs=require('fs'),path=require('path');
 const reports=[];
 for(const id of ['fox','dragon','owl','golem','deer']){
  reports.push(await page.evaluate(id=>{
   const a=CS16Graphics.createPet(id),b=CS16Graphics.createPet(id),meshes=[];a.traverse(o=>{if(o.isMesh)meshes.push(o)});
   if(meshes.length!==1||!meshes[0].isSkinnedMesh)throw Error('Pet must use one skinned draw: '+id);
   if(a.getObjectByName('petHead')===b.getObjectByName('petHead'))throw Error('Shared animation bones');
   if(meshes[0].geometry!==b.getObjectByName('Companion skin').geometry)throw Error('Geometry should be shared');
   a.getObjectByName('petHead').rotation.y=.5;if(b.getObjectByName('petHead').rotation.y!==0)throw Error('Pose leaked');
   const data={id,meshes:meshes.length,bones:meshes[0].skeleton.bones.length,triangles:meshes[0].geometry.index.count/3};
   a.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose()});b.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose()});
   const now=Date.now(),house=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0],x=house.x+17,z=house.z-13;
   __socket.receive('cs16_state',{phase:'freeze',map:'dust2',gm:'classic',mode:5,round:3,scores:{t:1,ct:1},players:[{id:'p1',nick:'Preview',team:'ct',alive:true,characterId:'neve',petId:id}],host:'Preview',freezeEnds:now+999999,roundEnds:now+999999,buyUntil:now+999999,now});
   __socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
   __socket.receive('cs16_round_start',{round:3,scores:{t:1,ct:1},spawns:[{id:'p1',nick:'Preview',pos:[x,0,z]}]});
   __qa.aim(x,0,z,2.54,id==='owl'||id==='dragon'?-.24:-.43);__qa.weapon(id==='golem'?'usp':'m4a1');__qa.hideMessages();const ui=__qa.ui();ui.quality.value='high';ui.quality.onchange();return data;
  },id));
  await page.waitForTimeout(1800);await page.waitForFunction(()=>{const p=__qa.scene().children.find(o=>o.userData.cs16SharedPet);return p&&Math.cos(p.rotation.y-5.75)>.985},null,{timeout:15000});await page.screenshot({path:path.join(out,'detail-'+id+'.png')});
  const live=await page.evaluate(()=>{const pet=__qa.scene().children.find(o=>o.userData.cs16SharedPet);if(!pet)throw Error('No living pet');return {position:pet.position.toArray(),visible:pet.visible}});assert(live.visible);reports.at(-1).live=live;
 }
 for(const id of ['m4a1','usp','knife']){
  await page.evaluate(id=>{const b=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0];__qa.aim(b.x+17,0,b.z-13,2.54,-.04);__qa.weapon(id)},id);await page.waitForTimeout(400);
  await page.keyboard.press('KeyI');await page.waitForTimeout(950);await page.screenshot({path:path.join(out,'detail-inspect-'+id+'.png')});await page.waitForTimeout(1400);
 }
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'pet-detail-checks.json'),JSON.stringify(reports,null,2));console.log('PET_DETAIL_PASS',JSON.stringify(reports));
};
