const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']});try{
 const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.ANIME_URL||'http://127.0.0.1:50716');await page.waitForFunction(()=>window.anime?.ready,null,{timeout:60000});await page.evaluate(()=>anime.start(false));await page.waitForTimeout(1500);
 const checks=[];for(const id of ['flame','frost','wind','stone','light','fox','dragon','owl','golem','deer']){
  const out=await page.evaluate(id=>{const a=anime;a.spellEffects.clear();a.castSkill(id);a.step(.26);a.renderer.render(a.scene,a.camera);return a.spellEffects.metrics()},id);assert.equal(out.effects,1,id);checks.push({id,...out});
 }
 const shots=[['04-ice.png','frost'],['05-fire.png','flame'],['06-healing.png','light']];
 for(const [file,id]of shots){await page.evaluate(id=>{anime.spellEffects.clear();anime.reset();anime.view(-.5,0,4,.06,-.09);document.getElementById('hero-skill').value=id;anime.castSkill(id)},id);await page.waitForTimeout(360);await page.screenshot({path:path.join(__dirname,'screenshots',file)})}
 const limits=await page.evaluate(()=>{const a=anime;a.spellEffects.clear();for(let i=0;i<45;i++)a.castSkill('stone');const high=a.spellEffects.metrics();a.setQuality('low');for(let i=0;i<45;i++)a.castSkill('light');const low=a.spellEffects.metrics();a.step(10);const clean=a.spellEffects.metrics();a.setQuality('high');return{high,low,clean}});
 assert.equal(limits.high.effects,16);assert.equal(limits.low.effects,8);assert.equal(limits.clean.effects,0);
 // Measure actual requestAnimationFrame intervals during a repeated 10-player ability burst.
 const stress=await page.evaluate(async()=>{const a=anime,ids=Object.keys(CS16SpellEffects.styles),times=[];a.spellEffects.clear();let before=performance.now();await new Promise(resolve=>{let n=0;function tick(t){if(n%30===0)for(const id of ids)a.castSkill(id);times.push(t-before);before=t;if(++n>=240)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)});times.shift();times.sort((a,b)=>a-b);return{p50ms:times[Math.floor(times.length*.50)],p95ms:times[Math.floor(times.length*.95)],maxms:times[times.length-1],...a.snapshot()}});
 assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(__dirname,'screenshots/effects-checks.json'),JSON.stringify({checks,limits,stress,errors},null,2));console.log('EFFECTS_PASS',JSON.stringify({limits,stress}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
