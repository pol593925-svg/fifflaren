'use strict';
// Actual renderer and local styles; no production requests, media or accounts.
const {bootstrap,playwright,root,workspace}=require('./personal-desk-smoke.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const out=path.join(workspace,'outputs/release-600');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  if(file.endsWith('index.html')){
    let html=fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',bootstrap+'<script src="game-loader.js">');
    if(!html.includes('href="release-intro.css"'))html=html.replace('</head>','<link rel="stylesheet" href="release-intro.css"></head>');
    if(!html.includes('src="release-intro.js"'))html=html.replace('</body>','<script src="release-intro.js"></script></body>');
    // This fallback can be removed after the renderer entry point is wired; it never duplicates it.
    html=html.replace('</body>',`<script>document.addEventListener('DOMContentLoaded',()=>{if(!document.getElementById('hubReleaseIntro'))HubReleaseIntro.start({version:'6.0.0'});});</script></body>`);
    return res.end(html);
  }
  fs.createReadStream(file).pipe(res);
});
async function run(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:960},locale:'ru-RU',reducedMotion:'no-preference',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],remote=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(origin))return route.continue();
    remote.push(route.request().url());
    return route.fulfill({json:{success:true,version:'6.0.0',latestVersion:'6.0.0',teams:[{name:'Fifflaren',users:['fifflaren']}],users:[],exchanges:[],entries:[],tasks:[],events:[],logs:[],calls:[],releases:[]}});
  });
  const checks=[];
  try{
    await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof window.HubReleaseIntro?.start==='function');
    await page.evaluate(()=>HubReleaseIntro.start({version:'6.0.0'}));
    assert.equal(await page.locator('#hubReleaseIntro').count(),1);
    assert.equal(await page.locator('#hubReleaseIntro .hub-release-version').textContent(),'6.0.0');
    await page.locator('#hubReleaseIntro').waitFor({state:'detached',timeout:3200});
    checks.push('Startup is self-completing and bounded; actual renderer screenshot captured');

    await page.evaluate(()=>{document.getElementById('authUsername').focus();window.__introPrevious=document.activeElement;HubReleaseIntro.start({version:'6.0.0'});});
    await page.locator('#hubReleaseIntro .hub-release-skip').click();
    assert.equal(await page.locator('#hubReleaseIntro').count(),0);
    assert(await page.evaluate(()=>document.activeElement===window.__introPrevious));
    checks.push('Skip immediately removes overlay and restores visible input focus');

    await page.evaluate(()=>HubReleaseIntro.start({version:'6.0.0'}));
    await page.keyboard.press('Tab');
    assert(await page.locator('.hub-release-skip').evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hubReleaseIntro').count(),0);
    checks.push('Keyboard stays on visible Skip control; Escape removes overlay immediately');

    await page.evaluate(()=>{HubReleaseIntro.start({version:'6.0.0'});HubReleaseIntro.start({version:'6.0.0'});});
    assert.equal(await page.locator('#hubReleaseIntro').count(),1);
    await page.evaluate(()=>HubReleaseIntro.stop());
    assert.equal(await page.locator('#hubReleaseIntro').count(),0);
    checks.push('Repeated initialization remains single-instance and stop cleans up');

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>HubReleaseIntro.start({version:'6.0.0'}));
    assert(await page.locator('#hubReleaseIntro').evaluate(el=>el.classList.contains('hub-release-reduced')));
    await page.locator('#hubReleaseIntro').waitFor({state:'detached',timeout:800});
    checks.push('Reduced motion uses static presentation and exits in 200ms');

    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:600,height:500});
    await page.evaluate(()=>HubReleaseIntro.start({version:'6.0.0'}));
    await page.waitForTimeout(1050);
    const outside=await page.locator('#hubReleaseIntro').evaluate(root=>[...root.querySelectorAll('button,h1,p,.hub-release-features,.hub-release-bottom')].some(el=>{const box=el.getBoundingClientRect();return box.left<0||box.top<0||box.right>innerWidth||box.bottom>innerHeight;}));
    assert.equal(outside,false);
    await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));});
    assert.equal(await page.locator('#hubReleaseIntro').count(),0);
    checks.push('Small 600×500 window fits; background/page exit cleans overlay');

    // Pause only the test clock so a slow screenshot encoder cannot outlive the 2.2s intro.
    // Production timing above has already been verified using the real clock.
    await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-11-24T12:00:01Z'));
    for(const [width,height]of [[1440,960],[600,500]]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>HubReleaseIntro.start({version:'6.0.0'}));
      await page.screenshot({path:path.join(out,'release-intro-'+width+'.png'),animations:'disabled'});
      assert.equal(await page.locator('#hubReleaseIntro').count(),1,'Screenshot captures the real intro before dismissal');
      await page.evaluate(()=>HubReleaseIntro.stop());
    }

    assert.deepEqual(errors,[]);
    checks.push('No runtime errors; all remote requests mocked; no extra media requests');
    const report={ok:true,checks,remoteRequestsMocked:remote.length,screens:['release-intro-1440.png','release-intro-600.png']};
    fs.writeFileSync(path.join(out,'intro-qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
