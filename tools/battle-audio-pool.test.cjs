const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const counts={},sources=[],nodes=[];let inside=false;
 const node=kind=>{counts[kind]=(counts[kind]||0)+1;const n={gain:{},pan:{},frequency:{},playbackRate:{},links:new Set(),connect(to){this.links.add(to);},disconnect(to){if(to)this.links.delete(to);else this.links.clear();},start(){},stop(){this.stopped=true;}};nodes.push(n);return n;};
 const a={sampleRate:100, destination:{},createConvolver:()=>node('reverb'),createGain:()=>node('gain'),createBiquadFilter:()=>node('filter'),createStereoPanner:()=>node('pan'),createBufferSource:()=>{const n=node('source');sources.push(n);return n;},createBuffer:(channels,size)=>({getChannelData:()=>new Float32Array(size)})};
 const window={};vm.runInNewContext(fs.readFileSync('cs16-battle-audio.js','utf8'),{window,performance,setTimeout,Math});
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
