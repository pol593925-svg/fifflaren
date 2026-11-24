/* Real renderer, local assets, in-memory Electron adapters and mocked remote APIs.
 * No network request can leave this test browser. Use QA_OUTPUT / PLAYWRIGHT_PATH
 * to override the output or an existing Playwright installation.
 */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'../..');
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.PLAYWRIGHT_PATH||path.join(workspace,'work/qa/node_modules/playwright'));}
const out=process.env.QA_OUTPUT||path.join(workspace,'outputs/graphite-610');
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
 const ownProfile={username:'fifflaren',avatar:'',telegram:'fifflaren_team',status:'available',team:'fifflaren',position:'Руководитель',month:{label:'Ноябрь 2026',workedMinutes:4584,logs:284,shifts:12,closedCalls:19}};
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
  if(url.endsWith('/api/profile/me')){if(request.method()==='PATCH')Object.assign(ownProfile,request.postDataJSON());return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,profile:ownProfile})});}
  if(url.endsWith('/api/owner/dashboard'))return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,isOwner:true,updatedAt:new Date().toISOString(),stats:{pendingCalls:2,pendingNetwork:1,pendingLoans:0,requestedPoints:0,onlineEmployees:3,totalEmployees:4},requests:[],employees:[]})});
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
  const checks=[],layouts=[];
  await page.setViewportSize({width:1600,height:1000});
  await page.goto(origin+'/index.html');await page.waitForTimeout(350);
  assert(await page.locator('body.graphite').count());
  assert.equal(await page.locator('#authPass').count(),0,'No personal-pass card');
  await snap('login-dark-1600');
  await login('fifflaren');
  const later=page.locator('#braveIntro button').filter({hasText:'Позже'});if(await later.isVisible())await later.click();
  await page.waitForFunction(()=>document.getElementById('hubProfileChipName')?.textContent==='fifflaren');
  await page.evaluate(()=>{localStorage.setItem('shift_state',JSON.stringify({isWorking:true,startTimeMs:Date.now()-(2*3600+18*60+36)*1000,startTimeStr:'09:00',count:14}));loadShiftState();});
  async function headerLayout(){return page.evaluate(()=>{const boxes=[...document.querySelector('.hub-header').children].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(n).display!=='none'}).map(n=>({id:n.id||n.className,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}));const overlaps=[];for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a],y=boxes[b];if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlaps.push([x.id,y.id]);}return {width:innerWidth,boxes,overlaps,overflow:document.documentElement.scrollWidth>innerWidth+1}})}
  for(const [width,height]of [[1600,1000],[1200,800],[700,1000]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);const result=await headerLayout();assert.deepEqual(result.overlaps,[],JSON.stringify(result));assert(!result.overflow,JSON.stringify(result));layouts.push(result);await layout();await page.mouse.move(1,1);await snap('shift-dark-'+width);}
  checks.push('header and Shift no overlaps or horizontal overflow at1600/1200/700');
  await page.setViewportSize({width:1600,height:1000});
  await page.locator('.profile-hub-chip').click();await page.locator('#hubProfileDialog[open]').waitFor();await snap('profile-dark-1600');await page.keyboard.press('Escape');
  await page.locator('.orbit-call').click();await page.locator('#shiftCallDialog[open]').waitFor();await snap('new-call-dark');await page.keyboard.press('Escape');checks.push('profile and new-call modals retain opening controls');
  const before=await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--hub-bg').trim());
  await page.click('#themeToggleBtn');assert(await page.locator('body.light').count());
  const after=await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--hub-bg').trim());assert.notEqual(before,after);await snap('shift-light-1600');
  await page.locator('.profile-hub-chip').click();await snap('profile-light-1600');await page.keyboard.press('Escape');
  await page.click('#themeToggleBtn');assert.equal(await page.locator('body.light').count(),0);checks.push('theme toggle updates colors in both directions');
  for(const id of ['hq','mycalls','leave','notes','tasks','crypto','exchanges','loans','chat','pm','feed','radio','admin']){await navigate(id);await page.waitForTimeout(90);assert(await page.locator('#tab-'+id).isVisible(),'Working route '+id);assert(await page.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow on '+id);if(['exchanges','radio','chat','loans','admin'].includes(id))await snap(id+'-dark-1600');}
  checks.push('13 work/communication/admin panes open using original controls');
  await navigate('shift');await page.locator('.terra-dock [data-terra-tab="leisure"]').click();await page.locator('#hubLeisureDialog[open]').waitFor();await snap('leisure-dark');await page.keyboard.press('Escape');
  await page.click('#radioYouTubeButton');await page.locator('#radioYouTubeDialog[open]').waitFor();await snap('youtube-dark');await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>typeof window.THREE),'undefined');checks.push('leisure chooser keeps game engines lazy');
  assert.deepEqual(errors,[]);checks.push('no browser errors');
  const report={ok:true,checks,layouts,screens,remoteRequestsMocked:blocked.length};fs.writeFileSync(path.join(out,'theme-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(error){await snap('theme-failure');console.error('Browser errors',errors);throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
