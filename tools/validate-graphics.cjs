const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'models/csgo');
const source=fs.readFileSync(path.join(root,'cs16.js'),'utf8');
for(const file of ['cs16-tactical-map.js','cs16-buildings.js','cs16-anime-materials.js','cs16-anime-nature.js','cs16-spell-effects.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
for(const file of ['cs16.js','cs16-menu.js','cs16-passages.js','cs16-passage-view.js','cs16-terrain.js','cs16-environment.js','cs16-environment-view.js','cs16-field-effects.js','cs16-adaptive-quality.js','cs16-battle-audio.js','cs16-weapon-animation.js','cs16-weapon-grip.js','cs16-field-view.js','cs16-footsteps.js','cs16-weapon-finish.js','cs16-landscape.js','cs16-graphics.js','cs16-props.js','cs16-conquest-ui.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
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
 assert(asset.meshes.length<=8&&asset.materials.length===1,id+' articulated pet draw budget');
 assert(names.has('petHead'),id+' missing head pivot');
 assert(names.has(id==='owl'?'limbL':'legLF'),id+' missing locomotion pivot');
}
const weapons=JSON.parse(fs.readFileSync(path.join(assets,'weapons-manifest.json')));
assert.equal(weapons.assets.length,20);weapons.assets.forEach(a=>{const g=glb(a.file);assert(g.materials.some(m=>m.normalTexture),a.file+' missing material relief');});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const anime=JSON.parse(fs.readFileSync(path.join(assets,'anime-maps-manifest.json')));
for(const name of ['dust2','inferno']){
 const entry=anime.maps[name],g=glb(entry.file);
 assert.equal(entry.layoutSha256,crypto.createHash('sha256').update(maps[name].join('\n')).digest('hex'),name+' stale anime geometry');
 assert(entry.meshBatches<=90&&entry.triangles<400000,name+' anime geometry budget');
 assert(entry.bytes<manifest.maps[name].bytes,name+' anime asset must be smaller than the replaced map');
 assert(g.materials.some(m=>m.name==='ground')&&g.materials.some(m=>m.name==='plaster'),name+' missing surfaces');
}
const animeWeapons=JSON.parse(fs.readFileSync(path.join(assets,'anime-weapons-manifest.json'))).assets;
assert.equal(animeWeapons.length,20);
for(const item of animeWeapons){
 const g=glb(item.file);assert(item.bytes<2*1024*1024,item.file+' asset budget');
 if(item.file==='anime-hands.glb')for(const name of ['rightHand','leftHand','leftCup','leftVertical'])assert(g.nodes.some(n=>n.name===name),'missing anime grip '+name);
}
const animeNature=glb('anime-nature.glb');
assert(animeNature.meshes.length<=12&&fs.statSync(path.join(assets,'anime-nature.glb')).size<3*1024*1024);
for(const name of ['cs16-tactical-map.js','cs16-anime-materials.js','cs16-anime-nature.js','cs16-spell-effects.js'])assert(html.indexOf(name)>=0&&html.indexOf(name)<html.indexOf('src="cs16.js"'),'missing/late '+name);
console.log('Anime: both complete layouts synchronized, 20 weapon/hand assets, nature and load order OK');
assert(html.indexOf('GLTFLoader.js')<html.indexOf('cs16-graphics.js'));
assert(html.indexOf('cs16-graphics.js')<html.indexOf('src="cs16.js"'));
for(const name of Object.keys(maps))console.log(name+': legacy geometry, PBR channels and draw budget OK');
console.log('Operators: six articulation groups each; 19 weapons and first-person hands: valid GLB');

const nature=glb('nature.glb');assert(nature.meshes.length<=12);assert(fs.statSync(path.join(assets,'nature.glb')).size<2*1024*1024);for(const species of ['oak','birch','pine','bush','rock'])assert(nature.nodes.some(n=>n.name?.startsWith(species+'_')));console.log('Nature: five original asset types, <=12 meshes, <2MB');
