const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const T = require('../three.min.js'), finish = require('../cs16-weapon-finish.js'), footsteps = require('../cs16-footsteps.js');
const root = path.resolve(__dirname, '..');
// Electron has both window and module.exports; browser scripts must expose both.
for(const [file,key]of [['cs16-weapon-finish.js','CS16WeaponFinish'],['cs16-footsteps.js','CS16Footsteps']]){
 const context={window:{},module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 assert.equal(context.window[key],context.module.exports,file+' lost the browser global in Electron');
}
function glb(file) { const b = fs.readFileSync(path.join(root, 'models/csgo', file)); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString().trim()); }

// Protect actual Blender material groups, not just an invented fixture name.
for (const id of ['awp','ak47','m4a1','glock','deagle','scout','mp5','p90']) {
  const asset = glb(id + '.glb');
  const original = asset.materials.map(m => new T.MeshStandardMaterial({name:m.name,roughness:.66,metalness:.8}));
  assert(original.some(m => m.name.startsWith('Weapon finish /')), id + ' missing paint group');
  const normal = new T.Texture(), roughness = new T.Texture(), decal = new T.Texture();
  original.forEach(m => { m.normalMap = normal; m.roughnessMap = roughness; });
  const model = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(), original); model.add(mesh);
  const second = new T.Mesh(mesh.geometry, original.find(m=>m.name.startsWith('Weapon finish /')));model.add(second);
  finish.apply(model,decal,{glow:true},'lightning');
  assert.equal(mesh.material.length, original.length, id+' material groups collapsed');
  original.forEach((m,i)=>{
    if(m.name.startsWith('Weapon finish /')) {
      assert.notEqual(mesh.material[i],m);assert.equal(mesh.material[i].map,decal);
      assert.equal(mesh.material[i].normalMap,normal);assert.equal(mesh.material[i].roughnessMap,roughness);
      assert.equal(mesh.material[i].emissiveIntensity,0);assert.equal(m.map,null);
      if(second.material.name===m.name)assert.equal(second.material,mesh.material[i]);
    } else assert.equal(mesh.material[i],m,id+' repainted protected '+m.name);
  });
  if(id==='awp')assert(original.some(m=>m.name==='Coated scope glass'));
}
console.log('WEAPONS: real GLB groups retain glass/steel/rubber; skins are matte receiver paint');

// A prior per-face upper-floor decision produced roof slabs at y=6.5 without walls.
for(const map of ['dust2','inferno']) {
  const g=glb(map+'.glb');let checked=0;
  for(const node of g.nodes) {
    if(node.mesh===undefined || !/^[01]_[01]_(plaster|plaster_light|plaster_blue|trim|window_glass|roof)$/.test(node.name))continue;
    for(const primitive of g.meshes[node.mesh].primitives) {
      const accessor=g.accessors[primitive.attributes.POSITION];
      assert(accessor.max[1]<=4.21,map+': floating facade above collision roof in '+node.name+' at '+accessor.max[1]);checked++;
    }
  }
  assert(checked>=4,map+' architectural batches not checked');
}
console.log('HOUSES: both rebuilt maps contain no floating facade/roof above solid 4m cover');

const node=()=>({append(){},remove(){},style:{},classList:{toggle(){}}});
let player={x:80,y:0,z:90,yaw:0,inVehicle:false};const scene=new T.Scene();
const window={CS16Magic:{petValid:()=>true,spells:{},pets:{}},CS16Characters:{profiles:{}},CS16Graphics:{createPet:()=>new T.Group()}};
vm.runInNewContext(fs.readFileSync(path.join(root,'cs16-magic-client.js'),'utf8'),{window,document:{createElement:node},performance:{now:()=>1},Math,Number,Set,Map});
const api=window.CS16MagicView;
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,1.2]) {
 const target=api.followTarget(player,yaw),dx=target.x-player.x,dz=target.z-player.z;
 assert(Math.abs(-Math.sin(yaw)*dx-Math.cos(yaw)*dz-2.35)<1e-9);
 assert(Math.abs(Math.cos(yaw)*dx-Math.sin(yaw)*dz+.95)<1e-9);
}
let tick=0;
const companion=api.create({T,scene,hud:node(),getState:()=>({players:[{nick:'me',alive:true,team:'ct',petId:'fox'}]}),getNick:()=> 'me',getPlayer:()=>player,getRemotes:()=>new Map(),now:()=>0});
for(const yaw of [0,0,Math.PI/2,Math.PI,Math.PI,-Math.PI/2]) {
 player.yaw=yaw;player.x-=Math.sin(yaw)*.3;player.z-=Math.cos(yaw)*.3;
 companion.update(.016,tick+=16);const pet=scene.children[0],dx=pet.position.x-player.x,dz=pet.position.z-player.z;
 assert(-Math.sin(yaw)*dx-Math.cos(yaw)*dz>.25,'pet behind camera after turn');
 assert(Number.isFinite(pet.position.y));
}
player.inVehicle=true;companion.update(.016,tick+=16);assert.equal(scene.children[0].visible,false);
companion.dispose();assert.equal(scene.children.length,0);
console.log('PETS: stay in front across movement/half-turns, hide in vehicles, clean disposal');

for(const rate of [22050,44100,48000])for(const surface of ['stone','earth','grass','metal']) {
 const pcm=footsteps.samples(surface,0,rate),other=footsteps.samples(surface,1,rate);
 assert(pcm.every(Number.isFinite));assert(Math.max(...pcm.map(Math.abs))<.9);assert(pcm.at(-1)===0);
 assert(pcm.some((n,i)=>Math.abs(n-other[i])>.01));
 assert(pcm.reduce((s,n)=>s+n*n,0)/pcm.length>.0001,'silent '+surface);
}
let allocations=0,sources=0,stopped=0;
const context={state:'running',sampleRate:44100,destination:{},createBuffer(n,length){allocations++;return {copyToChannel(){}};},createBufferSource(){sources++;return {playbackRate:{},connect(){},disconnect(){},start(){},stop(){stopped++;}};},createGain(){return {gain:{},connect(){},disconnect(){}};},createStereoPanner(){return {pan:{},connect(){},disconnect(){}};}};
const audio=footsteps.create(context);for(let i=0;i<100;i++)audio.play('grass');
assert.equal(allocations,4);assert.equal(sources-stopped,16);audio.dispose();assert.equal(sources,stopped);
console.log('FOLEY: four variations per surface, finite unclipped PCM, cached buffers, <=16 active sounds');
