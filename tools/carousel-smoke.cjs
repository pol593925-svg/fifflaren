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
  Object.assign(data,{reels:['7','⚡','🏛️','👑'],multiplier:1,winnings:5,phase:'bet',round:1,startPrice:100,price:103,ticks:[100,101,100.5,102,101.7,103],history:[],endsAt:Date.now()+60000,available:true,sectors:[{id:'win5',label:'+5',w:1},{id:'fine5',label:'−5',w:2},{id:'spin',label:'Ещё',w:1}],race:{phase:'bet',round:1,timeLeft:30,winner:-1,positions:[20,35,10,42,26],roosters:[{name:'Рубин',odds:2},{name:'Шторм',odds:3},{name:'Искра',odds:4},{name:'Лист',odds:5},{name:'Тень',odds:6}]}});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const tab=async id=>{if(await page.locator('#casinoSplash').isVisible())await page.locator('#casinoSplash').click();await page.locator('.hub-menuToggle').click();await page.locator('.hub-selector-controls input').fill(await page.locator('.tabs [data-tab="'+id+'"]').getAttribute('title')||id);await page.locator('.hub-hero-card[data-section="'+id+'"]').click();await page.waitForTimeout(120);assert.equal(await page.locator('#tab-'+id).evaluate(e=>getComputedStyle(e).display==='none'),false,id+' hidden');};
 try{
  await page.goto(origin+'/index.html');await page.locator('.comic-skip').click();
  await page.fill('#authUsername','fifflaren');await page.fill('#authPassword','isolated-test');await page.selectOption('#authTeam','fifflaren');await page.click('#authSubmitBtn');await page.waitForFunction(()=>document.getElementById('authScreen').style.display==='none');
  const menu=page.locator('.hub-menuToggle'),stage=page.locator('.hub-hero-stage'),center=page.locator('.hub-hero-card.centered');
  await menu.click();await page.waitForTimeout(500);
  assert.equal(await page.locator('.hub-hero-card[aria-hidden="false"]').count(),7);
  const before=await center.getAttribute('data-section');await stage.hover();await page.mouse.wheel(0,120);await page.waitForTimeout(550);assert.notEqual(await center.getAttribute('data-section'),before);assert(await page.locator('.hub-selector').isVisible());
  const bounds=await page.locator('.hub-hero-card[aria-hidden="false"]').evaluateAll(nodes=>nodes.map(n=>({offset:Number(n.dataset.offset),box:n.getBoundingClientRect().toJSON()})));
  const main=bounds.find(n=>n.offset===0);for(const n of bounds.filter(n=>n.offset!==0))assert(n.box.height<main.box.height);
  await page.screenshot({path:path.join(out,'carousel-desktop.png')});
  const neighbour=page.locator('.hub-hero-card[data-offset="1"]'),target=await neighbour.getAttribute('data-section');await neighbour.click();assert(!(await page.locator('.hub-selector').isVisible()));assert(await page.locator('#tab-'+target).isVisible());
  await menu.click();await stage.focus();const keyBefore=await center.getAttribute('data-section');await page.keyboard.press('ArrowRight');assert.notEqual(await center.getAttribute('data-section'),keyBefore);await page.keyboard.press('ArrowLeft');assert.equal(await center.getAttribute('data-section'),keyBefore);
  await page.locator('.hub-selector-controls input').fill('qwertynotfound');assert.equal(await page.locator('.hub-hero-card').count(),0);assert(await page.getByRole('button',{name:'Следующий раздел',exact:true}).isDisabled());
  await page.locator('.hub-selector-controls input').fill('Заметки');assert.equal(await page.locator('.hub-hero-card').count(),1);await stage.focus();await page.keyboard.press('Enter');assert(await page.locator('#tab-notes').isVisible());
  await menu.click();await page.locator('.hub-selector-filters [data-filter="games"]').click();assert(await page.locator('.hub-hero-card').count()>0);assert.equal(await page.locator('.hub-hero-card[data-section="notes"]').count(),0);
  await page.locator('.hub-selector-filters [data-filter="all"]').click();await page.evaluate(()=>document.querySelector('.tabs [data-tab="admin"]').style.display='none');await page.waitForTimeout(50);assert.equal(await page.locator('.hub-hero-card[data-section="admin"]').count(),0);
  await page.setViewportSize({width:900,height:650});await page.waitForTimeout(550);await page.screenshot({path:path.join(out,'carousel-900.png')});assert.equal(await page.locator('.hub-hero-card[aria-hidden="false"]').count(),7);
  const count=await page.locator('.hub-hero-card').count(),cycleStart=await center.getAttribute('data-section');for(let i=0;i<count;i++)await page.getByRole('button',{name:'Следующий раздел',exact:true}).click();assert.equal(await center.getAttribute('data-section'),cycleStart);
  await page.keyboard.press('Escape');assert(!(await page.locator('.hub-selector').isVisible()));assert(await menu.evaluate(e=>e===document.activeElement));
  assert.deepEqual(errors,[]);console.log('CAROUSEL PASS: seven heroes, wheel, smaller neighbours, direct side click, arrows, Enter, filters, search, permissions, wrap, responsive viewport, Escape/focus');
 }catch(error){console.error('BROWSER_ERRORS',JSON.stringify(errors));console.error('AUTH_STATUS',await page.locator('#authErrorMsg').textContent());await page.screenshot({path:path.join(out,'hub-ui-failure.png')});throw error;}finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
