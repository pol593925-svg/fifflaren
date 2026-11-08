// Exercise real instance buffers, including rebuilds after movement and quality changes.
module.exports=async function(page,spot){
 const assert=require('node:assert/strict');
 const buffers=()=>{
  const names=new Set(['Nearby meadow grass','TERRA facade ivy','Evolution detailed vegetation']);
  const result={};
  __qa.scene().traverse(o=>{if(o.isInstancedMesh&&(names.has(o.name)||names.has(o.parent?.name)))
   result[o.uuid]={name:o.name,count:o.count,version:o.instanceMatrix.version};});
  return result;
 };
 await page.waitForTimeout(700);
 const before=await page.evaluate(buffers);await page.waitForTimeout(900);
 const stationary=await page.evaluate(buffers);
 assert(Object.keys(before).length>=10,'Missing vegetation instance pools');
 assert.deepEqual(stationary,before,'Stationary camera must not rewrite decorative instance buffers');
 await page.evaluate(({x,z})=>__qa.aim(x+2,0,z,2.54,.05),spot);
 await page.waitForTimeout(700);const moved=await page.evaluate(buffers);
 assert(Object.keys(moved).every(k=>moved[k].version>before[k].version),'Movement must refresh all pools');
 await page.evaluate(()=>{const q=__qa.ui().quality;q.value='low';q.onchange()});
 await page.waitForTimeout(700);const low=await page.evaluate(buffers);
 assert(Object.keys(low).every(k=>low[k].version>moved[k].version),'Quality change must refresh stationary pools');
 assert(Object.values(low).filter(v=>v.name==='Nearby meadow grass').every(v=>v.count<=220));
 await page.evaluate(({x,z})=>{__qa.aim(x,0,z,2.54,.05);const q=__qa.ui().quality;q.value='high';q.onchange()},spot);
 await page.waitForTimeout(800);
 console.log('LANDSCAPE_POOLS_PASS',JSON.stringify({pools:Object.keys(before).length,stationaryWrites:0}));
};
