const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'models/csgo');
const source=fs.readFileSync(path.join(root,'cs16.js'),'utf8');
for(const file of ['cs16-tactical-map.js','cs16-buildings.js','cs16-anime-materials.js','cs16-anime-nature.js','cs16-spell-effects.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
for(const file of ['cs16.js','cs16-rpg-model.js','cs16-mines-view.js','cs16-cinematic.js','cs16-hit-feedback.js','cs16-loading.js','cs16-menu.js','cs16-passages.js','cs16-passage-view.js','cs16-terrain.js','cs16-environment.js','cs16-environment-view.js','cs16-field-effects.js','cs16-adaptive-quality.js','cs16-battle-audio.js','cs16-weapon-animation.js','cs16-weapon-grip.js','cs16-operator-batch.js','cs16-field-view.js','cs16-footsteps.js','cs16-weapon-finish.js','cs16-landscape.js','cs16-graphics.js','cs16-props.js','cs16-conquest-ui.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const maps=vm.runInNewContext('('+source.match(/const MAP_ROWS = (\{[\s\S]*?\n  \});/)[1]+')');
maps.frontline=require('../cs16-front').district();
const manifest=JSON.parse(fs.readFileSync(path.join(assets,'maps-manifest.json')));
function glb(file){
 const b=fs.readFileSync(path.join(assets,file));
 assert.equal(b.readUInt32LE(0),0x46546c67,file);assert.equal(b.readUInt32LE(4),2,file);assert.equal(b.readUInt32LE(8),b.length,file);
 assert(b.length<100*1024*1024,file+' too large for GitHub');
 return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString().trim());
}
for(const [name,rows]of Object.entries(maps)){
 assert.equal(rows.length,126);rows.forEach(r=>assert.equal(r.length,126));
 // Legacy map files are retained for rollback. Only frontline still uses this legacy export.
 if(name==='frontline')assert.equal(manifest.maps[name].layoutSha256,crypto.createHash('sha256').update(rows.join('\n')).digest('hex'),name+' stale export');
 const g=glb(name+'.glb');assert(g.materials.some(m=>m.normalTexture),name+' missing normals');
 assert(g.materials.some(m=>m.pbrMetallicRoughness?.metallicRoughnessTexture),name+' missing roughness');
 assert(manifest.maps[name].meshBatches<120,name+' draw budget');
}
for(const team of ['ct','t','ember','tide','jade','aurora','classic','pyra','neve','zephyr','basalt','helio']){
 const g=glb((['ct','t'].includes(team)?'operator-':'hero-')+team+'.glb');const names=new Set(g.nodes.map(n=>n.name));
 for(const n of ['torso','head','legL','legR','armL','armR'])assert(names.has(n),team+' missing '+n);
}
for(const id of ['fox','dragon','owl','golem','deer']){
 const asset=glb('pet-'+id+'.glb'),names=new Set(asset.nodes.map(n=>n.name));
 // Authoring pivots (including eyes/ears) are fused into one skinned mesh at load.
 assert(asset.meshes.length<=12&&asset.materials.length===1,id+' articulated pet source budget');
 assert(fs.statSync(path.join(assets,'pet-'+id+'.glb')).size<512*1024,id+' pet download budget');
 assert(names.has('petEyes'),id+' missing blink pivot');
 assert(names.has('petHead'),id+' missing head pivot');
 assert(names.has(id==='owl'?'limbL':'legLF'),id+' missing locomotion pivot');
}
const weapons=JSON.parse(fs.readFileSync(path.join(assets,'weapons-manifest.json')));
assert.equal(weapons.assets.length,20);weapons.assets.forEach(a=>{const g=glb(a.file);assert(g.materials.some(m=>m.normalTexture),a.file+' missing material relief');});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const anime=JSON.parse(fs.readFileSync(path.join(assets,'anime-maps-manifest.json')));
const bistroRoot=path.join(root,'assets/cs-realistic/bistro');
const bistro=JSON.parse(fs.readFileSync(path.join(bistroRoot,'manifest.json')));
const realisticMaps=anime.generator==='tools/blender/build_realistic_maps.py';
if(realisticMaps){
 assert.equal(bistro.license,'CC BY 4.0','licensed facade source');
 const kit=glb('bistro-kit.glb');
 assert(kit.materials.every(m=>m.extras?.cs16Realistic),'Bistro PBR marker');
 for(const name of ['window_frame','pilaster','shutter_panel','balcony_fascia','townhouses','tree','cypress','ivy'])assert(kit.nodes.some(n=>n.name==='bistro_'+name),'missing actual Bistro model '+name);
 assert(kit.materials.some(m=>m.name.includes('Foliage')&&m.alphaMode==='MASK'&&m.alphaCutoff>0),'foliage must use original alpha cutouts');
 assert(fs.statSync(path.join(assets,'bistro-kit.glb')).size<12*1024*1024,'Bistro delivery budget');
 for(const file of ['LICENSE.txt','ATTRIBUTION.txt'])assert(fs.statSync(path.join(bistroRoot,file)).size>50,'missing Bistro attribution '+file);
}
for(const name of ['dust2','inferno']){
 const entry=anime.maps[name],g=glb(entry.file);
 assert.equal(entry.layoutSha256,crypto.createHash('sha256').update(maps[name].join('\n')).digest('hex'),name+' stale anime geometry');
 assert(entry.meshBatches<=90&&entry.triangles<400000,name+' anime geometry budget');
 assert(entry.bytes<manifest.maps[name].bytes,name+' anime asset must be smaller than the replaced map');
 assert(g.materials.some(m=>m.name==='ground')&&g.materials.some(m=>m.name==='plaster'),name+' missing surfaces');
 if(realisticMaps){
  assert.equal(entry.bytes,fs.statSync(path.join(assets,entry.file)).size,name+' stale map byte count');
  assert(entry.triangles<80000,name+' realistic shell geometry budget');
  let triangles=0;
  for(const mesh of g.meshes)for(const primitive of mesh.primitives){
   const positions=g.accessors[primitive.attributes.POSITION],normals=g.accessors[primitive.attributes.NORMAL],uv=g.accessors[primitive.attributes.TEXCOORD_0];
   assert(positions?.count>0&&normals?.count===positions.count&&uv?.count===positions.count,name+' incomplete surface UV/normal geometry');
   assert(positions.min?.every(Number.isFinite)&&positions.max?.every(Number.isFinite),name+' invalid geometry bounds');
   triangles+=(primitive.indices===undefined?positions.count:g.accessors[primitive.indices].count)/3;
  }
  assert.equal(triangles,entry.triangles,name+' stale triangle count');
  for(const material of g.materials){
   const surface=bistro.surfaces[material.name];
   if(!surface){assert(['paint','lamp_warm','lamp_green','dark','window_glass','leaf','flower'].includes(material.name),name+' unassigned realistic material '+material.name);continue;}
   // The thin geometry GLB deliberately omits the superseded illustrated
   // images. The awaited world controller assigns these real PBR channels.
   const channels=bistro.materials[surface];assert(channels,name+' missing PBR assignment '+material.name);
   for(const channel of ['BaseColor','Normal','Specular']){
    const file=channels[channel];assert(typeof file==='string'&&file===path.basename(file),name+' missing '+channel+' for '+material.name);
    const bytes=fs.readFileSync(path.join(bistroRoot,file));
    assert(bytes.length>24&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP',name+' invalid '+channel+' delivery for '+material.name);
   }
  }
 }else for(const surface of ['ground','plaster','plaster_light','wood','shutter']){
   const material=g.materials.find(m=>m.name===surface);
   assert(material?.normalTexture,name+' missing illustrated relief: '+surface);
 }
}
const animeWeapons=JSON.parse(fs.readFileSync(path.join(assets,'anime-weapons-manifest.json'))).assets;
assert.equal(animeWeapons.length,20);
for(const item of animeWeapons){
 const g=glb(item.file),realistic=!!item.cs16Realistic;
 // Bound the real source models independently of the legacy illustrated set.
 assert(item.bytes<(realistic?4:2)*1024*1024,item.file+' asset budget');
 assert.equal(item.bytes,fs.statSync(path.join(assets,item.file)).size,item.file+' stale byte budget');
 if(realistic){
  assert(g.materials.every(m=>m.extras?.cs16Realistic),item.file+' lost authored PBR marker');
  const sourceAlbedoOnly=item.file==='anime-tec9.glb'&&item.sourceUrl==='https://stein-indie.itch.io/classic-weapons-pack'&&item.license==='CC0-1.0'&&item.generator==='tools/blender/import_cc0_compacts.py';
  const validTexture=info=>{
   const texture=g.textures?.[info?.index],image=g.images?.[texture?.source],view=g.bufferViews?.[image?.bufferView];
   return Number.isInteger(info?.index)&&!!image&&!!view&&view.byteLength>0&&['image/png','image/jpeg','image/webp'].includes(image.mimeType);
  };
  for(const material of g.materials){
   const pbr=material.pbrMetallicRoughness||{};
   for(const texture of [material.normalTexture,material.occlusionTexture,pbr.baseColorTexture,pbr.metallicRoughnessTexture])if(texture)
    assert(validTexture(texture),item.file+' invalid embedded material texture: '+material.name);
  }
  if(sourceAlbedoOnly){
   // The author's Tec-9 archive supplies T_Tec9_C.png only. Its restrained
   // physical roughness/metalness are explicit scalar parameters, not fake
   // normal or ORM images manufactured to satisfy this validator.
   assert(g.materials.every(m=>{
    const p=m.pbrMetallicRoughness;
    return validTexture(p?.baseColorTexture)&&Number.isFinite(p.roughnessFactor)&&p.roughnessFactor>=.35&&p.roughnessFactor<=.9&&Number.isFinite(p.metallicFactor)&&p.metallicFactor>=0&&p.metallicFactor<=1;
   }),item.file+' missing source albedo or valid physical material factors');
  }else assert(g.materials.some(m=>m.normalTexture&&m.pbrMetallicRoughness?.baseColorTexture&&m.pbrMetallicRoughness?.metallicRoughnessTexture),item.file+' missing real surface maps');
 }else assert(g.meshes.some(m=>m.primitives.some(p=>p.attributes.COLOR_0!==undefined)),item.file+' missing baked surface shading');
 if(item.file==='anime-hands.glb')for(const name of ['rightHand','leftHand','leftCup','leftVertical'])assert(g.nodes.some(n=>n.name===name),'missing anime grip '+name);
}
const animeNature=glb('anime-nature.glb');
const karambit=glb('anime-karambit.glb'),knifeHand=glb('anime-karambit-hand.glb');
assert(fs.statSync(path.join(assets,'anime-karambit.glb')).size<512*1024);
assert(fs.statSync(path.join(assets,'anime-karambit-hand.glb')).size<1024*1024);
assert(karambit.nodes.some(n=>n.name==='weapon'&&n.extras?.spinPivot?.length===3),'karambit ring pivot');
for(const name of ['rightHand','attackHand'])assert(knifeHand.nodes.some(n=>n.name===name),'karambit hand pose '+name);
assert(html.indexOf('cs16-karambit.js')<html.indexOf('src="cs16.js"'),'karambit script load order');
assert(animeNature.meshes.length<=12&&fs.statSync(path.join(assets,'anime-nature.glb')).size<3*1024*1024);
for(const name of ['cs16-hit-feedback.js','cs16-loading.js','cs16-tactical-map.js','cs16-anime-materials.js','cs16-anime-nature.js','cs16-spell-effects.js'])assert(html.indexOf(name)>=0&&html.indexOf(name)<html.indexOf('src="cs16.js"'),'missing/late '+name);
for(const name of ['RGBELoader.js','cs16-realistic-world.js','cs16-cinematic.js','cs16-rpg-model.js','cs16-missile-view.js','cs16-explosion-view.js']){
 new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});
 assert(html.indexOf(name)>=0&&html.indexOf(name)<html.indexOf('src="cs16.js"'),'missing realistic renderer dependency '+name);
}
console.log('Anime: both complete layouts synchronized, 20 weapon/hand assets, nature and load order OK');
assert(html.indexOf('GLTFLoader.js')<html.indexOf('cs16-graphics.js'));
assert(html.indexOf('cs16-graphics.js')<html.indexOf('src="cs16.js"'));
for(const name of Object.keys(maps))console.log(name+': legacy geometry, PBR channels and draw budget OK');
console.log('Operators: six articulation groups each; 19 weapons and first-person hands: valid GLB');

const nature=glb('nature.glb');assert(nature.meshes.length<=12);assert(fs.statSync(path.join(assets,'nature.glb')).size<2*1024*1024);for(const species of ['oak','birch','pine','bush','rock'])assert(nature.nodes.some(n=>n.name?.startsWith(species+'_')));console.log('Nature: five original asset types, <=12 meshes, <2MB');
