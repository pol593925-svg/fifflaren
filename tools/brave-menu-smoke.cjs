'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {EventEmitter} = require('node:events');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '..');

function bridge() {
  const app = new EventEmitter(), handlers = {}, frame = {url:pathToFileURL(path.join(root,'index.html')).href};
  const wc = {mainFrame:frame, send(){}}, win = {webContents:wc,isDestroyed:()=>false,isMinimized:()=>true,restore(){},show(){},focus(){}};
  Object.assign(app,{isPackaged:true,requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),setAsDefaultProtocolClient(){}});
  require('../brave-shortcuts-main').install({app,ipcMain:{handle:(name,fn)=>handlers[name]=fn},shell:{},getWindow:()=>win,argv:['exe','supporthub://work/call-email']});
  const event = {sender:wc,senderFrame:frame};
  const take = handlers['hub-shortcut:take'];
  assert.equal(take({...event,senderFrame:{}}),null);
  assert.equal(take(event),'email');
  assert.equal(take(event),null);
  app.emit('second-instance',{},['exe','supporthub://work/call-exchange?x=1']);
  assert.equal(take(event),null);
  app.emit('second-instance',{},['exe','supporthub://work/call-exchange']);
  assert.equal(take(event),'exchange');
}

async function run() {
  bridge();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'hub-brave-qa-'));
  const extension = path.join(root,'brave-extension');
  const ctx = await chromium.launchPersistentContext(profile,{
    executablePath:process.env.BRAVE_PATH || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    headless:true, ignoreDefaultArgs:['--disable-extensions'],args:['--disable-extensions-except='+extension,'--load-extension='+extension]
  });
  try {
    const page = await ctx.newPage();
    await ctx.route('**/*', route => route.fulfill({contentType:'text/html',body:'<main></main>'}));
    await page.goto('https://admin.standard-margin.com/computers/test-record#filters=test');
    const controls = '<button>AI chat</button><button>View activity</button>';
    await page.locator('main').evaluate((el,html)=>el.innerHTML=html,controls);
    const button = page.getByRole('button',{name:'Заколить'});
    await button.waitFor({timeout:10000});
    const beside = () => page.evaluate(()=>document.querySelector('button').nextElementSibling?.hasAttribute('data-support-hub-calls'));
    assert.equal(await beside(),true);
    await button.click();
    const links = page.locator('[data-support-hub-calls] a');
    assert.deepEqual(await links.allTextContents(),['Колл на биржу','Колл на почту']);
    assert.deepEqual(await links.evaluateAll(xs=>xs.map(x=>x.href)),['supporthub://work/call-exchange','supporthub://work/call-email']);
    await page.keyboard.press('Escape');
    assert.equal(await links.first().isVisible(),false);
    await page.locator('main').evaluate((el,html)=>el.innerHTML=html,controls);
    await button.waitFor(); assert.equal(await button.count(),1);
    await page.evaluate(()=>history.pushState({},'', '/folders'));
    await button.waitFor({state:'detached'});
    await page.evaluate(()=>history.pushState({},'', '/computers/another'));
    await button.waitFor();
    await page.locator('main').evaluate(el=>el.innerHTML='<button>View activity</button>');
    await button.waitFor(); assert.equal(await beside(),true);
    await page.locator('main').evaluate((el,html)=>el.innerHTML=html,controls);
    await button.waitFor(); assert.equal(await beside(),true);
    await page.goto('https://example.org/computers/test');
    await page.locator('main').evaluate((el,html)=>el.innerHTML=html,controls);
    assert.equal(await button.count(),0);
    console.log('PASS · Brave extension, SPA routes, toolbar remount, keyboard, domain isolation, exact URI handoff, cold and warm requests');
  } finally { await ctx.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
