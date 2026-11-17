const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('../three.min');
const node=()=>({append(){},remove(){},style:{},classList:{toggle(){}}});
function fixture(id='fox'){
 const scene=new T.Scene(),owner={x:80,y:0,z:90,yaw:0},roots=[];
 const global={CS16Magic:{petValid:()=>true,spells:{},pets:{}},CS16Characters:{profiles:{}},CS16SpellEffects:{create:()=>({clear(){},update(){},dispose(){},fx(){}})},CS16Graphics:{createPet:()=>{
  const root=new T.Group();for(const name of ['body','petHead','petEyes','earL','earR','legLF','legRF','legLB','legRB','limbL','limbR','tail']){const bone=new T.Object3D();bone.name=name;root.add(bone)}roots.push(root);return root;
 }}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../cs16-magic-client'),'utf8'),{window:global,document:{createElement:node},performance:{now:()=>0},Math,Number,Set,Map});
 const api=global.CS16MagicView,view=api.create({T,scene,hud:node(),getState:()=>({players:[{nick:'me',alive:true,team:'ct',petId:id}]}),getNick:()=> 'me',getPlayer:()=>owner,getRemotes:()=>new Map(),now:()=>0});
 let t=0;return{api,owner,scene,roots,view,tick(n=1){for(let i=0;i<n;i++)view.update(1/60,t+=1000/60)}};
}
test('all five companions settle behind and do not teleport across half turns',()=>{
 for(const id of ['fox','golem','deer','owl','dragon']){
  const f=fixture(id);f.tick();const pet=f.roots[0];
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,0]){
   f.owner.yaw=yaw;let max=0;
   for(let i=0;i<150;i++){const prev=pet.position.clone();f.tick();max=Math.max(max,Math.hypot(pet.position.x-prev.x,pet.position.z-prev.z));}
   assert(max<=10/60+.001,id+' jumped during turn');
   const dx=pet.position.x-f.owner.x,dz=pet.position.z-f.owner.z;
   assert(-Math.sin(yaw)*dx-Math.cos(yaw)*dz<-1.7,id+' must follow behind');
  }
  for(let i=0;i<240;i++){f.owner.z-=6/60;f.tick()}
  assert(Math.hypot(pet.position.x-f.owner.x,pet.position.z-f.owner.z)<4.5,id+' cannot catch running owner');
  assert(Number.isFinite(pet.rotation.y+pet.position.y));
  const legs=pet.getObjectByName('legLF'),other=pet.getObjectByName('legRF');assert(legs.rotation.x*other.rotation.x<=0,'diagonal trot');
  assert(legs.position.y>=0&&other.position.y>=0,'feet do not plunge below bind pose');
  f.view.dispose();assert.equal(f.scene.children.length,0);
 }
});
test('teleport relocation is recovered once; idle breathing and cast animations remain finite',()=>{
 const f=fixture();f.tick();f.owner.x+=80;f.tick();const pet=f.roots[0];assert(Math.hypot(pet.position.x-f.owner.x,pet.position.z-f.owner.z)<3);
 f.view.fx({by:'me',slot:'pet'});f.tick(300);pet.traverse(o=>assert(Number.isFinite(o.position.y+o.rotation.x+o.rotation.y+o.rotation.z+o.scale.y)));
 f.owner.inVehicle=true;f.tick();assert(!pet.visible);f.view.dispose();
});
