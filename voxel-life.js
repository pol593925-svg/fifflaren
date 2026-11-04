(function(){'use strict';
// Original lightweight block animals. Static details share one geometry per species.
window.HubVoxelLife=function(T,scene,camera,art){
 const C=window.HubVoxelCore,animals=new Map(),assets=new Map();let held=null,heldId=-1,swingAt=-1000;
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
 const grip=new T.Group();
 grip.name='Voxel first person';camera.add(grip);
 const overlay={depthTest:false,depthWrite:false,transparent:true,fog:false};

 const blockMaterial=new T.MeshBasicMaterial({...overlay,map:art.atlas,vertexColors:true});
 const flatMaterial=new T.MeshBasicMaterial({...overlay,alphaTest:.25,side:T.DoubleSide});
 function blockGeometry(id){
   const g=new T.BoxGeometry(.25,.25,.25),uv=g.attributes.uv,tile=art.atlasTiles.get(id);
   const col=tile%art.atlasColumns,row=Math.floor(tile/art.atlasColumns);
   const colors=[],shades=[.78,.73,1,.56,.89,.82];
   for(let i=0;i<uv.count;i++){
     uv.setXY(i,(col+.03+uv.getX(i)*.94)/art.atlasColumns,1-(row+.97-uv.getY(i)*.94)/art.atlasRows);
     const shade=shades[Math.floor(i/4)];colors.push(shade,shade,shade);
   }
   g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
 }
 function clearHeld(){
   if(!held)return;
   held.removeFromParent();held.geometry.dispose();held=null;
   if(flatMaterial.map){flatMaterial.map.dispose();flatMaterial.map=null;}
 }
 function equip(id){
   if(heldId===id)return;
   heldId=id;clearHeld();
   if(!id)return;
   const block=C.blocks[id];
   if(block&&!C.doorState(id)&&!block.flower&&![27,28].includes(id)){
     held=new T.Mesh(blockGeometry(id),blockMaterial);
     held.rotation.set(.16,-.62,.06);
   }else{
     const texture=new T.CanvasTexture(art.itemCanvas(id));
     texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.NearestFilter;
     texture.minFilter=T.NearestFilter;texture.generateMipmaps=false;
     flatMaterial.map=texture;flatMaterial.needsUpdate=true;
     held=new T.Mesh(new T.PlaneGeometry(.48,.48),flatMaterial);
     held.rotation.set(-.09,-.28,.09);
   }
   held.name='Voxel held item';held.renderOrder=111;grip.add(held);
 }
 function tick(dt,t,selected,digging=false,visible=true){
   equip(selected);grip.visible=visible;
   if(digging&&t-swingAt>=380)swingAt=t;
   const progress=Math.min(1,Math.max(0,(t-swingAt)/380)),arc=Math.sin(progress*Math.PI);
   const depth=.60,halfHeight=depth*Math.tan(camera.fov*Math.PI/360);
   grip.position.set(halfHeight*Math.min(camera.aspect,2.5)*.62-.12*arc,-halfHeight*.61+.07*arc,-depth-.14*arc);
   grip.rotation.set(-.26*arc,-.16*arc,-.42*arc);
   for(const a of animals.values()){const distance=a.group.position.distanceTo(a.target);a.group.position.lerp(a.target,Math.min(1,dt*9));let delta=(a.data.yaw-a.group.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;a.group.rotation.y+=delta*Math.min(1,dt*8);a.phase+=dt*(distance>.015?9:1);a.legs.forEach((leg,i)=>leg.rotation.x=distance>.015?Math.sin(a.phase+(i===0||i===3?0:Math.PI))*.45:0);}}
 function dispose(){for(const a of animals.values())a.group.removeFromParent();animals.clear();for(const g of assets.values())g.dispose();assets.clear();clearHeld();grip.removeFromParent();blockMaterial.dispose();flatMaterial.dispose();material.dispose();legGeometry.dispose();legsMat.dispose();}
 return{receive,tick,dispose,animals,swing(t){swingAt=t;}};
};
})();
