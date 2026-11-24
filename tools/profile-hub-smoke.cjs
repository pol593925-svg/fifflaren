'use strict';
// Actual renderer, isolated Electron adapters, no production requests or mutations.
const {bootstrap,playwright,root,workspace}=require('./personal-desk-smoke.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const out=path.join(workspace,'outputs/profile-hub-610');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
 if(file.endsWith('index.html'))return res.end(fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',bootstrap+'<script src="game-loader.js">'));
 fs.createReadStream(file).pipe(res);
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:1080},locale:'ru-RU',timezoneId:'Europe/Kyiv',reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),checks=[],errors=[],screens=[],writes=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 const makeProfile=username=>({username,team:'Fifflaren',position:'Сотрудник команды',avatar:'',telegram:'',status:'available',month:{label:'Ноябрь 2026',from:'2026-11-01',to:'2026-11-30',shifts:12,logs:146,workedMinutes:2245,closedCalls:18,truffles:20,approves:4}});
 const profiles={fifflaren:makeProfile('fifflaren'),Mira:makeProfile('Mira')};let failGet=false,failSave=false,delay=0,statsMissing=false;
 await context.route('**/*',async route=>{
  const req=route.request(),url=req.url(),pathname=new URL(url).pathname;
  if(pathname==='/api/profile/me'){
   const owner=req.headers().authorization==='Bearer '+'m'.repeat(43)?'Mira':'fifflaren';
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   if(req.method()==='PATCH'){
    writes.push({owner,body:req.postDataJSON(),authorization:req.headers().authorization});
    if(failSave)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Сохранение временно недоступно.'})});
    Object.assign(profiles[owner],req.postDataJSON());
   }else if(failGet)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Профиль временно недоступен.'})});
   return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,profile:{...profiles[owner],...(statsMissing?{month:null,statsUnavailable:true}:{})}})});
  }
  if(url.startsWith(origin+'/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
  return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,teams:[],users:[],items:[],events:[],calls:[],messages:[],tasks:[],tracks:[],queue:[],posts:[],logs:[],loans:[],exchanges:{yes:[],no:[],conditional:[]},rev:0,position:0,now:Date.now(),space:{used:0,limit:1e10,online:false}})});
 });
 async function boot(username='fifflaren'){
  await page.goto(origin+'/index.html');
  if(!await page.evaluate(()=>!!window.HubProfile))await page.addScriptTag({url:origin+'/profile-hub.js'});
  if(!await page.locator('link[href="profile-hub.css"]').count())await page.addStyleTag({url:origin+'/profile-hub.css'});
  if(fs.existsSync(path.join(root,'graphite-theme.css')))await page.addStyleTag({url:origin+'/graphite-theme.css'});
  await page.evaluate(async ({username,origin})=>{
   HubReleaseIntro?.stop();document.body.classList.remove('hub-auth-visible','light');document.body.classList.add('graphite');document.getElementById('authScreen').style.display='none';
   HubRadio.start({username,token:(username==='Mira'?'m':'t').repeat(43),server:'https://profile-qa.invalid',io:require('socket.io-client').io});
   await HubProfile.start({username,token:(username==='Mira'?'m':'t').repeat(43),server:origin});
  },{username,origin});
 }
 const snap=async name=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});screens.push(file);};
 try{
  await boot();assert.equal(await page.locator('#hubProfileChipName').textContent(),'fifflaren');
  assert(await page.locator('#hubProfileButton').evaluate(node=>node.nextElementSibling.id==='hubRadio'));
  await page.click('#hubProfileButton');await page.waitForFunction(()=>!document.querySelector('#hubProfileSave').disabled);
  assert.equal(await page.inputValue('#hubProfileUsername'),'fifflaren');assert.equal(await page.locator('#hubProfileHours').textContent(),'37 ч 25 мин');assert.equal(await page.locator('#hubProfileLogs').textContent(),'146');
  checks.push('Header own profile and real server-supplied monthly hours/logs/shifts/calls');
  await page.fill('#hubProfileTelegram','@team_member');await page.selectOption('#hubProfileStatus','break');await page.click('#hubProfileSave');await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.startsWith('Сохранено'));
  assert.deepEqual(writes[0].body,{telegram:'team_member',status:'break'});assert.equal(writes[0].authorization,'Bearer '+'t'.repeat(43));assert.equal(await page.locator('#hubProfileChipStatus').textContent(),'Перерыв');
  checks.push('Authenticated partial save persists Telegram and status, updates chip');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'hubProfileButton');
  await boot();await page.click('#hubProfileButton');await page.waitForFunction(()=>!document.getElementById('hubProfileSave').disabled);assert.equal(await page.inputValue('#hubProfileTelegram'),'@team_member');assert.equal(await page.inputValue('#hubProfileStatus'),'break');checks.push('Saved profile survives full renderer reload');
  await page.fill('#hubProfileTelegram','@unsaved_name');await page.selectOption('#hubProfileStatus','dnd');await page.click('#hubProfileCancel');await page.click('#hubProfileButton');await page.waitForFunction(()=>!document.getElementById('hubProfileSave').disabled);assert.equal(await page.inputValue('#hubProfileTelegram'),'@team_member');assert.equal(await page.inputValue('#hubProfileStatus'),'break');checks.push('Closing discards unsaved profile edits');
  await page.fill('#hubProfileTelegram','https://bad.example');const beforeInvalid=writes.length;await page.click('#hubProfileSave');assert.equal(writes.length,beforeInvalid);assert((await page.locator('#hubProfileMessage').textContent()).includes('от 5 до 32'));await page.fill('#hubProfileTelegram','@team_member');checks.push('Telegram validation prevents invalid and external URLs');
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;const ctx=canvas.getContext('2d');ctx.fillStyle='#799f3b';ctx.fillRect(0,0,400,300);ctx.fillStyle='#e7f7c2';ctx.font='bold 180px sans-serif';ctx.fillText('F',130,210);return canvas.toDataURL('image/png').split(',')[1];});
  await page.setInputFiles('#hubProfileFile',{name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.startsWith('Фото готово'));
  assert.equal(await page.locator('#hubProfileChipAvatar img').count(),0,'Draft photo must not publish to chip');await page.click('#hubProfileSave');await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.startsWith('Сохранено'));assert(/^data:image\/jpeg;base64,/.test(profiles.fifflaren.avatar));assert(profiles.fifflaren.avatar.length<400000);assert.equal(await page.locator('#hubProfileChipAvatar img').count(),1);
  assert.deepEqual(await page.locator('#hubProfileChipAvatar img').evaluate(image=>[image.naturalWidth,image.naturalHeight]),[256,256]);checks.push('Avatar cropped/resized to256 JPEG, only published after server save');
  await page.setInputFiles('#hubProfileFile',{name:'script.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg></svg>')});await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.includes('JPG, PNG'));assert.equal(await page.locator('#hubProfileAvatar img').count(),1);checks.push('Unsupported files rejected without replacing current avatar');
  failSave=true;await page.fill('#hubProfileTelegram','@retry_name');await page.click('#hubProfileSave');await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.includes('Сохранение временно'));assert.equal(await page.inputValue('#hubProfileTelegram'),'@retry_name');assert.equal(profiles.fifflaren.telegram,'team_member');
  failSave=false;delay=300;await page.click('#hubProfileSave');assert(await page.locator('#hubProfileSave').isDisabled());await page.locator('#hubProfileSave').evaluate(node=>node.click());await page.keyboard.press('Escape');assert(await page.locator('#hubProfileDialog').evaluate(node=>node.open));await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.startsWith('Сохранено'));delay=0;assert.equal(profiles.fifflaren.telegram,'retry_name');checks.push('Failed save preserves draft; retry saves once, pending mutation cannot be dismissed');
  await page.selectOption('#hubProfileStatus','dnd');await page.click('#hubProfileSave');await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.startsWith('Сохранено'));await page.mouse.move(1,1);await snap('profile-desktop');
  await page.keyboard.press('Escape');await boot();assert.equal(await page.locator('#hubProfileChipAvatar img').count(),1);assert.equal(await page.locator('#hubProfileChipStatus').textContent(),'Не беспокоить');checks.push('Avatar and DND status restored from server after relaunch');
  await page.click('#hubProfileButton');await page.waitForFunction(()=>!document.getElementById('hubProfileSave').disabled);await page.click('#hubProfileRemovePhoto');assert.equal(await page.locator('#hubProfileChipAvatar img').count(),1);await page.click('#hubProfileSave');await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.startsWith('Сохранено'));assert.equal(profiles.fifflaren.avatar,'');assert.equal(await page.locator('#hubProfileChipAvatar img').count(),0);checks.push('Explicit saved avatar removal');
  statsMissing=true;await page.click('#hubProfileRefresh');await page.waitForFunction(()=>!document.getElementById('hubProfileSave').disabled);assert.equal(await page.locator('#hubProfileHours').textContent(),'—');assert((await page.locator('#hubProfileStatsNote').textContent()).includes('временно недоступна'));assert(!(await page.locator('#hubProfileSave').isDisabled()));statsMissing=false;checks.push('Unavailable stats show dash/retry while profile remains editable');
  failGet=true;await page.evaluate(()=>HubProfile.stop());await page.evaluate(origin=>HubProfile.start({username:'fifflaren',token:'t'.repeat(43),server:origin}),origin);await page.click('#hubProfileButton');await page.waitForFunction(()=>document.getElementById('hubProfileMessage').textContent.includes('Профиль временно'));assert(await page.locator('#hubProfileSave').isDisabled());failGet=false;await page.click('#hubProfileRefresh');await page.waitForFunction(()=>!document.getElementById('hubProfileSave').disabled);checks.push('Initial load failure disables editing until successful retry');
  delay=350;await page.evaluate(origin=>{HubProfile.open();setTimeout(()=>HubProfile.start({username:'Mira',token:'m'.repeat(43),server:origin}),20);},origin);await page.waitForFunction(()=>document.getElementById('hubProfileChipName').textContent==='Mira'&&document.getElementById('hubProfileChipStatus').textContent==='На связи');await page.waitForTimeout(450);delay=0;
  assert.equal(await page.locator('#hubProfileChipName').textContent(),'Mira');assert.equal(await page.inputValue('#hubProfileTelegram'),'');assert.equal(await page.locator('#hubProfileDialog[open]').count(),0);assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>String(value).includes('retry_name')||String(value).includes('t'.repeat(43)))),false);checks.push('Old asynchronous response cannot leak profile into another account; no token/avatar/TG browser storage');
  await page.setViewportSize({width:700,height:960});await page.click('#hubProfileButton');await page.waitForFunction(()=>!document.getElementById('hubProfileSave').disabled);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#hubProfileDialog').evaluate(node=>node.getBoundingClientRect().width<=innerWidth&&node.scrollWidth<=node.clientWidth+1));await snap('profile-700');checks.push('Responsive chip/dialog fit700px without horizontal overflow');
  await page.evaluate(()=>HubProfile.stop());assert(!(await page.locator('#hubProfileButton').isVisible()));assert.equal(await page.inputValue('#hubProfileUsername'),'');checks.push('Logout clears profile and closes dialog');
  assert.deepEqual(errors,[]);const report={ok:true,checks,screens,writes:writes.map(write=>({owner:write.owner,fields:Object.keys(write.body)}))};fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){await snap('profile-failure');console.error('BROWSER_ERRORS',JSON.stringify(errors));throw error;}
 finally{await browser.close();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
