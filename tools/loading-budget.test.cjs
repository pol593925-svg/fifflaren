const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),THREE=require('../three.min');
test('weapon loading parses at most three assets at once and retry reuses successful assets',async()=>{
 const source=fs.readFileSync('cs16.js','utf8'),code=source.slice(source.indexOf('  function loadGLBAll()'),source.indexOf('  // Клон GLB-модели'));
 let concurrent=0,peak=0,fail=true;const calls={};const cache={};
 class Loader{async loadAsync(url){calls[url]=(calls[url]||0)+1;peak=Math.max(peak,++concurrent);await new Promise(r=>setTimeout(r,8));concurrent--;if(url==='bad'&&fail){fail=false;throw Error('isolated failure');}return {scene:new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial())};}}
 const GLB_MODELS=Object.fromEntries(['a','b','c','bad','e','f','g'].map(id=>[id,{url:id,len:1}]));
 const ctx={THREE:{...THREE,GLTFLoader:Loader},GLB_MODELS,glbCache:cache,renderer3:{capabilities:{getMaxAnisotropy:()=>4}}};vm.runInNewContext(code,ctx);
 await assert.rejects(ctx.loadGLBAll(),/Weapon model unavailable: bad/);assert.equal(concurrent,0);assert(peak<=3);const done=Object.keys(cache).filter(id=>cache[id].model),counts={...calls};await ctx.loadGLBAll();assert(peak<=3);for(const id of done)assert.equal(calls[id],counts[id]);assert.equal(Object.values(cache).filter(c=>c.model).length,7);
});
