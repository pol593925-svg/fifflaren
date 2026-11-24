'use strict';
// Real renderer and game-loader, with tiny instrumented game fixtures and blocked remote APIs.
const {bootstrap,playwright,root,workspace}=require('./personal-desk-smoke.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const out=path.join(workspace,'outputs/leisure-600');fs.mkdirSync(out,{recursive:true});
const fixtures={
  '/qa-engine.js':"window.__qaGames.loaded.push('engine');window.THREE={};",
  '/qa-cs16.js':"window.__qaGames.loaded.push('cs16');window.__cs16Configure=()=>{};window.__cs16Open=nick=>window.__qaGames.opened.push(['cs16',nick]);",
  '/qa-voxel.js':"window.__qaGames.loaded.push('voxel');window.HubVoxels={configure(){},open(){window.__qaGames.opened.push(['voxel']);},leave(){window.__qaGames.left++;}};"
};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(fixtures[pathname]){res.setHeader('Content-Type','text/javascript');return res.end(fixtures[pathname]);}
  const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  if(file.endsWith('index.html'))return res.end(fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',bootstrap+'<script src="game-loader.js">'));
  fs.createReadStream(file).pipe(res);
});
async function run(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,browser=await playwright.chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce',locale:'ru-RU',timezoneId:'Europe/Kyiv',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],remote=[],checks=[],screens=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',route=>{
    const request=route.request(),url=request.url();if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
    const pathname=new URL(url).pathname;remote.push(pathname);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,username:'fifflaren',role:'admin',team:'fifflaren',callsToken:'t'.repeat(43),teams:[{name:'fifflaren',users:['fifflaren']}],users:[],tasks:[],exchanges:[],events:[],calls:[],logs:[],loans:[],messages:[],items:[],posts:[],top:[],feed:[],balance:500,dailyAvailable:true})});
  });
  const snap=async name=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});screens.push(file);};
  try{
    await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.HubLeisure&&document.querySelector('[data-terra-tab="leisure"]'));
    const skip=page.getByRole('button',{name:'Пропустить',exact:true});if(await skip.isVisible().catch(()=>false))await skip.click();
    await page.evaluate(()=>{
      document.getElementById('authScreen').style.display='none';document.body.classList.remove('hub-auth-visible');currentUser='fifflaren';
      window.__qaGames={loaded:[],opened:[],left:0};
      for(const [id,source]of [['engine','qa-engine.js'],['cs16','qa-cs16.js'],['voxel','qa-voxel.js']])document.getElementById('game-scripts-'+id).innerHTML='<script src="'+source+'"></script>';
      HubGames.configure({username:'fifflaren',token:'t'.repeat(43),server:location.origin});
    });
    assert.equal(await page.locator('.terra-dock [data-terra-tab="cs16"]').count(),0);assert.equal(await page.locator('.terra-dock [data-terra-tab="leisure"]').count(),1);
    await page.click('[data-terra-tab="leisure"]');await page.locator('#hubLeisureDialog[open]').waitFor();
    assert.equal(await page.locator('[data-leisure-launch]').count(),3);assert.equal(await page.evaluate(()=>typeof window.THREE),'undefined');assert.deepEqual(await page.evaluate(()=>__qaGames.loaded),[]);
    checks.push('One bottom Leisure entry; chooser does not load any game engine');await snap('leisure-1440');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#hubLeisureDialog[open]').count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.terraTab),'leisure');
    checks.push('Escape dismisses chooser and restores keyboard focus');
    await page.click('[data-terra-tab="leisure"]');await page.click('[data-leisure-launch="cs16"]');await page.waitForFunction(()=>__qaGames.opened.length===1);
    assert.deepEqual(await page.evaluate(()=>__qaGames.loaded),['engine','cs16']);assert.deepEqual(await page.evaluate(()=>__qaGames.opened),[['cs16','fifflaren']]);assert.equal(await page.locator('#tab-cs16.active').count(),1);
    assert(await page.locator('[data-terra-tab="leisure"]').evaluate(node=>node.classList.contains('active')));checks.push('CS launches through original routing and only its game group loads');
    await page.click('[data-terra-tab="leisure"]');assert(await page.locator('[data-leisure-card="cs16"]').evaluate(node=>node.classList.contains('is-current')));assert.equal(await page.locator('[data-leisure-launch="cs16"]').textContent(),'Вернуться в игру');await page.keyboard.press('Escape');assert.equal(await page.locator('#tab-cs16.active').count(),1);checks.push('Current game is highlighted and closing chooser preserves current screen');
    await page.click('[data-terra-tab="leisure"]');await page.click('[data-leisure-launch="voxel"]');await page.waitForFunction(()=>__qaGames.opened.length===2);assert.deepEqual(await page.evaluate(()=>__qaGames.loaded),['engine','cs16','voxel']);assert.equal(await page.locator('#tab-voxel.active').count(),1);checks.push('Block world launches its original entry and reuses shared engine');
    const casinoBefore=remote.filter(pathname=>pathname==='/api/casino/state').length;await page.click('[data-terra-tab="leisure"]');await page.click('[data-leisure-launch="casino"]');await page.locator('#tab-casino.active').waitFor();await page.waitForFunction(()=>document.getElementById('casinoBalance').textContent==='500$');assert.equal(remote.filter(pathname=>pathname==='/api/casino/state').length,casinoBefore+1);assert.deepEqual(await page.evaluate(()=>__qaGames.loaded),['engine','cs16','voxel']);checks.push('Casino entry invokes original state load once without loading extra game scripts');
    await page.evaluate(()=>{const pane=document.createElement('section');pane.textContent='Custom workspace test';HubWorkspace.register({id:'qa-pane',label:'QA pane',element:pane});HubWorkspace.open('qa-pane');HubTerra.openMenu();});
    assert(!(await page.locator('.tabs [data-tab="cs16"]').isVisible()));assert(!(await page.locator('.tabs [data-tab="voxel"]').isVisible()));assert(!(await page.locator('.tabs [data-tab="casino"]').isVisible()));await page.click('[data-leisure-menu]');await page.locator('#hubLeisureDialog[open]').waitFor();await page.keyboard.press('Escape');assert(await page.locator('#tab-qa-pane').isVisible());checks.push('Single drawer entry hides duplicate games and does not hide active custom workspace panel');
    await page.click('[data-terra-tab="leisure"]');await page.click('.leisure-back');await page.locator('#tab-shift.active').waitFor();assert(!(await page.locator('[data-terra-tab="leisure"]').evaluate(node=>node.classList.contains('active'))));checks.push('Return to Shift uses existing workspace navigation and clears Leisure active state');
    await page.evaluate(()=>document.getElementById('adminTabBtn').click());await page.locator('#tab-admin.active').waitFor();assert(!(await page.locator('[data-terra-tab="leisure"]').evaluate(node=>node.classList.contains('active'))));checks.push('Admin navigation keeps Leisure unselected while chooser is closed');
    await page.setViewportSize({width:700,height:960});await page.click('[data-terra-tab="leisure"]');await snap('leisure-700');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#hubLeisureDialog').evaluate(node=>node.getBoundingClientRect().width<=innerWidth&&node.scrollWidth<=node.clientWidth+1));checks.push('700px chooser has no horizontal overflow and scrolls vertically');
    await page.evaluate(()=>document.querySelector('.tabs [data-tab="voxel"]').disabled=true);await page.waitForFunction(()=>document.querySelector('[data-leisure-launch="voxel"]').disabled);assert.equal(await page.evaluate(()=>HubLeisure.launch('voxel')),false);checks.push('Unavailable original game disables launch without bypassing existing restrictions');
    assert.deepEqual(errors,[]);checks.push('No browser runtime errors; all remote calls mocked');
    const report={ok:true,checks,screens};fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }catch(e){console.error('BROWSER_ERRORS',JSON.stringify(errors));await snap('leisure-failure');throw e;}
  finally{await browser.close();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
