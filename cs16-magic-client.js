(function(global){'use strict';
const M=global.CS16Magic;
// FPS forward is -Z at yaw=0. Companions follow behind the owner's left shoulder.
function followTarget(pos,yaw){return {x:pos.x+Math.sin(yaw)*2.15-Math.cos(yaw)*.8,y:pos.y,z:pos.z+Math.cos(yaw)*2.15+Math.sin(yaw)*.8};}
global.CS16MagicView={followTarget,create({T,scene,hud,getState,getNick,getPlayer,getRemotes,now,getQuality=()=>"balanced",constrain=(_,target)=>target}){
 const companions=new Map(),dummy=new T.Object3D();let info={},lastHud=0,gestureUntil=0;
 const spellFx=global.CS16SpellEffects.create({T,scene,getQuality,getEye:getPlayer,getTeam:()=>getState().players.find(p=>p.nick===getNick())?.team,getPlayerPosition:n=>n===getNick()?getPlayer():getRemotes().get(n)});
 const bar=document.createElement('div');bar.className='cs16-magic-bar';const hero=document.createElement('div'),pet=document.createElement('div'),buff=document.createElement('small');bar.append(hero,pet,buff);hud.append(bar);
 function release(mesh){mesh.removeFromParent();mesh.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
 function clear(){for(const p of companions.values())release(p.mesh);companions.clear();spellFx.clear();}
 function fx(data){const caster=companions.get(data.by);if(caster&&data.slot==='pet')caster.castAt=performance.now();if(data.by===getNick())gestureUntil=performance.now()+650;spellFx.fx(data);}
 function update(dt,t){const state=getState(),nick=getNick(),mine=state.players.find(p=>p.nick===nick),keep=new Set();for(const p of state.players){if(!p.alive||!p.team||!M.petValid(p.petId))continue;const self=p.nick===nick,r=getRemotes().get(p.nick),pos=self?getPlayer():r;if(!pos||!Number.isFinite(pos.x+pos.y+pos.z))continue;if(!self){const eye=getPlayer(),limit=getQuality()==="low"?32:getQuality()==="high"?100:64;if(Math.hypot(pos.x-eye.x,pos.z-eye.z)>limit)continue;}keep.add(p.nick);let a=companions.get(p.nick);if(a&&a.id!==p.petId){release(a.mesh);companions.delete(p.nick);a=null;}if(!a){const mesh=global.CS16Graphics.createPet(p.petId);if(!mesh)continue;mesh.scale.setScalar(.8);scene.add(mesh);const rig={};for(const n of ['petHead','petEyes','body','earL','earR','legLF','legRF','legLB','legRB','limbL','limbR','tail'])rig[n]=mesh.getObjectByName(n);
      const rest={};for(const [name,bone]of Object.entries(rig))if(bone)rest[name]={y:bone.position.y,scaleY:bone.scale.y};
      a={mesh,rig,rest,id:p.petId,first:true,castAt:-Infinity,prevFloor:pos.y,hopAt:-Infinity,speed:0,phase:0,motion:0};companions.set(p.nick,a);}const yaw=(self?pos.yaw:r.yaw)||0,fly=p.petId==='owl'||p.petId==='dragon';
   const step=Math.min(.05,Math.max(0,dt));
   if(a.first)a.trailYaw=yaw;
   const turn=Math.atan2(Math.sin(yaw-a.trailYaw),Math.cos(yaw-a.trailYaw));
   a.trailYaw+=Math.max(-step*4.5,Math.min(step*4.5,turn*(1-Math.exp(-step*7))));
   const goal=constrain(pos,followTarget(pos,a.trailYaw));
   const beforeX=a.mesh.position.x,beforeZ=a.mesh.position.z;
   dummy.position.set(goal.x,goal.y,goal.z);
   // Turning never teleports a companion. Only initial spawn / long relocations snap.
   const distance=Math.hypot(goal.x-beforeX,goal.z-beforeZ),snap=a.first||Math.hypot(beforeX-pos.x,beforeZ-pos.z)>16;
   const wanted=distance>.10?Math.min(10,distance*6):0;
   a.speed+=(wanted-a.speed)*(1-Math.exp(-step*9));
   a.mesh.position.lerp(dummy.position,snap?1:Math.min(1,step*a.speed/Math.max(.001,distance)));
   const safe=constrain(pos,a.mesh.position);a.mesh.position.set(safe.x,safe.y,safe.z);
   const travel=snap?0:Math.hypot(safe.x-beforeX,safe.z-beforeZ),moving=travel>step*.15;
   a.motion+=(Math.min(1,travel/Math.max(.001,step*4))-a.motion)*(1-Math.exp(-step*10));
   a.phase+=travel*(p.petId==='deer'?4.4:p.petId==='golem'?5.3:7.2);
   a.mesh.position.y+=fly?.90+Math.sin(t*.0038+p.nick.length)*.065:.025+(1-Math.cos(a.phase*2))*.022*a.motion;
   const look=Math.sin(t*.0008+p.nick.length)*(1-a.motion),targetYaw=moving?Math.atan2(beforeX-safe.x,beforeZ-safe.z):Math.atan2(safe.x-pos.x,safe.z-pos.z)+look*.12;
   if(snap)a.facing=yaw;
   const steering=Math.atan2(Math.sin(targetYaw-a.facing),Math.cos(targetYaw-a.facing));
   a.facing+=steering*(1-Math.exp(-step*8));
   a.mesh.rotation.set(fly?-.06*a.motion+Math.sin(t*.004)*.025:Math.sin(a.phase*2)*.022*a.motion,a.facing,Math.max(-.18,Math.min(.18,-steering*.16))*a.motion);
   // Hide at point-blank walls/vehicles instead of covering the scope.
   a.mesh.visible=(!self||!pos.inVehicle)&&Math.hypot(safe.x-pos.x,safe.z-pos.z)>.72;
   if(!a.first&&safe.y>a.prevFloor+.28)a.hopAt=t;
   a.prevFloor=safe.y;const hop=Math.sin(Math.min(1,Math.max(0,(t-a.hopAt)/440))*Math.PI);
   const cast=Math.sin(Math.min(1,Math.max(0,(t-a.castAt)/950))*Math.PI);
   const gait=Math.sin(a.phase)*a.motion;
   for(const [i,n] of ['legLF','legRF','legLB','legRB'].entries())if(a.rig[n]){
    const phase=a.phase+(i===0||i===3?0:Math.PI),stride=Math.sin(phase)*a.motion;
    a.rig[n].rotation.x=stride*(p.petId==='golem'?.42:.62)-hop*.32;
    a.rig[n].position.y=a.rest[n].y+Math.max(0,Math.cos(phase))*(p.petId==='deer'?.055:.035)*a.motion;
   }
   if(a.rig.petHead){a.rig.petHead.rotation.y=Math.sin(t*.0016+p.nick.length)*.14+look*.22;a.rig.petHead.rotation.x=(p.petId==='deer'?-.48:p.petId==='dragon'?.48:.20)*cast-look*.10;a.rig.petHead.rotation.z=look*Math.sin(t*.001)*.10;}
   const blink=(t+p.nick.length*337)%4700,closed=blink<145?Math.sin(blink/145*Math.PI):0;
   if(a.rig.petEyes)a.rig.petEyes.scale.y=1-closed*.93;
   for(const [i,n]of ['earL','earR'].entries())if(a.rig[n]){a.rig[n].rotation.z=(i?1:-1)*(Math.sin(t*.003+i)*.035+cast*.13);a.rig[n].rotation.x=look*.10;}
   if(a.rig.body)a.rig.body.scale.y=a.rest.body.scaleY*(1+Math.sin(t*.0022)*.012*(1-a.motion)-Math.cos(a.phase*2)*.012*a.motion);
   for(const [i,n] of ['limbL','limbR'].entries())if(a.rig[n]){
    const wing=Math.sin(t*.011+p.nick.length),stroke=wing>=0?wing:wing*.6;
    a.rig[n].rotation.z=(i===0?1:-1)*(fly?stroke*(p.petId==='owl'?.57:.40)+cast*.70:cast*1.15+gait*.24);
    if(fly)a.rig[n].rotation.x=Math.cos(t*.011+p.nick.length)*.10;
   }
   if(a.rig.tail){a.rig.tail.rotation.y=Math.sin(t*.003+a.phase*.35)*(.18+.18*a.motion)+cast*.7-steering*.12;a.rig.tail.rotation.x=Math.sin(a.phase+.6)*.09*a.motion;}
   if(p.petId==='owl')a.mesh.rotation.z+=cast*.46;
   if(p.petId==='fox')a.mesh.rotation.y+=cast*.75;
   if(p.petId==='golem')a.mesh.rotation.x-=cast*.22;
   a.mesh.position.y+=hop*.40+cast*(p.petId==='fox'?.30:p.petId==='deer'?.18:0);
   a.first=false;
  }

  for(const[n,a]of companions)if(!keep.has(n)){release(a.mesh);companions.delete(n);}spellFx.update(dt,t);
  if(t-lastHud>100){lastHud=t;const spec=global.CS16Characters.profiles[mine?.characterId],ability=M.spells[spec?.ability],p=M.pets[mine?.petId],clock=now(),remaining=n=>Math.max(0,Math.ceil(((info[n]||0)-clock)/1000));hero.textContent='C · '+(ability?.name||'Магия')+' · '+(remaining('heroReady')?remaining('heroReady')+' с':'ГОТОВО');pet.textContent='V · '+(p?.name||'Без питомца')+(p?' · '+(remaining('petReady')?remaining('petReady')+' с':'ГОТОВО'):'');hero.style.borderColor=ability?.color||'#aaa';pet.style.borderColor=p?.color||'#aaa';buff.textContent=(info.shieldUntil>clock?'Щит '+info.shield+' · ':'')+(info.slowUntil>clock?'Замедление · ':'')+(info.speedUntil>clock?'Ускорение':'');bar.classList.toggle('inactive',!mine?.alive);}
 }
 return {update,fx,clear,warm:spellFx.warm,gesture(t){return t<gestureUntil?Math.sin((gestureUntil-t)/650*Math.PI):0;},set(data){info={...info,...data};},dispose(){clear();bar.remove();spellFx.dispose();}};
}};
})(window);
