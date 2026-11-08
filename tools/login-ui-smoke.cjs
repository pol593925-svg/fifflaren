// Runs the real renderer with isolated filesystem, Electron and network adapters.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.GRAPHICS_OUTPUT||path.join(root,'graphics-qa');
fs.mkdirSync(out,{recursive:true});
const mocks=`<script>
window.__writes={};window.__ipc=[];window.process={cwd:()=>'/isolated-test'};
const ipc={on(){},send:(...a)=>__ipc.push(a),invoke:async(n,data)=>{
 if(n==='auth-profile'){const saved=JSON.parse(localStorage.getItem('__qaSavedPass')||'null');return {profile:saved?{username:saved.username,expiresAt:saved.expiresAt}:null,version:'5.2.0'};}
 if(n==='auth-save'){localStorage.setItem('__qaSavedPass',JSON.stringify({username:data.username,token:data.callsToken,expiresAt:data.sessionExpiresAt}));return {saved:true};}
 if(n==='auth-session-read')return JSON.parse(localStorage.getItem('__qaSavedPass')||'null');
 if(n==='auth-forget'){localStorage.removeItem('__qaSavedPass');return true;}
 return null;
}};
window.require=n=>{
 if(n==='fs')return {existsSync:p=>p in __writes,readFileSync:p=>__writes[p],writeFileSync:(p,v)=>__writes[p]=v};
 if(n==='path')return {join:(...a)=>a.join('/')};
 if(n==='electron')return {ipcRenderer:ipc,desktopCapturer:{getSources:async()=>[]}};
 if(n==='./assistance-stream')return {AssistanceStream:class{}}; if(n==='./assistance-protocol')return {KEYS:{}};
 if(n==='socket.io-client')return {io:()=>{const h={};return {on(n,f){h[n]=f;return this},off(){return this},emit(n){if(n==='cs16_join')setTimeout(()=>h.cs16_state?.({phase:'lobby',map:'dust2',gm:'classic',mode:5,round:0,scores:{t:0,ct:0},host:'knyaz',players:[{nick:'fifflaren',team:null},{nick:'knyaz',team:null}],now:Date.now()}),0)},disconnect(){},connected:true}}};
 throw Error('Unmocked module '+n);
};
window.Audio=class{play(){return Promise.resolve()}pause(){}addEventListener(){}removeEventListener(){}};
</script>`;
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
 if(file.endsWith('index.html'))return res.end(fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',mocks+'<script src="game-loader.js">'));
 fs.createReadStream(file).pipe(res);
});

async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],authRequests=[];
 let resumeStatus=200,loginDelay=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('hub-comic-hidden','1');if(!sessionStorage.__seeded){sessionStorage.__seeded='1';localStorage.setItem('sh_auth',JSON.stringify({u:'Fifflaren',p:'legacy-qa-password'}));}window.__workReady=0;document.addEventListener('hub:work-ready',()=>window.__workReady++);});
 await page.route('**/*',async route=>{
  const req=route.request(),url=req.url();
  if(url.startsWith(origin)||url.startsWith('blob:'))return route.continue();
  const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  const data={success:true,username:'Fifflaren',callsToken:'t'.repeat(43),sessionExpiresAt:Date.now()+86400000,role:'admin',isTL:false,team:'fifflaren',teams:[{name:'fifflaren',users:[]}],users:[],events:[],tasks:[],items:[],posts:[],messages:[],dialogs:[],matches:[],queue:[],rev:0,now:Date.now(),position:0,tops:[],totals:[],stats:[],rows:[],calls:[],tracks:[],balance:0,owned:[],equipped:'',hasMore:false,exchanges:{yes:[],no:[],conditional:[]},links:{},space:{used:0,limit:1e10,online:false}};
  if(/\/api\/(auth\/|login|register)/.test(url)){
   authRequests.push({url,body:req.postData(),authorization:req.headers().authorization});
   if(loginDelay)await new Promise(r=>setTimeout(r,loginDelay));
   if(url.endsWith('/api/auth/session'))return respond(resumeStatus===200?{...data,role:'user'}:{success:false,message:resumeStatus===401?'Пропуск истёк. Войди с паролем.':'Сервер временно недоступен.'},resumeStatus);
   if(url.endsWith('/api/login')&&req.postDataJSON().password==='wrong')return respond({success:false,message:'Неверный логин или пароль!'},400);
  }
  return respond(data);
 });
 const reload=async()=>{await page.goto(origin+'/index.html');await page.waitForFunction(()=>document.getElementById('authVersion').textContent.includes('5.2.0'));};
 const login=async remember=>{await page.fill('#authUsername','Fifflaren');await page.fill('#authPassword',' qa password ');await page.locator('#authRemember').setChecked(remember);await page.press('#authPassword','Enter');await page.locator('#authScreen').waitFor({state:'hidden'});};
 try{
  await reload();assert.equal(await page.evaluate(()=>localStorage.getItem('sh_auth')),null);
  assert.equal(authRequests.length,0,'No automatic password/token login');
  assert(!(await page.locator('#authTeam').isVisible()));assert(!(await page.locator('#authPass').isVisible()));
  await page.screenshot({path:path.join(out,'login-premium-form.png')});
  for(const size of [{width:900,height:600},{width:530,height:820}]){
   await page.setViewportSize(size);await page.screenshot({path:path.join(out,'login-'+size.width+'.png')});
   assert(await page.locator('#authScreen').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'horizontal overflow');
   await page.locator('#authSubmitBtn').scrollIntoViewIfNeeded();assert(await page.locator('#authSubmitBtn').isVisible());
  }
  await page.setViewportSize({width:1440,height:900});
  await page.fill('#authPassword','wrong');await page.click('#authShowPassword');assert.equal(await page.getAttribute('#authPassword','type'),'text');
  await page.click('#authShowPassword');await page.press('#authPassword','Enter');await page.waitForFunction(()=>document.getElementById('authErrorMsg').textContent.includes('Неверный'));
  assert(await page.locator('#authScreen').isVisible());assert.equal(await page.evaluate(()=>window.__workReady),0);
  await login(true);assert.equal(await page.evaluate(()=>window.__workReady),1);assert.equal(await page.evaluate(()=>isWorking),false);
  assert.equal(await page.evaluate(()=>typeof window.THREE),'undefined');
  assert.equal(JSON.parse(authRequests.findLast(r=>r.url.endsWith('/api/login')).body).password,' qa password ');
  await reload();await page.locator('#authPass').waitFor();assert((await page.locator('#authSubmitBtn').textContent()).includes('Продолжить как Fifflaren'));
  assert.equal(await page.evaluate(()=>currentUser),'');await page.screenshot({path:path.join(out,'login-premium-pass.png')});
  const before=authRequests.length;resumeStatus=503;await page.click('#authSubmitBtn');await page.waitForFunction(()=>!document.getElementById('authSubmitBtn').disabled);
  assert(await page.locator('#authPass').isVisible());assert(await page.evaluate(()=>!!localStorage.getItem('__qaSavedPass')));
  resumeStatus=200;await page.click('#authSubmitBtn');await page.locator('#authScreen').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>currentRole),'user','Current role comes from server');
  assert.equal(authRequests[before].authorization,'Bearer '+'t'.repeat(43));
  await reload();resumeStatus=401;await page.click('#authSubmitBtn');await page.locator('#authFields').waitFor();
  assert.equal(await page.inputValue('#authUsername'),'Fifflaren');assert.equal(await page.evaluate(()=>localStorage.getItem('__qaSavedPass')),null);
  assert.equal(await page.evaluate(()=>currentUser),'');
  await page.click('#authSwitchMode');await page.locator('#authTeam').waitFor();await page.fill('#authPassword','new-qa-password');
  const count=authRequests.length;await page.click('#authSubmitBtn');assert.equal(authRequests.length,count);assert((await page.locator('#authErrorMsg').textContent()).includes('команду'));
  await page.selectOption('#authTeam','fifflaren');await page.click('#authSubmitBtn');await page.waitForFunction(()=>document.getElementById('authErrorMsg').textContent.includes('Профиль создан'));
  assert.equal(await page.evaluate(()=>currentUser),'');assert(!(await page.locator('#authTeam').isVisible()));
  await login(false);await reload();assert(!(await page.locator('#authPass').isVisible()));
  loginDelay=250;const postCount=authRequests.filter(r=>r.url.endsWith('/api/login')).length;
  await page.fill('#authUsername','Fifflaren');await page.fill('#authPassword','qa');await page.press('#authPassword','Enter');await page.press('#authPassword','Enter');
  await page.locator('#authScreen').waitFor({state:'hidden'});assert.equal(authRequests.filter(r=>r.url.endsWith('/api/login')).length,postCount+1);
  await reload();await page.locator('#authPass').waitFor();await page.click('#authOtherAccount');await page.locator('#authFields').waitFor();
  assert.equal(await page.inputValue('#authUsername'),'');assert.equal(await page.evaluate(()=>localStorage.getItem('__qaSavedPass')),null);
  assert(authRequests.some(r=>r.url.endsWith('/api/auth/logout')));
  await login(true);await page.click('#logoutBtn');await page.locator('#authScreen').waitFor({state:'visible'});
  assert(!(await page.locator('#authPass').isVisible()));assert.equal(await page.evaluate(()=>localStorage.getItem('__qaSavedPass')),null);
  assert.deepEqual(errors,[]);
  console.log('LOGIN UI PASS: real app, Enter, errors, saved badge, no automatic login, server role, expiry, offline retry, registration, account switch, duplicate submit, 1440/900/530px, lazy game engine.');
 }catch(e){console.error('BROWSER_ERRORS',errors);await page.screenshot({path:path.join(out,'login-failure.png')});throw e;}
 finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
