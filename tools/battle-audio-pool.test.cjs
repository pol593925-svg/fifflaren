const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(recorded=false){
 const counts={},sources=[],nodes=[];let inside=false;
 const node=kind=>{counts[kind]=(counts[kind]||0)+1;const n={gain:{},pan:{},frequency:{},playbackRate:{},links:new Set(),connect(to){this.links.add(to);},disconnect(to){if(to)this.links.delete(to);else this.links.clear();},start(){},stop(){this.stopped=true;}};nodes.push(n);return n;};
 const a={sampleRate:100, destination:{},createDynamicsCompressor:()=>Object.assign(node('compressor'),{threshold:{},knee:{},ratio:{},attack:{},release:{}}),createConvolver:()=>node('reverb'),createGain:()=>node('gain'),createBiquadFilter:()=>node('filter'),createStereoPanner:()=>node('pan'),createBufferSource:()=>{const n=node('source');sources.push(n);return n;},createBuffer:(channels,size)=>{counts.buffer=(counts.buffer||0)+1;return {getChannelData:()=>new Float32Array(size)};}};
 const window=recorded?{CS16SoundBank:{create:()=>({prepare:async()=>{},get:typeof recorded==='function'?recorded:(type,variant)=>({type,variant}),dispose(){}})}}:{};vm.runInNewContext(fs.readFileSync('cs16-battle-audio.js','utf8'),{window,performance,setTimeout,Math});
 const audio=window.CS16BattleAudio.create(a,{listener:()=>({x:0,y:0,z:0,yaw:0}),blocked:()=>false,indoor:()=>inside});
 return {audio,counts,sources,nodes,indoor:v=>inside=v};
}
test('gunfire reuses 28 spatial channels and stale ended events cannot interrupt a replacement',async()=>{
 const {audio,counts,sources,nodes}=fixture();await audio.prepare();assert.equal(counts.filter,28);assert.equal(counts.pan,28);
 for(let i=0;i<28;i++)audio.shot('m4a1',[0,0,-5]);const oldEnd=sources[0].onended;
 audio.shot('ak47',[0,0,-5]);assert(sources[0].stopped);oldEnd();assert(!sources.at(-1).stopped);
 for(let i=0;i<300;i++)audio.shot('m4a1',[0,0,-5]);assert.equal(counts.filter,28);assert.equal(counts.gain,29);assert.equal(counts.pan,28);
 audio.dispose();assert(nodes.every(n=>n.links.size===0));const count=sources.length;audio.shot('m4a1',[0,0,-5]);assert.equal(sources.length,count);
});
test('finished voices reconnect room reverb correctly; distant shots allocate nothing',async()=>{
 const {audio,counts,sources,nodes,indoor}=fixture();await audio.prepare();audio.shot('m4a1',[0,0,200]);assert.equal(counts.source,undefined);
 indoor(true);audio.shot('m4a1',[0,0,-5]);const filter=[...sources[0].links][0],volume=[...filter.links][0],pan=[...volume.links][0];assert.equal(pan.links.size,2);
 sources[0].onended();indoor(false);audio.shot('m4a1',[0,0,-5]);assert.equal([...sources[1].links][0],filter);assert.equal(pan.links.size,1);
 audio.dispose();audio.dispose();assert(nodes.every(n=>n.links.size===0));
});
test('recorded weapon families stay distinct and suppressed pistols retain pistol recordings',async()=>{
 const {audio,sources}=fixture(true);await audio.prepare();
 for(const id of ['ak47','galil','famas','aug','m4a1','usp','glock','mp5','awp'])audio.shot(id,[0,0,-1]);
 assert.deepEqual(sources.map(source=>source.buffer.type),['rifleAk','rifleAk','rifleAr','rifleAr','suppressed','suppressedPistol','pistol','smg','sniper']);
 audio.dispose();
});
test('missing PPQ recordings prewarm the USP fallback even when AR recordings decoded',async()=>{
 const {audio,counts,sources}=fixture((type,variant)=>type==='suppressedPistol'||type==='pistol'?null:{type,variant});
 await audio.prepare();const preparedBuffers=counts.buffer;
 for(let i=0;i<16;i++)audio.shot('usp',[0,0,-1]);
 assert.equal(counts.buffer,preparedBuffers,'first USP shot must not synthesize PCM during play');
 assert.equal(sources[0].buffer.type,undefined,'USP must use its fallback when pistol recordings are missing');
 audio.shot('m4a1',[0,0,-1]);assert.equal(sources.at(-1).buffer.type,'suppressed');audio.dispose();
});
