/* CC0 real-scale vehicle adaptation. See models/vehicles/ATTRIBUTION.txt. */
(function(g){'use strict';
 function finish(T,source,kind){
  const asset=source.scene,box=new T.Box3().setFromObject(asset),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const length=kind==='tank'?size.z:size.x,target=kind==='tank'?6.4:10.4,scale=target/Math.max(length,.001);
  const centre=new T.Group();centre.name=kind+' centred source';asset.updateMatrixWorld(true);
  centre.add(asset);asset.scale.setScalar(scale);asset.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
  const root=new T.Group();root.name=kind==='tank'?'Real main battle tank':'Real medium helicopter';root.add(centre);
  root.userData.realVehicle=true;root.userData.aimOffset=0;
  if(kind==='tank'){
   centre.rotation.y=Math.PI/2; // source gun faces +Z, gameplay hull faces +X
   root.userData.aimOffset=Math.PI/2;
   const turret=asset.getObjectByName('turret'),cannon=asset.getObjectByName('gun'),weapon=asset.getObjectByName('weapon_station');
   asset.updateMatrixWorld(true);
   // The game aims the commander's gun separately from the turret. Preserve its
   // authored transform while making it a sibling rather than a turret child.
   if(turret&&weapon&&weapon.parent===turret)asset.attach(weapon);
   if(turret)turret.name='Turret';
   if(cannon){cannon.name='Barrel';cannon.userData.recoilAxis='z';}
   if(weapon)weapon.name='Gun';
  }else{
   asset.updateMatrixWorld(true);
   const rotor=new T.Group();rotor.name='Rotor';rotor.position.set(1.80698,4.49,0);asset.add(rotor);
   const tail=new T.Group();tail.name='TailRotor';tail.position.set(-6.773,2.8977,-.445);tail.userData.spinAxis='z';asset.add(tail);
   const main=[],rear=[];asset.traverse(o=>{if(o===rotor||o===tail)return;const n=o.name||'';
    if(/^Main rotor (finite|closed|blade|pitch|mast)/.test(n))main.push(o);
    if(/^Tail rotor (finite|closed|blade|mast)/.test(n))rear.push(o);
   });
   for(const node of main)rotor.attach(node);for(const node of rear)tail.attach(node);
  }
  const materials=new Set();root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m||materials.has(m))continue;materials.add(m);m.envMapIntensity=.9;m.dithering=true;
    if(/warm white outdoor paint/.test(m.name)){m.color.setHex(0x65705a);m.roughness=.48;m.metalness=.18;}
    if(/teal enamel/.test(m.name)){m.color.setHex(0x303c34);m.roughness=.42;}
    if(/clear glazing/.test(m.name)){m.color.setHex(0x617984);m.roughness=.08;m.metalness=.12;m.envMapIntensity=1.2;}
   }
  });
  root.userData.sourceSize=size.toArray();root.userData.scale=scale;return root;
 }
 function tank(T,asset){return finish(T,asset,'tank');}
 function heli(T,asset){return finish(T,asset,'heli');}
 g.CS16RealVehicles={tank,heli};
})(window);
