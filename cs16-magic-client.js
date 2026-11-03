(function(global){'use strict';
const M=global.CS16Magic;
// FPS forward is -Z at yaw=0. Stay ahead and on the left of the weapon.
function followTarget(pos,yaw){return {x:pos.x-Math.sin(yaw)*2.35-Math.cos(yaw)*.95,y:pos.y,z:pos.z-Math.cos(yaw)*2.35+Math.sin(yaw)*.95};}
global.CS16MagicView={followTarget,create({T,scene,hud,getState,getNick,getPlayer,getRemotes,now,constrain=(_,target)=>target}){
 const companions=new Map(),effects=[],ringGeo=new T.TorusGeometry(1,.035,5,48),sparkGeo=new T.IcosahedronGeometry(.11,0),dummy=new T.Object3D();let info={},lastHud=0;
 const bar=document.createElement('div');bar.className='cs16-magic-bar';const hero=document.createElement('div'),pet=document.createElement('div'),buff=document.createElement('small');bar.append(hero,pet,buff);hud.append(bar);
 function clear(){for(const p of companions.values())p.mesh.removeFromParent();companions.clear();while(effects.length)remove(effects.pop());}
 function remove(f){f.group.removeFromParent();f.material.dispose();}
 function fx(data){if(!Array.isArray(data.pos)||!data.pos.every(Number.isFinite)||!scene)return;while(effects.length>=16)remove(effects.shift());const color=M.spells[data.id]?.color||M.pets[data.id]?.color||'#fff4bd',material=new T.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending}),group=new T.Group(),ring=new T.Mesh(ringGeo,material),sparks=new T.InstancedMesh(sparkGeo,material,24);ring.rotation.x=Math.PI/2;group.add(ring,sparks);group.position.fromArray(data.pos);group.position.y+=.12;scene.add(group);effects.push({group,ring,sparks,material,start:performance.now(),radius:data.id==='flame'?5:data.id==='frost'?6:2.2});}
 function update(dt,t){const state=getState(),nick=getNick(),mine=state.players.find(p=>p.nick===nick),keep=new Set();for(const p of state.players){if(!p.alive||!p.team||!M.petValid(p.petId))continue;const self=p.nick===nick,r=getRemotes().get(p.nick),pos=self?getPlayer():r;if(!pos||!Number.isFinite(pos.x+pos.y+pos.z))continue;keep.add(p.nick);let a=companions.get(p.nick);if(a&&a.id!==p.petId){a.mesh.removeFromParent();companions.delete(p.nick);a=null;}if(!a){const mesh=global.CS16Graphics.createPet(p.petId);if(!mesh)continue;mesh.scale.setScalar(.8);scene.add(mesh);a={mesh,id:p.petId,first:true};companions.set(p.nick,a);}const yaw=(self?pos.yaw:r.yaw)||0,fly=p.petId==='owl'||p.petId==='dragon';
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
   a.first=false;
  }

  for(const[n,a]of companions)if(!keep.has(n)){a.mesh.removeFromParent();companions.delete(n);}for(let i=effects.length-1;i>=0;i--){const f=effects[i],k=(t-f.start)/1100;if(k>=1){remove(f);effects.splice(i,1);continue;}f.material.opacity=(1-k)*.85;f.ring.scale.setScalar(.3+k*f.radius);for(let j=0;j<24;j++){const angle=j*Math.PI*2/24;dummy.position.set(Math.cos(angle)*k*f.radius,Math.sin(j*8)*k*.6+Math.sin(k*Math.PI)*1.7,Math.sin(angle)*k*f.radius);dummy.scale.setScalar(1-k*.7);dummy.updateMatrix();f.sparks.setMatrixAt(j,dummy.matrix);}f.sparks.instanceMatrix.needsUpdate=true;}
  if(t-lastHud>100){lastHud=t;const spec=global.CS16Characters.profiles[mine?.characterId],ability=M.spells[spec?.ability],p=M.pets[mine?.petId],clock=now(),remaining=n=>Math.max(0,Math.ceil(((info[n]||0)-clock)/1000));hero.textContent='C · '+(ability?.name||'Магия')+' · '+(remaining('heroReady')?remaining('heroReady')+' с':'ГОТОВО');pet.textContent='V · '+(p?.name||'Без питомца')+(p?' · '+(remaining('petReady')?remaining('petReady')+' с':'ГОТОВО'):'');hero.style.borderColor=ability?.color||'#aaa';pet.style.borderColor=p?.color||'#aaa';buff.textContent=(info.shieldUntil>clock?'Щит '+info.shield+' · ':'')+(info.slowUntil>clock?'Замедление · ':'')+(info.speedUntil>clock?'Ускорение':'');bar.classList.toggle('inactive',!mine?.alive);}
 }
 return {update,fx,clear,set(data){info={...info,...data};},dispose(){clear();bar.remove();ringGeo.dispose();sparkGeo.dispose();}};
}};
})(window);
