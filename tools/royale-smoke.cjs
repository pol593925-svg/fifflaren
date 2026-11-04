// Local end-to-end smoke for the actual CS entry button, two rooms and the Three.js BR client.
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const dependencies = process.env.VOXEL_TEST_DEPS || path.resolve(__dirname, '../../servertest/node_modules'),
  { Server } = require(path.join(dependencies, 'socket.io'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  root = path.resolve(__dirname, '..'),
  out = path.join(root, 'graphics-qa');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  matchScripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((m) => m[1])
    .filter(
      (n) =>
        /^(?:three.min|GLTFLoader|SkeletonUtils|cs16(?:[.-].*)?|royale-.*)\.js$/.test(n) || n === 'cs16.js',
    );
const harness =
  '<!doctype html><meta charset=utf-8><link rel=stylesheet href="/royale.css"><link rel=stylesheet href="/cs16-graphics.css"><style>body{margin:0}#tab-cs16{height:100vh;position:relative}</style><div id=tab-cs16></div><script src="/socket.io/socket.io.js"></script><script>const real=io;window.io=(url,opts)=>String(url).endsWith("/royale")?real(url,opts):({connected:true,on(n,f){if(n==="cs16_state")setTimeout(()=>f({phase:"lobby",map:"dust2",gm:"cq",mode:5,host:"Tester",scores:{t:0,ct:0},players:[{nick:"Tester",team:null,alive:false,money:800}]}),0);return this},emit(){},removeAllListeners(){},disconnect(){}});</script>' +
  matchScripts.map((n) => '<script src="/' + n + '"></script>').join('') +
  '<script>HubRoyale.configure({username:"Tester",token:"qa-token",server:location.origin,io});__cs16Open("Tester");</script>';
const web = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(harness);
    return;
  }
  const target = path.resolve(root, '.' + url.pathname);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const type = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.glb': 'model/gltf-binary',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  }[path.extname(target)];
  if (type) res.setHeader('Content-Type', type);
  if (url.pathname === '/royale-client.js') {
    res.end(
      fs
        .readFileSync(target, 'utf8')
        .replace(
          /active\s*=\s*\{\s*close\s*\}\s*;/,
          'global.__royaleQA={state:()=>state,view:()=>view,loot:()=>loot,look:v=>{yaw=v;}};active={close};',
        ),
    );
    return;
  }
  fs.createReadStream(target).pipe(res);
});
const io = new Server(web),
  service = require('../../support-hub-server/royale-service')({
    io,
    authenticate: async (t) => (t === 'qa-token' ? { username: 'Tester' } : null),
  });
async function run() {
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + web.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('page', e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(m.text());
      console.error('renderer', m.text());
    }
  });
  await page.route('**/*', (r) =>
    r.request().url().startsWith(origin) || r.request().url().startsWith('blob:')
      ? r.continue()
      : r.fulfill({
          contentType: 'application/json',
          body: '{"success":true,"balance":0,"owned":[],"equipped":""}',
        }),
  );
  try {
    await page.goto(origin);
    await page.locator('.cs16-br-entry').click({ timeout: 120000 });
    await page.waitForFunction(
      () =>
        (window.__royaleQA?.view() && !document.querySelector('.br-primary').disabled) ||
        document.querySelector('.br-status')?.textContent.startsWith('Город не загрузился'),
      null,
      { timeout: 120000 },
    );
    assert(
      await page.evaluate(() => !!window.__royaleQA?.view()),
      await page.locator('.br-status').innerText(),
    );
    await page.screenshot({ path: path.join(out, 'royale-lobby.png') });
    await page.getByRole('button', { name: 'Дуэты', exact: true }).click();
    await page.locator('.br-primary').click();
    const room = service.rooms.get('duo');
    await page.waitForFunction(() => __royaleQA.state()?.self?.s === 'plane', null, { timeout: 15000 });
    assert.equal(room.members.size, 24);
    await page.screenshot({ path: path.join(out, 'royale-flight.png') });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => __royaleQA.state()?.self?.s === 'fall');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => __royaleQA.state()?.self?.s === 'chute');
    const p = room.members.get('Tester');
    assert.equal(p.status, 'chute');
    const b = require('../../support-hub-server/royale-core').buildings.find((b) => b.kind === 1);
    p.x = b.ladder.x;
    p.z = b.z;
    p.y = 1;
    p.vy = -7;
    await page.waitForFunction(() => __royaleQA.state()?.self?.s === 'ground');
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => __royaleQA.state()?.self?.climb);
    assert(p.climb);
    p.y = b.h - 0.12;
    await page.waitForFunction(() => __royaleQA.state()?.self?.climb === false);
    assert(Math.abs(p.y - b.h) < 0.1);
    await page.screenshot({ path: path.join(out, 'royale-roof.png') });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => __royaleQA.state()?.self?.climb);
    assert(p.climb.down);
    p.y = 0.12;
    await page.waitForFunction(() => __royaleQA.state()?.self?.climb === false);
    assert(p.y < 0.1);
    const box = room.match.boxes.find((b) => b.tier === 4 && b.y < 1);
    p.x = box.x + 1;
    p.y = box.y;
    p.z = box.z;
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => __royaleQA.loot().drops.length > 0);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => __royaleQA.state().self.gear.some((x) => x?.tier === 4));
    await page.keyboard.press('KeyM');
    assert(await page.locator('.br-mapplate').isVisible());
    await page.screenshot({ path: path.join(out, 'royale-map.png') });
    await page.keyboard.press('KeyM');
    p.x = b.x - 9;
    p.z = b.front - 19;
    await page.evaluate(() => __royaleQA.look(Math.PI + 0.36));
    p.y = 0;
    p.status = 'ground';
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, 'royale-street.png') });
    p.x = b.x;
    p.z = b.front - 1.1;
    await page.evaluate(() => __royaleQA.look(Math.PI));
    await page.keyboard.down('KeyW');
    await page.waitForFunction((front) => {
      const state = __royaleQA.state(),
        actor = state.actors.find((a) => a.id === state.self.id);
      return actor.z > front + 1;
    }, b.front);
    await page.keyboard.up('KeyW');
    assert(p.z > b.front && p.z < b.back);
    await page.screenshot({ path: path.join(out, 'royale-interior.png') });
    await page.locator('.br-exit').click();
    await page.waitForSelector('.cs16-br-entry', { timeout: 120000 });
    assert.equal(await page.locator('.br-stage').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      'PASS native CS entry, 24-person duo, aircraft jump, canopy, roof ladder, gold kit, map, cleaned up and returned to classic lobby',
    );
  } catch (e) {
    console.error(
      'HUD:',
      await page
        .locator('body')
        .innerText()
        .catch(() => ''),
    );
    throw e;
  } finally {
    await browser.close();
    service.dispose();
    await new Promise((r) => io.close(r));
  }
}
run().catch((e) => {
  console.error(e);
  service.dispose();
  io.close();
  process.exitCode = 1;
});
