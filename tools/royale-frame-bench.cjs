// Reproducible city-only GPU workload. The same fixed poses are used on both builds.
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'),
  baseline = process.env.BR_BENCH_BASELINE;
const web = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  if (name === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<style>*{margin:0}</style><canvas></canvas>' +
        [
          'three.min',
          'GLTFLoader',
          'cs16-graphics',
          'royale-core',
          ...(!baseline && fs.existsSync(path.join(root, 'royale-landscape.js')) ? ['royale-landscape'] : []),
          'royale-city',
        ]
          .map((s) => '<script src="/' + s + '.js"></script>')
          .join(''),
    );
    return;
  }
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const historical = baseline && name.endsWith('.js') ? path.join(baseline, path.basename(name)) : null;
  fs.createReadStream(historical && fs.existsSync(historical) ? historical : file).pipe(res);
});
(async () => {
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args:
        process.env.BR_BENCH_GPU === 'hardware'
          ? ['--use-angle=d3d11']
          : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + web.address().port);
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Shader Error')) errors.push(msg.text());
      if (msg.text().startsWith('GPU:')) console.log(msg.text());
    });
    const rows = await page.evaluate(async () => {
      const T = THREE,
        r = new T.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: false });
      CS16Graphics.configureRenderer(r, { quality: 'balanced' });
      r.setSize(800, 450);
      const scene = new T.Scene(),
        cam = new T.PerspectiveCamera(75, 800 / 450, 0.07, 4600),
        city = await RoyaleCity.create(T, scene, r),
        rows = [],
        pixel = new Uint8Array(4),
        gl = r.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      console.log(
        'GPU: ' + (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
      );
      window.benchPose = (eye, at) => {
        cam.position.fromArray(eye);
        cam.lookAt(...at);
        city.update(cam, performance.now() + 900, 'balanced');
        r.render(scene, cam);
      };
      for (const [name, eye, at] of [
        ['street', [999, 1.6, 588], [970, 4, 650]],
        ['air', [300, 245, 480], [1110, 30, 870]],
        ['station', [495, 1.6, 1300], [450, 5, 1350]],
      ]) {
        const times = [];
        let tri = 0,
          calls = 0;
        for (let i = 0; i < 17; i++) {
          await new Promise(requestAnimationFrame);
          const t = performance.now();
          window.benchPose(eye, at);
          gl.readPixels(400, 225, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          if (i >= 5) {
            times.push(performance.now() - t);
            tri += r.info.render.triangles;
            calls += r.info.render.calls;
          }
        }
        times.sort((a, b) => a - b);
        rows.push({
          name,
          medianMs: +times[6].toFixed(1),
          p90Ms: +times[10].toFixed(1),
          triangles: Math.round(tri / times.length),
          calls: Math.round(calls / times.length),
        });
      }
      return rows;
    });
    if (errors.length) throw Error(errors.join('\n'));
    console.log(JSON.stringify(rows));
    if (process.env.BR_BENCH_OUT) fs.writeFileSync(process.env.BR_BENCH_OUT, JSON.stringify(rows));
    for (const [n, e, a] of [
      ['rail', [482, 3, 1272], [451, 5, 1250]],
      ['ridge', [130, 0, 237], [270, 4, 160]],
      ['river', [240, 0, 181], [360, 6, 143]],
      ['harbor', [1584, 5, 1380], [1550, 14, 1350]],
    ]) {
      await page.evaluate(
        ([e, a]) => {
          if (!e[1]) e[1] = RoyaleCore.floor(e[0], e[2], 100) + 1.65;
          window.benchPose(e, a);
        },
        [e, a],
      );
      fs.mkdirSync(path.join(root, 'graphics-qa'), { recursive: true });
      await page.screenshot({
        path: path.join(
          root,
          'graphics-qa',
          'br-' + (process.env.BR_BENCH_LABEL || 'current') + '-' + n + '.png',
        ),
      });
    }
  } finally {
    await browser?.close();
    web.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
