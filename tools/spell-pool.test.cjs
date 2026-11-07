const assert=require('node:assert/strict');
const T=require('../three.min.js');
require('../cs16-spell-effects');
const scene=new T.Scene();let time=0,quality='high';
const fx=global.CS16SpellEffects.create({T,scene,getQuality:()=>quality,clock:()=>time,getEye:()=>({x:0,y:0,z:0})});
const cast=id=>fx.fx({id,origin:[0,1.3,0],pos:[0,0,-3],dir:[0,0,-1],team:'ct'});
const pools=new Set(),buffers=new Set(),materials=new Set();
for(let cycle=0;cycle<60;cycle++){
 for(const id of Object.keys(global.CS16SpellEffects.styles)){
  assert(cast(id));fx.update(.016,time+=16);
  for(const group of scene.children){pools.add(group.uuid);group.traverse(o=>{if(o.isInstancedMesh)buffers.add(o.instanceMatrix);if(o.material)materials.add(o.material);});}
 }
 if(cycle%3===0){time+=8000;fx.update(8,time);assert.equal(fx.metrics().effects,0);}
}
assert.equal(pools.size,16);assert.equal(buffers.size,32);assert.equal(materials.size,48);
for(const m of materials)assert.equal(m.forceSinglePass,true,'unlit transparent VFX should not rebuild back/front shader variants per draw');
quality='low';for(let i=0;i<35;i++)cast('stone');fx.update(0,time);assert.equal(fx.metrics().effects,8);
for(const group of scene.children)assert.equal(group.children.find(o=>o.isInstancedMesh).count,14);
fx.clear();cast('wind');fx.update(.01,time+=10);assert.equal(scene.children[0].children[3].visible,false);
fx.clear();cast('stone');fx.update(.01,time+=10);assert.equal(scene.children[0].children[3].visible,true,'reused shield must restore the hidden core');
const before=fx.metrics();assert.equal(fx.fx({id:'flame',pos:[NaN,0,0]}),false);assert.deepEqual(fx.metrics(),before);
fx.dispose();assert.equal(scene.children.length,0);assert.equal(cast('flame'),false);
const Q=require('../cs16-adaptive-quality');const applied=[];
const q=Q.create({quality:'low',maxQuality:'low',apply:v=>applied.push(v)});
for(let i=0;i<9000;i++)q.sample(8,true);
assert.equal(q.quality,'low','weak-PC automatic mode must not turn costly shadows back on');
q.setMode('high');assert.equal(q.quality,'high','manual quality remains available');
console.log('PASS 600 mixed casts reuse 16 effects / 32 instance buffers / 48 materials; cleanup, quality changes and weak-PC ceiling');
