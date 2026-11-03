/* Evolution-inspired meadow materials and CC0 nature; playable collision remains unchanged. */
(function(global){'use strict';
 const noise=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
 function create({T,scene,grid,map,model}){
  const size=grid.length,world=size*4,maskBytes=new Uint8Array(size*size*4),clearance=new Uint16Array(size*size),queue=[];
  const buildings=global.CS16Buildings.layout(grid,map).buildings;
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
   const blocked=grid[z][x]!==0||buildings.some(b=>x*4>b.x-4&&x*4<b.x+16&&z*4>b.z-4&&z*4<b.z+16);
   const i=z*size+x;clearance[i]=blocked?0:65535;if(blocked)queue.push(i);
  }
  for(let q=0;q<queue.length;q++){const i=queue[q],x=i%size,z=Math.floor(i/size);for(const n of [x>0?i-1:-1,x<size-1?i+1:-1,z>0?i-size:-1,z<size-1?i+size:-1])if(n>=0&&clearance[n]>clearance[i]+1){clearance[n]=clearance[i]+1;queue.push(n);}}
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
   const wx=(x+.5)*4,wz=(z+.5)*4;
   const road=Math.min(Math.abs(wx-world*.48-Math.sin(wz*.019)*13),Math.abs(wz-world*.52-Math.sin(wx*.023)*11));
   const open=Math.min(1,Math.max(0,(clearance[z*size+x]-1)/2.5)),path=Math.min(1,Math.max(0,(road-3.5)/5));
   const meadow=open*path*(.78+.22*Math.sin(wx*.03+Math.sin(wz*.025)));const i=(z*size+x)*4;
   maskBytes[i]=Math.round(meadow*255);maskBytes[i+1]=Math.round(Math.max(0,1-(clearance[z*size+x]-1)*.55)*255);maskBytes[i+2]=0;maskBytes[i+3]=255;
  }
  const mask=new T.DataTexture(maskBytes,size,size,T.RGBAFormat);mask.magFilter=mask.minFilter=T.LinearFilter;mask.needsUpdate=true;
  const patched=new Set();
  model.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material])){
   if(!m||m.name!=='ground'||patched.has(m))continue;patched.add(m);
   m.onBeforeCompile=shader=>{
    shader.uniforms.meadowMask={value:mask};shader.uniforms.meadowSize={value:world};
    shader.vertexShader='varying vec3 meadowWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmeadowWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='uniform sampler2D meadowMask;uniform float meadowSize;varying vec3 meadowWorld;\nfloat meadowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(meadowHash(i),meadowHash(i+vec2(1,0)),f.x),mix(meadowHash(i+vec2(0,1)),meadowHash(i+vec2(1,1)),f.x),f.y);}\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float meadowBroad=meadowNoise(meadowWorld.xz*.065),meadowFine=meadowNoise(meadowWorld.xz*8.);
     float meadowMix=texture2D(meadowMask,meadowWorld.xz/meadowSize).r;
     meadowMix=smoothstep(.12,.82,meadowMix+(meadowNoise(meadowWorld.xz*.8)-.5)*.19);
     vec3 meadowColor=mix(vec3(.085,.14,.028),vec3(.22,.29,.067),meadowBroad)*(.82+meadowFine*.34);
     float meadowPaving=texture2D(meadowMask,meadowWorld.xz/meadowSize).g;
     vec3 earthColor=mix(vec3(.19,.135,.073),vec3(.33,.25,.14),meadowBroad)*(.82+meadowFine*.35);
     diffuseColor.rgb=mix(mix(earthColor,diffuseColor.rgb*(.86+meadowBroad*.25),meadowPaving),meadowColor,meadowMix);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,max(meadowMix*.96,(1.-meadowPaving)*.82)));');
   };
   m.customProgramCacheKey=()=> 'evolution-meadow-1';m.needsUpdate=true;
  }});
  const group=new T.Group();group.name='Evolution valley landscape';scene.add(group);
  const vertices=[],colors=[],indices=[],res=116,extent=1350,center=world/2;
  function height(x,z){const edge=Math.max(0,-x-75,-z-75,x-world-75,z-world-75),r=Math.hypot(x-center,z-center),a=Math.atan2(z-center,x-center);return Math.min(1,edge/100)*(30+Math.sin(x*.011+z*.003)*Math.cos(z*.008)*18+Math.pow(.5+.5*Math.sin(a*5+1),2)*42+Math.sin(x*.035+z*.021)*3.5)*Math.min(1,(r-world*.48)/100);}
  for(let z=0;z<=res;z++)for(let x=0;x<=res;x++){
   const wx=center-extent/2+x/res*extent,wz=center-extent/2+z/res*extent,h=Math.max(-.4,height(wx,wz)),rock=Math.min(1,Math.max(0,(h-43)/55));
   vertices.push(wx,h-.35,wz);const c=new T.Color().lerpColors(new T.Color('#587b44'),new T.Color('#abb9b7'),rock);c.multiplyScalar(.85+noise(x,z)*.18);colors.push(c.r,c.g,c.b);
   if(x<res&&z<res){const mx=wx+extent/res/2,mz=wz+extent/res/2;if(mx>=-3&&mx<=world+3&&mz>=-3&&mz<=world+3)continue;const n=z*(res+1)+x;indices.push(n,n+res+1,n+1,n+1,n+res+1,n+res+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1});const hills=new T.Mesh(geo,mat);hills.name='Soft distant ridges';hills.receiveShadow=false;group.add(hills);
  // Local, pooled grass blades: only nearby meadow patches enter the draw call.
  const points=[],pointsByCell=new Map();
  for(let z=2;z<world-2;z+=2.6)for(let x=2;x<world-2;x+=2.6){const weight=maskBytes[(Math.floor(z/4)*size+Math.floor(x/4))*4]/255;if(weight<.56||noise(x,z)<.3)continue;const p={x:x+(noise(z,x)-.5)*1.5,z:z+(noise(x+9,z)-.5)*1.5};points.push(p);const key=Math.floor(p.x/32)+','+Math.floor(p.z/32);if(!pointsByCell.has(key))pointsByCell.set(key,[]);pointsByCell.get(key).push(p);}
  const blade=new T.BufferGeometry(),pos=[],col=[],ix=[];
  for(let i=0;i<12;i++){
   const a=i*2.399,sx=Math.sin(a),sz=Math.cos(a),x=(noise(i,2)-.5)*1.3,z=(noise(i,8)-.5)*1.3,h=.13+noise(i,12)*.22,w=.016+noise(i,19)*.022,n=pos.length/3;
   pos.push(x-sx*w,0,z-sz*w,x+sx*w,0,z+sz*w,x-sx*w*.45,.55*h,z-sz*w*.45,x+sx*w*.45,.55*h,z+sz*w*.45,x+.09*sz,h,z-.09*sx);ix.push(n,n+2,n+1,n+1,n+2,n+3,n+2,n+4,n+3);
   for(let k=0;k<5;k++){const c=new T.Color(k<2?'#4e6b2c':'#94ad50');col.push(c.r,c.g,c.b);}
  }
  blade.setAttribute('position',new T.Float32BufferAttribute(pos,3));blade.setAttribute('color',new T.Float32BufferAttribute(col,3));blade.setIndex(ix);blade.computeVertexNormals();
  const wind={value:0},grassMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1});
  grassMat.onBeforeCompile=s=>{s.uniforms.meadowTime=wind;s.vertexShader='uniform float meadowTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   transformed.x+=sin(meadowTime*1.7+instanceMatrix[3].x*.5+instanceMatrix[3].z*.3)*position.y*.22;`);};
  const grass=new T.InstancedMesh(blade,grassMat,700);grass.count=0;grass.name='Nearby meadow grass';grass.frustumCulled=false;grass.receiveShadow=true;group.add(grass);const dummy=new T.Object3D();let last=-Infinity;
  return {mask,groundSurface(x,z){const i=(Math.max(0,Math.min(size-1,Math.floor(z/4)))*size+Math.max(0,Math.min(size-1,Math.floor(x/4))))*4;return maskBytes[i]>.45*255?'grass':maskBytes[i+1]>.5*255?'stone':'earth';},update(camera,time,quality){wind.value=time*.001;if(time-last<250)return;last=time;const max=quality==='low'?220:quality==='high'?700:420,near=[];const cx=Math.floor(camera.position.x/32),cz=Math.floor(camera.position.z/32);for(let z=cz-2;z<=cz+2;z++)for(let x=cx-2;x<=cx+2;x++)for(const p of pointsByCell.get(x+','+z)||[]){const d=(p.x-camera.position.x)**2+(p.z-camera.position.z)**2;if(d<55*55)near.push({p,d});}near.sort((a,b)=>a.d-b.d);grass.count=Math.min(max,near.length);for(let i=0;i<grass.count;i++){const p=near[i].p;dummy.position.set(p.x,.012,p.z);dummy.rotation.y=noise(p.x,p.z)*6.28;dummy.scale.setScalar(1);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}grass.instanceMatrix.needsUpdate=true;},dispose(){mask.dispose();geo.dispose();mat.dispose();blade.dispose();grassMat.dispose();group.removeFromParent();}};
 }
 function vegetation({T,group,nature,items,slots,broken}){
  const root=new T.Group();root.name='Evolution detailed vegetation';group.add(root);nature.updateMatrixWorld(true);
  const pools=new Map(),resources=[],dummy=new T.Object3D(),zero=new T.Matrix4().makeScale(0,0,0);let shown=new Set(),last=-Infinity;const breeze={value:0};
  function leafWind(m){m.onBeforeCompile=s=>{s.uniforms.natureTime=breeze;s.vertexShader='uniform float natureTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(natureTime+instanceMatrix[3].x*.4+instanceMatrix[3].z*.3)*.035*clamp(position.y,0.,1.);');};m.customProgramCacheKey=()=> 'nature-leaf-breeze-v1';}
  nature.traverse(o=>{
   if(!o.isMesh)return;const species=o.name.split('_')[0];if(!['oak','birch','pine','bush'].includes(species))return;
   const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),material=o.material.clone(),leaf=/Leaves|Flowers/.test(o.name);
   material.transparent=false;material.opacity=1;material.alphaTest=leaf?.4:0;material.side=leaf?T.DoubleSide:T.FrontSide;material.roughness=.95;material.envMapIntensity=.3;if(leaf)material.color.set('#b5bd9d');
   const mesh=new T.InstancedMesh(geometry,material,species==='bush'?70:32);mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name=o.name;
   if(leaf){mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:material.map,alphaTest:.4,side:T.DoubleSide});leafWind(material);leafWind(mesh.customDepthMaterial);}
   root.add(mesh);resources.push(mesh);if(!pools.has(species))pools.set(species,[]);pools.get(species).push(mesh);
  });
  const candidates=items.filter(i=>i.kind==='tree'||i.kind==='shrub');
  function refresh(camera,time,quality){
   breeze.value=time*.001;if(!camera||time-last<220)return;last=time;
   for(const id of shown)if(!broken.has(id))for(const s of slots.get(id)||[]){s.mesh.setMatrixAt(s.index,s.matrix);s.mesh.instanceMatrix.needsUpdate=true;}
   shown=new Set();const nearest=candidates.filter(i=>!broken.has(i.id)).map(i=>({i,d:(i.x-camera.position.x)**2+(i.z-camera.position.z)**2})).filter(v=>v.d<(v.i.kind==='tree'?85*85:42*42)).sort((a,b)=>a.d-b.d);
   const used={oak:0,birch:0,pine:0,bush:0};let trees=0;
   for(const {i} of nearest){const species=i.kind==='shrub'?'bush':['oak','birch','pine'][i.id%3],pool=pools.get(species);if(!pool)continue;const limit=quality==='low'?10:quality==='high'?32:20;if(i.kind==='tree'&&(trees>=limit*2||used[species]>=limit)||i.kind==='shrub'&&used.bush>=(quality==='low'?20:60))continue;
    const index=used[species]++;if(i.kind==='tree')trees++;
    dummy.position.set(i.x,0,i.z);dummy.rotation.set(0,i.yaw,0);dummy.scale.setScalar(i.scale);dummy.updateMatrix();for(const mesh of pool)mesh.setMatrixAt(index,dummy.matrix);
    shown.add(i.id);for(const s of slots.get(i.id)||[]){s.mesh.setMatrixAt(s.index,zero);s.mesh.instanceMatrix.needsUpdate=true;}
   }
   for(const [species,meshes] of pools)for(const mesh of meshes){mesh.count=used[species];mesh.instanceMatrix.needsUpdate=true;}
  }
  return {update:refresh,invalidate(){last=-Infinity;},dispose(){root.removeFromParent();for(const m of resources){m.geometry.dispose();m.material.dispose();m.customDepthMaterial?.dispose();}}};
 }
 global.CS16Landscape={create,vegetation};
})(window);
