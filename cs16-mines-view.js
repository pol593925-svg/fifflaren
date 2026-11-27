/* Server-synchronised, instanced anti-personnel mines. */
(function(g){'use strict';
 const CAPACITY=96,valid=row=>row&&Number.isSafeInteger(row.id)&&row.kind==='ap'&&Array.isArray(row.pos)&&row.pos.length===3&&row.pos.every(Number.isFinite);
 function create(T,scene){
  const rows=new Map(),group=new T.Group(),dummy=new T.Object3D();group.name='Server mines';scene.add(group);
  const materials={
   base:new T.MeshStandardMaterial({color:0x4b5135,roughness:.72,metalness:.46}),
   top:new T.MeshStandardMaterial({color:0x767a53,roughness:.56,metalness:.55}),
   led:new T.MeshStandardMaterial({color:0x4b0906,emissive:0xff2c16,emissiveIntensity:1.4,roughness:.3,metalness:.2}),
  };
  const geometries={
   base:new T.CylinderGeometry(.19,.22,.10,16,1),top:new T.CylinderGeometry(.11,.14,.045,16,1),
   led:new T.SphereGeometry(.025,8,6),
  };
  const meshes={};
  function part(key,geometry,material){const mesh=new T.InstancedMesh(geometry,material,CAPACITY);mesh.name='Mine '+key;mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);meshes[key]=mesh;}
  part('base',geometries.base,materials.base);part('top',geometries.top,materials.top);part('led',geometries.led,materials.led);
  function put(key,index,pos,y){const mesh=meshes[key];dummy.position.set(pos[0],pos[1]+y,pos[2]);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
  function rebuild(){
   let index=0;
   for(const row of rows.values()){
    if(index>=CAPACITY)break;const pos=row.pos;
    put('base',index,pos,.05);put('top',index,pos,.12);put('led',index,[pos[0]+.105,pos[1],pos[2]],.145);index++;
   }
   for(const mesh of Object.values(meshes)){mesh.count=Math.min(index,CAPACITY);mesh.instanceMatrix.needsUpdate=true;}
  }
  function add(row){if(!valid(row)||rows.size>=CAPACITY&&!rows.has(row.id))return;rows.set(row.id,{id:row.id,kind:row.kind,pos:row.pos.slice(),team:row.team,by:row.by,armedAt:row.armedAt});rebuild();}
  function remove(id){if(rows.delete(id))rebuild();}
  function sync(data){rows.clear();for(const row of Array.isArray(data?.rows)?data.rows:[])if(valid(row)&&rows.size<CAPACITY)rows.set(row.id,{...row,pos:row.pos.slice()});rebuild();}
  function update(time){const pulse=Math.floor(time/420)%2===0;materials.led.emissiveIntensity=pulse?2.2:.45;}
  function dispose(){group.removeFromParent();for(const mesh of Object.values(meshes))mesh.dispose();for(const geometry of Object.values(geometries))geometry.dispose();for(const material of Object.values(materials))material.dispose();rows.clear();}
  return {add,remove,sync,update,dispose,count:()=>rows.size,stats:()=>({active:rows.size,ids:[...rows.keys()],draws:Object.values(meshes).filter(m=>m.count>0).length,capacity:CAPACITY})};
 }
 g.CS16MinesView={create};
})(window);
