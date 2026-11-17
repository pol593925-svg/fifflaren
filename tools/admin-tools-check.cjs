module.exports=async function(page,outputs,errors){
 const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
 const spot=await page.evaluate(()=>{
  const b=CS16Buildings.layout(__qa.grid(),'dust2').buildings[0],now=Date.now(),x=b.x+17,z=b.z-13;
  window.__adminMatch={phase:'freeze',map:'dust2',gm:'classic',mode:5,round:1,scores:{t:0,ct:0},players:[{id:'p1',nick:'Preview',team:'ct',money:3200,alive:true,characterId:'neve'}],host:'Preview',freezeEnds:now+120000,roundEnds:now+120000,buyUntil:now+120000,now};
  __socket.receive('cs16_state',__adminMatch);__socket.receive('cs16_you',{money:3200,hp:100,armor:100,team:'ct',alive:true,weapon:'m4a1'});
  __socket.receive('cs16_round_start',{round:1,scores:{t:0,ct:0},spawns:[{id:'p1',nick:'Preview',pos:[x,1.6,z]}]});
  __qa.aim(x,0,z,Math.PI-.25,-.03);__qa.weapon('m4a1');__qa.addRemote('За стеной','t',b.x,b.z+4);__qa.hideMessages();
  __socket.receive('cs16_admin_tools_state',{allowed:false,wallhack:true,aimbot:true});__qa.menu();
  return {x,z,bx:b.x,bz:b.z};
 });
 assert.equal(await page.locator('.cs16-admin-tools').isVisible(),false,'ordinary users never receive controls');
 await page.evaluate(()=>__socket.receive('cs16_admin_tools_state',{allowed:true,wallhack:false,aimbot:false}));
 assert(await page.locator('.cs16-admin-tools').isVisible());
 await page.locator('[data-admin-tool="wallhack"]').click();
 assert.deepEqual(await page.evaluate(()=>__emitted.filter(e=>e.n==='cs16_admin_tools').at(-1)),{n:'cs16_admin_tools',d:{wallhack:true,aimbot:false}});
 assert.equal(await page.evaluate(()=>__qa.admin().tools.state.wallhack),false,'wait for server authorization');
 await page.evaluate(()=>__socket.receive('cs16_admin_tools_state',{allowed:true,wallhack:true,aimbot:false}));
 await page.screenshot({path:path.join(outputs,'fifflaren-esc-tools.png')});
 await page.evaluate(()=>__qa.closeMenu());await page.waitForTimeout(120);
 const wallhack=await page.evaluate(()=>{
  const target=__qa.karambit().remotes.get('За стеной'),canvas=document.querySelector('.cs16-wallhack'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;
  return {occluded:!__qa.admin().visible(target),pixels,enabled:!canvas.hidden};
 });
 assert(wallhack.occluded,'target must really be behind the house');assert(wallhack.pixels>50&&wallhack.enabled);
 await page.screenshot({path:path.join(outputs,'fifflaren-wallhack.png')});
 await page.evaluate(()=>__qa.menu());await page.locator('[data-admin-tool="aimbot"]').click();
 assert.deepEqual(await page.evaluate(()=>__emitted.filter(e=>e.n==='cs16_admin_tools').at(-1)),{n:'cs16_admin_tools',d:{wallhack:true,aimbot:true}});
 await page.evaluate(s=>{
  __socket.receive('cs16_admin_tools_state',{allowed:true,wallhack:true,aimbot:true});__qa.closeMenu();
  __socket.receive('cs16_state',{...__adminMatch,phase:'live'});__qa.addRemote('Видимая цель','t',s.x+1,s.z+8);
 },spot);
 await page.waitForTimeout(100);
 const aim=await page.evaluate(()=>{
  const before=__qa.admin().position(),target=__qa.karambit().remotes.get('Видимая цель'),visible=__qa.admin().visible(target),after=__qa.admin().apply();
  return {before:{yaw:before.yaw,pitch:before.pitch},after,visible,expected:Math.atan2(-1,-8)};
 });
 assert(aim.visible);assert(Math.abs(aim.after.yaw-aim.expected)<.01);assert.notEqual(aim.after.yaw,aim.before.yaw);
 await page.evaluate(()=>__socket.receive('cs16_admin_tools_state',{allowed:false,wallhack:false,aimbot:false}));
 assert.equal(await page.evaluate(()=>__qa.admin().tools.state.aimbot),false);
 assert.equal(await page.locator('.cs16-wallhack').isVisible(),false);
 assert.equal(await page.locator('.cs16-admin-tools').isVisible(),false);
 const session=await page.evaluate(()=>{
  const token='x'.repeat(43);__cs16Configure({username:'Fifflaren',token});__cs16Open('Fifflaren');
  const handshake=__socketAuth.token===token,connected=__socket.connected;
  __socket.receive('cs16_admin_tools_state',{allowed:true,wallhack:true,aimbot:true});
  __cs16Configure(null);
  return {handshake,connected,disconnected:!__socket.connected,reset:!__qa.admin().tools.state.allowed};
 });
 assert.deepEqual(session,{handshake:true,connected:true,disconnected:true,reset:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(outputs,'admin-tools-check.json'),JSON.stringify({wallhack,aim,errors},null,2));
 console.log('ADMIN_TOOLS_PASS',JSON.stringify({wallhack,aim}));
};
