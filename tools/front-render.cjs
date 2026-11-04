const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.route('http://front.test/**',r=>{const u=new URL(r.request().url());if(u.pathname==='/')return r.fulfill({contentType:'text/html',body:'<canvas></canvas>'+['three.min','GLTFLoader','cs16-front','cs16-front-view','cs16-terrain'].map(n=>'<script src="/'+n+'.js"></script>').join('')});return r.fulfill({path:path.join(root,u.pathname)});});
 await page.goto('http://front.test/');
 const result=await page.evaluate(async()=>{
   const T=THREE,grid=CS16Front.district().map(r=>Array.from(r,c=>c==='#'?1:0));
   const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas'),preserveDrawingBuffer:true});
   renderer.setSize(128,128,false);renderer.shadowMap.enabled=true;
   const scene=new T.Scene(),camera=new T.OrthographicCamera(-4,4,4,-4,.1,30);scene.background=new T.Color(0x183149);
   const root=new T.Group();root.name='Walkable two-storey buildings';scene.add(root);
   const wall=new T.Mesh(new T.BoxGeometry(8,5,.2),new T.MeshBasicMaterial({color:0xfc7f20}));wall.position.set(20,2.5,18);wall.castShadow=true;root.add(wall);camera.position.set(20,2.4,26);camera.lookAt(20,2.4,18);
   const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(20,9,28);sun.target=wall;sun.castShadow=true;scene.add(sun,new T.AmbientLight(0xffffff,1));
   const view=CS16FrontView.create({T,scene,grid,map:'dust2',assets:{}}),gl=renderer.getContext();
   function pixels(){renderer.render(scene,camera);const p=new Uint8Array(8);gl.readPixels(35,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p.subarray(0,4));gl.readPixels(90,64,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p.subarray(4));return [...p];}
   const before=pixels();CS16Front.apply(grid,[CS16Front.key(grid,18,18)]);view.sync();const after=pixels();
   CS16Front.reset(grid);view.sync();const restored=pixels();view.dispose();
   const asset=(await new T.GLTFLoader().loadAsync('models/csgo/frontline.glb')).scene;root.add(asset);root.updateMatrixWorld(true);const real=CS16FrontView.create({T,scene,grid,map:'frontline',assets:{}});
   camera.left=-90;camera.right=90;camera.top=60;camera.bottom=-60;camera.far=650;camera.position.set(180,80,220);camera.lookAt(150,0,105);camera.updateProjectionMatrix();
   CS16Front.apply(grid,CS16Front.footprint(grid,100,133,6));real.sync(true);
   real.ingest(Array.from({length:100},(_,i)=>[1100+(i%10)*25,0,1200+Math.floor(i/10)*30,0,100]));real.update(performance.now(), 'low',null);
   renderer.render(scene,camera);const calls=renderer.info.render.calls;real.dispose();renderer.dispose();
   return {before,after,restored,calls};
 });
 assert(result.before[0]>200&&result.before[4]>200,JSON.stringify(result));assert(result.after[0]<100&&result.after[4]>200,JSON.stringify(result));assert.deepEqual(result.before,result.restored);assert.deepEqual(errors,[]);console.log('PASS real WebGL',JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
