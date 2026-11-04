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
 if(n==='./assistance-stream')return {AssistanceStream:class{}}; if(n==='./assistance-protocol')return {KEYS:{}};
 if(n==='socket.io-client')return {io:()=>{const h={};return {on(n,f){h[n]=f;return this},off(){return this},emit(n){if(n==='cs16_join')setTimeout(()=>h.cs16_state?.({phase:'lobby',map:'dust2',gm:'classic',mode:5,round:0,scores:{t:0,ct:0},host:'knyaz',players:[{nick:'fifflaren',team:null},{nick:'knyaz',team:null}],now:Date.now()}),0)},disconnect(){},connected:true}}};
 throw Error('Unmocked module '+n);
};
window.Audio=class{play(){return Promise.resolve()}pause(){}addEventListener(){}};
</script>`;
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
 if(file.endsWith('index.html'))return res.end(fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',mocks+'<script src="game-loader.js">'));
 fs.createReadStream(file).pipe(res);
});
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 let failLog=false;
 await page.route('**/*',async route=>{
  const req=route.request(),url=req.url();if(url.startsWith(origin)||url.startsWith('blob:'))return route.continue();
  if(req.method()==='POST')posts.push({url,body:req.postData()});if(failLog&&url.endsWith('/api/logs')&&req.postData()?.includes('\"comment\"')){failLog=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Попробуй ещё раз'})});}
  if(req.resourceType()==='document')return route.fulfill({contentType:'text/html',body:'<body style="background:#191c26;color:#9ba4bc;font:14px Segoe UI;padding:30px">Чат поддержки · локальная проверка интерфейса</body>'});
 const data={success:true,username:'fifflaren',callsToken:'t'.repeat(43),calls:[{id:'1',user:'Alex',createdAt:'2026-10-25T10:00:00Z',service:'Binance',kind:'Проверка',link:'https://example.com/call',note:'Тест команды'}],hasMore:false,role:'admin',isTL:true,team:'fifflaren',teams:[{name:'fifflaren',users:['fifflaren','Alex','Mira']}],users:[],events:[],tasks:[],items:[],posts:[],messages:[],dialogs:[],matches:[],queue:[],rev:0,now:Date.now(),position:0,tops:[],totals:[],stats:[],rows:[],balance:1500,owned:[],equipped:'',exchanges:{yes:[],no:[],conditional:[]}};
  Object.assign(data,{reels:['7','⚡','🏛️','👑'],multiplier:1,winnings:5,phase:'bet',round:1,startPrice:100,price:103,ticks:[100,101,100.5,102,101.7,103],history:[],endsAt:Date.now()+60000,available:true,sectors:[{id:'win5',label:'+5',w:1},{id:'fine5',label:'−5',w:2},{id:'spin',label:'Ещё',w:1}],race:{phase:'bet',round:1,timeLeft:30,winner:-1,positions:[20,35,10,42,26],roosters:[{name:'Рубин',odds:2},{name:'Шторм',odds:3},{name:'Искра',odds:4},{name:'Лист',odds:5},{name:'Тень',odds:6}]}});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const tab=async id=>{await page.locator('.tabs [data-tab='+id+']').click();};
 try{
 await page.goto(origin+'/index.html');await page.locator('.comic-skip').click();await page.fill('#authUsername','fifflaren');await page.fill('#authPassword','isolated-test');await page.selectOption('#authTeam','fifflaren');await page.click('#authSubmitBtn');await page.waitForFunction(()=>document.getElementById('authScreen').style.display==='none');
 await page.locator('.tabs [data-tab=shift]').click();
 assert(await page.locator('#tab-shift .my-calls-panel').isVisible());assert.equal(await page.locator('#tab-shift #counterBox').count(),0);assert(await page.locator('.orbit-addOneBtn').isDisabled());
 await page.click('#startBtn');await page.locator('.orbit-addOneBtn').click();assert(await page.locator('#shiftLogDialog').isVisible());assert.equal(await page.locator('#countDisplay').textContent(),'0');
 await page.click('#addOneBtn');assert((await page.locator('#logStatus').textContent()).includes('Добавь'));await page.fill('#logLinkInput','https://example.com/log/1');await page.fill('#logCommentInput','Проверка лога');await page.screenshot({path:path.join(out,'shift-log-modal.png')});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#countDisplay').textContent(),'0');await page.locator('.orbit-addOneBtn').click();assert.equal(await page.inputValue('#logCommentInput'),'Проверка лога');
 failLog=true;await page.click('#addOneBtn');await page.waitForFunction(()=>!document.getElementById('addOneBtn').disabled);assert(await page.locator('#shiftLogDialog').isVisible());assert.equal(await page.locator('#countDisplay').textContent(),'0');
 await page.click('#addOneBtn');await page.waitForFunction(()=>!document.getElementById('shiftLogDialog').open);assert.equal(await page.locator('#countDisplay').textContent(),'1');assert.equal(await page.inputValue('#logCommentInput'),'');
 await page.locator('.orbit-call').click();assert(await page.locator('#shiftCallDialog').isVisible());await page.fill('#callServiceName','Binance QA');await page.fill('#callLinkInput','https://example.com/call/2');await page.fill('#callNoteInput','На проверку');await page.screenshot({path:path.join(out,'shift-call-modal.png')});await page.click('#sendCallBtn');await page.waitForFunction(()=>!document.getElementById('shiftCallDialog').open);
 assert(posts.some(p=>p.url.includes('/api/events')&&JSON.parse(p.body).type==='call'&&JSON.parse(p.body).serviceName==='Binance QA'));
 assert(posts.some(p=>p.url.endsWith('/api/logs')&&JSON.parse(p.body).comment==='Проверка лога'));
 await page.getByRole('button',{name:'Биржи',exact:true}).click();await page.locator('#exchangeSearchInput').fill('Deribit');assert(await page.locator('.orbit-tool-dialog').isVisible());await page.keyboard.press('Escape');await page.waitForFunction(()=>document.getElementById('tab-exchanges').parentElement.tagName!=='DIALOG');assert.equal(await page.locator('#tab-exchanges').evaluate(e=>e.parentElement.tagName==='DIALOG'),false);assert(await page.locator('#teamLogFeed').isVisible());await page.evaluate(()=>{const h={};HubCalls.subscribe({emit(){},on:(n,f)=>h[n]=f});const row={id:'live-1',user:'Alex',createdAt:new Date().toISOString(),link:'https://example.com/log',comment:'Новый лог команды'};h.team_log(row);h.team_log(row);});assert.equal(await page.locator('.team-log-entry').count(),1);await page.screenshot({path:path.join(out,'shift-combined.png')});await page.click('#stopBtn');assert(await page.locator('#reportBox').isVisible());assert(await page.locator('.orbit-addOneBtn').isDisabled());
 await page.locator('.orbit-call').click();assert(await page.locator('#shiftCallDialog').isVisible());await page.keyboard.press('Escape');
 await page.setViewportSize({width:900,height:650});await page.screenshot({path:path.join(out,'shift-combined-900.png')});assert.equal(await page.evaluate(()=>typeof window.THREE),'undefined');
 await page.locator('.tabs [data-tab=voxel]').click();await page.locator('.vx-lobby').waitFor();assert.equal(await page.evaluate(()=>typeof window.__cs16Open),'undefined');
 await page.locator('.tabs [data-tab=cs16]').click();await page.waitForFunction(()=>typeof window.__cs16Open==='function'&&!!document.querySelector('#tab-cs16 canvas'),null,{timeout:60000});
 await page.locator('.tabs [data-tab=shift]').click();assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/three.min.js').length),1);
 assert.deepEqual(errors,[]);console.log('SHIFT PASS: unified navigation, personal call statuses, log modal validation/cancel/retry, one increment on success, call submission, finish and responsive layout');
 }catch(error){console.error('BROWSER_ERRORS',JSON.stringify(errors));console.error('AUTH_STATUS',await page.locator('#authErrorMsg').textContent());await page.screenshot({path:path.join(out,'hub-ui-failure.png')});throw error;}finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
