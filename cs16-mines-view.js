/* Server-synchronised, instanced anti-personnel and anti-tank mines. */
(function(g){'use strict';
 const CAPACITY=96,valid=row=>row&&Number.isSafeInteger(row.id)&&['ap','at'].includes(row.kind)&&Array.isArray(row.pos)&&row.pos.length===3&&row.pos.every(Number.isFinite);
 function create(T,scene){
  const rows=new Map(),group=new T.Group(),dummy=new T.Object3D();group.name='Server mines';scene.add(group);
  const materials={
   ap:new T.MeshStandardMaterial({color:0x4b5135,roughness:.72,metalness:.46}),
   apTop:new T.MeshStandardMaterial({color:0x767a53,roughness:.56,metalness:.55}),
   at:new T.MeshStandardMaterial({color:0x343a35,roughness:.66,metalness:.64}),
   atTop:new T.MeshStandardMaterial({color:0x5f6654,roughness:.62,metalness:.52}),
   led:new T.MeshStandardMaterial({color:0x4b0906,emissive:0xff2c16,emissiveIntensity:1.4,roughness:.3,metalness:.2}),
  };
  const geometries={
   apBase:new T.CylinderGeometry(.19,.22,.10,16,1),apTop:new T.CylinderGeometry(.11,.14,.045,16,1),
   atBase:new T.CylinderGeometry(.32,.35,.12,24,1),atTop:new T.CylinderGeometry(.25,.29,.045,24,1),
   led:new T.SphereGeometry(.025,8,6),ring:new T.TorusGeometry(.24,.018,6,20).rotateX(Math.PI/2),
  };
  const meshes={};
  function part(key,geometry,material){const mesh=new T.InstancedMesh(geometry,material,CAPACITY);mesh.name='Mine '+key;mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);meshes[key]=mesh;}
  part('apBase',geometries.apBase,materials.ap);part('apTop',geometries.apTop,materials.apTop);part('apLed',geometries.led,materials.led);
  part('atBase',geometries.atBase,materials.at);part('atTop',geometries.atTop,materials.atTop);part('atRing',geometries.ring,materials.atTop);part('atLed',geometries.led,materials.led);
  function put(key,index,pos,y){const mesh=meshes[key];dummy.position.set(pos[0],pos[1]+y,pos[2]);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
  function rebuild(){
   const counts={ap:0,at:0};
   for(const row of rows.values()){
    const i=counts[row.kind]++;if(i>=CAPACITY)continue;
    if(row.kind==='ap'){put('apBase',i,row.pos,.05);put('apTop',i,row.pos,.12);put('apLed',i,[row.pos[0]+.105,row.pos[1],row.pos[2]],.145);}
    else{put('atBase',i,row.pos,.06);put('atTop',i,row.pos,.14);put('atRing',i,row.pos,.165);put('atLed',i,[row.pos[0]+.19,row.pos[1],row.pos[2]],.18);}
   }
   for(const [key,mesh]of Object.entries(meshes)){const kind=key.startsWith('ap')?'ap':'at';mesh.count=Math.min(counts[kind],CAPACITY);mesh.instanceMatrix.needsUpdate=true;}
  }
  function add(row){if(!valid(row)||rows.size>=CAPACITY&&!rows.has(row.id))return;rows.set(row.id,{id:row.id,kind:row.kind,pos:row.pos.slice(),team:row.team,by:row.by,armedAt:row.armedAt});rebuild();}
  function remove(id){if(rows.delete(id))rebuild();}
  function sync(data){rows.clear();for(const row of Array.isArray(data?.rows)?data.rows:[])if(valid(row)&&rows.size<CAPACITY)rows.set(row.id,{...row,pos:row.pos.slice()});rebuild();}
  function update(time){const pulse=Math.floor(time/420)%2===0;materials.led.emissiveIntensity=pulse?2.2:.45;}
  function dispose(){group.removeFromParent();for(const mesh of Object.values(meshes))mesh.dispose();for(const geometry of Object.values(geometries))geometry.dispose();for(const material of Object.values(materials))material.dispose();rows.clear();}
  return {add,remove,sync,update,dispose,count:()=>rows.size,stats:()=>({active:rows.size,draws:Object.values(meshes).filter(m=>m.count>0).length,capacity:CAPACITY})};
 }
 g.CS16MinesView={create};
})(window);
