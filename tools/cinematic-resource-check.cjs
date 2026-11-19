// CPU-only lifecycle check using the actual Three.js render targets. No GPU/browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const T=require('../three.min.js');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cs16-cinematic.js'),'utf8'),context);
const drawn=[],targets=new Set();let destination=null,bufferWidth=1920,bufferHeight=1080;
const renderer={
  capabilities:{isWebGL2:true},extensions:{has:()=>true},userData:{cs16Quality:'high'},
  info:{autoReset:true,reset(){}},
  getDrawingBufferSize(out){return out.set(bufferWidth,bufferHeight);},
  getRenderTarget(){return destination;},
  setRenderTarget(value){destination=value;if(value)targets.add(value);},
  clear(){},render(scene,camera){drawn.push({scene,camera,target:destination});},
};
const post=context.window.CS16Cinematic.create(T,renderer),scene=new T.Scene(),camera=new T.PerspectiveCamera(75,16/9,.08,1600);
post.render(scene,camera);
assert.equal(targets.size,3);assert.equal(drawn.length,4);assert.equal(destination,null);assert.equal(renderer.info.autoReset,true);
const sizes=[...targets].map(t=>[t.width,t.height]);
assert.deepEqual(sizes,[[1920,1080],[960,540],[480,270]]);
let disposals=0;for(const target of targets)target.addEventListener('dispose',()=>disposals++);

renderer.userData.cs16Quality='low';bufferWidth=998;bufferHeight=561;
post.render(scene,camera);
assert.equal(disposals,3,'entering low releases all three previous full-size targets');
for(const target of targets)assert.deepEqual([target.width,target.height],[1,1]);
assert.equal(post.info().width,0);assert.equal(post.info().height,0);
assert.equal(drawn.at(-1).scene,scene);assert.equal(drawn.at(-1).target,null);
for(let i=0;i<30;i++)post.render(scene,camera);
assert.equal(disposals,3,'low frames must not repeatedly dispose resources');

// Return to the exact old drawing-buffer size: cached dimensions must not skip
// allocation just because high quality has the same dimensions as before low.
renderer.userData.cs16Quality='high';bufferWidth=1920;bufferHeight=1080;
post.render(scene,camera);
assert.deepEqual([...targets].map(t=>[t.width,t.height]),sizes);
assert.equal(post.info().width,1920);assert.equal(drawn.at(-1).target,null);
const restoredDisposals=disposals;
post.setEnabled(false);post.render(scene,camera);
assert.equal(disposals,restoredDisposals+3,'manual bypass also releases buffers');
post.render(scene,camera);assert.equal(disposals,restoredDisposals+3);
post.setEnabled(true);post.render(scene,camera);
assert.equal(post.info().height,1080);

post.dispose();const finalDisposals=disposals;post.dispose();
assert.equal(disposals,finalDisposals,'final disposal is idempotent');
post.render(scene,camera);assert.equal(disposals,finalDisposals);
assert.equal(destination,null);assert.equal(renderer.info.autoReset,true);
console.log('PASS cinematic resources: high -> low -> high and manual bypass release once, recreate at previous dimensions, and preserve renderer state.');
