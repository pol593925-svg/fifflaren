module.exports=async function(page,outputs,errors){
 const assert=require('assert/strict'),fs=require('fs'),path=require('path');
 const report=await page.evaluate(async()=>{
  const T=THREE,loader=new T.GLTFLoader(),reports=[];
  for(const id of Object.keys(CS16Characters.profiles)){
   const asset=(await loader.loadAsync('models/csgo/hero-'+id+'.glb')).scene;
   const create=()=>{
    const root=asset.clone(true),holder=new T.Group();root.add(holder);
    const hold=CS16Grip.operator(T,root,holder,.51),source=[];
    root.traverse(o=>{if(o.isMesh)source.push({mesh:o,parent:o.parent});});
    const batch=CS16OperatorBatch.create(T,root,'QA-'+id);
    const gun=new T.Group();gun.userData.grip={right:[0,-.07,.03],left:[0,-.02,-.2]};holder.add(gun);
    return {root,hold,source,batch,gun};
   };
   const a=create(),b=create();let maxError=0,checked=0;
   if(a.batch.mesh.geometry!==b.batch.mesh.geometry)throw Error('shared geometry '+id);
   const v=new T.Vector3(),w=new T.Vector3();
   for(const pitch of [-.7,0,.7])for(const walk of [-.6,0,.6])for(const crouch of [1,.72]){
    a.root.position.set(21,2,-13);a.root.rotation.y=.8;a.root.scale.y=crouch;
    a.root.getObjectByName('legL').rotation.x=walk;a.root.getObjectByName('legR').rotation.x=-walk;
    a.root.getObjectByName('head').position.y=1.72+Math.abs(walk)*.04;
    a.hold.update(a.gun,pitch,.5,Math.abs(walk)*.035);
    a.root.updateMatrixWorld(true);a.batch.mesh.skeleton.update();let offset=0;
    for(const {mesh,parent} of a.source){
     mesh.matrixWorld.multiplyMatrices(parent.matrixWorld,mesh.matrix);
     if(mesh.isSkinnedMesh){mesh.bindMatrixInverse.copy(mesh.matrixWorld).invert();mesh.skeleton.update();}
     const count=mesh.geometry.attributes.position.count;
     for(let i=0;i<count;i+=Math.max(1,Math.floor(count/256))){
      mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);
      a.batch.mesh.getVertexPosition(offset+i,w);w.applyMatrix4(a.batch.mesh.matrixWorld);
      maxError=Math.max(maxError,v.distanceTo(w));checked++;
     }
     offset+=count;
    }
   }
   if(maxError>.00002)throw Error(id+' pose changed '+maxError);
   if(a.batch.mesh.skeleton===b.batch.mesh.skeleton)throw Error('shared animation state');
   let disposals=0;a.batch.mesh.geometry.addEventListener('dispose',()=>disposals++);
   a.batch.dispose();a.hold.dispose();if(disposals)throw Error('early shared geometry disposal');
   b.batch.dispose();b.hold.dispose();if(disposals)throw Error('warm geometry lost between rounds');
   const c=create();if(c.batch.mesh.geometry!==a.batch.mesh.geometry)throw Error('round rebuilt GPU buffer');c.batch.dispose();c.hold.dispose();
   reports.push({id,checked,maxError,meshesBefore:a.source.length,meshesAfter:1});
   const geometries=new Set(),materials=new Set();asset.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
   geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
   if(disposals!==1)throw Error('missing shared geometry disposal with source');
  }
  return reports;
 });
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(report.length,10);
 fs.writeFileSync(path.join(outputs,'operator-batch-checks.json'),JSON.stringify(report,null,2));
 console.log('OPERATOR_BATCH_PASS',JSON.stringify(report));
};
