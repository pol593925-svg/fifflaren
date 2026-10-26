const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const C=require('../cs16-combat'),THREE=require('../three.min');
const p={x:0,y:0,z:-10,tx:100,ty:20,tz:100};
for(const [y,zone] of [[1.72,'head'],[1.1,'body'],[.4,'leg']]) {
  const hit=C.playerHit([0,y,0],[0,0,-1],p,20);
  assert.equal(hit.zone,zone);assert(hit.t>9&&hit.t<10);
}
assert.equal(C.playerHit([0,1.72,0],[0,0,1],p,20),null,'target behind shooter');
assert.equal(C.playerHit([1,1.72,0],[0,0,-1],p,20),null,'off crosshair');
assert.equal(C.playerHit([0,1.72,0],[0,0,-1],p,5),null,'wall clips ray');
assert.equal(C.playerHit([0,1.72,0],[0,0,-1],{...p,crouched:true},20),null,'duck below head ray');
assert.equal(C.playerHit([0,1.72*.72,0],[0,0,-1],{...p,crouched:true},20).zone,'head');
assert(C.playerHit([.3,4,-10],[0,-1,0],p,20),'vertical body cap');
for(const yaw of [-3,-1,0,1,3])for(const pitch of [-1,0,1]) {
  const camera=new THREE.PerspectiveCamera();camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
  const expected=camera.getWorldDirection(new THREE.Vector3()),actual=C.direction(yaw,pitch,0);
  assert(expected.distanceTo(new THREE.Vector3(...actual))<1e-10,'crosshair/camera direction');
  const sampled=C.direction(yaw,pitch,1,()=>.7);
  assert(Math.abs(Math.hypot(...sampled)-1)<1e-10);
  assert(expected.angleTo(new THREE.Vector3(...sampled))<=Math.PI/180+.00001);
}
for(const [id,w] of Object.entries(C.weapons)) {
  assert(w.rpm>0&&w.penetration>0&&w.penetration<=1);
  const close=C.damage(id,'body',0,0),far=C.damage(id,'body',100,0),armored=C.damage(id,'body',0,100);
  assert(close.damage>=far.damage);assert(armored.damage<=close.damage);
  assert(armored.armorUsed>=0&&armored.armorUsed<=100);
  assert(C.damage(id,'head',0,0).damage>=close.damage);
}
assert(C.damage('ak47','head',0,100).damage>=100);
assert(C.damage('m4a1','head',0,100).damage<100);
assert(C.damage('awp','body',25,100).damage>=100);
assert(C.damage('awp','leg',25,100).damage<100);
assert.deepEqual(C.damage('glock','leg',0,100),C.damage('glock','leg',0,0),'legs ignore armor');
assert(C.damage('ak47','body',0,1).damage>C.damage('ak47','body',0,100).damage,'armor exhaustion');
assert.equal(C.damage('__proto__','body',1,0).damage,0);
assert.equal(C.damage('unknown','body',1,0).damage,0);
assert.equal(C.damage('ak47','body',NaN,0).damage,0);
const rifle={...C.weapons.ak47,auto:true};
assert(C.spread(rifle)<C.spread(rifle,{moving:true}));
assert(C.spread(rifle,{airborne:true})>C.spread(rifle,{moving:true}));
assert(C.spread(rifle,{crouched:true})<C.spread(rifle));
assert(C.spread(rifle,{shots:10,bloom:2})>C.spread(rifle));
assert(fs.readFileSync(path.join(__dirname,'../cs16-combat.js')).equals(fs.readFileSync(path.join(__dirname,'../../support-hub-server/cs16-combat.js'))),'client/server balance differs');
console.log('COMBAT PASS: camera alignment, head/body/leg/crouch, rendered positions, wall distance, 19 weapon profiles, armor/range, spread, shared server module');
