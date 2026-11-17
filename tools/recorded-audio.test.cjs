const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),bankCode=fs.readFileSync(path.join(root,'cs16-sound-bank.js'),'utf8');
function fixture({failure,hang,local=false,timeout=5000}={}) {
  const requests=[],decoded=[],aborted=[];
  const response=file=>({file,byteLength:12});
  const window={fetch:async(url,{signal})=>{
    const file=path.basename(url);requests.push(file);signal.addEventListener('abort',()=>aborted.push(file));
    if(hang==='network')return new Promise(()=>{});
    return {ok:!failure?.(file),arrayBuffer:async()=>response(file)};
  }};
  if(local){window.location={protocol:'file:'};window.XMLHttpRequest=class {
    open(method,url){this.file=path.basename(url);}send(){requests.push(this.file);this.status=0;this.response=response(this.file);queueMicrotask(()=>this.onload());}abort(){this.onabort();}
  };}
  const context={decodeAudioData:async bytes=>{decoded.push(bytes.file);if(hang==='decode')return new Promise(()=>{});return {file:bytes.file,duration:.5};}};
  vm.runInNewContext(bankCode,{window,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,timeout)),clearTimeout,console});
  return {api:window.CS16SoundBank,context,requests,decoded,aborted};
}
test('recording assets are local, compact and have traceable, click-free PCM firearm takes',()=>{
  const api=require('../cs16-sound-bank'),files=[...new Set(Object.values(api.files).flat())],folder=path.join(root,'assets/audio/cs16');
  let total=0;for(const file of files){assert(!file.includes('..'));const b=fs.readFileSync(path.join(folder,file));total+=b.length;assert.equal(b.toString('ascii',0,4),file.endsWith('.wav')?'RIFF':'OggS');}
  assert.equal(files.length,41);assert(total<2*1024*1024);
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'licenses/firearms-manifest.json'),'utf8'));
  assert.equal(manifest.length,13);assert.equal(new Set(manifest.map(x=>x.sha256)).size,13);
  for(const item of manifest){const b=fs.readFileSync(path.join(folder,item.output));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),item.sha256);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),48000);assert.equal(b.readUInt16LE(34),16);assert.equal(b.readInt16LE(44),0);assert.equal(b.readInt16LE(b.length-2),0);let peak=0,energy=0;for(let i=44;i<b.length;i+=2){const sample=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}assert(peak<.83&&peak>.8);assert(energy/(b.length/2)>.00001);}
});
test('prepare deduplicates decoding across audio engines and play lookup performs no network',async()=>{
  const {api,context,requests,decoded}=fixture(),a=api.create(context),b=api.create(context);
  assert.equal(a.get('rifleAk'),null);assert.equal(requests.length,0);
  const results=await Promise.all([a.prepare('battle'),b.prepare('steps'),a.prepare('battle')]);
  assert.deepEqual(results.map(x=>x.loaded),[29,16,29]);assert.equal(requests.length,41);assert.equal(new Set(requests).size,41);assert.equal(decoded.length,41);
  const first=a.get('rifleAk',0);assert.equal(first.file,'rifle-ak-0.wav');assert.equal(a.get('rifleAr',0).file,'rifle-ar-0.wav');
  for(let i=0;i<100;i++)b.get('step.grass',i);assert.equal(requests.length,41);
  a.dispose();assert.equal(a.get('rifleAk'),null);assert(b.get('rifleAk'));b.dispose();
  const c=api.create(context);await c.prepare('battle');assert.equal(requests.length,41);c.dispose();
});
test('one missing variant keeps other recordings; an entirely missing class returns fallback sentinel',async()=>{
  const {api,context}=fixture({failure:file=>file==='rifle-ak-0.wav'||file.startsWith('pistol')});const a=api.create(context),result=await a.prepare('battle');
  assert.equal(result.loaded,25);assert.equal(a.get('rifleAk',0).file,'rifle-ak-1.wav');assert.equal(a.get('pistol'),null);a.dispose();
});
for(const hang of ['network','decode'])test('hung '+hang+' settles and aborts within the prepare deadline',async()=>{
  const {api,context,aborted}=fixture({hang,timeout:10}),a=api.create(context),result=await a.prepare('battle');
  assert.equal(result.loaded,0);assert.equal(aborted.length,29);assert.equal(a.get('rifleAk'),null);a.dispose();
});
test('Electron local file mode loads bundled assets with XHR',async()=>{
  const {api,context,requests,decoded}=fixture({local:true}),a=api.create(context);const result=await a.prepare('steps');
  assert.equal(result.loaded,16);assert.equal(requests.length,16);assert.equal(decoded.length,16);a.dispose();
});
test('disposing every owner aborts pending loading without delaying shutdown',async()=>{
  const {api,context,aborted}=fixture({hang:'network'}),a=api.create(context),b=api.create(context),job=a.prepare('battle');a.dispose();assert.equal(aborted.length,0);b.dispose();
  assert.equal((await job).loaded,0);assert.equal(aborted.length,29);
});
test('battle and footsteps share one output limiter until the final owner is disposed',()=>{
  const {api,context}=fixture(),nodes=[];
  const node=()=>{const value={gain:{},links:new Set(),connect(to){this.links.add(to)},disconnect(){this.links.clear()}};nodes.push(value);return value;};
  context.destination={};context.createGain=node;context.createWaveShaper=node;
  const a=api.create(context),b=api.create(context),output=a.destination;
  assert.equal(output,b.destination);assert.equal(nodes.length,2);assert.equal(output.gain.value,.25);
  const limiter=nodes[1];assert.equal(limiter.oversample,'4x');assert.equal(limiter.curve[4096],0);
  assert(Math.abs(limiter.curve[4608]-.5)<1e-6,'single-shot level below knee must retain unity gain');
  assert(Math.max(...limiter.curve)<.901);a.dispose();assert.equal(output.links.size,1);
  b.dispose();assert(nodes.every(n=>n.links.size===0));assert.equal(a.destination,context.destination);assert.equal(nodes.length,2);
  const c=api.create(context);assert.notEqual(c.destination,output);assert.equal(nodes.length,4);c.dispose();assert(nodes.every(n=>n.links.size===0));
});
test('footstep channels and decoded PCM are reused, including when an ended event arrives late',async()=>{
  const nodes=[],sources=[],counts={};const node=kind=>{counts[kind]=(counts[kind]||0)+1;const n={gain:{},frequency:{},pan:{},playbackRate:{},links:new Set(),connect(to){this.links.add(to)},disconnect(){this.links.clear()},start(){},stop(){this.stopped=true}};nodes.push(n);return n;};
  let buffers=0;const context={sampleRate:8000,state:'running',destination:{},createBuffer:(channels,length)=>{buffers++;const data=new Float32Array(length);return {length,numberOfChannels:channels,getChannelData:()=>data,copyToChannel:x=>data.set(x)}},createGain:()=>node('gain'),createStereoPanner:()=>node('pan'),createBiquadFilter:()=>node('filter'),createBufferSource:()=>{const n=node('source');sources.push(n);return n;}};
  const recording=context.createBuffer(1,2400);recording.getChannelData()[40]=.4;
  const window={CS16SoundBank:{create:()=>({prepare:async()=>{},get:()=>recording,dispose(){}})}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'cs16-footsteps.js'),'utf8'),{window,setTimeout,Math});const steps=window.CS16Footsteps.create(context);await steps.prepare();const preparedBuffers=buffers;
  for(let i=0;i<8;i++)steps.play('metal');const oldEnd=sources[0].onended;steps.play('stone');oldEnd();assert(!sources.at(-1).stopped);
  for(let i=0;i<100;i++)steps.play(['stone','wood','grass','earth','metal'][i%5]);assert.equal(counts.filter,8);assert.equal(counts.gain,8);assert.equal(counts.pan,8);assert.equal(buffers,preparedBuffers);
  assert.equal(sources[8].buffer.getChannelData()[40],Math.fround(.56));steps.dispose();assert(nodes.every(n=>n.links.size===0));const count=sources.length;steps.play('stone');assert.equal(sources.length,count);
});
