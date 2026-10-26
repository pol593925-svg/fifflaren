/* Original dark-fantasy environment. Shared instanced geometry keeps forest draw calls bounded. */
(function(){
 function build(scene,{size,lanes,nearLane,riverDistance,bases,obstacles,trees}){
  const T=THREE;let seed=3281;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
  const ctx=canvas.getContext('2d'),px=v=>(v+size/2)/size*2048;
  ctx.fillStyle='#354839';ctx.fillRect(0,0,2048,2048);
  const shade=ctx.createLinearGradient(0,2048,2048,0);shade.addColorStop(0,'#4b5b3d');shade.addColorStop(.5,'#34473d');shade.addColorStop(1,'#383b40');ctx.fillStyle=shade;ctx.fillRect(0,0,2048,2048);
  for(let i=0;i<55000;i++){const x=random()*2048,y=random()*2048,r=1+random()*8;ctx.fillStyle=['#74905a19','#121c1828','#a1a08a12','#1a282423'][i%4];ctx.fillRect(x,y,r,r*.55);}
  for(const points of Object.values(lanes)){
   for(const [width,color] of [[13,'#43523c'],[11,'#66665a'],[8.5,'#817d6a']]){
    ctx.strokeStyle=color;ctx.lineWidth=width/size*2048;ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(px(x),px(z)):ctx.moveTo(px(x),px(z)));ctx.stroke();
   }
   for(let k=1;k<points.length;k++){
    const a=points[k-1],b=points[k],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let j=0;j<length;j+=1.5){const f=j/length,x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;
     for(let n=-2;n<=2;n++){const xx=x-(b[1]-a[1])/length*n*1.4,zz=z+(b[0]-a[0])/length*n*1.4;
      ctx.fillStyle=['#8b8973','#727767','#97927b','#62695b'][Math.floor(random()*4)];ctx.fillRect(px(xx),px(zz),9+random()*7,8+random()*6);
     }
    }
   }
  }
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const detail=new T.TextureLoader().load('assets/support2/forest-floor.png');detail.wrapS=detail.wrapT=T.RepeatWrapping;detail.repeat.set(12,12);detail.anisotropy=8;
  const terrainMaterial=new T.MeshStandardMaterial({map:tex,bumpMap:detail,bumpScale:.25,roughness:.96});
  terrainMaterial.onBeforeCompile=shader=>{shader.uniforms.terrainDetail={value:detail};shader.fragmentShader='uniform sampler2D terrainDetail;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb *= .55 + texture2D(terrainDetail, vMapUv * 12.0).rgb * 1.8;');};
  const ground=new T.Mesh(new T.PlaneGeometry(size,size),terrainMaterial);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const outer=new T.Mesh(new T.PlaneGeometry(size+160,size+160),new T.MeshStandardMaterial({color:0x28342d,roughness:1}));outer.rotation.x=-Math.PI/2;outer.position.y=-.06;scene.add(outer);
  const positions=[];
  for(let tries=0;positions.length<300&&tries<12000;tries++){
   const x=(random()-.5)*(size-10),z=(random()-.5)*(size-10);
   if(nearLane(x,z)<8||riverDistance(x,z)<10||bases.some(b=>Math.hypot(x-b.x,z-b.z)<23)||positions.some(p=>Math.hypot(x-p.x,z-p.z)<3.2))continue;
   positions.push({x,z,s:.8+random()*.6});obstacles.push({x,z,r:.8});trees.push({x,z,hp:1});
  }
  const trunk=new T.InstancedMesh(new T.CylinderGeometry(.22,.5,6,7),new T.MeshStandardMaterial({color:0x40362c,roughness:1}),positions.length);
  const leaf=new T.InstancedMesh(new T.ConeGeometry(2.2,4.5,9,2),new T.MeshStandardMaterial({color:0xffffff,roughness:.9}),positions.length*4);
  const m=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),s=new T.Vector3(),c=new T.Color();
  positions.forEach((p,i)=>{
   q.setFromAxisAngle(new T.Vector3(0,1,0),random()*6.28);m.compose(v.set(p.x,3*p.s,p.z),q,s.set(p.s,p.s,p.s));trunk.setMatrixAt(i,m);
   for(let j=0;j<4;j++){const scale=p.s*(1-j*.17);m.compose(v.set(p.x+(random()-.5)*.4,3+j*1.35*p.s,p.z),q,s.set(scale,scale*.85,scale));leaf.setMatrixAt(i*4+j,m);
    c.setHSL(p.x+p.z>15?.08:.29,p.x+p.z>15?.12:.26,.16+j*.025+random()*.05);leaf.setColorAt(i*4+j,c);
   }
  });trunk.castShadow=leaf.castShadow=true;leaf.receiveShadow=true;scene.add(trunk,leaf);
  const rockPositions=[];for(let i=0;i<190;i++){const x=(random()-.5)*(size-8),z=(random()-.5)*(size-8);if(nearLane(x,z)<7||bases.some(b=>Math.hypot(x-b.x,z-b.z)<20))continue;rockPositions.push({x,z});}
  const rocks=new T.InstancedMesh(new T.DodecahedronGeometry(1,1),new T.MeshStandardMaterial({color:0x626969,roughness:1}),rockPositions.length);
  rockPositions.forEach((p,i)=>{q.setFromEuler(new T.Euler(random(),random()*6,random()));m.compose(v.set(p.x,.3,p.z),q,s.set(1+random()*2,.6+random()*2,1+random()*2));rocks.setMatrixAt(i,m);});rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks);
  // Reeds and grass occupy clear ground, never the playable lane center.
  const grassPositions=[];for(let i=0;i<2400;i++){const x=(random()-.5)*size,z=(random()-.5)*size;if(nearLane(x,z)<6||riverDistance(x,z)<7)continue;grassPositions.push({x,z});}
  const grass=new T.InstancedMesh(new T.ConeGeometry(.24,.8,3),new T.MeshStandardMaterial({color:0x63714a,roughness:1}),grassPositions.length);
  grassPositions.forEach((p,i)=>{q.setFromAxisAngle(new T.Vector3(0,1,0),random()*6);m.compose(v.set(p.x,.3,p.z),q,s.set(1,.5+random(),1));grass.setMatrixAt(i,m);});scene.add(grass);
  const waterGeo=new T.PlaneGeometry(size*1.45,11,120,8);
  const water=new T.Mesh(waterGeo,new T.MeshPhongMaterial({color:0x183e45,specular:0x6aaab1,shininess:95,transparent:true,opacity:.9}));water.rotation.x=-Math.PI/2;water.rotation.z=-Math.PI/4;water.position.y=.08;scene.add(water);
  const stone=new T.MeshStandardMaterial({color:0x6e746d,roughness:.85,metalness:.08});
  for(const x of [-64,0,64]){
   const bridge=new T.Group();bridge.position.set(x,0,x);bridge.rotation.y=-Math.PI/4;
   for(let j=0;j<10;j++){const slab=new T.Mesh(new T.BoxGeometry(8,.35,1.45),stone);slab.position.set(0,.25,(j-4.5)*1.5);slab.receiveShadow=true;bridge.add(slab);}
   for(const side of [-1,1])for(let j=0;j<4;j++){const post=new T.Mesh(new T.BoxGeometry(.7,1.8,.7),stone);post.position.set(side*4,.9,(j-1.5)*4.5);post.castShadow=true;bridge.add(post);}
   scene.add(bridge);
  }
  return {waterGeo,waterMesh:water};
 }
 function character(def){
  const T=THREE,model=new T.Group(),body=new T.Group(),legs=[],arms=[];
  const hue=new T.Color(def.cloth).lerp(new T.Color(0x8a918d),.25),metal=new T.MeshStandardMaterial({color:0x88939a,metalness:.28,roughness:.42});
  const cloth=new T.MeshStandardMaterial({color:hue,roughness:.92}),trim=new T.MeshStandardMaterial({color:0xb39458,metalness:.7,roughness:.4});
  const skin=new T.MeshStandardMaterial({color:0x9c8069,roughness:.8}),glow=new T.MeshStandardMaterial({color:def.color,emissive:def.color,emissiveIntensity:1.1,roughness:.2});
  const mesh=(parent,geo,mat,x,y,z)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;};
  model.add(body);body.position.y=1.65;
  const torso=mesh(body,new T.SphereGeometry(1,24,16),def.atkRange<7?metal:cloth,0,.43,0);torso.scale.set(.51,.62,.3);
  for(let i=0;i<4;i++){const plate=mesh(body,new T.SphereGeometry(1,16,8),metal,0,.65-i*.2,.12);plate.scale.set(.48-i*.045,.17,.25);}
  mesh(body,new T.TorusGeometry(.33,.06,8,20),trim,0,.93,0).rotation.x=Math.PI/2;
  const belt=mesh(body,new T.CylinderGeometry(.36,.38,.16,16),trim,0,-.12,0);belt.scale.z=.8;
  mesh(body,new T.SphereGeometry(.26,16,12),skin,0,1.25,0);
  const helm=mesh(body,new T.SphereGeometry(.29,16,12,0,Math.PI*2,0,Math.PI*.65),metal,0,1.3,0);helm.scale.y=1.25;
  mesh(body,new T.BoxGeometry(.44,.075,.16),glow,0,1.3,.23);
  const cape=mesh(body,new T.ConeGeometry(.64,1.9,16,1,true),cloth,0,-.1,-.2);cape.scale.z=.55;
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.24,1.6,0);model.add(leg);legs.push(leg);
    mesh(leg,new T.CylinderGeometry(.22,.18,.8,12),metal,0,-.4,0);
    mesh(leg,new T.SphereGeometry(.22,12,10),metal,0,-.8,.07);
    mesh(leg,new T.CylinderGeometry(.18,.16,.6,12),cloth,0,-1.05,0);
    mesh(leg,new T.BoxGeometry(.32,.23,.55),metal,0,-1.4,.1);
    const arm=new T.Group();arm.position.set(side*.52,.8,0);body.add(arm);arms.push(arm);
    const pauldron=mesh(arm,new T.SphereGeometry(.29,12,8),metal,0,0,0);pauldron.scale.y=.65;
    mesh(arm,new T.TorusGeometry(.25,.035,6,12),trim,0,.06,0).rotation.x=Math.PI/2;
    mesh(arm,new T.CylinderGeometry(.18,.14,.65,12),cloth,side*.06,-.4,0);
    mesh(arm,new T.CylinderGeometry(.2,.14,.45,12),metal,side*.08,-.88,.05);
    mesh(arm,new T.SphereGeometry(.13,10,8),skin,side*.08,-1.13,.05);
  }
  if(def.atkRange>7){
    mesh(arms[1],new T.CylinderGeometry(.055,.07,2.7,8),trim,.1,-.5,.12);
    mesh(arms[1],new T.OctahedronGeometry(.25),glow,.1,.94,.12);
    const halo=mesh(arms[1],new T.TorusGeometry(.35,.035,8,24),trim,.1,.94,.12);halo.rotation.y=.4;
    const hood=mesh(body,new T.ConeGeometry(.38,.65,12),cloth,0,1.73,-.06);hood.rotation.z=.1;
  }else{
    mesh(arms[1],new T.BoxGeometry(.18,1.6,.07),metal,.08,-.35,.15);
    mesh(arms[1],new T.BoxGeometry(.65,.09,.12),trim,.08,-1.05,.15);
    const shield=mesh(arms[0],new T.CylinderGeometry(.54,.54,.12,8),metal,-.1,-.55,.2);shield.rotation.x=Math.PI/2;
    mesh(arms[0],new T.OctahedronGeometry(.19),glow,-.1,-.55,.32);
  }
  // Crests differentiate each original hero without toy-like head proportions.
  const variants={varg:3,mord:2,silva:1,ksul:4,jin:2,kris:1,freya:5,torg:2,zik:3,gnil:4,astra:5,undina:3,cinder:4,vesper:5,briar:4};
  for(let i=0;i<(variants[def.id]||3);i++){const angle=i*.65-1;const gem=mesh(body,new T.ConeGeometry(.08,.4+i*.06,6),i%2?trim:glow,Math.sin(angle)*.32,1.68,Math.cos(angle)*.14);gem.rotation.z=-angle*.3;}
  model.scale.setScalar(def.hp>700?1.2:1.1);
  let time=0;
  return {model,actions:{},current:null,custom:true,animate(u,dt){time+=dt;const stride=u.moving?Math.sin(time*9)*.65:0;legs[0].rotation.x=stride;legs[1].rotation.x=-stride;body.position.y=1.65+(u.moving?Math.abs(Math.sin(time*9))*.065:Math.sin(time*2)*.015);arms[0].rotation.x=-stride*.65;arms[1].rotation.x=u.atkAnimT>0?-1.6+Math.sin(u.atkAnimT*14)*.6:stride*.65;cape.rotation.x=u.moving?-.2:0;}};
 }
 window.S2World={build,character};
})();
