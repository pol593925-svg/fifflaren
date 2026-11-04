const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<script src="/three.min.js"></script><script src="/cs16-heat-scope.js"></script>');}
    if(!['/three.min.js','/cs16-heat-scope.js'].includes(req.url)){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type','text/javascript');fs.createReadStream(path.join(root,req.url.slice(1))).pipe(res);
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
    await page.goto('http://127.0.0.1:'+server.address().port);
    const result=await page.evaluate(()=>{
      const T=THREE,r=new T.WebGLRenderer({preserveDrawingBuffer:true});r.setSize(320,220);
      const scene=new T.Scene(),cam=new T.OrthographicCamera(-1.6,1.6,1.1,-1.1,.1,30);cam.position.z=5;scene.background=new T.Color(0x222838);
      function mesh(x,w,color,z=0){const o=new T.Mesh(new T.BoxGeometry(w,1.8,.05),new T.MeshBasicMaterial({color}));o.position.set(x,0,z);scene.add(o);return o;}
      const live=mesh(0,.52,0x33aa66),dead=mesh(.35,.12,0x776666),wall=mesh(-.15,.12,0x556677,1),outside=mesh(.92,.25,0x33aa66);
      const units=new Map([[1,{alive:true,group:live,heatBody:[live]}],[2,{alive:false,group:dead,heatBody:[dead]}],[3,{alive:true,group:outside,heatBody:[outside]}]]);
      const gl=r.getContext(),pixel=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
      const samples=()=>[[160,110],[145,110],[160,177],[195,110],[251,110]].map(([x,y])=>pixel(x,y));
      const hot=CS16HeatScope.create(T);r.render(scene,cam);const before=samples();hot.aperture(r.domElement,cam,true,null);hot.render(r,scene,cam,units);const after=samples();
      const glass=new T.Mesh(new T.CircleGeometry(.1,16));glass.position.x=.2;scene.add(glass);glass.updateMatrixWorld(true);
      const spot=hot.aperture(r.domElement,cam,false,glass).toArray();hot.dispose();r.dispose();return{before,after,spot};
    });
    assert.deepEqual(errors,[]);assert.deepEqual(result.after[0],[255,99,18,255]);assert.deepEqual(result.before.slice(1),result.after.slice(1));
    assert(Math.abs(result.spot[0]-180)<.1&&Math.abs(result.spot[2]-10)<.1);console.log('PASS thermal pixels: living target orange, foreground wall, dead target and outside of optic unchanged; physical reflex lens projected correctly.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
