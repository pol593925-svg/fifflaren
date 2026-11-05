const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {create,PART}=require('../radio-library-main');
test('desktop music storage resumes across restart, rejects changed parts, and commits original bytes once',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'radio-local-')),id='a'.repeat(24),data=Buffer.alloc(PART+121,42);data.write('RIFF');data.write('WAVE',8);
 const meta={id,title:'Song',size:data.length,duration:30,addedBy:'mira'};
 try{
  let store=create(dir);assert.equal((await store.start(meta)).next,0);await store.part(id,0,data.subarray(0,PART));
  store=create(dir);assert.equal((await store.start(meta)).next,1);await assert.rejects(store.start({...meta,addedBy:'leo'}));await assert.rejects(store.part(id,0,Buffer.alloc(PART,1)));
  await store.part(id,0,data.subarray(0,PART));await assert.rejects(store.finish(id));await store.part(id,1,data.subarray(PART));
  await fs.rename(path.join(dir,id+'.part'),path.join(dir,id+'.audio'));assert.equal((await store.start(meta)).next,2);
  const saved=await store.finish(id);assert.equal(saved.addedBy,'mira');assert.equal(saved.mime,'audio/wav');assert.deepEqual(await store.finish(id),saved);
  store=create(dir);assert.equal((await store.list()).length,1);assert.deepEqual(Buffer.concat([await store.read(id,0),await store.read(id,PART)]),data);
  await assert.rejects(store.read('../x',0));await assert.rejects(store.read(id,3));
  const second={...meta,id:'b'.repeat(24)};await store.start(second);await fs.writeFile(path.join(dir,second.id+'.part'),data.subarray(0,15));
  assert.equal((await store.start(second)).next,0);await store.part(second.id,0,data.subarray(0,PART));await store.part(second.id,1,data.subarray(PART));await store.finish(second.id);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
