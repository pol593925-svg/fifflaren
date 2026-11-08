(function(global){'use strict';
const M=global.CS16Magic;
// FPS forward is -Z at yaw=0. Stay ahead and on the left of the weapon.
function followTarget(pos,yaw){return {x:pos.x-Math.sin(yaw)*2.35-Math.cos(yaw)*.95,y:pos.y,z:pos.z-Math.cos(yaw)*2.35+Math.sin(yaw)*.95};}
global.CS16MagicView={followTarget,create({T,scene,hud,getState,getNick,getPlayer,getRemotes,now,getQuality=()=>"balanced",constrain=(_,target)=>target}){
 const companions=new Map(),dummy=new T.Object3D();let info={},lastHud=0,gestureUntil=0;
 const spellFx=global.CS16SpellEffects.create({T,scene,getQuality,getEye:getPlayer,getTeam:()=>getState().players.find(p=>p.nick===getNick())?.team,getPlayerPosition:n=>n===getNick()?getPlayer():getRemotes().get(n)});
 const bar=document.createElement('div');bar.className='cs16-magic-bar';const hero=document.createElement('div'),pet=document.createElement('div'),buff=document.createElement('small');bar.append(hero,pet,buff);hud.append(bar);
 function release(mesh){mesh.removeFromParent();mesh.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
 function clear(){for(const p of companions.values())release(p.mesh);companions.clear();spellFx.clear();}
 function fx(data){const caster=companions.get(data.by);if(caster&&data.slot==='pet')caster.castAt=performance.now();if(data.by===getNick())gestureUntil=performance.now()+650;spellFx.fx(data);}
 function update(dt,t){const state=getState(),nick=getNick(),mine=state.players.find(p=>p.nick===nick),keep=new Set();for(const p of state.players){if(!p.alive||!p.team||!M.petValid(p.petId))continue;const self=p.nick===nick,r=getRemotes().get(p.nick),pos=self?getPlayer():r;if(!pos||!Number.isFinite(pos.x+pos.y+pos.z))continue;if(!self){const eye=getPlayer(),limit=getQuality()==="low"?32:getQuality()==="high"?100:64;if(Math.hypot(pos.x-eye.x,pos.z-eye.z)>limit)continue;}keep.add(p.nick);let a=companions.get(p.nick);if(a&&a.id!==p.petId){release(a.mesh);companions.delete(p.nick);a=null;}if(!a){const mesh=global.CS16Graphics.createPet(p.petId);if(!mesh)continue;mesh.scale.setScalar(.8);scene.add(mesh);const rig={};for(const n of ['petHead','petEyes','body','earL','earR','legLF','legRF','legLB','legRB','limbL','limbR','tail'])rig[n]=mesh.getObjectByName(n);
      a={mesh,rig,id:p.petId,first:true,castAt:-Infinity,prevFloor:pos.y,hopAt:-Infinity};companions.set(p.nick,a);}const yaw=(self?pos.yaw:r.yaw)||0,fly=p.petId==='owl'||p.petId==='dragon';
   const goal=constrain(pos,followTarget(pos,yaw));
   const beforeX=a.mesh.position.x,beforeZ=a.mesh.position.z;
   dummy.position.set(goal.x,goal.y,goal.z);
   // Snap after respawns/half-turns; otherwise catch up faster than a sprint.
   const forwardDot=-(beforeX-pos.x)*Math.sin(yaw)-(beforeZ-pos.z)*Math.cos(yaw);
   const snap=a.first||forwardDot<.25||Math.hypot(beforeX-pos.x,beforeZ-pos.z)>8;
   a.mesh.position.lerp(dummy.position,snap?1:1-Math.exp(-dt*15));
   const safe=constrain(pos,a.mesh.position);a.mesh.position.set(safe.x,safe.y,safe.z);
   const travel=snap?0:Math.hypot(safe.x-beforeX,safe.z-beforeZ),moving=travel>dt*.25;
   a.motion=(a.motion||0)+((moving?1:0)-(a.motion||0))*(1-Math.exp(-dt*8));
   a.phase=(a.phase||0)+travel*6;
   a.mesh.position.y+=fly?.90+Math.sin(t*.004+p.nick.length)*.08:.02+Math.abs(Math.sin(a.phase))*.045*a.motion;
   // A companion glances back at its owner while waiting, then turns into a run.
   const look=Math.max(0,Math.sin(t*.0007+p.nick.length))*(1-a.motion),targetYaw=yaw+look*3.35;
   if(snap)a.facing=yaw;
   a.facing+=Math.atan2(Math.sin(targetYaw-a.facing),Math.cos(targetYaw-a.facing))*(1-Math.exp(-dt*6));
   a.mesh.rotation.set(fly?Math.sin(t*.005)*.04:Math.sin(a.phase*2)*.03*a.motion,a.facing,!fly?Math.sin(a.phase)*.035*a.motion:0);
   // Hide at point-blank walls/vehicles instead of covering the scope.
   a.mesh.visible=(!self||!pos.inVehicle)&&Math.hypot(safe.x-pos.x,safe.z-pos.z)>.72;
   if(!a.first&&safe.y>a.prevFloor+.28)a.hopAt=t;
   a.prevFloor=safe.y;const hop=Math.sin(Math.min(1,Math.max(0,(t-a.hopAt)/440))*Math.PI);
   const cast=Math.sin(Math.min(1,Math.max(0,(t-a.castAt)/950))*Math.PI);
   const gait=Math.sin(a.phase)*a.motion;
   for(const [i,n] of ['legLF','legRF','legLB','legRB'].entries())if(a.rig[n])a.rig[n].rotation.x=(i===0||i===3?1:-1)*gait*.66-hop*.45;
   if(a.rig.petHead){a.rig.petHead.rotation.y=Math.sin(t*.0016+p.nick.length)*.14+look*.22;a.rig.petHead.rotation.x=(p.petId==='deer'?-.48:p.petId==='dragon'?.48:.20)*cast-look*.10;a.rig.petHead.rotation.z=look*Math.sin(t*.001)*.10;}
   const blink=(t+p.nick.length*337)%4700,closed=blink<145?Math.sin(blink/145*Math.PI):0;
   if(a.rig.petEyes)a.rig.petEyes.scale.y=1-closed*.93;
   for(const [i,n]of ['earL','earR'].entries())if(a.rig[n]){a.rig[n].rotation.z=(i?1:-1)*(Math.sin(t*.003+i)*.035+cast*.13);a.rig[n].rotation.x=look*.10;}
   if(a.rig.body)a.rig.body.scale.y=1+Math.sin(t*.0022)*.012*(1-a.motion);
   for(const [i,n] of ['limbL','limbR'].entries())if(a.rig[n])a.rig[n].rotation.z=(i===0?1:-1)*(fly?Math.sin(t*.012)*(p.petId==='owl'?.50:.34)+cast*.70:cast*1.15+gait*.18);
   if(a.rig.tail)a.rig.tail.rotation.y=Math.sin(t*.006)*.35+cast*.9;
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
