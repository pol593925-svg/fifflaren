'use strict';
// Real renderer with isolated fixtures. All remote requests are intercepted.
const {bootstrap,playwright,root}=require('./personal-desk-smoke.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const out=path.join(root,'qa','calls-requests');fs.mkdirSync(out,{recursive:true});
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
 const page=await context.newPage(),errors=[],checks=[],screens=[],writes=[],external=[];page.setDefaultTimeout(10000);
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 const photo=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#749353';ctx.fillRect(0,0,96,96);ctx.fillStyle='#f1ffd9';ctx.font='bold 60px Arial';ctx.textAlign='center';ctx.fillText('A',48,69);return canvas.toDataURL('image/png');});
 const alternatePhoto=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#536f93';ctx.fillRect(0,0,96,96);ctx.fillStyle='#eff6ff';ctx.font='bold 60px Arial';ctx.textAlign='center';ctx.fillText('A',48,69);return canvas.toDataURL('image/png');});
 let actor='alex',failPost=true,delay=300,authors={alex:{avatar:photo},mira:{avatar:''},unsafe:{avatar:'https://avatar.example/track.png'}},emptyAuthors=false;
 const now=new Date().toISOString();
 const logs=[{id:'feed-1',user:'Alex',createdAt:now,comment:'Очередь проверена. Открытых вопросов нет.',link:'https://example.com/status'},{id:'feed-2',user:'Mira',createdAt:now,comment:'Передача смены готова.',link:'https://example.com/notes'},{id:'feed-3',user:'Unsafe',createdAt:now,comment:'Проверка отображения профиля.',link:'https://example.com/check'}];
 const calls=[{id:'111111111111111111111111',user:'Alex',createdAt:now,service:'Рабочий календарь',kind:'Колл на почту',link:'https://example.com/calendar',note:'Проверить рабочий доступ',status:'pending',version:0,history:[]},{id:'222222222222222222222222',user:'Mira',createdAt:now,service:'Передача смены',kind:'Колл на почту',link:'https://example.com/handover',note:'Сводка подготовлена',status:'done',version:0,history:[]}];
 const hunts={alex:[{id:'a'.repeat(24),url:'https://example.com/existing-hunt',note:'Первый хант · доступ проверен',createdAt:now}],mira:[{id:'b'.repeat(24),url:'https://example.com/mira-hunt',note:'Личный хант Mira',createdAt:now}],fifflaren:[]};
 const ids=new Map();let sequence=0,huntSequence=0;
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url(),pathname=new URL(url).pathname,method=request.method();
  if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
  external.push(url);const body=['GET','DELETE'].includes(method)?null:request.postDataJSON();
  if(method!=='GET')writes.push({pathname,method,body,authorization:request.headers().authorization});
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(pathname==='/api/profile/me')return reply({success:true,profile:{username:actor,avatar:authors[actor]?.avatar||'',telegram:'',status:'available',team:'fifflaren',month:{label:'Ноябрь 2026',shifts:12,logs:86,workedMinutes:1800,closedCalls:7,truffles:0,approves:0}}});
  if(pathname==='/api/calls/access')return reply({success:true,isOwner:actor==='fifflaren',canReview:actor==='fifflaren',team:'fifflaren'});
  if(pathname==='/api/hunts/mine'&&method==='GET')return reply({success:true,hunts:hunts[actor]||[],limit:20});
  if(pathname==='/api/hunts/mine'&&method==='POST'){
   if(!hunts[actor])hunts[actor]=[];if(hunts[actor].length>=20)return reply({success:false,message:'Уже сохранено 20 хантов.'},409);
   hunts[actor].unshift({id:(++huntSequence).toString(16).padStart(24,'0'),url:body.url,note:body.note,createdAt:new Date().toISOString()});return reply({success:true,hunts:hunts[actor],limit:20},201);
  }
  if(pathname.startsWith('/api/hunts/mine/')&&method==='DELETE'){
   const id=pathname.split('/').pop();hunts[actor]=(hunts[actor]||[]).filter(row=>row.id!==id);return reply({success:true,hunts:hunts[actor],limit:20});
  }
  if(pathname.startsWith('/api/fifflaren/hunts/')&&method==='GET'){
   if(actor!=='fifflaren')return reply({success:false,message:'Нет доступа'},403);const username=decodeURIComponent(pathname.split('/').pop());return reply({success:true,username,hunts:hunts[username]||[],limit:20});
  }
  if(pathname==='/api/calls/log-requests'&&method==='POST'){
   const author=actor;await new Promise(resolve=>setTimeout(resolve,delay));
   if(failPost){failPost=false;return reply({success:false,message:'Сервер временно недоступен.'},503);}
   if(!ids.has(body.requestId)){const row={id:(++sequence+32).toString(16).padStart(24,'0'),user:author,createdAt:now,requestType:'logs',quantity:body.quantity,kind:'Запросить логов',service:'Запрос логов · '+body.quantity,link:'',note:'',status:'pending',version:0,history:[]};ids.set(body.requestId,row);calls.unshift(row);}
   return reply({success:true,call:ids.get(body.requestId)});
  }
  if(pathname.startsWith('/api/fifflaren/calls/')&&method==='PATCH'){
   const row=calls.find(row=>pathname.endsWith('/'+row.id));Object.assign(row,{status:body.status,reason:body.reason,version:row.version+1});return reply({success:true,call:row});
  }
  if(pathname.startsWith('/api/calls/mine/')&&method==='PATCH'){
   const row=calls.find(row=>pathname.endsWith('/'+row.id));Object.assign(row,{quantity:body.quantity,service:'Запрос логов · '+body.quantity,status:'pending',reason:'',version:row.version+1});return reply({success:true,call:row});
  }
  if(pathname==='/api/calls/mine'){const mine=calls.filter(row=>row.user.toLowerCase()===actor);return reply({success:true,calls:mine,authors:emptyAuthors?{}:authors,total:mine.length,hasMore:false});}
  if(pathname==='/api/fifflaren/calls')return reply({success:true,calls,authors:emptyAuthors?{}:authors,total:calls.length,hasMore:false,team:'fifflaren'});
  if(pathname==='/api/logs/team')return reply({success:true,logs,authors:emptyAuthors?{}:authors});
  if(url.startsWith('https://api.github.com/'))return reply({message:'Isolated QA'},503);
  return reply({success:true,username:actor,callsToken:'t'.repeat(43),role:actor==='fifflaren'?'admin':'search',isTL:false,team:'fifflaren',teams:[{name:'fifflaren',users:['fifflaren','alex','mira']}],users:[],calls:[],total:0,hasMore:false,logs:[],tasks:[],events:[],items:[],posts:[],messages:[],dialogs:[],queue:[],rev:0,now:Date.now(),position:0,tops:[],totals:[],stats:[],rows:[],tracks:[],loans:[],exchanges:{yes:[],no:[],conditional:[]},space:{used:0,limit:1e10,online:false},online:false});
 });
 const snap=async name=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});screens.push(file);};
 const requestWrites=()=>writes.filter(write=>write.pathname==='/api/calls/log-requests');
 async function login(name){actor=name;await page.goto(origin+'/index.html');await page.evaluate(()=>HubReleaseIntro?.stop());await page.fill('#authUsername',name);await page.fill('#authPassword','isolated-qa');await page.click('#authSubmitBtn');await page.waitForFunction(()=>document.getElementById('authScreen').style.display==='none');await page.locator('#logRequestButton').waitFor();await page.locator('#teamLogList .team-log-entry').first().waitFor();}
 async function navigate(id){await page.locator('.desk-work-tab[data-work-tab="'+id+'"]').click();}
 try{
  await login('alex');
  await page.waitForFunction(()=>document.querySelector('#teamLogList [data-author="alex"] img')?.naturalWidth>0);
  assert.equal(await page.locator('#teamLogList [data-author="alex"] img').count(),1);assert.equal(await page.locator('#myCallsList [data-author="alex"] img').count(),1);
  assert.equal(await page.locator('#teamLogList [data-author="mira"] img').count(),0);assert.match(await page.locator('#teamLogList [data-author="mira"]').textContent(),/M/i);
  assert.equal(await page.locator('#teamLogList [data-author="unsafe"] img').count(),0);assert(!external.some(url=>url.startsWith('https://avatar.example/')));
  checks.push('Feed and personal call show author image, missing/unsafe photos use initial without external fetch');
  assert(await page.locator('#logRequestButton').evaluate(node=>node.previousElementSibling.id==='networkRequestButton'),'New action must follow existing network action');
  await page.evaluate(()=>{localStorage.setItem('shift_state',JSON.stringify({isWorking:true,startTimeMs:Date.now()-7200000,startTimeStr:'09:00',count:14}));loadShiftState();});
  await snap('shift-avatars-1600');
  assert(await page.locator('#myHuntsPanel').evaluate(node=>node.parentElement===document.querySelector('#tab-shift .my-calls-panel')));assert.equal(await page.locator('#myHuntsCount').textContent(),'1 / 20');
  const huntWrites=()=>writes.filter(write=>write.pathname==='/api/hunts/mine');
  await page.fill('#huntUrl','javascript:alert(1)');await page.fill('#huntNote','Небезопасная ссылка');await page.click('#huntAddButton');assert.equal(huntWrites().length,0);
  await page.fill('#huntUrl','https://example.com/new-hunt');await page.fill('#huntNote','Новый хант · описание сотрудника');await page.click('#huntAddButton');await page.waitForFunction(()=>document.getElementById('myHuntsList').textContent.includes('Новый хант · описание сотрудника'));
  assert.equal(huntWrites().length,1);assert.equal(huntWrites()[0].authorization,'Bearer '+'t'.repeat(43));assert.equal(await page.locator('#myHuntsCount').textContent(),'2 / 20');await snap('shift-hunts-1600');
  const oldHunt=page.locator('#myHuntsList .hunt-entry').filter({hasText:'existing-hunt'});await oldHunt.locator('.hunt-remove').click();await page.waitForFunction(()=>!document.getElementById('myHuntsList').textContent.includes('existing-hunt'));
  assert(writes.some(write=>write.method==='DELETE'&&write.pathname==='/api/hunts/mine/'+'a'.repeat(24)));assert.equal(await page.locator('#myHuntsCount').textContent(),'1 / 20');checks.push('Personal hunts sit below My calls, reject unsafe links, save with description and delete through authenticated API');
  await page.click('#logRequestButton');await page.locator('#logRequestDialog[open]').waitFor();
  for(const invalid of ['0','-1','1.5','100001']){await page.fill('#logRequestQuantity',invalid);await page.click('#logRequestSubmit');assert.equal(requestWrites().length,0,'Invalid quantity must not submit: '+invalid);}
  await page.fill('#logRequestQuantity','25');await snap('request-dialog-1600');
  await page.click('#logRequestSubmit');assert(await page.locator('#logRequestSubmit').isDisabled());await page.locator('#logRequestSubmit').evaluate(node=>node.click());
  await page.waitForFunction(()=>!document.getElementById('logRequestSubmit').disabled);assert.equal(requestWrites().length,1);assert.equal(await page.inputValue('#logRequestQuantity'),'25');
  assert((await page.locator('#logRequestStatus').textContent()).includes('Сервер временно недоступен'));
  await page.click('#logRequestSubmit');await page.waitForFunction(()=>!document.getElementById('logRequestDialog').open);
  assert.equal(requestWrites().length,2);assert.equal(requestWrites()[0].body.requestId,requestWrites()[1].body.requestId);assert.deepEqual(Object.keys(requestWrites()[1].body).sort(),['quantity','requestId']);assert.equal(requestWrites()[1].authorization,'Bearer '+'t'.repeat(43));
  await page.waitForFunction(()=>document.getElementById('myCallsList').textContent.includes('25'));
  const quantityCard=page.locator('#myCallsList .call-entry').filter({hasText:'Запрос логов · 25'});assert(await quantityCard.isVisible());assert.equal(await quantityCard.locator('.call-copy-link').count(),0);
  checks.push('Quantity validation, disabled duplicate submission, stable retry key, authenticated count-only request and personal pending history');
  await page.click('#logRequestButton');await page.fill('#logRequestQuantity','10');await page.click('#logRequestSubmit');await page.waitForFunction(()=>!document.getElementById('logRequestDialog').open);assert.equal(requestWrites().length,3);assert.notEqual(requestWrites()[2].body.requestId,requestWrites()[1].body.requestId);checks.push('New intentional request receives a new idempotency key');
  authors.alex.avatar=alternatePhoto;await page.waitForFunction(()=>document.getElementById('myCallsList').textContent.includes('Запрос логов · 10'));
  await page.evaluate(photo=>document.dispatchEvent(new CustomEvent('hub:profile-updated',{detail:{username:'alex',avatar:photo}})),alternatePhoto);
  assert((await page.locator('#teamLogList [data-author="alex"] img').getAttribute('src'))===alternatePhoto);assert((await page.locator('#myCallsList [data-author="alex"] img').first().getAttribute('src'))===alternatePhoto);checks.push('Saved profile change refreshes existing feed and call avatars without page reload');
  authors.alex.avatar=photo;await page.evaluate(()=>HubCalls.loadMine());assert((await page.locator('#myCallsList [data-author="alex"] img').first().getAttribute('src'))===alternatePhoto);assert((await page.locator('#teamLogList [data-author="alex"] img').getAttribute('src'))===alternatePhoto);authors.alex.avatar=alternatePhoto;checks.push('Older list response cannot overwrite newly saved own avatar');
  await login('fifflaren');await navigate('mycalls');await page.waitForFunction(()=>document.getElementById('callsList').textContent.includes('Запрос логов · 25'));
  const ownerCard=page.locator('#callsList .call-entry').filter({hasText:'Запрос логов · 25'});assert.equal(await ownerCard.locator('[data-author="alex"] img').count(),1);await snap('team-inbox-1600');
  await ownerCard.locator('.call-author-name').click();await page.locator('#teamHuntsDialog[open]').waitFor();await page.waitForFunction(()=>document.getElementById('teamHuntsList').textContent.includes('Новый хант · описание сотрудника'));
  assert.match(await page.locator('#teamHuntsTitle').textContent(),/alex/i);assert.equal(await page.locator('#teamHuntsList .hunt-entry').count(),1);assert(!(await page.locator('#teamHuntsList').textContent()).includes('mira-hunt'));await snap('team-hunts-1600');await page.keyboard.press('Escape');checks.push('Owner opens the selected employee hunts from the team-call nickname without exposing another employee list');
  await ownerCard.locator('.call-done-action').click();await page.waitForFunction(()=>[...document.querySelectorAll('#callsList .call-entry')].some(node=>node.textContent.includes('Запрос логов · 25')&&node.querySelector('.call-done')));assert.equal(calls.find(row=>row.quantity===25).status,'done');checks.push('Owner sees request with author avatar and marks Done through existing review API');
  const returned=calls.find(row=>row.quantity===10);returned.status='returned';returned.reason='Уточни количество';returned.version=1;
  await login('alex');await page.getByRole('button',{name:'Исправить и отправить повторно'}).click();const repair=page.locator('#myCallsList .call-quantity-repair');await repair.waitFor();await repair.locator('input[name="quantity"]').fill('12');await repair.locator('button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('.call-quantity-repair'));
  assert.equal(returned.quantity,12);assert.equal(returned.status,'pending');const correction=writes.find(write=>write.pathname.endsWith('/'+returned.id)&&write.pathname.startsWith('/api/calls/mine/'));assert.deepEqual(Object.keys(correction.body).sort(),['quantity','version']);checks.push('Returned quantity request can be corrected and resubmitted without irrelevant link fields');
  for(const width of [1600,1000,700]){await page.setViewportSize({width,height:1080});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow at '+width);await page.click('#logRequestButton');assert(await page.locator('#logRequestDialog').evaluate(node=>node.getBoundingClientRect().width<=innerWidth&&node.scrollWidth<=node.clientWidth+1));await page.keyboard.press('Escape');}
  await snap('shift-avatars-700');checks.push('Avatar cards and quantity dialog fit1600/1000/700 without horizontal overflow');
  emptyAuthors=true;actor='mira';await page.evaluate(()=>HubCalls.start({username:'mira',token:'m'.repeat(43),server:'https://calls-qa.invalid',io:require('socket.io-client').io,notify(){}}));await page.waitForTimeout(350);
  assert.equal(await page.locator('#teamLogList [data-author="alex"] img').count(),0);assert.equal(await page.locator('#callsList .call-entry').count(),0);checks.push('Account change clears author cache and privileged team inbox');
  assert.deepEqual(errors,[]);checks.push('No browser runtime errors');const report={ok:true,checks,screens,requests:requestWrites().map(write=>({quantity:write.body.quantity,fields:Object.keys(write.body)}))};fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){await snap('failure');console.error('BROWSER_ERRORS',JSON.stringify(errors));throw error;}
 finally{await browser.close();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
