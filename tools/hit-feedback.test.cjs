const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../three.min');
require('../cs16-hit-feedback');
function fixture(){
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();camera.position.set(0,1.6,0);
 let now=0,quality='high',visible=true;
 const fx=global.CS16HitFeedback.create({T,scene,camera,getQuality:()=>quality,clock:()=>now,isVisible:()=>visible});
 return {fx,scene,camera,setTime:n=>now=n,setQuality:q=>quality=q,setVisible:v=>visible=v};
}
const target={x:0,y:0,z:-6},hit={target:'B',weapon:'m4a1',dmg:28,hp:72,zone:'body',head:false};

test('loading uploads hit buffers and cancellation never renders a disposed scene',async()=>{
 const {fx,scene}=fixture();let renders=0;
 await fx.warm({compileAsync:async()=>{},render(){renders++;assert(scene.children[0].children.every(m=>m.visible&&m.count===1));}});
 assert.equal(renders,1);assert(scene.children[0].children.every(m=>!m.visible&&m.count===0));fx.dispose();
 const canceled=fixture();let finish;
 const pending=canceled.fx.warm({compileAsync:()=>new Promise(resolve=>finish=resolve),render(){throw Error('Canceled warm-up rendered');}});
 canceled.fx.dispose();finish();await pending;assert.equal(canceled.scene.children.length,0);
});
test('local ray prediction never displays a hit; acknowledgement consumes its contact point',()=>{
 const {fx,scene,setTime}=fixture();
 fx.remember('B','m4a1',[.1,1.3,-5.7],target);fx.update();assert.equal(fx.metrics().active,0);
 setTime(80);fx.confirm(hit,{...target,x:1},true);fx.update();
 assert.equal(fx.metrics().active,1);assert.equal(fx.metrics().pending,0);assert.equal(fx.metrics().total,28);
 const m=new T.Matrix4(),p=new T.Vector3();scene.children[0].children[0].getMatrixAt(0,m);p.setFromMatrixPosition(m);
 assert(Math.abs(p.x-1.1)<.05,'confirmed effect follows the target interpolation without losing the shot point');
 setTime(600);fx.update();assert.equal(fx.metrics().active,0);fx.dispose();
});
test('head, armor, fatal and legacy events are distinct; zero/invalid damage is ignored',()=>{
 const {fx}=fixture();
 for(const [event,kind]of [[hit,'body'],[{...hit,armor:100},'body'],[{...hit,armorDamage:4},'armor'],[{...hit,head:true,armorDamage:4},'head'],[{...hit,hp:0,head:true},'kill']]){
  fx.clear();fx.confirm(event,target,true);fx.update();assert.equal(fx.metrics().kind,kind);
 }
 fx.clear();assert.equal(fx.confirm({...hit,dmg:0},target,true),false);assert.equal(fx.confirm({...hit,dmg:NaN},target,true),false);fx.update();assert.equal(fx.metrics().active,0);fx.dispose();
});
test('contact core is brief, armor chips are conditional, and fading strokes stay compact',()=>{
 const {fx,scene,setTime}=fixture(),meshes=scene.children[0].children,matrix=new T.Matrix4(),contact=new T.Vector3(),position=new T.Vector3(),tint=new T.Color();
 fx.confirm(hit,target,true);fx.update();assert.deepEqual(fx.metrics().counts,[1,0,6]);
 meshes[0].getMatrixAt(0,matrix);contact.setFromMatrixPosition(matrix);
 meshes[2].getColorAt(0,tint);const initialBrightness=tint.r+tint.g+tint.b;
 setTime(120);fx.update();assert.deepEqual(fx.metrics().counts,[0,0,6]);assert.equal(fx.metrics().active,1,'strokes remain active after the core expires');
 const offsets=[];
 for(let i=0;i<meshes[2].count;i++){
  meshes[2].getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix).sub(contact);offsets.push(position.clone());
  assert(position.length()<.45,'impact strokes must not obscure a whole player');
 }
 const mean=offsets.reduce((sum,offset)=>sum.add(offset),new T.Vector3()).normalize();
 assert(offsets.every(offset=>offset.dot(mean)>0),'strokes form a directional fan, not a circular burst');
 meshes[2].getColorAt(0,tint);assert(tint.r+tint.g+tint.b<initialBrightness*.4,'late strokes fade instead of remaining solid');
 setTime(270);fx.update();assert.equal(fx.metrics().active,0);assert.deepEqual(fx.metrics().counts,[0,0,0]);
 fx.confirm({...hit,armorDamage:5,armorBreak:true},target,true);fx.update();assert.deepEqual(fx.metrics().counts,[1,2,6]);
 setTime(400);fx.update();assert.deepEqual(fx.metrics().counts,[0,2,6]);
 assert(meshes.every(mesh=>mesh.geometry.type!=='RingGeometry'),'no expanding rings cover the contact');fx.dispose();
});
test('emitted strokes and armor chips keep their world trajectory when the camera turns',()=>{
 const {fx,scene,camera,setTime}=fixture();fx.confirm({...hit,armorDamage:5},target,true);setTime(100);fx.update();
 const meshes=scene.children[0].children,before=meshes.map(mesh=>Array.from(mesh.instanceMatrix.array));
 camera.rotation.set(.15,.65,-.1);camera.position.x=1;camera.updateMatrixWorld();fx.update();
 assert.deepEqual(meshes.map(mesh=>Array.from(mesh.instanceMatrix.array)),before);fx.dispose();
});
test('server shot IDs skip rejected predictions and match out-of-order acknowledgements',()=>{
 const {fx,scene}=fixture();
 const earlier=fx.remember('B','m4a1',[.1,1.1,-5.7],target);
 const accepted=fx.remember('B','m4a1',[-.2,1.7,-5.7],target);
 fx.confirm({...hit,hitId:accepted,head:true},target,true);fx.update();
 const matrix=new T.Matrix4(),point=new T.Vector3();scene.children[0].children[0].getMatrixAt(0,matrix);point.setFromMatrixPosition(matrix);
 assert(Math.abs(point.x+.2)<.05);assert(Math.abs(point.y-1.7)<.05);assert.equal(fx.metrics().pending,1);
 fx.confirm({...hit,hitId:accepted,head:true},target,true);
 assert.equal(fx.metrics().pending,1,'a repeated acknowledgement must not consume another shot contact');
 fx.confirm({...hit,hitId:earlier},target,true);assert.equal(fx.metrics().pending,0);fx.dispose();
});
test('hidden enemies have no world effect; occluded hit cannot move a previous visible flash',()=>{
 const {fx,scene,setVisible}=fixture();fx.confirm(hit,target,true);fx.update();
 const mesh=scene.children[0].children[0],matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);const before=matrix.elements.slice();
 setVisible(false);for(let i=0;i<40;i++)fx.confirm(hit,{x:100,y:0,z:-12},true);fx.update();
 mesh.getMatrixAt(0,matrix);assert.deepEqual(matrix.elements,before);assert.equal(fx.metrics().active,1);
 fx.clear();fx.confirm(hit,target,true);fx.update();assert.equal(fx.metrics().active,0);assert.equal(fx.metrics().total,28);fx.dispose();
});
test('thousands of rapid hits reuse three buffers/materials and respect weak-PC capacity',()=>{
 const {fx,scene,setQuality,setTime}=fixture(),meshes=scene.children[0].children;
 const resources=meshes.map(m=>[m.geometry,m.material,m.instanceMatrix,m.instanceColor]);
 for(let i=0;i<2000;i++)fx.confirm({...hit,head:i%3===0,armorDamage:3,armorBreak:true},target,true);
 fx.update();assert.equal(fx.metrics().active,12);assert.deepEqual(fx.metrics().counts,[12,24,72]);
 setQuality('low');fx.update();assert.equal(fx.metrics().active,6);assert.deepEqual(fx.metrics().counts,[6,6,18]);
 assert.deepEqual(meshes.map(m=>[m.geometry,m.material,m.instanceMatrix,m.instanceColor]),resources);
 for(const mesh of meshes){assert(mesh.material.depthTest);assert.equal(mesh.material.depthWrite,false);assert(mesh.material.forceSinglePass);}
 setTime(2000);fx.update();assert.deepEqual(fx.metrics().counts,[0,0,0]);fx.dispose();assert.equal(scene.children.length,0);assert.equal(fx.confirm(hit,target,true),false);
});
test('distant and off-screen hits keep personal confirmation without world work',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,16/9,.1,500);camera.position.set(0,1.6,0);camera.updateMatrixWorld();
 let queries=0;
 const fx=global.CS16HitFeedback.create({T,scene,camera,getQuality:()=> 'low',isVisible:()=>{queries++;return true;}});
 for(const target of [{x:0,y:0,z:-100},{x:30,y:0,z:-6},{x:0,y:0,z:6}]){
  fx.clear();fx.confirm(hit,target,true);fx.update();assert.equal(fx.metrics().active,0);assert.equal(fx.metrics().total,28);
 }
 assert.equal(queries,0,'irrelevant impacts must not run the wall/smoke query');
 fx.confirm(hit,{x:0,y:0,z:-6},true);fx.update();assert.equal(queries,1);assert.equal(fx.metrics().active,1);fx.dispose();
});
