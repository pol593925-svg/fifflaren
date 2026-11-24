/* Browser contract check for the internal-points workflow. All APIs are mocked. */
'use strict';
const {bootstrap,playwright,root,workspace}=require('./personal-desk-smoke.cjs');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const out=process.env.QA_OUTPUT||path.join(workspace,'outputs/personal-desk-600');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((request,response)=>{
 const file=path.resolve(root,'.'+new URL(request.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.statusCode=404;return response.end();}
 response.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
 if(file.endsWith('index.html'))return response.end(fs.readFileSync(file,'utf8').replace('<script src="game-loader.js">',bootstrap+'<script src="game-loader.js">'));
 fs.createReadStream(file).pipe(response);
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:960},locale:'ru-RU',timezoneId:'Europe/Kyiv',reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],writes=[],screens=[];
 let username='Alex',loan=null,failCreate=true;
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 function actions(){if(!loan)return[];if(username==='fifflaren'&&loan.status==='requested')return['assign','reject'];if(username===loan.lender&&loan.status==='assigned')return['confirm_issue','decline_issue'];if(username===loan.borrower&&loan.status==='active')return['request_return'];if(username===loan.lender&&loan.status==='return_pending')return['confirm_return','deny_return'];return[];}
 function present(detail=false){if(!loan)return null;const row={...loan,actions:actions()};if(!detail||!['fifflaren',loan.borrower,loan.lender].includes(username)){delete row.terms;delete row.history;}return row;}
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();if(url.startsWith(origin+'/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
  const pathname=new URL(url).pathname;
  const respond=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(request.method()!=='GET')writes.push({url,method:request.method(),body:request.postData(),authorization:request.headers().authorization,username});
  if(url.startsWith('https://api.github.com/'))return respond({message:'Isolated QA'},503);
  if(request.resourceType()==='document')return route.fulfill({status:403,contentType:'text/plain',body:'External document blocked by isolated QA'});
  if(pathname==='/api/loans/employees')return respond({success:true,users:[{username:'Alex'},{username:'Mira'},{username:'Denis'}]});
  if(pathname==='/api/loans'&&request.method()==='POST'){
   await new Promise(resolve=>setTimeout(resolve,200));
   if(failCreate){failCreate=false;return respond({success:false,message:'Временная ошибка соединения.'},503);}
   const payload=request.postDataJSON();loan={id:'loan-demo',borrower:username,lender:'',quantity:payload.quantity,startDate:payload.startDate,dueDate:payload.dueDate,terms:payload.terms,requestId:payload.requestId,commitment:payload.commitment,status:'requested',version:0,history:[{at:new Date().toISOString(),by:username,action:'request'}]};
   return respond({success:true,loan:present(true)});
  }
  if(pathname==='/api/loans'&&request.method()==='GET')return respond({success:true,loans:loan?[present()]:[],total:loan?1:0,hasMore:false});
  if(pathname==='/api/loans/loan-demo'&&request.method()==='GET')return respond({success:true,loan:present(true)});
  if(pathname==='/api/loans/loan-demo'&&request.method()==='PATCH'){
   const payload=request.postDataJSON();assert(actions().includes(payload.action),'UI offered an action not allowed by mocked server');assert.equal(payload.version,loan.version);
   if(payload.action==='assign'){loan.lender=payload.lender;loan.status='assigned';}
   if(payload.action==='confirm_issue')loan.status='active';
   if(payload.action==='request_return')loan.status='return_pending';
   if(payload.action==='confirm_return')loan.status='closed';
   loan.version++;loan.history.push({at:new Date().toISOString(),by:username,action:payload.action});return respond({success:true,loan:present(true)});
  }
  if(pathname==='/api/calls/access')return respond({success:true,isOwner:username==='fifflaren',canReview:username==='fifflaren',team:'fifflaren'});
  return respond({success:true,username,role:username==='fifflaren'?'admin':'search',callsToken:'t'.repeat(43),isTL:username==='fifflaren',team:'fifflaren',teams:[{name:'fifflaren',users:['Alex','Mira','Denis']}],users:[],calls:[],logs:[],tasks:[],hasMore:false,total:0,events:[],items:[],posts:[],messages:[],dialogs:[],matches:[],queue:[],rev:0,now:Date.now(),position:0,tops:[],totals:[],stats:[],rows:[],balance:0,owned:[],equipped:'',exchanges:{yes:[],no:[],conditional:[]},links:{cola:'',sprite:'',fanta:''},tracks:[],before:null,film:null,title:'Кинозал',startsAt:Date.now()+900000,phase:'scheduled',online:true,devices:[],space:{used:0,limit:1e10,online:false}});
 });
 const snap=async name=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});screens.push(file);};
 async function login(name){username=name;await page.goto(origin+'/index.html');await page.fill('#authUsername',name);await page.fill('#authPassword','isolated-test');await page.click('#authSubmitBtn');await page.locator('#tab-shift.active .my-calls-panel').waitFor();assert.equal(await page.locator('.hub-comic').count(),0);}
 async function openLedger(){await page.locator('.desk-work-tab[data-work-tab="loans"]').click();await page.locator('#tab-loans.active').waitFor();if(loan)await page.locator('.loans-row[data-loan-id="loan-demo"]').waitFor();}
 async function openDetail(){await openLedger();await page.locator('.loans-row[data-loan-id="loan-demo"] button').click();await page.locator('#loanDetailDialog[open] .loans-detail-summary').waitFor();}
 async function action(name,status){await page.locator('[data-loan-action="'+name+'"]').click();await page.waitForFunction(expected=>document.querySelector('#loanDetailDialog .loans-badge')?.textContent===expected,status);}
 async function ledgerLayout(){assert(await page.locator('#loansCreate').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'Ledger create button fits viewport');assert(await page.locator('.loans-heading>div').evaluate(el=>el.getBoundingClientRect().width>250),'Ledger heading is not squeezed by action button');}
 try{
  if(process.env.LOAN_LEDGER_PREVIEW_ONLY){loan={id:'loan-demo',borrower:'Alex',lender:'Mira',quantity:120,startDate:'2026-11-24',dueDate:'2026-12-01',terms:'Вернуть 120 внутренних баллов после следующей смены.',status:'closed',version:4,history:[]};await login('Mira');await openLedger();await ledgerLayout();await snap('personal-desk-loans-ledger-closed');return;}
  await login('Alex');await page.click('#shiftLoanButton');await page.locator('#loanRequestDialog[open]').waitFor();
  await page.fill('#loanQuantity','120');await page.fill('#loanTerms','Вернуть 120 внутренних баллов после следующей смены.');await page.check('#loanCommitment');
  await snap('personal-desk-loan-form');if(process.env.LOAN_PREVIEW_ONLY)return;
  await page.fill('#loanNickname','Mira');await page.click('#loanRequestSubmit');
  assert((await page.locator('#loanRequestStatus').textContent()).includes('Укажи ник своего аккаунта'),'Nickname spoof rejected locally');
  assert.equal(writes.filter(r=>new URL(r.url).pathname==='/api/loans').length,0,'No request sent with mismatched nickname');
  await page.fill('#loanNickname','Alex');
  await page.click('#loanRequestSubmit');assert(await page.locator('#loanRequestSubmit').isDisabled());await page.locator('#loanRequestSubmit').evaluate(el=>el.click());
  await page.waitForFunction(()=>!document.getElementById('loanRequestSubmit').disabled);assert((await page.locator('#loanRequestStatus').textContent()).includes('Данные сохранены'));
  assert.equal(await page.inputValue('#loanQuantity'),'120');await page.click('#loanRequestSubmit');await page.waitForFunction(()=>!document.getElementById('loanRequestDialog').open);await page.locator('.loans-row').waitFor();
  const creates=writes.filter(r=>new URL(r.url).pathname==='/api/loans'&&r.method==='POST');assert.equal(creates.length,2);assert.equal(JSON.parse(creates[0].body).requestId,JSON.parse(creates[1].body).requestId,'Retry keeps same ID');assert(creates.every(r=>r.authorization==='Bearer '+'t'.repeat(43)));
  assert.equal(loan.quantity,120);assert.equal(loan.commitment,true);assert(loan.dueDate>=loan.startDate);await snap('personal-desk-loans-ledger-requested');
  await login('fifflaren');await openDetail();await page.selectOption('#loanLender','Mira');await action('assign','Ожидает выдачи');await page.keyboard.press('Escape');await snap('personal-desk-loans-owner-assigned');
  await login('Mira');await openDetail();await action('confirm_issue','Выдан');await page.keyboard.press('Escape');
  await login('Alex');await openDetail();await action('request_return','Возврат на подтверждении');await page.keyboard.press('Escape');
  await login('Mira');await openDetail();await action('confirm_return','Возвращён');await page.keyboard.press('Escape');await ledgerLayout();await snap('personal-desk-loans-ledger-closed');
  await login('Denis');await openDetail();assert.equal(await page.locator('#loanDetailDialog .loans-terms').count(),0,'Other employees do not render private terms');assert.equal(await page.locator('#loanDetailDialog [data-loan-action]').count(),0,'Other employees have read-only detail');assert((await page.locator('#loanDetailDialog').textContent()).includes('Возвращён'));
  assert.deepEqual(errors,[]);assert.equal(loan.status,'closed');assert.equal(loan.version,4);
  const report={ok:true,checks:['nickname spoof rejected before API','authenticated create, in-flight lock, failure retry keeps request ID','request visible in public ledger','owner assigns lender','lender confirms issue','borrower requests return','lender confirms return','closed state visible to other employee','private terms omitted for unrelated employee','no browser runtime errors'],actions:writes.filter(r=>r.method==='PATCH').map(r=>({username:r.username,action:JSON.parse(r.body).action})),screens};
  fs.writeFileSync(path.join(out,'loans-ui-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){console.error('BROWSER_ERRORS',JSON.stringify(errors));await snap('personal-desk-loans-failure');throw error;}
 finally{await browser.close();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1});
