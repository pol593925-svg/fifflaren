const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {create,LIMIT,PART}=require('../cinema-library-main');
test('PC library accounts for complete files and legacy space, and deletes only the managed copy',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'hub-film-library-')),store=create(path.join(root,'store'));
  const source=path.join(root,'Example.mp4'),data=Buffer.alloc(PART+64,117);data.write('ftyp',4);
  const meta={duration:4,width:1920,height:1080},copy=(legacy=0)=>store.add(source,meta,legacy,()=>{},()=>true);
  try{
    await fs.writeFile(source,data);
    await assert.rejects(copy(LIMIT-data.length+1),/10 ГБ/);
    const item=await copy(LIMIT-data.length);assert.deepEqual(await store.list(),[item]);assert.equal(item.width,1920);
    assert.deepEqual(Buffer.concat([await store.read(item.id,0),await store.read(item.id,PART)]),data);
    const reopen=create(path.join(root,'store'));assert.equal((await reopen.list())[0].id,item.id);
    await assert.rejects(copy(LIMIT-data.length),/10 ГБ/);await assert.rejects(store.read('../source',0));
    await reopen.remove(item.id);assert.deepEqual(await store.list(),[]);assert.deepEqual(await fs.readFile(source),data);
    const both=await Promise.allSettled([copy(LIMIT-data.length),copy(LIMIT-data.length)]);
    assert.equal(both.filter(r=>r.status==='fulfilled').length,1);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
