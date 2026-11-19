// Exercise real instance buffers, including rebuilds after movement and quality changes.
module.exports=async function(page,spot){
 const assert=require('node:assert/strict');
 const buffers=()=>{
  const names=new Set(['Nearby meadow grass','TERRA facade ivy','Evolution detailed vegetation']);
  const result={};
  __qa.scene().traverse(o=>{
   if(!o.isInstancedMesh)return;
   const realistic=o.parent?.name==='ORCA Bistro adapted architecture'&&o.userData.cs16Realistic===true;
   if(!realistic&&!names.has(o.name)&&!names.has(o.parent?.name))return;
   // Include the actual backing data, not just Three's needsUpdate counter.
   const array=o.instanceMatrix.array,words=new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
   let hash=2166136261,activeHash=2166136261;for(let i=0;i<words.length;i++){
    hash=Math.imul(hash^words[i],16777619)>>>0;
    if(i<o.count*16)activeHash=Math.imul(activeHash^words[i],16777619)>>>0;
   }
   const materials=Array.isArray(o.material)?o.material:[o.material];
   result[o.uuid]={name:o.name,realistic,count:o.count,capacity:o.instanceMatrix.count,
    version:o.instanceMatrix.version,matrixHash:hash,activeMatrixHash:activeHash,bytes:array.byteLength,
    geometry:o.geometry.uuid,materials:materials.map(m=>m.uuid),
    triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3*o.count,
    castShadow:o.castShadow};
  });
  // The old vegetation may still exist as empty compatibility pools, while
  // Bistro owns the visible world. Its dormant controllers must not be asked
  // to upload buffers on a quality change in the other renderer branch.
  const real=Object.entries(result).filter(([,value])=>value.realistic);
  return real.length?Object.fromEntries(real):result;
 };
 const sameResources=(a,b)=>{
  assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),'Pool meshes must be reused');
  for(const id of Object.keys(a))for(const key of ['capacity','bytes','geometry','materials'])
   assert.deepEqual(b[id][key],a[id][key],'Camera/quality must not allocate new pool resources: '+a[id].name+' / '+key);
 };
 const refreshed=(a,b,reason)=>{
  const rows=Object.keys(b).map(id=>({id,name:b[id].name,beforeCount:a[id]?.count,count:b[id].count,beforeVersion:a[id]?.version,version:b[id].version,
   hashChanged:b[id].matrixHash!==a[id]?.matrixHash,realistic:b[id].realistic}));
  const bad=rows.filter(r=>r.realistic?r.hashChanged&&r.version<=r.beforeVersion:(r.beforeCount>0||r.count>0)&&r.version<=r.beforeVersion);
  assert.deepEqual(bad,[],reason+' (changed CPU matrices require a GPU upload): '+JSON.stringify(rows));
  assert(rows.some(r=>(r.beforeCount>0||r.count>0)&&(r.version>r.beforeVersion||r.count!==r.beforeCount)),reason+' (no active pool refreshed): '+JSON.stringify(rows));
 };
 await page.waitForTimeout(700);
 const before=await page.evaluate(buffers);await page.waitForTimeout(900);
 const stationary=await page.evaluate(buffers);
 const realistic=Object.values(before).some(v=>v.realistic);
 if(realistic){
  const names=new Set(Object.values(before).filter(v=>v.realistic).map(v=>v.name));
  for(const name of ['tree','cypress','ivy','townhouses','window_frame','shutter_panel'])
   assert(names.has('Bistro '+name),'Missing actual Bistro instance pool: '+name);
  assert(Object.values(before).filter(v=>v.realistic).every(v=>v.capacity>0&&v.capacity<=128&&v.count<=v.capacity),'Bistro pools must have bounded instance storage');
  const manifest=require('../assets/cs-realistic/bistro/manifest.json');
  const surfaces=await page.evaluate(manifest=>{
   const selected=new Set(Object.values(manifest.surfaces)),seen=new Set(),failures=[];
   __qa.scene().traverse(o=>{if(!o.isMesh)return;for(const material of Array.isArray(o.material)?o.material:[o.material]){
    const source=material?.userData?.source;if(!selected.has(source)||seen.has(material.uuid))continue;seen.add(material.uuid);
    const expected=manifest.materials[source];
    if(!material.userData.cs16Realistic||!material.userData.cs16WorldSurface)failures.push(material.name+': missing realistic material ownership');
    for(const [slot,file,color] of [['map',expected.BaseColor,'srgb'],['normalMap',expected.Normal,''],['roughnessMap',expected.Specular,''],['metalnessMap',expected.Specular,''],['aoMap',expected.Specular,'']]){
     const texture=material[slot],url=texture?.image?.currentSrc||texture?.image?.src||'';
     if(!texture||texture.colorSpace!==color||!decodeURIComponent(url).endsWith(file))failures.push(material.name+': incorrect '+slot);
    }
    if(material.roughnessMap!==material.metalnessMap||material.roughnessMap!==material.aoMap)failures.push(material.name+': ORM channels must share one texture');
   }});return{checked:seen.size,failures};
  },manifest);
  assert(surfaces.checked>0,'Bistro surface materials must actually replace the original palette');
  assert.deepEqual(surfaces.failures,[],'Actual runtime surface maps/color spaces must match the prepared manifest');
 }else assert(Object.keys(before).length>=10,'Missing vegetation instance pools');
 assert.deepEqual(stationary,before,'Stationary camera must not rewrite decorative instance buffers');
 await page.evaluate(({x,z})=>__qa.aim(x+2,0,z,2.54,.05),spot);
 await page.waitForTimeout(700);const moved=await page.evaluate(buffers);
 sameResources(before,moved);
 refreshed(before,moved,'Movement must refresh visible pools');
 await page.evaluate(()=>{const q=__qa.ui().quality;q.value='low';q.onchange()});
 await page.waitForTimeout(700);const low=await page.evaluate(buffers);
 sameResources(moved,low);
 assert.equal(await page.evaluate(()=>__qa.renderer().userData.cs16Quality),'low','Quality UI must apply economy renderer state');
 refreshed(moved,low,'Quality change must refresh stationary visible pools');
 if(realistic){
  const lowCaps={townhouses:1,tree:2,window_frame:24,pilaster:12,shutter_panel:36};
  const ids=Object.keys(low).filter(id=>low[id].realistic);
  for(const id of ids){
   const pool=low[id],name=pool.name.replace(/^Bistro /,'');
   assert(pool.count<=Math.min(pool.capacity,lowCaps[name]??4),'Economy LOD count exceeds its budget: '+name);
   assert(pool.count<=moved[id].count,'Economy LOD must not add instances: '+name);
   assert.equal(pool.castShadow,false,'Economy detail pools must not render shadow maps');
  }
  const triangles=state=>ids.reduce((sum,id)=>sum+state[id].triangles,0);
  assert(triangles(low)<triangles(moved),'Economy quality must actually reduce submitted Bistro triangles');
  const submitted=state=>ids.filter(id=>state[id].count>0).length;
  assert(submitted(low)<=submitted(moved),'Economy quality must not increase detail draw calls');
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(buffers),low,'Stationary economy pools must stop uploading matrices');
 }else assert(Object.values(low).filter(v=>v.name==='Nearby meadow grass').every(v=>v.count<=220));
 await page.evaluate(({x,z})=>{__qa.aim(x,0,z,2.54,.05);const q=__qa.ui().quality;q.value='high';q.onchange()},spot);
 await page.waitForTimeout(800);
 const restored=await page.evaluate(buffers);sameResources(before,restored);
 if(realistic){
  for(const id of Object.keys(before).filter(id=>before[id].realistic)){
   assert.equal(restored[id].count,before[id].count,'Restoring the same camera/high quality must restore selected instances');
   assert.equal(restored[id].activeMatrixHash,before[id].activeMatrixHash,'Restoring the camera must restore actual active instance transforms');
   // Unused capacity can retain old transforms, so only active data must match.
   assert.equal(restored[id].castShadow,before[id].castShadow,'High-quality shadow policy must be restored');
  }
 }
 console.log('LANDSCAPE_POOLS_PASS',JSON.stringify({mode:realistic?'Bistro 3D':'illustrated vegetation',pools:Object.keys(before).length,stationaryWrites:0,
  highTriangles:Object.values(moved).reduce((n,p)=>n+p.triangles,0),lowTriangles:Object.values(low).reduce((n,p)=>n+p.triangles,0)}));
};
