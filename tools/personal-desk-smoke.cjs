/* Real renderer, local assets, in-memory Electron adapters and mocked remote APIs.
 * No network request can leave this test browser. Use QA_OUTPUT / PLAYWRIGHT_PATH
 * to override the output or an existing Playwright installation.
 */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'../..');
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_PATH||path.join(workspace,'work/qa/node_modules/playwright'));}
const out=process.env.QA_OUTPUT||path.join(workspace,'outputs/personal-desk-600');
fs.mkdirSync(out,{recursive:true});
const bootstrap=`<script>
window.__qaWrites={};window.__qaIpc=[];window.process={cwd:()=>'/isolated-test'};
const ipcHandlers={};const ipc={on:(n,f)=>{ipcHandlers[n]=f},removeListener(){},send:(...a)=>__qaIpc.push(a),invoke:async()=>null};
window.require=n=>{
 if(n==='fs')return {existsSync:p=>p in __qaWrites,readFileSync:p=>__qaWrites[p],writeFileSync:(p,v)=>__qaWrites[p]=v};
 if(n==='path')return {join:(...a)=>a.join('/')};
 if(n==='electron')return {ipcRenderer:ipc,desktopCapturer:{getSources:async()=>[]},webUtils:{getPathForFile:()=>'/isolated-test/media'}};
 if(n==='./assistance-stream')return {AssistanceStream:class{}};
 if(n==='./assistance-protocol')return {KEYS:{}};
 if(n==='socket.io-client')return {io:()=>({on(){return this},off(){return this},emit(){},disconnect(){},connected:true})};
 throw Error('Unmocked module '+n);
};
window.Audio=class{constructor(){this.volume=1;this.paused=true}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}addEventListener(){}removeEventListener(){}load(){}};
</script>`;
const server=http.createServer((req,res)=>{
 const requested=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+requested);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
 if(file.endsWith('index.html'))return res.end(fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',bootstrap+'<script src="game-loader.js">'));
 fs.createReadStream(file).pipe(res);
});
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:960},timezoneId:'Europe/Kyiv',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],writes=[],blocked=[],screens=[];
 let staff=false,staffReview=false,failNetwork=true;
 const networkIds=new Set();
 const tasks=[{_id:'task-1',text:'Прочитать передачу смены',done:['fifflaren']},{_id:'task-2',text:'Проверить очередь обращений',done:[]},{_id:'task-3',text:'Обновить рабочие заметки',done:[]}];
 const calls=[{id:'call-1',user:'fifflaren',createdAt:new Date().toISOString(),service:'Проверка доступа',kind:'Рабочая заявка',link:'https://example.com/request/1',note:'Уточнить доступ к командному календарю',status:'pending'},{id:'call-2',user:'fifflaren',createdAt:new Date(Date.now()-3600000).toISOString(),service:'Статус сервиса',kind:'Рабочая заявка',link:'https://example.com/request/2',note:'Проверка завершена',status:'done'}];
 const logs=[{id:'entry-1',user:'Alex',createdAt:new Date().toISOString(),comment:'Очередь проверена. Открытых вопросов нет.',link:'https://example.com/status'},{id:'entry-2',user:'Mira',createdAt:new Date(Date.now()-1800000).toISOString(),comment:'Передача смены готова.',link:'https://example.com/notes'}];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();
  if(url.startsWith(origin+'/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
  blocked.push(url);
  if(request.method()!=='GET')writes.push({url,method:request.method(),body:request.postData(),authorization:request.headers().authorization});
  if(url.startsWith('https://api.github.com/'))return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Isolated QA"}'});
  if(request.resourceType()==='document')return route.fulfill({status:403,contentType:'text/plain',body:'External document blocked by isolated QA'});
  if(url.includes('/api/loans'))return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,loans:[],total:0,hasMore:false})});
  if(url.endsWith('/api/calls/access'))return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,isOwner:!staff,canReview:!staff||staffReview,team:'fifflaren'})});
  if(url.includes('/api/owner/calls-access')){
   if(request.method()==='PATCH'&&url.endsWith('/Alex'))staffReview=request.postDataJSON().enabled===true;
   return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,users:[{username:'Alex',team:'fifflaren',canReview:staffReview},{username:'Mira',team:'fifflaren',canReview:true}]})});
  }
  if(url.endsWith('/api/calls/network-requests')&&request.method()==='POST'){
   await new Promise(resolve=>setTimeout(resolve,250));
   if(failNetwork){failNetwork=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Сервер временно недоступен.'})});}
   const payload=request.postDataJSON();
   if(!networkIds.has(payload.requestId)){networkIds.add(payload.requestId);calls.unshift({id:'network-1',user:staff?'Alex':'fifflaren',createdAt:new Date().toISOString(),service:'Скачать пасы',kind:'Заявка по сети',requestType:'network',link:payload.link,note:'',status:'pending',version:0});}
   return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,call:calls[0]})});
  }
  if(url.includes('/api/fifflaren/calls/')&&request.method()==='PATCH'){
   const row=calls.find(c=>url.endsWith('/'+c.id));if(row){Object.assign(row,request.postDataJSON());row.version++;}
   return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,call:row})});
  }
  if(url.includes('/api/tasks/toggle')){const payload=request.postDataJSON(),task=tasks.find(t=>t._id===payload.id);if(task)task.done=task.done.includes(payload.username)?task.done.filter(n=>n!==payload.username):task.done.concat(payload.username);}
  const data={success:true,username:staff?'Alex':'fifflaren',callsToken:'t'.repeat(43),role:staff?'search':'admin',isTL:!staff,team:'fifflaren',teams:[{name:'fifflaren',users:['fifflaren','Alex','Mira']}],users:[],calls,hasMore:false,total:calls.length,logs,tasks,matches:[],events:[],items:[],posts:[],messages:[],dialogs:[],queue:[],rev:0,now:Date.now(),position:0,tops:[],totals:[],stats:[],rows:[],balance:0,owned:[],equipped:'',exchanges:{yes:[],no:[],conditional:[]},links:{cola:'',sprite:'',fanta:''},tracks:[],before:null,film:null,title:'Вечер команды',startsAt:Date.now()+900000,phase:'scheduled',online:true,devices:[],space:{used:0,limit:1e10,online:false}};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const snap=async name=>{const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:false});screens.push(file);};
 const workButton=id=>page.locator('.desk-work-tab[data-work-tab="'+id+'"]');
 const navigate=async id=>{const work=workButton(id);if(await work.isVisible()){await work.click();return;}await page.evaluate(()=>HubTerra.openMenu());await page.locator('.tabs [data-tab="'+id+'"]').click();};
 async function login(name){
  await page.goto(origin+'/index.html');
  assert.equal(await page.locator('.hub-comic').count(),0,'Removed intro comic must not mount');
  assert.equal(await page.locator('script[src="startup-voice.js"]').count(),0,'Entry voice must not load');
  const skip=page.locator('.comic-skip');if(await skip.isVisible())await skip.click();
  await page.fill('#authUsername',name);await page.fill('#authPassword','isolated-test');await page.click('#authSubmitBtn');
  await page.waitForFunction(()=>document.getElementById('authScreen').style.display==='none');
  await page.locator('#tab-shift.active .my-calls-panel').waitFor();
  await page.waitForFunction(()=>document.body.classList.contains('personal-desk'));
 }
 async function noSupport(){
  assert.equal(await page.locator('#support-chat-toggle,#support-chat-panel').count(),0,'Floating support integration must be removed');
  assert.equal(await page.locator('script[src="support-chat.js"]').count(),0,'Support chat script must not load');
  assert.equal(await page.locator('.tabs [data-tab="support"], [data-terra-tool="support"]').count(),0,'Support entry points must be removed');
  assert.equal(blocked.filter(u=>/tawk\.to|tawk\.link/.test(u)).length,0,'No hidden external support iframe requests');
 }
 async function layout(){
  const result=await page.evaluate(()=>{
   const rects=[...document.querySelectorAll('#tab-shift > .card,#tab-shift > .my-calls-panel,#tab-shift > section')].filter(el=>el.getBoundingClientRect().width&&getComputedStyle(el).display!=='none').map(el=>({id:el.id||el.className,...Object.fromEntries(['left','right','top','bottom','width','height'].map(k=>[k,el.getBoundingClientRect()[k]]))}));
   const overlaps=[];for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++){const x=rects[a],y=rects[b];if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2)overlaps.push([x.id,y.id]);}
   const shiftMetrics=[...document.querySelectorAll('.terra-shift-card,.terra-shift-card > *,.shift-orbit-core,.shift-orbit-core > *,.terra-shift-actions,.terra-shift-actions > *,.terra-shift-secondary,.terra-work-tools')].map(el=>{const style=getComputedStyle(el);return {tag:el.tagName,id:el.id,cls:el.className,height:el.getBoundingClientRect().height,margin:style.margin,padding:style.padding,gap:style.gap,display:style.display};});
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overlaps,rects,shiftMetrics};
  });
  assert(result.scrollWidth<=result.width+1,'Page horizontal overflow at '+result.width+': '+result.scrollWidth);
  assert.deepEqual(result.overlaps,[],'Shift sections overlap at '+result.width);
  return result;
 }
 try{
  await login('fifflaren');await noSupport();
  assert(await page.locator('.orbit-addOneBtn').isDisabled(),'Log action disabled before shift');
  await page.click('#startBtn');assert(await page.locator('#stopBtn').isVisible());
  await page.locator('.orbit-call').click();await page.locator('#shiftCallDialog[open]').waitFor();
  await page.fill('#callServiceName','Командный календарь');await page.fill('#callLinkInput','https://example.com/request/new');await page.fill('#callNoteInput','Проверить доступ к рабочему календарю');
  await snap('personal-desk-call-dialog');
  await page.click('#sendCallBtn');await page.waitForFunction(()=>!document.getElementById('shiftCallDialog').open);
  assert(writes.some(r=>r.url.endsWith('/api/events')&&JSON.parse(r.body||'{}').serviceName==='Командный календарь'),'Existing new-call handler still submits once');
  assert.equal(writes.filter(r=>r.url.endsWith('/api/events')&&JSON.parse(r.body||'{}').serviceName==='Командный календарь').length,1,'No duplicate new-call handlers');
  await page.click('#stopBtn');await page.locator('#reportBox').waitFor({state:'visible'});
  assert(await page.locator('.orbit-addOneBtn').isDisabled(),'Finishing shift disables log action');
  assert((await page.locator('#reportBox').textContent()).includes('fifflaren'),'Report retained');
  await page.click('#resetShiftBtn');await page.click('#startBtn');
  await page.evaluate(()=>{localStorage.setItem('shift_state',JSON.stringify({isWorking:true,startTimeMs:Date.now()-(2*3600+18*60+36)*1000,startTimeStr:'09:00',count:14}));loadShiftState();});
  await page.waitForTimeout(200);
  const layouts=[];
  for(const [width,height] of [[1440,960],[1000,800],[700,900]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);layouts.push(await layout());await snap('personal-desk-shift-'+width);}
  await page.setViewportSize({width:1440,height:960});
  await workButton('loans').click();await page.locator('#tab-loans.active').waitFor();
  assert.equal(await page.locator('#hubPageTitle').textContent(),'Смена','Custom work section stays under Shift');
  await navigate('shift');assert(!(await page.locator('#tab-loans').isVisible()),'Returning to built-in section hides custom pane');
  for(const id of ['hq','mycalls','leave','notes','tasks','crypto','exchanges'])assert(await workButton(id).isVisible(),'Work section is accessible under Shift: '+id);
  assert.equal(await page.locator('.terra-dock [data-terra-tab="exchanges"]:visible,.terra-dock [data-terra-tab="tasks"]:visible').count(),0,'Work sections no longer duplicate dock entries');
  await page.click('.desk-configure');await page.locator('#personalDeskSettings[open]').waitFor();
  await page.locator('#personalDeskSettings input[name="feed"]').uncheck();
  assert(!(await page.locator('#teamLogFeed').isVisible()),'Personal settings hide selected card');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hub-personal-desk:fifflaren')).feed),false,'Preferences stored for current account');
  await page.locator('#personalDeskSettings input[name="feed"]').check();await page.keyboard.press('Escape');
  await navigate('tasks');await page.locator('#tasksList .task-item').first().waitFor();
  await page.locator('#tasksList .task-item').nth(1).locator('input').check();
  await page.waitForFunction(()=>document.querySelectorAll('#tasksList .task-item')[1]?.classList.contains('done'));
  assert(writes.some(r=>r.url.endsWith('/api/tasks/toggle')&&JSON.parse(r.body).id==='task-2'),'Reused checklist keeps real toggle handler');
  await page.keyboard.press('Escape');await navigate('shift');
  await page.locator('#tab-shift #tasksList').waitFor({state:'visible'});
  await page.click('#networkRequestButton');await page.locator('#networkRequestDialog[open]').waitFor();
  await page.fill('#networkRequestLink','https://example.com/network/request-1');await snap('personal-desk-network-dialog');
  await page.click('#networkRequestSubmit');assert(await page.locator('#networkRequestSubmit').isDisabled(),'Network submit locked while in flight');
  await page.locator('#networkRequestSubmit').evaluate(el=>el.click());
  await page.waitForFunction(()=>!document.getElementById('networkRequestSubmit').disabled);
  assert((await page.locator('#networkRequestStatus').textContent()).includes('Ссылка сохранена'),'Failure preserves retry guidance');
  assert.equal(await page.inputValue('#networkRequestLink'),'https://example.com/network/request-1','Failure preserves link');
  await page.click('#networkRequestSubmit');await page.waitForFunction(()=>!document.getElementById('networkRequestDialog').open);
  const networkWrites=writes.filter(r=>r.url.endsWith('/api/calls/network-requests'));
  assert.equal(networkWrites.length,2,'One failed request and one retry, no duplicate while disabled');
  assert.equal(JSON.parse(networkWrites[0].body).requestId,JSON.parse(networkWrites[1].body).requestId,'Retry retains idempotency key');
  assert(networkWrites.every(r=>r.authorization==='Bearer '+'t'.repeat(43)),'Network request uses session authentication');
  await page.locator('#myCallsList .call-network-request').waitFor();
  assert((await page.locator('#myCallsList .call-network-request').textContent()).includes('В ожидании'),'Personal history shows pending network request');
  await navigate('mycalls');await page.locator('#callsList .call-network-request').waitFor();
  await page.locator('#callsList .call-network-request .call-done-action').click();
  await page.waitForFunction(()=>document.querySelector('#callsList .call-network-request .call-done')?.textContent==='Сделано');
  await page.click('#teamCallsAccessButton');await page.locator('#teamCallsAccessDialog[open]').waitFor();
  await page.locator('#teamCallsAccessList input[aria-label="Доступ к коллам: Alex"]').check();
  await page.waitForFunction(()=>document.getElementById('teamCallsAccessStatus').textContent.includes('Доступ выдан'));
  assert(writes.some(r=>r.url.endsWith('/api/owner/calls-access/Alex')&&JSON.parse(r.body).enabled===true),'Owner grants access using scoped API');
  await snap('personal-desk-access-dialog');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await navigate('notes');assert(await page.locator('#userNotes').isVisible());await page.keyboard.press('Escape');
  await navigate('chat');assert(await page.locator('#tab-chat').isVisible(),'Team chat remains available');
  await navigate('shift');
  assert.equal(await page.evaluate(()=>typeof window.THREE),'undefined','Work screens must keep game engine lazy');
  await page.click('#themeToggleBtn');await snap('personal-desk-night');await page.click('#themeToggleBtn');
  staff=true;await page.reload();const skip=page.locator('.comic-skip');if(await skip.isVisible())await skip.click();
  await page.fill('#authUsername','Alex');await page.fill('#authPassword','isolated-test');await page.click('#authSubmitBtn');await page.locator('#tab-shift.active .my-calls-panel').waitFor();
  await noSupport();await page.evaluate(()=>HubTerra.openMenu());
  for(const id of ['admin','radio','tlpanel'])assert(!(await page.locator('.tabs [data-tab="'+id+'"]').isVisible()),'Delegated staff cannot access '+id);
  assert(await workButton('mycalls').isVisible()||await page.locator('.tabs [data-tab="mycalls"]').isVisible(),'Delegated staff can see team calls');
  assert(!(await page.locator('#teamCallsAccessButton').isVisible()),'Delegated staff cannot grant permissions');
  await snap('personal-desk-staff-menu');await page.keyboard.press('Escape');
  await navigate('mycalls');await page.locator('#callsList .call-network-request').waitFor();
  staffReview=false;
  await page.evaluate(()=>{const handlers={};HubCalls.subscribe({emit(){},on:(n,f)=>handlers[n]=f});handlers.calls_access_changed({canReview:false,isOwner:false,team:'fifflaren'});});
  await page.waitForFunction(()=>document.getElementById('callsTabBtn').style.display==='none');
  assert.equal(await page.locator('#callsList .call-entry').count(),0,'Revocation clears visible team data');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[],'No browser runtime errors');
  const report={ok:true,checks:['start/end shift','existing new-call submission once','support entry points and network removed','intro comic and entry voice removed','responsive no overflow/overlap','all work sections grouped under Shift','custom work pane hides when returning to built-in screen','personal card preferences scoped to account','checklist handlers survive moves between sections','team chat and notes retained','authenticated network request failure/retry with stable request ID','pending personal history and owner Done action','owner grant UI','delegated review without admin privileges','live revocation clears data','game engine remains lazy','no browser errors'],layouts,remoteRequestsMocked:blocked.length,screens};
  fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){console.error('BROWSER_ERRORS',JSON.stringify(errors));await snap('personal-desk-failure');throw error;}
 finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports={bootstrap,playwright,root,workspace};
if(require.main===module)run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
