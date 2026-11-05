'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const PART=512*1024,valid=id=>typeof id==='string'&&/^[a-f0-9]{24}$/.test(id);
const fail=(message,status=409)=>Object.assign(Error(message),{status});
function mime(b){
  const h=b.toString('latin1',0,4);
  if(['RIFF','RF64','BW64'].includes(h)&&b.toString('ascii',8,12)==='WAVE')return 'audio/wav';
  if(h==='fLaC')return 'audio/flac';if(h==='OggS')return 'audio/ogg';
  if(h==='FORM'&&['AIFF','AIFC'].includes(b.toString('ascii',8,12)))return 'audio/aiff';
  if(b.toString('ascii',4,8)==='ftyp')return 'audio/mp4';if(b.length>=4&&b.readUInt32BE(0)===0x1a45dfa3)return 'audio/webm';
  if(b.length>=2&&b[0]===255&&(b[1]&0xf6)===0xf0)return 'audio/aac';
  if(h.startsWith('ID3')||b.length>=2&&b[0]===255&&(b[1]&224)===224)return 'audio/mpeg';
  return null;
}
function create(dir){
  let serial=Promise.resolve(),pending=0;
  const file=(id,ext)=>{if(!valid(id))throw fail('Неверный номер трека.');return path.join(dir,id+ext);};
  const exclusive=fn=>{if(pending>=12)return Promise.reject(fail('ПК занят другими загрузками. Повтори через несколько секунд.',429));pending++;const p=serial.then(fn);serial=p.catch(()=>{});return p.finally(()=>pending--);};
  async function json(id,ext){try{return JSON.parse(await fs.readFile(file(id,ext),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  async function write(id,ext,obj){const p=file(id,ext);await fs.writeFile(p+'.tmp',JSON.stringify(obj));await fs.rename(p+'.tmp',p);}
  const size=async p=>{try{return (await fs.stat(p)).size;}catch(e){if(e.code==='ENOENT')return 0;throw e;}};
  async function list(){
    await fs.mkdir(dir,{recursive:true});const out=[];
    for(const name of await fs.readdir(dir))if(/^[a-f0-9]{24}\.json$/.test(name)){const t=await json(name.slice(0,24),'.json');if(t&&await size(file(t.id,'.audio'))===t.size)out.push(t);}
    return out;
  }
  async function start(meta){return exclusive(async()=>{
    await fs.mkdir(dir,{recursive:true});
    if(!valid(meta?.id)||typeof meta.title!=='string'||!meta.title.trim()||meta.title.length>200||!Number.isSafeInteger(meta.size)||meta.size<4||!Number.isFinite(meta.duration)||meta.duration<=0||typeof meta.addedBy!=='string'||meta.addedBy.length>100)throw fail('Некорректный трек.',400);
    const old=await json(meta.id,'.json')||await json(meta.id,'.upload.json');
    if(old){if(['title','size','duration','addedBy'].some(k=>old[k]!==meta[k]))throw fail('Этот номер принадлежит другой загрузке.');
      const complete=await size(file(meta.id,'.audio'))===meta.size;
      if(!complete){const h=await fs.open(file(meta.id,'.part'),'a');await h.close();}
      const bytes=await size(file(meta.id,'.part'));return {next:complete?Math.ceil(meta.size/PART):Math.floor(bytes/PART),partSize:PART};
    }
    let reserved=0;for(const name of await fs.readdir(dir))if(/^[a-f0-9]{24}\.upload\.json$/.test(name)){
      const id=name.slice(0,24),t=await json(id,'.upload.json');if(!await json(id,'.json'))reserved+=Math.max(0,t.size-await size(file(id,'.part'))-await size(file(id,'.audio')));
    }
    const space=await fs.statfs(dir);if(space.bavail*space.bsize-reserved<meta.size+64*1024*1024)throw fail('На ПК Fifflaren недостаточно свободного места.',507);
    await write(meta.id,'.upload.json',{...meta,createdAt:Date.now()});await fs.writeFile(file(meta.id,'.part'),Buffer.alloc(0),{flag:'wx'});
    return {next:0,partSize:PART};
  });}
  async function part(id,n,bytes){return exclusive(async()=>{
    const t=await json(id,'.upload.json')||await json(id,'.json');
    if(!t||!Number.isSafeInteger(n)||n<0||n>=Math.ceil(t.size/PART)||!Buffer.isBuffer(bytes)||bytes.length!==Math.min(PART,t.size-n*PART))throw fail('Неверная часть трека.',400);
    const p=file(id,await json(id,'.json')?'.audio':'.part'),length=await size(p),offset=n*PART;
    if(offset>length)throw fail('Пропущена предыдущая часть.');
    const fp=await fs.open(p,'r+');try{
      if(length>=offset+bytes.length){const before=Buffer.alloc(bytes.length);await fp.read(before,0,before.length,offset);if(!before.equals(bytes))throw fail('Содержимое трека изменилось.');return {ok:true};}
      if(length!==offset)await fp.truncate(offset);
      let done=0;while(done<bytes.length){const r=await fp.write(bytes,done,bytes.length-done,offset+done);if(!r.bytesWritten)throw fail('Не удалось сохранить часть.');done+=r.bytesWritten;}
      await fp.sync();return {ok:true};
    }finally{await fp.close();}
  });}
  async function finish(id){return exclusive(async()=>{
    const ready=await json(id,'.json');if(ready){if(await size(file(id,'.audio'))!==ready.size)throw fail('Файл на ПК недоступен.');return ready;}
    const t=await json(id,'.upload.json');if(!t)throw fail('Начни загрузку заново.');
    let p=file(id,'.part');if(await size(p)!==t.size){p=file(id,'.audio');if(await size(p)!==t.size)throw fail('Загружены не все части.');}
    const fp=await fs.open(p,'r'),head=Buffer.alloc(Math.min(4096,t.size));try{await fp.read(head,0,head.length,0);}finally{await fp.close();}
    const type=mime(head);if(!type)throw fail('Формат аудио не распознан.',415);
    const track={...t,mime:type,storage:'pc'};if(p!==file(id,'.audio'))await fs.rename(p,file(id,'.audio'));
    await write(id,'.json',track);await fs.rm(file(id,'.upload.json'),{force:true});return track;
  });}
  async function read(id,offset){
    if(!Number.isSafeInteger(offset)||offset<0||offset%PART)throw fail('Неверный диапазон.');
    const fp=await fs.open(file(id,'.audio'),'r');try{const s=(await fp.stat()).size;if(offset>=s)throw fail('Конец файла.');const out=Buffer.alloc(Math.min(PART,s-offset));let n=0;
      while(n<out.length){const r=await fp.read(out,n,out.length-n,offset+n);if(!r.bytesRead)throw fail('Файл изменился.');n+=r.bytesRead;}return out;
    }finally{await fp.close();}
  }
  return {list,start,part,finish,read};
}
module.exports={create,PART};
