// Project each sight through the actual first-person camera and check for opaque geometry in its aperture.
const {chromium}=require('playwright'), fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'cs16.js'),'utf8');
const profiles=JSON.parse(source.match(/Object\.assign\(GLB_MODELS, (\{[\s\S]*?\n\})\);/)[1]);
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:900,height:600}});
    await page.route('http://sight.test/**',r=>{
      const url=new URL(r.request().url());
      if(url.pathname==='/')return r.fulfill({contentType:'text/html',body:'<style>*{margin:0}</style><canvas></canvas>'+['three.min','GLTFLoader','cs16-field-view','cs16-weapon-grip'].map(k=>'<script src="/'+k+'.js"></script>').join('')});
      return r.fulfill({path:path.join(root,decodeURIComponent(url.pathname))});
    });
    await page.goto('http://sight.test/');await page.addScriptTag({content:source.slice(source.indexOf('function makeRPGModel()'),source.indexOf('  const rpgShots='))});
    const results=await page.evaluate(async profiles=>{
      const T=THREE,scene=new T.Scene(),cam=new T.PerspectiveCamera(50,1.5,.05,200);
      scene.add(cam,new T.HemisphereLight(0xfef4de,0x788896,2.5));scene.background=new T.Color(0x85979c);
      const renderer=new T.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});renderer.setSize(900,600);
      const loader=new T.GLTFLoader(),optic=CS16FieldView.optic(T),point=new T.Vector3(),result=[];
      const hands=(await loader.loadAsync('models/csgo/hands.glb')).scene;
      for(const [id,p]of Object.entries({...profiles,rpg:null})){
        if(!CS16FieldView.supported(id))continue;
        const gun=new T.Group(),basis=p?new T.Group():null;
        if(p){basis.add((await loader.loadAsync(p.url)).scene);basis.updateMatrixWorld(true);
          const dims=new T.Box3().setFromObject(basis).getSize(new T.Vector3());
          basis.scale.setScalar(p.len/Math.max(dims.x,dims.y,dims.z));basis.updateMatrixWorld(true);
          basis.position.sub(new T.Box3().setFromObject(basis).getCenter(new T.Vector3()));gun.add(basis);
        }else gun.add(makeRPGModel());
        CS16Grip.bindGun(T,gun,basis,id);CS16Grip.fitHands(gun,hands);
        const dot=CS16FieldView.mount(gun,optic.root,['twin','cup'].includes(gun.userData.grip.style));
        cam.add(gun);CS16FieldView.frame(gun.position,1,true,gun.userData.grip);
        gun.rotation.set(.018,-.024,.008);CS16FieldView.align(gun,dot,1,point);dot.visible=true;
        scene.updateMatrixWorld(true);const projected=dot.getWorldPosition(point).project(cam);
        const error=Math.hypot(projected.x*450,projected.y*300);
        const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(0,0),cam);
        const obstacles=ray.intersectObject(gun,true).filter(hit=>!hit.object.parent.name.includes('Field reflex optic')&&hit.object.material.opacity!==0&&hit.distance>=cam.near).map(hit=>hit.object.name);
        result.push({id,error,obstacles:[...new Set(obstacles)]});
        if(id==='glock'||id==='awp'){renderer.render(scene,cam);window['image_'+id]=renderer.domElement.toDataURL();}
        gun.removeFromParent();
      }
      optic.dispose();renderer.dispose();return result;
    },profiles);
    assert.equal(results.length,19);for(const v of results){assert(v.error<.01,JSON.stringify(v));assert.equal(v.obstacles.length,0,JSON.stringify(v));}
    const out=process.env.GRAPHICS_OUTPUT||path.join(root,'graphics-qa');fs.mkdirSync(out,{recursive:true});
    for(const id of ['glock','awp'])fs.writeFileSync(path.join(out,'ads-'+id+'.png'),Buffer.from((await page.evaluate(id=>window['image_'+id],id)).split(',')[1],'base64'));
    console.log('PASS',results.length,'firearms and RPG: aperture clear, reticle <0.01 pixels from aim axis');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
