// Runs the real renderer with isolated filesystem, Electron and network adapters.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.GRAPHICS_OUTPUT||path.join(root,'graphics-qa');
fs.mkdirSync(out,{recursive:true});
const mocks=`<script>
window.__writes={};window.__ipc=[];window.process={cwd:()=>'/isolated-test'};
const ipc={on(){},send:(...a)=>__ipc.push(a),invoke:async()=>null};
window.require=n=>{
 if(n==='fs')return {existsSync:p=>p in __writes,readFileSync:p=>__writes[p],writeFileSync:(p,v)=>__writes[p]=v};
 if(n==='path')return {join:(...a)=>a.join('/')};
 if(n==='electron')return {ipcRenderer:ipc,desktopCapturer:{getSources:async()=>[]}};
 if(n==='socket.io-client')return {io:()=>{const h={};return {on(n,f){h[n]=f;return this},off(){return this},emit(n){if(n==='cs16_join')setTimeout(()=>h.cs16_state?.({phase:'lobby',map:'dust2',gm:'classic',mode:5,round:0,scores:{t:0,ct:0},host:'knyaz',players:[{nick:'fifflaren',team:null},{nick:'knyaz',team:null}],now:Date.now()}),0)},disconnect(){},connected:true}}};
 throw Error('Unmocked module '+n);
};
window.Audio=class{play(){return Promise.resolve()}pause(){}addEventListener(){}};
</script>`;
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
 if(file.endsWith('index.html'))return res.end(fs.readFileSync(file,'utf8').replace('<script src="three.min.js">',mocks+'<script src="three.min.js">'));
 fs.createReadStream(file).pipe(res);
});
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',async route=>{
  const req=route.request(),url=req.url();if(url.startsWith(origin)||url.startsWith('blob:'))return route.continue();
  if(req.method()==='POST')posts.push({url,body:req.postData()});
  if(req.resourceType()==='document')return route.fulfill({contentType:'text/html',body:'<body style="background:#191c26;color:#9ba4bc;font:14px Segoe UI;padding:30px">Чат поддержки · локальная проверка интерфейса</body>'});
 const data={success:true,username:'fifflaren',callsToken:'t'.repeat(43),calls:[{id:'1',user:'Alex',createdAt:'2026-10-25T10:00:00Z',service:'Binance',kind:'Проверка',link:'https://example.com/call',note:'Тест команды'}],hasMore:false,role:'admin',isTL:true,team:'fifflaren',teams:[{name:'fifflaren',users:['fifflaren','Alex','Mira']}],users:[],events:[],tasks:[],items:[],posts:[],messages:[],dialogs:[],queue:[],tops:[],totals:[],stats:[],rows:[],balance:1500,owned:[],equipped:'',exchanges:{yes:[],no:[],conditional:[]}};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const tab=async id=>{await page.locator('.tabs [data-tab="'+id+'"]').click();await page.waitForTimeout(120);assert.equal(await page.locator('#tab-'+id).evaluate(e=>getComputedStyle(e).display==='none'),false,id+' hidden');};
 try{
  await page.goto(origin+'/index.html');
  await page.screenshot({path:path.join(out,'hub-login.png')});
  await page.fill('#authUsername','fifflaren');await page.fill('#authPassword','isolated-test');await page.selectOption('#authTeam','fifflaren');await page.click('#authSubmitBtn');
  await page.waitForFunction(()=>document.getElementById('authScreen').style.display==='none');
  await page.screenshot({path:path.join(out,'hub-support.png')});
  await tab('shift');await page.click('#startBtn');await page.click('#addFiveBtn');
  assert.equal(await page.locator('#countDisplay').textContent(),'5');
  await page.screenshot({path:path.join(out,'hub-shift.png')});await page.click('#stopBtn');
  assert(await page.locator('#reportBox').isVisible());
  await tab('cols');await page.fill('#callServiceName','QA');await page.fill('#callLinkInput','https://example.com/test');await page.fill('#callNoteInput','Проверка формы');
  await page.screenshot({path:path.join(out,'hub-calls.png')});await page.click('#sendCallBtn');assert.equal(await page.inputValue('#callServiceName'),'');
  await tab('leave');await page.fill('#leaveDate','2026-10-25');await page.fill('#leaveTimeFrom','14:00');await page.fill('#leaveTimeTo','15:00');await page.fill('#leaveComment','Локальная проверка');await page.click('#sendLeaveBtn');
  await page.screenshot({path:path.join(out,'hub-leave.png')});
  await tab('notes');await page.fill('#userNotes','План на день\n\n1. Проверить сообщения команды\n2. Закрыть текущие задачи\n3. Подготовить отчёт по смене');await page.click('#saveNotesBtn');
  assert((await page.evaluate(()=>Object.values(__writes)))[0].includes('План на день'));
  await page.screenshot({path:path.join(out,'hub-notes.png')});
  const visited=[];
  for(const id of ['hq','support','shift','cols','mycalls','leave','crypto','notes','exchanges','tasks','feed','chat','pm','swipe','casino','tops','battleship','tlpanel','admin']){
   if(await page.locator('.tabs [data-tab="'+id+'"]').isVisible()){await tab(id);visited.push(id);}
  }
  await tab('mycalls');await page.waitForSelector('.call-entry');assert.equal(await page.locator('.call-entry a').getAttribute('href'),'https://example.com/call');
  await page.screenshot({path:path.join(out,'hub-personal-calls.png')});
  await page.evaluate(async()=>{
   const handlers={};HubCalls.subscribe({emit(){},on:(n,f)=>handlers[n]=f});
   handlers.fifflaren_call({id:'push1',user:'Alex',service:'QA',link:'https://example.com/call'});
   handlers.fifflaren_call({id:'push1',user:'Alex',service:'QA',link:'https://example.com/call'});
  });
  assert.equal((await page.evaluate(()=>__ipc)).filter(a=>a[0]==='call-notification'&&a[1].title==='Новый колл · Alex').length,1);
  await tab('exchanges');assert(await page.locator('.exchange-card').count()>0);
  await page.fill('#exchangeSearchInput','https://www.deribit.com/options/BTC');assert(await page.locator('.exchange-card').count()>0);
  await page.click('#exchangeClear');await page.locator('[data-exchange-filter="condition"]').click();assert.equal(await page.locator('.exchange-card:not([data-section="condition"])').count(),0);
  await page.screenshot({path:path.join(out,'hub-exchanges.png')});
  await tab('casino');await page.evaluate(()=>casinoSkipSplash());await page.screenshot({path:path.join(out,'hub-casino.png')});
  await page.locator('.casino-room-btn').first().click();await page.locator('.slot-theme-btn[data-theme="zeus"]').click();assert.equal(await page.locator('#room-slot').getAttribute('data-art'),'zeus');
  await page.waitForTimeout(350);await page.screenshot({path:path.join(out,'hub-slots.png')});
  assert.equal(await page.locator('.tabs [data-tab="approve"],.tabs [data-tab="salary"]').count(),0);
  await tab('shift');await page.click('#themeToggleBtn');assert(await page.locator('body').evaluate(e=>e.classList.contains('light')));
  await page.screenshot({path:path.join(out,'hub-light.png')});
  await page.setViewportSize({width:900,height:650});await tab('cols');
  const box=await page.locator('#sendCallBtn').boundingBox();assert(box.x>=0&&box.x+box.width<=900);
  await page.locator('.hub-menuToggle').click();assert(await page.locator('body').evaluate(e=>e.classList.contains('hub-navCollapsed')));
  await page.locator('.hub-menuToggle').click();await page.click('#themeToggleBtn');
  await tab('support2');visited.push('support2');await page.getByText('✖ Закрыть игру',{exact:true}).click();
  await tab('cs16');visited.push('cs16');
  await page.waitForFunction(()=>{const l=document.querySelector('.cs16-loading');return l&&l.style.display==='none'},null,{timeout:120000});
  await tab('cs16');await page.waitForSelector('#cs16StartBtn',{state:'visible'});await page.screenshot({path:path.join(out,'hub-game-lobby.png')});
  assert(await page.getByRole('button',{name:'Забрать хост себе',exact:true}).isVisible());
  assert(await page.locator('#tab-cs16').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight+1));
  assert.equal(await page.locator('#tlPetSection').count(),0);
  assert(!(await page.evaluate(()=>__ipc)).some(a=>a[0]==='show-toolbar'));
  for(const type of ['shift','call','leave'])assert(posts.some(p=>p.url.includes('/api/events')&&JSON.parse(p.body).type===type),'Missing '+type+' submission');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'hub-ui-validation.json'),JSON.stringify({visited,checks:['login','shift start/counter/finish','call submit','leave submit','notes save','dark/light','900px layout','sidebar toggle','pet removed'],errors},null,2));
  console.log('UI PASS',visited.length,'sections; shift, calls, leave, notes, themes, navigation; no live requests');
 }catch(error){console.error('BROWSER_ERRORS',JSON.stringify(errors));console.error('AUTH_STATUS',await page.locator('#authErrorMsg').textContent());await page.screenshot({path:path.join(out,'hub-ui-failure.png')});throw error;}finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
