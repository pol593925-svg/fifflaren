'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{createReadStream,createWriteStream}=require('node:fs'),{Transform}=require('node:stream');
const LIMIT=4_000_000_000,PART=512*1024,validId=id=>typeof id==='string'&&/^[a-f0-9]{24}$/.test(id);
function create(dir){
  const file=(id,ext)=>{if(!validId(id))throw Error('Неверный номер фильма.');return path.join(dir,id+ext);};
  async function list(){
    await fs.mkdir(dir,{recursive:true});const movies=[];
    for(const name of await fs.readdir(dir)){
      if(!/^[a-f0-9]{24}\.json$/.test(name))continue;
      const id=name.slice(0,-5),item=JSON.parse(await fs.readFile(file(id,'.json'),'utf8'));
      try{if((await fs.stat(file(id,'.original'))).size===item.size)movies.push(item);}catch(e){if(e.code!=='ENOENT')throw e;}
    }
    return movies;
  }
  async function diskOperation(fn){
    await fs.mkdir(dir,{recursive:true});const lock=path.join(dir,'writer.lock');let handle;
    try{handle=await fs.open(lock,'wx');}
    catch(e){
      if(e.code!=='EEXIST')throw e;
      const pid=Number(await fs.readFile(lock,'utf8'));
      let alive=true;if(Number.isSafeInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(err){if(err.code==='ESRCH')alive=false;}}
      else if(Date.now()-(await fs.stat(lock)).mtimeMs>60000)alive=false;
      if(alive)throw Error('Библиотека уже занята. Дождись окончания операции.');
      await fs.unlink(lock);handle=await fs.open(lock,'wx');
    }
    try{await handle.writeFile(String(process.pid));
      // Only generated temporary files and uncommitted copies can remain after a crash.
      for(const name of await fs.readdir(dir)){
        if(/^[a-f0-9]{24}\.(part|tmp)$/.test(name))await fs.unlink(path.join(dir,name));
        if(/^[a-f0-9]{24}\.original$/.test(name)){
          try{await fs.access(file(name.slice(0,24),'.json'));}catch(e){if(e.code!=='ENOENT')throw e;await fs.unlink(path.join(dir,name));}
        }
      }
      return await fn();
    }finally{await handle.close();await fs.unlink(lock);}
  }
  async function add(source,meta,legacyBytes,onProgress,stillOwner){
    return diskOperation(async()=>{
      const size=(await fs.stat(source)).size,title=path.basename(source,path.extname(source)).trim().slice(0,200);
      if(!title||!Number.isSafeInteger(size)||size<12||!Number.isFinite(meta.duration)||meta.duration<=0||!(meta.width>0&&meta.height>0))throw Error('Видеофайл не удалось прочитать.');
      const used=(await list()).reduce((n,m)=>n+m.size,legacyBytes);
      if(used+size>LIMIT)throw Error('Не хватает места в библиотеке на 4 ГБ. Удали старый фильм.');
      const disk=await fs.statfs(dir);if(disk.bavail*disk.bsize<size)throw Error('На диске ПК недостаточно свободного места.');
      const id=crypto.randomBytes(12).toString('hex'),part=file(id,'.part'),final=file(id,'.original'),json=file(id,'.json'),temp=file(id,'.tmp');
      let copied=0,last=-1;
      try{
        await pipeline(createReadStream(source),new Transform({transform(buf,enc,cb){
          copied+=buf.length;if(copied>size||!stillOwner())return cb(Error('Копирование прервано. Проверь файл и подключение библиотеки.'));
          const pct=Math.floor(copied/size*100);if(last!==pct){last=pct;onProgress(pct);}cb(null,buf);
        }}),createWriteStream(part,{flags:'wx'}));
        if(copied!==size)throw Error('Размер исходного файла изменился. Выбери его снова.');
        const fp=await fs.open(part,'r');let head;try{head=Buffer.alloc(Math.min(4096,size));await fp.read(head,0,head.length,0);}finally{await fp.close();}
        const mime=head.toString('ascii',4,8)==='ftyp'?'video/mp4':head.readUInt32BE(0)===0x1a45dfa3&&head.includes(Buffer.from('webm'))?'video/webm':null;
        if(!mime)throw Error('Поддерживаются фильмы MP4 и WebM.');
        const item={id,title,size,duration:meta.duration,width:meta.width,height:meta.height,mime,storage:'pc',createdAt:Date.now()};
        await fs.writeFile(temp,JSON.stringify(item),{flag:'wx'});await fs.rename(part,final);await fs.rename(temp,json);return item;
      }catch(e){await Promise.all([part,temp,final].map(p=>fs.rm(p,{force:true})));throw e;}
    });
  }
  async function remove(id){
    await diskOperation(async()=>{await fs.rm(file(id,'.original'),{force:true});await fs.rm(file(id,'.json'),{force:true});});
  }
  async function read(id,offset){
    if(!Number.isSafeInteger(offset)||offset<0||offset%PART)throw Error('Неверный диапазон.');
    const fp=await fs.open(file(id,'.original'),'r');try{const {size}=await fp.stat();if(offset>=size)throw Error('Конец файла.');
      const buf=Buffer.allocUnsafe(Math.min(PART,size-offset));let n=0;
      while(n<buf.length){const r=await fp.read(buf,n,buf.length-n,offset+n);if(!r.bytesRead)throw Error('Файл изменился.');n+=r.bytesRead;}return buf;
    }finally{await fp.close();}
  }
  return {list,add,remove,read};
}
module.exports={create,LIMIT,PART};
