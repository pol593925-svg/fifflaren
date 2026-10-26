const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'graphics-qa');fs.mkdirSync(out,{recursive:true});
const hook=`window.__qa={heroes:HEROES,start(id){rootWrap.querySelectorAll('[data-lobby],[data-pick]').forEach(e=>e.remove());setupMatch(id);},pause(){cancelAnimationFrame(rafId);rafId=null;},castAll(){const h=myHero;h.lvl=15;h.hp=h.maxHp/2;h.mana=2000;const target={x:h.x+5,z:h.z+5};return h.abilities.map(a=>{a.lvl=1;a.cdT=0;const ok=castAbility(h,a,a.def.type==='self'?h:target);return {key:a.def.key,ok,cooldown:a.cdT,mana:h.mana,damage:abilityDmg(h,h.abilities.indexOf(a))};});},draw(){mouseOnUI=true;camX=myHero.x;camZ=myHero.z;tickFog(.2);updateCamera(.016);applyFogVisibility();updateHud();updateSelPanel();drawMinimap();renderer.render(scene,camera);},refreshLobby:renderLobby,close:closeS2,get state(){return {heroes:units.filter(u=>u.isHero).length,hp:myHero?.hp,shield:myHero?.shieldHp,children:scene?.children.length};}};`;
const fogHook=`window.__qa.fogCheck=()=>{
 const enemy=units.find(u=>u.isHero&&u.team!==myHero.team),saved={x:enemy.x,z:enemy.z};
 enemy.x=BASE_D.x;enemy.z=BASE_D.z;syncMesh(enemy);fogT=0;tickFog(1);enemy.mesh.visible=true;selectUnit(enemy);myHero.target=enemy;
 applyFogVisibility();drawMinimap();
 const p=Math.floor((BASE_D.x+MAP/2)/MAP*214),q=Math.floor((BASE_D.z+MAP/2)/MAP*214),pixel=Array.from(minimapCtx.getImageData(p,q,1,1).data);
 const hidden=!enemy.mesh.visible,baseHidden=BASE_D.visuals.every(m=>!m.visible),selectionCleared=!selUnit&&!myHero.target;
 enemy.x=myHero.x+3;enemy.z=myHero.z+3;syncMesh(enemy);fogT=0;tickFog(1);applyFogVisibility();const revealed=enemy.mesh.visible;
 enemy.x=BASE_D.x;enemy.z=BASE_D.z;syncMesh(enemy);tickUnit(enemy,.016);fogT=0;tickFog(1);applyFogVisibility();const hiddenAgain=!enemy.mesh.visible;
 enemy.x=saved.x;enemy.z=saved.z;syncMesh(enemy);
 return {hidden,baseHidden,selectionCleared,revealed,hiddenAgain,pixel,orthographic:camera.isOrthographicCamera,basesCorrect:BASE_R.x<BASE_D.x&&BASE_R.z>BASE_D.z};
};`;
const server=http.createServer((req,res)=>{
 if(req.url==='/')return res.end('<html><meta charset="utf-8"><body style="margin:0"><div id="tab-support2"></div><link rel="stylesheet" href="/hub-features.css"><script src="/three.min.js"></script><script src="/GLTFLoader.js"></script><script src="/SkeletonUtils.js"></script><script src="/support2-world.js"></script><script src="/support2-effects.js"></script><script src="/support2.js"></script></body></html>');
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');
 if(file.endsWith('support2.js'))return res.end(fs.readFileSync(file,'utf8').replace('  window.__s2Open = open;',hook+fogHook+'\n  window.__s2Open = open;'));
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGLProgram'))errors.push(m.text());});
 await page.route('**/*',r=>r.request().url().startsWith(origin)||r.request().url().startsWith('data:')?r.continue():r.abort());
 try{
  await page.goto(origin);await page.evaluate(()=>{__s2Open('fifflaren');__qa.pause();});
  await page.waitForFunction(()=>__qa.heroes.every(h=>h.portrait),null,{timeout:120000});
  await page.evaluate(()=>__qa.refreshLobby());assert.equal(await page.locator('.s2-heroCard').count(),15);
  await page.screenshot({path:path.join(out,'support2-lobby.png')});
  const checks=[];
  for(const id of ['cinder','vesper','briar']){
   await page.evaluate(id=>__qa.start(id),id);await page.waitForTimeout(250);
   const results=await page.evaluate(()=>{__qa.pause();return __qa.castAll();});
   assert(results.every(a=>a.ok&&a.cooldown>0&&Number.isFinite(a.damage)));assert.equal((await page.evaluate(()=>__qa.state)).heroes,10);
   await page.evaluate(()=>{S2Effects.update(.3);__qa.draw();});
   await page.screenshot({path:path.join(out,'support2-'+id+'.png')});
   await page.evaluate(()=>S2Effects.update(5));assert.equal(await page.evaluate(()=>S2Effects.count),0);
   checks.push({id,abilities:results});
  }
  const fog=await page.evaluate(()=>__qa.fogCheck());for(const field of ['hidden','baseHidden','selectionCleared','revealed','hiddenAgain','orthographic','basesCorrect'])assert.equal(fog[field],true,field);assert(fog.pixel[0]<30&&fog.pixel[1]<30&&fog.pixel[2]<30,'Hidden base must not appear on minimap');
  const stress=await page.evaluate(()=>{for(let i=0;i<80;i++)__qa.castAll();const count=S2Effects.count;S2Effects.update(5);return{count,remaining:S2Effects.count};});
  assert(stress.count<=36);assert.equal(stress.remaining,0);
  await page.evaluate(()=>__qa.close());await page.evaluate(()=>{__s2Open('fifflaren');__qa.pause();});assert.equal(await page.locator('.s2-shell').count(),1);
  await page.evaluate(()=>__qa.close());assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'support2-validation.json'),JSON.stringify({checks,fog,stress,errors},null,2));console.log('Support2 PASS: 15 heroes, 12 skills, fog reveal/hide, hidden base/minimap, selection, camera, VFX, close/reopen');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

