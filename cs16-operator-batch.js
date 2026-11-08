/* One skin per opponent, preserving the existing shoulder/elbow IK and body pivots. */
(function(g){
 'use strict';
 const cache=new Map();
 function create(T,root,key){
  const sources=[];root.traverse(o=>{if(o.isMesh)sources.push(o);});
  // Authored heroes use one vertex-colour material. Leave other asset types alone.
  if(!sources.length||sources.some(o=>Array.isArray(o.material)||!o.geometry.attributes.color||o.material.map))return null;
  root.updateWorldMatrix(true,true);
  const bones=[],boneIndices=new Map(),rigidBones=[],inverse=new T.Matrix4().copy(root.matrixWorld).invert();
  const register=bone=>{if(!boneIndices.has(bone)){boneIndices.set(bone,bones.length);bones.push(bone);}return boneIndices.get(bone);};
  for(const source of sources){
   if(source.isSkinnedMesh)source.skeleton.bones.forEach(register);
   else {const bone=new T.Bone();bone.name=source.parent.name+'BatchJoint';source.parent.add(bone);rigidBones.push(bone);register(bone);source.userData.batchJoint=bone;}
  }
  root.updateWorldMatrix(true,true);
  const material=sources.find(o=>o.isSkinnedMesh)?.material||sources[0].material;
  const cacheKey=key+'/'+material.uuid;
  let entry=cache.get(cacheKey);
  if(!entry){
   const positions=[],normals=[],colours=[],joints=[],weights=[],indices=[];
   const matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),v=new T.Vector3();
   for(const source of sources){
    const geometry=source.geometry,{position,normal,color,skinIndex,skinWeight}=geometry.attributes,offset=positions.length/3;
    matrix.multiplyMatrices(inverse,source.matrixWorld);normalMatrix.getNormalMatrix(matrix);
    for(let i=0;i<position.count;i++){
     v.fromBufferAttribute(position,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
     v.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);normals.push(v.x,v.y,v.z);
     colours.push(color.getX(i),color.getY(i),color.getZ(i));
     if(source.isSkinnedMesh){
      for(let j=0;j<4;j++){joints.push(boneIndices.get(source.skeleton.bones[skinIndex.getComponent(i,j)]));weights.push(skinWeight.getComponent(i,j));}
     }else {joints.push(boneIndices.get(source.userData.batchJoint),0,0,0);weights.push(1,0,0,0);}
    }
    if(geometry.index)for(let i=0;i<geometry.index.count;i++)indices.push(offset+geometry.index.getX(i));
    else for(let i=0;i<position.count;i++)indices.push(offset+i);
   }
   const geometry=new T.BufferGeometry();
   for(const [name,data,size] of [['position',positions,3],['normal',normals,3],['color',colours,3],['skinWeight',weights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(data,size));
   geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setIndex(indices);
   // The envelope includes bent elbows, recoil, a moving head and coat tails.
   geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.08,0),1.65);
   entry={geometry,refs:0,retired:false};cache.set(cacheKey,entry);
   // Retain at most one geometry per loaded hero between rounds. The loading
   // screen uploads this same buffer; first spawn must not rebuild it again.
   const retire=()=>{entry.retired=true;material.removeEventListener('dispose',retire);if(!entry.refs){entry.geometry.dispose();cache.delete(cacheKey);}};
   material.addEventListener('dispose',retire);
  }
  entry.refs++;
  const mesh=new T.SkinnedMesh(entry.geometry,material),skeleton=new T.Skeleton(bones);
  mesh.name='Unified operator skin';mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.boundingSphere=entry.geometry.boundingSphere.clone();root.add(mesh);mesh.bind(skeleton,root.matrixWorld);
  for(const source of sources){delete source.userData.batchJoint;source.removeFromParent();}
  let disposed=false;
  return {mesh,sources,bones,dispose(){
   if(disposed)return;disposed=true;mesh.removeFromParent();skeleton.dispose();rigidBones.forEach(b=>b.removeFromParent());
   if(--entry.refs===0&&entry.retired){entry.geometry.dispose();cache.delete(cacheKey);}
  }};
 }
 g.CS16OperatorBatch={create};
})(typeof window!=='undefined'?window:globalThis);
