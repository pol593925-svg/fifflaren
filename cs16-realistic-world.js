/* Amazon Lumberyard Bistro / ORCA, CC BY 4.0. See assets/cs-realistic/bistro/ATTRIBUTION.txt.
 * The tactical collision shell stays authoritative. Original architectural detail is
 * placed against walls; distant city geometry stays beyond the playable perimeter. */
(function(g){'use strict';
 const BASE='assets/cs-realistic/bistro/';
 // Preserve the photographed albedo. The previous sunset multipliers made
 // concrete, limestone and metal share the same orange, plastic-looking response.
 const TINT={MASTER_Concrete_Smooth:[1.05,1.03,.99],MASTER_Concrete_Plaster:[1.08,1.04,.98],MASTER_Concrete:[1.04,1.02,.97],
  MASTER_Brick_Large_Beige_BLENDSHADER:[1.06,1.03,.97],MASTER_Brick_Large_White:[1.04,1.03,1.00],MASTER_Concrete_White:[1.05,1.04,1.00],
  MASTER_Wood_Painted_Green:[.62,.78,.67],MASTER_Wood_Painted3:[.80,.67,.53],MASTER_Wood_Brown:[.86,.72,.58],
  MASTER_Roofing_Shingle_Grey:[.86,.89,.91],Balcony_Concrete:[1.06,1.03,.98],Balcony_Trims:[1.07,1.04,.99],Balcony_Ornaments:[1.06,1.03,.98]};
 function tintMaterial(material,source){const color=TINT[source];if(color)material.color.setRGB(...color);}
 function physicalSurface(source,old){
  const metal=/metal/i.test(source),wood=/wood/i.test(source),glass=/glass/i.test(source),foliage=/foliage|leaf|leaves/i.test(source),ground=old.name==='ground',ceramic=/plantpots|ceramic/i.test(source);
  return {roughness:metal?.43:wood?.68:glass?.16:foliage?.84:ground?.91:ceramic?.34:.86,
   metalness:metal?.88:glass?.06:0,normal:ground?.38:metal?.48:wood?.62:.52,
   environment:metal?1.05:glass?1.15:ceramic?.72:foliage?.38:.48,
   // ORCA's Specular images are not glTF ORM textures. Using them as metalness
   // made stone metallic; retain only the useful roughness variation on metal.
   roughnessMap:metal,metalnessMap:false,aoMap:false};
 }
 async function prepare({T,model,grid,map,renderer}){
  const response=await fetch(BASE+'manifest.json');if(!response.ok)throw Error('Bistro material manifest unavailable');
  const manifest=await response.json(),loader=new T.TextureLoader(),textureJobs=new Map(),materials=new Map();
  const quality=renderer.userData.cs16Quality||'balanced',anisotropy=Math.min(quality==='low'?2:8,renderer.capabilities.getMaxAnisotropy());
  function texture(file,color){
   if(!file)return Promise.resolve(null);
   if(!textureJobs.has(file))textureJobs.set(file,loader.loadAsync(BASE+file).then(t=>{t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=anisotropy;return t;}));
   return textureJobs.get(file);
  }
  const buildings=g.CS16Buildings.layout(grid,map).buildings;
  const oldMaterials=new Set();model.traverse(o=>{if(o.isMesh){
   if(['leaf','flower'].includes(o.material?.name))o.visible=false;
   // Superseded decorations are removed at authoring, not by scanning millions
   // of triangle/region pairs every time an employee loads a match.
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)oldMaterials.add(m);
  }});
  const materialResults=await Promise.allSettled([...oldMaterials].map(async old=>{
   const key=manifest.surfaces[old.name];if(!key)return;
   const maps=manifest.materials[key]||{},[albedo,normal,specular]=await Promise.all([texture(maps.BaseColor,true),texture(maps.Normal,false),texture(maps.Specular,false)]),surface=physicalSurface(key,old);
   const next=new T.MeshStandardMaterial({name:old.name,map:albedo,normalMap:normal,normalScale:new T.Vector2(surface.normal,surface.normal),roughnessMap:surface.roughnessMap?specular:null,metalnessMap:surface.metalnessMap?specular:null,aoMap:null,roughness:surface.roughness,metalness:surface.metalness,vertexColors:old.vertexColors,side:old.side,envMapIntensity:surface.environment,dithering:true});
   next.userData={...old.userData,cs16Realistic:true,source:key,cs16WorldSurface:true,cs16EnvironmentIntensity:surface.environment};materials.set(old,next);
   tintMaterial(next,key);
  }));
  const failed=materialResults.find(result=>result.status==='rejected');
  if(failed){
   // A failed channel must not abandon still-decoding textures or the materials
   // created before the map has taken ownership of them.
   const settled=await Promise.allSettled(textureJobs.values());
   for(const result of settled)if(result.status==='fulfilled')result.value.dispose();
   for(const material of materials.values())material.dispose();
   throw failed.reason;
  }
  model.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>materials.get(m)||m):materials.get(o.material)||o.material;});
  model.userData.cs16Realistic=true;
  // Retired images were never uploaded; release them once no remaining material uses them.
  const used=new Set();model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m||{}))if(v?.isTexture)used.add(v);});
  const retired=new Set();for(const old of materials.keys()){for(const value of Object.values(old))if(value?.isTexture&&!used.has(value))retired.add(value);old.dispose();}for(const t of retired)t.dispose();
  const asset=await new T.GLTFLoader().loadAsync('models/csgo/bistro-kit.glb');asset.scene.updateMatrixWorld(true);
  const root=new T.Group();root.name='ORCA Bistro adapted architecture';root.userData.cs16Realistic=true;model.add(root);
  const dummy=new T.Object3D(),pools=[];
  function template(name){return asset.scene.getObjectByName('bistro_'+name);}
  function addPool(name,placements,capacity,range){
   const source=template(name);if(!source)return;
   const meshes=[];source.traverse(node=>{if(!node.isMesh)return;
    const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld),material=node.material;
    material.userData={...material.userData,cs16Realistic:true,cs16WorldSurface:true,cs16EnvironmentIntensity:.65};material.envMapIntensity=.65;material.dithering=true;
    tintMaterial(material,material.name.replace(/^Bistro /,''));
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(material[key])material[key].anisotropy=anisotropy;
    const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='Bistro '+name;mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=name!=='townhouses';mesh.userData.cs16Realistic=true;mesh.userData.backdrop=name==='townhouses';root.add(mesh);meshes.push(mesh);
   });pools.push({name,meshes,placements,capacity,range});
  }
  const lamps=[],awnings=[],signs=[],pots=[],balconies=[],frames=[],pilasters=[],shutters=[],ivies=[],tables=[],chairs=[],pottedTrees=[];
  for(const b of buildings){
   lamps.push({x:b.x+7.65,y:2.80,z:b.z-.21,a:0,s:.52},{x:b.x+11.92,y:2.85,z:b.z+5.2,a:-Math.PI/2,s:.52});
   // West wall is solid masonry; the small shop canopies stay out of doors,
   // stair approaches and every usable window on the east elevation.
   awnings.push({x:b.x-.50,y:2.40,z:b.z+3.2,a:Math.PI/2,s:.58},{x:b.x-.50,y:2.40,z:b.z+8.5,a:Math.PI/2,s:.58});
   awnings.push({x:b.x+5.50,y:2.65,z:b.z-1.0,a:0,scale:[1.11,.43,.60]});
   signs.push({x:b.x+7.8,y:2.7,z:b.z-.68,a:Math.PI/2,s:.63});
   // Existing pottery footprints; courtyard doors remain three metres wide.
   pots.push({x:b.x+.85,y:.02,z:b.z-.60,a:b.id*.7,s:.89},{x:b.x+10.8,y:.02,z:b.z-.60,a:b.id*.9,s:.89});
   // The real Bistro limestone moulding dresses the exact solid balcony slab.
   balconies.push({x:b.x+5.4,y:3.42,z:b.z-1.78,a:0,s:1});
   for(const x of [2.5,9.5])frames.push({x:b.x+x,y:4.28,z:b.z-.11,a:0,s:1});
   // This opening is the balcony DOOR: its bottom is 3.60, not the 4.50 window
   // sill. Fitted geometry must leave its full 2 x 2.40m aperture unobstructed.
   frames.push({x:b.x+6,y:3.6-.22*2.4/1.5,z:b.z-.11,a:0,scale:[1,2.4/1.5,1]});
   frames.push({x:b.x+5.5,y:-.22*2.6/1.5,z:b.z-.12,a:0,scale:[1.5,2.6/1.5,1]});
   for(const z of [3.2,8.5])for(const y of [1.05,4.65])frames.push({x:b.x+12.10,y:y-.22*1.3/1.5,z:b.z+z,a:-Math.PI/2,scale:[.9,1.3/1.5,1]});
   for(const x of [2.5,9.5])for(const side of [-1,1])shutters.push({x:b.x+x+side*1.48,y:4.50,z:b.z-.13,a:0,s:1});
   for(const z of [3.2,8.5])for(const y of [1.05,4.65])for(const side of [-1,1])shutters.push({x:b.x+12.13,y,z:b.z+z+side*1.36,a:-Math.PI/2,scale:[1,1.3/1.49,1]});
   // Closed original wooden shutters on the solid elevation make its status
   // unambiguous. The actual open windows remain on the east and front sides.
   for(const z of [3.2,8.5])for(const y of [1.05,4.65]){
    frames.push({x:b.x-.10,y:y-.22*1.3/1.5,z:b.z+z,a:Math.PI/2,scale:[.6,1.3/1.5,1]});
    for(const side of [-1,1])shutters.push({x:b.x-.13,y,z:b.z+z+side*.30,a:Math.PI/2,scale:[.6/.44,1.3/1.49,1]});
   }
   for(const x of [.85,10.8])ivies.push({x:b.x+x,y:.57,z:b.z-.60,a:b.id*.7,s:.15});
   // Cafe furniture is confined to the left balcony niche. Door, stairs and
   // the open street stay clear; these small furnishings are not added cover.
   tables.push({x:b.x+2.40,y:.015,z:b.z-.90,a:.4,s:.58});
   chairs.push({x:b.x+1.40,y:.015,z:b.z-.95,a:Math.PI/2,s:.56},{x:b.x+3.35,y:.015,z:b.z-.95,a:-Math.PI/2,s:.56});
   for(const x of [.85,10.8])pottedTrees.push({x:b.x+x,y:.44,z:b.z-.60,a:b.id*.7,s:.23});
   for(const x of [.20,11.80])pilasters.push({x:b.x+x,y:.06,z:b.z-.12,a:0,s:1});
   for(const z of [.24,11.76])pilasters.push({x:b.x-.12,y:.06,z:b.z+z,a:Math.PI/2,s:1});
  }
  addPool('lantern',lamps,12,75);addPool('awning',awnings,18,95);addPool('sign',signs,6,60);addPool('planter',pots,12,65);addPool('balcony_fascia',balconies,6,115);
  addPool('window_frame',frames,72,135);addPool('pilaster',pilasters,24,135);addPool('shutter_panel',shutters,120,135);addPool('ivy',ivies,12,65);
  addPool('table',tables,6,65);addPool('chair',chairs,12,65);addPool('cypress',pottedTrees,12,75);
  // This is actual 3D city geometry, not a photographic plane. It stands beyond
  // the closed perimeter, preserving every play-space collision and sight line.
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  // Row one contains map-format metadata (including a bridge code), not a
  // playable cell. Counting it previously sent the skyline hundreds of metres away.
  for(let z=3;z<grid.length;z++)for(let x=0;x<grid[z].length;x++)if(grid[z][x]!==1&&grid[z][x]!==11&&grid[z][x]!==10){minX=Math.min(minX,x*4);maxX=Math.max(maxX,(x+1)*4);minZ=Math.min(minZ,z*4);maxZ=Math.max(maxZ,(z+1)*4);}
  const midX=(minX+maxX)/2,midZ=(minZ+maxZ)/2;
  // The original principal facade faces -X. Face its detailed elevations into
  // the playable court rather than showing the plain backs of the buildings.
  const cities=[{x:minX-20,y:.2,z:midZ-25,a:Math.PI,s:.55},{x:maxX+20,y:.2,z:midZ+18,a:0,s:.55},{x:midX+18,y:.2,z:maxZ+20,a:-Math.PI/2,s:.55},{x:midX-20,y:.2,z:minZ-20,a:Math.PI/2,s:.55}];
  addPool('townhouses',cities,4,310);
  // Actual licensed trees stand on the sealed outside verge. Their trunks
  // cannot create ghost cover or snag players; only crowns appear over walls.
  const trees=[{x:minX-7,y:0,z:minZ+20,a:.4,s:.42},{x:minX-8,y:0,z:midZ+15,a:1.8,s:.48},{x:maxX+8,y:0,z:minZ+24,a:2.4,s:.43},{x:maxX+8,y:0,z:midZ-16,a:1.1,s:.46},{x:minX+22,y:0,z:minZ-7,a:1.7,s:.40},{x:midX+20,y:0,z:maxZ+7,a:.8,s:.44}];
  const cypress=[];for(const p of cities)for(const side of [-1,1])cypress.push({x:p.x+side*8,y:0,z:p.z-5,a:side*.7,s:1.12});
  addPool('tree',trees,6,150);addPool('cypress',cypress,8,155);
  // Source geometry was copied; materials are retained by the final model.
  const originalGeometry=new Set();asset.scene.traverse(o=>{if(o.geometry)originalGeometry.add(o.geometry);});for(const geometry of originalGeometry)geometry.dispose();
  let stamp=-Infinity,lastX=Infinity,lastZ=Infinity,lastQuality='';
  function update(camera,time,q){
   if(time-stamp<220)return;stamp=time;
   const shadowReset=pools.some(pool=>pool.meshes.some(mesh=>mesh.castShadow!==(q!=='low'&&pool.name!=='townhouses')));
   if(!shadowReset&&q===lastQuality&&Math.hypot(camera.position.x-lastX,camera.position.z-lastZ)<1)return;
   lastX=camera.position.x;lastZ=camera.position.z;lastQuality=q;
   for(const pool of pools){
    const city=pool.name==='townhouses',low=q==='low',architectural=['window_frame','pilaster','shutter_panel','balcony_fascia'].includes(pool.name);
    const distance=city?pool.range:pool.range*(low?(architectural?.72:.52):q==='high'?1:.82);
    const lowLimit=pool.name==='window_frame'?24:pool.name==='pilaster'?12:pool.name==='shutter_panel'?36:pool.name==='tree'?2:4;
    const selected=pool.placements.map(p=>({p,d:(p.x-lastX)**2+(p.z-lastZ)**2})).filter(v=>v.d<distance*distance).sort((a,b)=>a.d-b.d).slice(0,city?(low?1:4):low?Math.min(lowLimit,pool.capacity):pool.capacity);
    for(const mesh of pool.meshes){mesh.count=selected.length;mesh.castShadow=!low&&!city;
     for(let i=0;i<selected.length;i++){const p=selected[i].p;dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.a,0);if(p.scale)dummy.scale.fromArray(p.scale);else dummy.scale.setScalar(p.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;
    }
   }
  }
  // Geometry/material ownership belongs to the parent world's disposeTree.
  return{update,dispose(){pools.length=0;},stats:{source:'ORCA Bistro CC BY 4.0',materialCount:materials.size,detailBatches:pools.reduce((n,p)=>n+p.meshes.length,0)}};
 }
 g.CS16RealisticWorld={prepare};
})(window);
