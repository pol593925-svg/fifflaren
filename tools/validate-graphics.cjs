const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'models/csgo');
const source=fs.readFileSync(path.join(root,'cs16.js'),'utf8');
for(const file of ['cs16.js','cs16-graphics.js','cs16-props.js','cs16-conquest-ui.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const maps=vm.runInNewContext('('+source.match(/const MAP_ROWS = (\{[\s\S]*?\n  \});/)[1]+')');
const manifest=JSON.parse(fs.readFileSync(path.join(assets,'maps-manifest.json')));
function glb(file){
 const b=fs.readFileSync(path.join(assets,file));
 assert.equal(b.readUInt32LE(0),0x46546c67,file);assert.equal(b.readUInt32LE(4),2,file);assert.equal(b.readUInt32LE(8),b.length,file);
 assert(b.length<100*1024*1024,file+' too large for GitHub');
 return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString().trim());
}
for(const [name,rows]of Object.entries(maps)){
 assert.equal(rows.length,42);rows.forEach(r=>assert.equal(r.length,42));
 assert.equal(manifest.maps[name].layoutSha256,crypto.createHash('sha256').update(rows.join('\n')).digest('hex'),name+' stale export');
 const g=glb(name+'.glb');assert(g.materials.some(m=>m.normalTexture),name+' missing normals');
 assert(g.materials.some(m=>m.pbrMetallicRoughness?.metallicRoughnessTexture),name+' missing roughness');
 assert(manifest.maps[name].meshBatches<120,name+' draw budget');
}
for(const team of ['ct','t']){
 const g=glb('operator-'+team+'.glb');const names=new Set(g.nodes.map(n=>n.name));
 for(const n of ['torso','head','legL','legR','armL','armR'])assert(names.has(n),team+' missing '+n);
}
const weapons=JSON.parse(fs.readFileSync(path.join(assets,'weapons-manifest.json')));
assert.equal(weapons.assets.length,20);weapons.assets.forEach(a=>glb(a.file));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.indexOf('GLTFLoader.js')<html.indexOf('cs16-graphics.js'));
assert(html.indexOf('cs16-graphics.js')<html.indexOf('src="cs16.js"'));
for(const name of ['dust2','inferno'])console.log(name+': geometry, PBR channels, source hash and draw budget OK');
console.log('Operators: six articulation groups each; 19 weapons and first-person hands: valid GLB');
