const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),T=require('../three.min');
const context={window:{},document:{createElement(){return {getContext(){return {
 createRadialGradient(){return {addColorStop(){}};},fillRect(){},
 createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){},
};}};}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cs16-field-effects.js'),'utf8'),context);
function fixture(){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();let quality='high';
 const fx=context.window.CS16FieldEffects.create(T,scene,[],()=>quality,()=>0,camera),root=scene.getObjectByName('Battlefield effects');
 return {fx,scene,camera,root,setQuality:q=>quality=q};
}
const pos=[0,1,-5],normal=[0,0,1];

test('surface bursts reuse preallocated attributes, enforce low caps immediately, and dispose once',()=>{
 const {fx,scene,root,setQuality}=fixture(),meshes=root.children;
 const fragments=scene.getObjectByName('Surface fragments'),dust=scene.getObjectByName('Vehicle dust');
 assert(fragments.instanceColor);assert(dust.instanceColor);assert(dust.geometry.getAttribute('instanceFade'));
 const resources=meshes.map(m=>[m.geometry,m.material,m.instanceMatrix,m.instanceColor,m.geometry.getAttribute('instanceFade')]);
 for(let i=0;i<800;i++){fx.impact(pos,normal,i%2?'stone':'wood');fx.eject([0,1,0],[0,0,-1]);fx.plume(0,0,-3);}
 fx.update(.016);assert.deepEqual(meshes.map(m=>m.count),[112,48,48,96]);
 setQuality('low');fx.update(.016);assert.deepEqual(meshes.map(m=>m.count),[51,22,22,44]);
 assert.deepEqual(meshes.map(m=>[m.geometry,m.material,m.instanceMatrix,m.instanceColor,m.geometry.getAttribute('instanceFade')]),resources);
 const disposable=[...meshes,...meshes.map(m=>m.geometry),...meshes.map(m=>m.material),...meshes.map(m=>m.material.map).filter(Boolean)],disposed=[];
 for(const resource of disposable)resource.addEventListener('dispose',()=>disposed.push(resource));
 fx.dispose();fx.dispose();fx.impact(pos,normal,'stone');fx.update(.2);
 assert.equal(scene.children.length,0);assert.equal(disposed.length,disposable.length);assert(meshes.every(m=>m.count===0));
});

test('compact wall dust fades independently, faces the camera, and expires without a shader change',()=>{
 const {fx,scene,camera,setQuality}=fixture(),dust=scene.getObjectByName('Vehicle dust'),matrix=new T.Matrix4(),scale=new T.Vector3(),position=new T.Vector3(),rotation=new T.Quaternion();
 fx.impact(pos,normal,'glass');fx.update(.01);assert.equal(dust.count,0,'glass does not emit an opaque dust cloud');
 fx.impact(pos,normal,'stone');fx.update(.06);assert.equal(dust.count,2);
 const fade=dust.geometry.getAttribute('instanceFade'),bright=fade.getX(0),version=dust.material.version;
 assert(bright>0&&bright<1);assert(dust.material.depthTest);assert.equal(dust.material.depthWrite,false);
 assert.equal(dust.material.map.image.width,64);assert.equal(dust.material.map.image.height,64);
 camera.rotation.set(.2,.6,.1);fx.update(.17);dust.getMatrixAt(0,matrix);matrix.decompose(position,rotation,scale);
 assert(fade.getX(0)<bright*.6,'each dust particle must fade before removal');assert(scale.x<.45,'wall puffs must stay smaller than a torso');
 const facing=new T.Vector3(0,0,1).applyQuaternion(rotation),viewFacing=new T.Vector3(0,0,1).applyQuaternion(camera.quaternion);
 assert(facing.dot(viewFacing)>.99999,'dust planes must billboard when the camera turns');assert.equal(dust.material.version,version);
 fx.update(.8);assert.equal(dust.count,0);setQuality('low');fx.impact(pos,normal,'wood');fx.update(.02);assert.equal(dust.count,1);fx.dispose();
});

test('loading primes every particle buffer and a canceled warm-up cannot render or resurrect effects',async()=>{
 const {fx,root}=fixture();let renders=0;
 await fx.warm({compileAsync:async()=>{},render(){renders++;assert(root.children.every(m=>m.count===1));}});
 assert.equal(renders,1);assert(root.children.every(m=>m.count===0));fx.dispose();
 const canceled=fixture();let finish;
 const pending=canceled.fx.warm({compileAsync:()=>new Promise(resolve=>finish=resolve),render(){throw Error('Disposed effects rendered');}});
 canceled.fx.dispose();finish();await pending;assert.equal(canceled.scene.children.length,0);assert(canceled.root.children.every(m=>m.count===0));
});
