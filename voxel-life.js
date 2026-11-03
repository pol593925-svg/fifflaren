(function(){'use strict';
// Original lightweight block animals. Static details share one geometry per species.
window.HubVoxelLife=function(T,scene,camera){
 const C=window.HubVoxelCore,animals=new Map(),assets=new Map();let weapon=null,weaponId=-1,swingAt=-1000;
 function merge(parts){const pos=[],norm=[],col=[];for(const[size,at,color]of parts){const g=new T.BoxGeometry(...size).toNonIndexed();g.translate(...at);pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);const c=new T.Color(color);for(let i=0;i<g.attributes.position.count;i++)col.push(c.r,c.g,c.b);g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeBoundingSphere();return g;}
 const material=new T.MeshLambertMaterial({vertexColors:true}),legGeometry=new T.BoxGeometry(.19,.42,.2),legsMat=new T.MeshLambertMaterial({color:0x55463c});
 function body(kind){if(assets.has(kind))return assets.get(kind);const cow=kind==='cow',sheep=kind==='sheep',color=cow?0xe3d3b6:sheep?0xeae4d6:0xe0a49b,h=cow?.94:sheep?.83:.64,parts=[[[.83,.6,1.15],[0,h,0],color],[[.52,.52,.48],[0,h+.12,.72],color],[[.38,.22,.13],[0,h-.02,1.02],cow?0x8c6a56:0xd98d8c]];
  for(const x of [-.2,.2]){parts.push([[.07,.09,.06],[x,h+.22,.975],0x272d2a],[[.18,.13,.24],[x*1.7,h+.3,.7],color]);if(cow)parts.push([[.09,.24,.1],[x,h+.45,.69],0xd5bf85]);}
  if(cow)for(const[x,z]of [[-.19,-.3],[.2,.17],[-.26,.42]])parts.push([[.3,.02,.35],[x,h+.305,z],0x4f4338]);
  if(sheep)for(const x of [-.34,.34])parts.push([[.22,.45,.9],[x,h,.01],0xf5eddf]);
  parts.push([[.08,.1,.27],[0,h+.02,-.69],color]);const geometry=merge(parts);assets.set(kind,geometry);return geometry;
 }
 function receive(list){const keep=new Set();for(const p of list||[]){if(!C.animals[p.kind]||!C.validPos(p.pos)||p.health<=0)continue;keep.add(p.id);let a=animals.get(p.id);if(!a){const group=new T.Group(),mesh=new T.Mesh(body(p.kind),material),legs=[];group.add(mesh);for(const x of [-.28,.28])for(const z of [-.4,.4]){const pivot=new T.Group(),leg=new T.Mesh(legGeometry,legsMat);leg.position.y=-.21;pivot.position.set(x,.43,z);pivot.add(leg);group.add(pivot);legs.push(pivot);}scene.add(group);group.position.fromArray(p.pos);a={group,legs,target:new T.Vector3(),phase:0};animals.set(p.id,a);}a.target.fromArray(p.pos);a.data=p;}
  for(const[id,a]of animals)if(!keep.has(id)){a.group.removeFromParent();animals.delete(id);}
 }
 function equip(id){if(weaponId===id)return;weaponId=id;if(weapon){weapon.geometry.dispose();weapon.removeFromParent();weapon=null;}if(C.items[id]?.kind!=='sword')return;const color=[0,0x98704b,0x99a4a4,0xd9e6e5,0x62dddc][C.items[id].tier],g=merge([[[.075,.5,.025],[0,.34,0],color],[[.045,.08,.025],[0,.63,0],color],[[.22,.04,.065],[0,.09,0],0xc6ab62],[[.055,.17,.055],[0,-.01,0],0x5e4431],[[.09,.05,.07],[0,-.11,0],0xc6ab62]]);weapon=new T.Mesh(g,material);weapon.renderOrder=10;camera.add(weapon);}
 function tick(dt,t,selected){equip(selected);if(weapon){const phase=Math.max(0,1-(t-swingAt)/380),s=Math.sin(phase*Math.PI);weapon.position.set(.42-s*.25,-.36+s*.05,-.65);weapon.rotation.set(-.2+s*.7,0,-.25-s*1.2);}for(const a of animals.values()){const distance=a.group.position.distanceTo(a.target);a.group.position.lerp(a.target,Math.min(1,dt*9));let delta=(a.data.yaw-a.group.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;a.group.rotation.y+=delta*Math.min(1,dt*8);a.phase+=dt*(distance>.015?9:1);a.legs.forEach((leg,i)=>leg.rotation.x=distance>.015?Math.sin(a.phase+(i===0||i===3?0:Math.PI))*.45:0);}}
 function dispose(){for(const a of animals.values())a.group.removeFromParent();animals.clear();for(const g of assets.values())g.dispose();assets.clear();if(weapon){weapon.geometry.dispose();weapon.removeFromParent();}material.dispose();legGeometry.dispose();legsMat.dispose();}
 return{receive,tick,dispose,animals,swing(t){swingAt=t;}};
};
})();
