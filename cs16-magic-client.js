(function(global){'use strict';
const M=global.CS16Magic;
// FPS forward is -Z at yaw=0. Stay ahead and on the left of the weapon.
function followTarget(pos,yaw){return {x:pos.x-Math.sin(yaw)*2.35-Math.cos(yaw)*.95,y:pos.y,z:pos.z-Math.cos(yaw)*2.35+Math.sin(yaw)*.95};}
global.CS16MagicView={followTarget,create({T,scene,hud,getState,getNick,getPlayer,getRemotes,now,getQuality=()=>"balanced",constrain=(_,target)=>target}){
 const companions=new Map(),effects=[],ringGeo=new T.TorusGeometry(1,.035,5,48),sparkGeo=new T.IcosahedronGeometry(.11,0),dummy=new T.Object3D();let info={},lastHud=0;
 const bar=document.createElement('div');bar.className='cs16-magic-bar';const hero=document.createElement('div'),pet=document.createElement('div'),buff=document.createElement('small');bar.append(hero,pet,buff);hud.append(bar);
 function clear(){for(const p of companions.values())p.mesh.removeFromParent();companions.clear();while(effects.length)remove(effects.pop());}
 function remove(f){f.group.removeFromParent();f.material.dispose();}
 function fx(data){const caster=companions.get(data.by);if(caster&&data.slot==="pet"&&caster.id===data.id)caster.castAt=performance.now();if(!Array.isArray(data.pos)||!data.pos.every(Number.isFinite)||!scene)return;while(effects.length>=16)remove(effects.shift());const color=M.spells[data.id]?.color||M.pets[data.id]?.color||'#fff4bd',material=new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending}),group=new T.Group(),ring=new T.Mesh(ringGeo,material),sparks=new T.InstancedMesh(sparkGeo,material,24);ring.rotation.x=Math.PI/2;group.add(ring,sparks);group.position.fromArray(data.pos);const petFx=data.slot==='pet';if(petFx&&caster&&data.id!=='dragon')group.position.copy(caster.mesh.position);group.position.y+=.12;scene.add(group);effects.push({group,ring,sparks,material,start:performance.now(),petFx,radius:petFx?(data.id==='dragon'?2.6:1.05):data.id==='flame'?5:data.id==='frost'?6:2.2});}
 function update(dt,t){const state=getState(),nick=getNick(),mine=state.players.find(p=>p.nick===nick),keep=new Set();for(const p of state.players){if(!p.alive||!p.team||!M.petValid(p.petId))continue;const self=p.nick===nick,r=getRemotes().get(p.nick),pos=self?getPlayer():r;if(!pos||!Number.isFinite(pos.x+pos.y+pos.z))continue;if(!self){const eye=getPlayer(),limit=getQuality()==="low"?32:getQuality()==="high"?100:64;if(Math.hypot(pos.x-eye.x,pos.z-eye.z)>limit)continue;}keep.add(p.nick);let a=companions.get(p.nick);if(a&&a.id!==p.petId){a.mesh.removeFromParent();companions.delete(p.nick);a=null;}if(!a){const mesh=global.CS16Graphics.createPet(p.petId);if(!mesh)continue;mesh.scale.setScalar(.8);scene.add(mesh);const rig={};for(const n of ['petHead','legLF','legRF','legLB','legRB','limbL','limbR','tail'])rig[n]=mesh.getObjectByName(n);
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
   a.phase=(a.phase||0)+travel*6;
   a.mesh.position.y+=fly?.90+Math.sin(t*.004+p.nick.length)*.08:.02+(moving?Math.abs(Math.sin(a.phase))*.055:0);
   a.mesh.rotation.set(fly?Math.sin(t*.005)*.04:moving?Math.sin(a.phase*2)*.035:0,yaw,moving&&!fly?Math.sin(a.phase)*.04:0);
   // Hide at point-blank walls/vehicles instead of covering the scope.
   a.mesh.visible=(!self||!pos.inVehicle)&&Math.hypot(safe.x-pos.x,safe.z-pos.z)>.72;
   if(!a.first&&safe.y>a.prevFloor+.28)a.hopAt=t;
   a.prevFloor=safe.y;const hop=Math.sin(Math.min(1,Math.max(0,(t-a.hopAt)/440))*Math.PI);
   const cast=Math.sin(Math.min(1,Math.max(0,(t-a.castAt)/950))*Math.PI);
   const gait=moving?Math.sin(a.phase):0;
   for(const [i,n] of ['legLF','legRF','legLB','legRB'].entries())if(a.rig[n])a.rig[n].rotation.x=(i===0||i===3?1:-1)*gait*.66-hop*.45;
   if(a.rig.petHead){a.rig.petHead.rotation.y=Math.sin(t*.0016+p.nick.length)*.22;a.rig.petHead.rotation.x=(p.petId==='deer'?-.48:p.petId==='dragon'?.48:.20)*cast;}
   for(const [i,n] of ['limbL','limbR'].entries())if(a.rig[n])a.rig[n].rotation.z=(i===0?1:-1)*(fly?Math.sin(t*.012)*(p.petId==='owl'?.50:.34)+cast*.70:cast*1.15+gait*.18);
   if(a.rig.tail)a.rig.tail.rotation.y=Math.sin(t*.006)*.35+cast*.9;
   if(p.petId==='owl')a.mesh.rotation.z+=cast*.46;
   if(p.petId==='fox')a.mesh.rotation.y+=cast*.75;
   if(p.petId==='golem')a.mesh.rotation.x-=cast*.22;
   a.mesh.position.y+=hop*.40+cast*(p.petId==='fox'?.30:p.petId==='deer'?.18:0);
   a.first=false;
  }

  for(const[n,a]of companions)if(!keep.has(n)){a.mesh.removeFromParent();companions.delete(n);}for(let i=effects.length-1;i>=0;i--){const f=effects[i],k=(t-f.start)/1100;if(k>=1){remove(f);effects.splice(i,1);continue;}f.material.opacity=(1-k)*.85;f.ring.scale.setScalar(.3+k*f.radius);for(let j=0;j<24;j++){const angle=j*Math.PI*2/24;dummy.position.set(Math.cos(angle)*k*f.radius,Math.sin(j*8)*k*.6+Math.sin(k*Math.PI)*1.7,Math.sin(angle)*k*f.radius);dummy.scale.setScalar((f.petFx?.42:1)*(1-k*.7));dummy.updateMatrix();f.sparks.setMatrixAt(j,dummy.matrix);}f.sparks.instanceMatrix.needsUpdate=true;}
  if(t-lastHud>100){lastHud=t;const spec=global.CS16Characters.profiles[mine?.characterId],ability=M.spells[spec?.ability],p=M.pets[mine?.petId],clock=now(),remaining=n=>Math.max(0,Math.ceil(((info[n]||0)-clock)/1000));hero.textContent='C · '+(ability?.name||'Магия')+' · '+(remaining('heroReady')?remaining('heroReady')+' с':'ГОТОВО');pet.textContent='V · '+(p?.name||'Без питомца')+(p?' · '+(remaining('petReady')?remaining('petReady')+' с':'ГОТОВО'):'');hero.style.borderColor=ability?.color||'#aaa';pet.style.borderColor=p?.color||'#aaa';buff.textContent=(info.shieldUntil>clock?'Щит '+info.shield+' · ':'')+(info.slowUntil>clock?'Замедление · ':'')+(info.speedUntil>clock?'Ускорение':'');bar.classList.toggle('inactive',!mine?.alive);}
 }
 return {update,fx,clear,set(data){info={...info,...data};},dispose(){clear();bar.remove();ringGeo.dispose();sparkGeo.dispose();}};
}};
})(window);
