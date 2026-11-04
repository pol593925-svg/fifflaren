(function(g){
 'use strict';
 function create({T,scene,grid,map,assets}){
   const root=new T.Group();root.name='Sector frontline';scene.add(root);
   const owned=[],own=o=>(owned.push(o),o),vehicles=new Map(),parts=[],chunks=new Map(),patched=new Map(),depths=new Map();
   const dummy=new T.Object3D(),damageMap=new Uint8Array(grid.length*grid[0].length);
   const mask=own(new T.DataTexture(damageMap,grid[0].length,grid.length,T.RedFormat));
   mask.minFilter=mask.magFilter=T.NearestFilter;mask.needsUpdate=true;
   let lastRev=-1,lastDraw=-1,previous=[],current=[],netAt=0;
   function patch(material){
     if(!material||patched.has(material)||material.isShaderMaterial)return;
     const before=material.onBeforeCompile,cache=material.customProgramCacheKey,base=cache.call(material);
     patched.set(material,{before,cache});material.onBeforeCompile=function(shader,renderer){
       before.call(this,shader,renderer);shader.uniforms.frontMask={value:mask};
       shader.vertexShader='varying vec2 frontXZ;\n'+shader.vertexShader.replace('#include <project_vertex>',[
         'vec4 frontPosition=vec4(transformed,1.0);','#ifdef USE_INSTANCING','frontPosition=instanceMatrix*frontPosition;','#endif','frontXZ=(modelMatrix*frontPosition).xz;','#include <project_vertex>'].join('\n'));
       shader.fragmentShader='uniform sampler2D frontMask; varying vec2 frontXZ;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',
         '#include <clipping_planes_fragment>\nif(texture2D(frontMask,(floor(frontXZ/4.0)+0.5)/vec2('+grid[0].length+'.0,'+grid.length+'.0)).r>0.5)discard;');
     };material.customProgramCacheKey=()=>base+'-front-demolition';material.needsUpdate=true;
   }
   const depth=own(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}));
   function bind(){
     for(const node of scene.children){
       if(!['CS16 Blender world: '+map,'Walkable two-storey buildings','Interactive interiors','CS16 destructible field','Evolution valley landscape'].includes(node.name))continue;
       node.traverse(o=>{if(!o.isMesh||o.name==='CS16 sky')return;for(const m of [].concat(o.material))patch(m);
         if(o.castShadow){if(!o.customDepthMaterial){depths.set(o,null);o.customDepthMaterial=depth;}patch(o.customDepthMaterial);}
       });
     }
   }
   const rubble=own(new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
   function rebuildChunk(key){
     const old=chunks.get(key);if(old){old.geometry.dispose();old.removeFromParent();chunks.delete(key);}
     const [cx,cz]=key.split(',').map(Number),p=[],colors=[],indices=[],w=grid[0].length;
     for(let z=cz*8;z<Math.min((cz+1)*8,grid.length);z++)for(let x=cx*8;x<Math.min((cx+1)*8,w);x++){
       if(!grid.frontDamage?.original.has(z*w+x))continue;
       const first=p.length/3;
       for(let j=0;j<=4;j++)for(let i=0;i<=4;i++){
         const wx=x*4+i,wz=z*4+j,shade=.18+((x*37+z*19+i*7+j*29)%23)*.003;
         p.push(wx,g.CS16Terrain.height(grid,wx,wz)+.008,wz);colors.push(shade,shade*.88,shade*.71);
       }
       for(let j=0;j<4;j++)for(let i=0;i<4;i++){const a=first+j*5+i;indices.push(a,a+5,a+1,a+1,a+5,a+6);}
     }
     if(!indices.length)return;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
     const mesh=new T.Mesh(geo,rubble);mesh.receiveShadow=true;root.add(mesh);chunks.set(key,mesh);
   }
   function sync(force=false){
     const state=g.CS16Front.damage(grid);if(lastRev===state.revision&&!force)return;lastRev=state.revision;
     if(state.original.size&&(force||!patched.size))bind();const changed=new Set();
     for(let id=0;id<damageMap.length;id++){
       const value=state.original.has(id)?255:0;if(value===damageMap[id])continue;damageMap[id]=value;
       changed.add(Math.floor((id%grid[0].length)/8)+','+Math.floor(Math.floor(id/grid[0].length)/8));
     }
     if(changed.size){mask.needsUpdate=true;for(const k of changed)rebuildChunk(k);}
   }
   function material(color,roughness=.8){return own(new T.MeshStandardMaterial({color,roughness,metalness:roughness<.6?.45:.08}));}
   const uniform=material(0xffffff),gear=material(0x343e36),skin=material(0xb99678),steel=material(0x303635,.38);
   function body(geo,m,x,y,z,sx,sy,sz,leg=0){
     const mesh=new T.InstancedMesh(own(geo),m,92);mesh.count=0;mesh.frustumCulled=false;root.add(mesh);
     parts.push({mesh,x,y,z,sx,sy,sz,leg});return mesh;
   }
   const oval=()=>new T.SphereGeometry(1,8,6),box=()=>new T.BoxGeometry(1,1,1);
   body(oval(),uniform,0,1.06,0,.32,.44,.21);body(box(),gear,0,1.1,.17,.39,.51,.19);body(oval(),skin,0,1.61,0,.175,.20,.16);
   body(oval(),uniform,0,1.73,0,.20,.14,.19);body(box(),steel,.20,1.12,-.27,.075,.10,.64);
   for(const sign of [-1,1]){body(oval(),gear,sign*.15,.44,0,.13,.42,.14,sign);body(oval(),uniform,sign*.27,1.12,-.07,.12,.25,.12);}
   const jetMetal=material(0x637477,.42),canopy=material(0x284952,.27),nozzle=material(0x394244,.36);
   function jet(){
     const obj=new T.Group();function piece(geo,m,x,y,z){const n=new T.Mesh(own(geo),m);n.position.set(x,y,z);obj.add(n);return n;}
     const fus=piece(new T.SphereGeometry(1,14,10),jetMetal,0,.70,0);fus.scale.set(.59,.61,4.35);
     const glass=piece(new T.SphereGeometry(1,12,8),canopy,0,1.13,-1.25);glass.scale.set(.43,.35,1.37);
     for(const side of [-1,1]){
       const pos=[0,.80,-1.72, side*4.3,.60,1.45, side*3.95,.66,2.03, 0,.86,1.23, 0,.67,-1.72, side*4.3,.53,1.45,side*3.95,.56,2.03,0,.67,1.23];
       const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,1,5,6,1,6,2,0,4,5,0,5,1,3,2,6,3,6,7]);geo.computeVertexNormals();jetMetal.side=T.DoubleSide;piece(geo,jetMetal,0,0,0);
       const tail=piece(new T.BoxGeometry(1.6,.11,1.05),jetMetal,side*.78,.72,2.68);tail.rotation.y=-side*.30;
       const fin=piece(new T.BoxGeometry(.09,1.38,1.0),jetMetal,side*.38,1.36,2.53);fin.rotation.x=.4;fin.rotation.z=-side*.2;
       piece(new T.CylinderGeometry(.23,.29,.88,10).rotateX(Math.PI/2),nozzle,side*.26,.63,3.1);
     }return obj;
   }
   const ring=new T.Mesh(own(new T.TorusGeometry(4.4,.09,5,40)),own(new T.MeshBasicMaterial({color:0xf8be56})));ring.rotation.x=-Math.PI/2;root.add(ring);ring.visible=false;
   function objective(s){ring.visible=!!s;if(s)ring.position.set(s.x,s.y+.17,s.z);}
   const colors=[new T.Color(0xb49c6b),new T.Color(0x769aaa)];
   function ingest(rows){previous=current;current=rows||[];netAt=performance.now();}
   function point(id,at=performance.now()){
     const r=current[id];if(!r||r[4]<=0)return null;const old=previous[id],q=old?.[4]>0&&Math.hypot(old[0]-r[0],old[2]-r[2])<140?old:r,k=Math.min(1,Math.max(0,(at-netAt)/200));
     return {x:(q[0]+(r[0]-q[0])*k)/10,y:(q[1]+(r[1]-q[1])*k)/10,z:(q[2]+(r[2]-q[2])*k)/10,yaw:r[3]/100,hp:r[4]};
   }
   function update(t,quality,seat){
     if(t-lastDraw<(quality==='low'?65:32))return;lastDraw=t;let count=0;
     for(let id=0;id<100;id++){const v=point(id,t),j=id%50,foot=j<46;
       if(!v||id===seat){if(vehicles.has(id))vehicles.get(id).visible=false;continue;}
       if(!foot){
         let o=vehicles.get(id);if(!o){const kind=j<48?(j===46?'tank':'bastion'):j===48?'heli':'jet';o=kind==='jet'?jet():assets[kind]?.clone(true);if(!o)continue;root.add(o);vehicles.set(id,o);}
         o.visible=true;o.position.set(v.x,v.y,v.z);o.rotation.y=j===49?v.yaw:v.yaw+Math.PI/2;
         if(j===48){const rotor=o.getObjectByName('MainRotor'),tail=o.getObjectByName('TailRotor');if(rotor)rotor.rotation.y=t*.027;if(tail)tail.rotation.x=t*.046;}
         continue;
       }
       const yaw=v.yaw,cs=Math.cos(yaw),sn=Math.sin(yaw),walk=previous[id]&&Math.abs(current[id][0]-previous[id][0])+Math.abs(current[id][2]-previous[id][2])>0;
       for(const b of parts){const stride=b.leg&&walk?Math.sin(t*.011+id)*b.leg:0;
         dummy.position.set(v.x+b.x*cs+(b.z+stride*.12)*sn,v.y+b.y,v.z-b.x*sn+(b.z+stride*.12)*cs);dummy.rotation.set(stride*.33,yaw,0,'YXZ');dummy.scale.set(b.sx,b.sy,b.sz);dummy.updateMatrix();
         b.mesh.setMatrixAt(count,dummy.matrix);if(b.mesh.material===uniform)b.mesh.setColorAt(count,colors[id<50?0:1]);
       }count++;
     }
     for(const p of parts){p.mesh.count=count;p.mesh.instanceMatrix.needsUpdate=true;if(p.mesh.instanceColor)p.mesh.instanceColor.needsUpdate=true;}
   }
   function dispose(){for(const [m,old] of patched){m.onBeforeCompile=old.before;m.customProgramCacheKey=old.cache;m.needsUpdate=true;}for(const [o,old] of depths)o.customDepthMaterial=old;
     for(const mesh of chunks.values())mesh.geometry.dispose();for(const p of parts)p.mesh.dispose();for(const v of owned)v.dispose();root.removeFromParent();}
   function intersect(o,d,limit,team){
     let nearest=limit;
     for(let id=0;id<current.length;id++){
       if((id<50?'t':'ct')===team)continue;const u=point(id);if(!u)continue;
       const k=id%50,r=k<46?.46:k<48?2.1:2.6,h=k<46?1.8:k<48?2.4:2;
       const t=g.CS16Buildings.rayBox(o,d,{min:[u.x-r,u.y,u.z-r],max:[u.x+r,u.y+h,u.z+r]},nearest);
       if(t!==null&&t<nearest)nearest=t;
     }return nearest;
   }
   return {sync,ingest,point,update,objective,intersect,dispose};
 }
 g.CS16FrontView={create};
})(window);
