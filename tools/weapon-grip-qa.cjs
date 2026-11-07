// Validate fitted palms against the actual exported meshes, including the third-person bone palettes.
const path = require('node:path'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'),
  root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('http://grip.test/**', (r) => {
      const uri = new URL(r.request().url()).pathname;
      if (uri === '/')
        return r.fulfill({
          contentType: 'text/html',
          body:
            '<style>*{margin:0}</style><canvas></canvas>' +
            ['three.min', 'GLTFLoader', 'cs16-field-view', 'cs16-weapon-grip', 'cs16-weapon-animation']
              .map((s) => '<script src="/' + s + '.js"></script>')
              .join(''),
        });
      const f = path.resolve(root, '.' + uri);
      return f.startsWith(root + path.sep) && fs.existsSync(f)
        ? r.fulfill({ path: f })
        : r.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://grip.test/');
    const stats = await page.evaluate(async () => {
      const T = THREE,
        loader = new T.GLTFLoader(),
        load = async (name) => (await loader.loadAsync('models/' + name + '.glb')).scene;
      const hands = await load('csgo/anime-hands'),
        tactical = await load('csgo/operator-ct'),
        hero = await load('csgo/hero-classic');
      const renderer = new T.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true });
      renderer.setSize(1100, 720);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      const scene = new T.Scene();
      scene.background = new T.Color(0x566775);
      scene.add(new T.HemisphereLight(0xf5f8ff, 0xa49a83, 1.7));
      const sun = new T.DirectionalLight(0xffe3bb, 2.9);
      sun.position.set(-3, 6, -4);
      scene.add(sun);
      const camera = new T.PerspectiveCamera(31, 1100 / 720, 0.05, 20);
      const optic = CS16FieldView.optic(T);
      const profiles = [
        ['usp', 0.25],
        ['elite', 0.23],
        ['mp7', 0.52],
        ['vector', 0.49],
        ['bizon', 0.68],
        ['ak47', 0.89],
        ['awp', 1.12],
        ['m4a1', 0.82],
        ['knife', 0.4],
      ];
      let arms = 0,
        poses = 0,
        maxWrist = 0,
        magError = 0;
      for (const [id, len] of profiles) {
        const asset = await load((['mp7', 'vector', 'bizon'].includes(id) ? 'royale/' : 'csgo/anime-') + id),
          gun = new T.Group();
        const box = new T.Box3().setFromObject(asset),
          dims = box.getSize(new T.Vector3());
        asset.scale.setScalar(len / Math.max(dims.x, dims.y, dims.z));
        asset.updateMatrixWorld(true);
        asset.position.sub(new T.Box3().setFromObject(asset).getCenter(new T.Vector3()));
        asset.name = 'weaponBasis';
        gun.add(asset);
        CS16Grip.bindGun(T, gun, asset, id);
        const vm = gun.clone(true);
        CS16Grip.fitHands(vm, hands);
        const data = gun.userData.grip,
          right = vm.getObjectByName('rightHand'),
          left = vm.getObjectByName('leftHand');
        gun.updateMatrixWorld(true);
        for (const socket of [data.right, data.left].filter(Boolean)) {
          const at = new T.Vector3(...socket),
            ray = new T.Raycaster(),
            direction = new T.Vector3(1, 0, 0);
          ray.set(at.clone().addScaledVector(direction, -0.14), direction);
          if (!ray.intersectObject(asset, true).some((hit) => hit.point.distanceTo(at) < 0.08)) {
            throw Error('Grip has no weapon surface within reach: ' + id);
          }
        }
        if (
          !right ||
          right.position.distanceTo(new T.Vector3(...data.right)) > 1e-6 ||
          Boolean(left) !== Boolean(data.left)
        )
          throw Error('Unattached glove ' + id);
        if (left) {
          if (left.position.distanceTo(new T.Vector3(...data.left)) > 1e-6)
            throw Error('Support socket ' + id);
          const anim = CS16WeaponAnimation.bind(vm),
            rest = left.position.clone(),
            magazine = vm.getObjectByName('magazine');
          const target = new T.Vector3(...data.mag);
          target.x -= 0.02;
          magazine.worldToLocal(vm.localToWorld(target));
          CS16WeaponAnimation.update(anim, vm, id, 0.46, 2, 0);
          vm.worldToLocal(magazine.localToWorld(target));
          magError = Math.max(magError, left.position.distanceTo(target));
          CS16WeaponAnimation.update(anim, vm, id, -1, 2, 0);
          if (left.position.distanceTo(rest) > 1e-5) throw Error('Reload drift ' + id);
        }
        if (id !== 'knife') {
          for (const [body, palmY] of [
            [tactical.clone(true), 0.54],
            [hero.clone(true), 0.51],
          ]) {
            const h = new T.Group(),
              model = gun.clone(true);
            body.add(h);
            h.add(model);
            scene.add(body);
            body.position.set(0.13, 0, 0.27);
            body.rotation.y = 0.41;
            const rig = CS16Grip.operator(T, body, h, palmY);
            const rigidMaterials=new Set(),armMaterials=new Set();
            body.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))(o.isSkinnedMesh?armMaterials:rigidMaterials).add(m);});
            for(const m of armMaterials)if(rigidMaterials.has(m))throw Error('Rigid/skinned material variant thrashing');
            arms += 2;
            for (const pitch of [-0.72, 0, 0.62]) {
              const posed = model.userData.grip;
              rig.update(model, pitch, 0.35, 0.014);
              for (const scenario of ['standing', 'translated', 'crouched', 'restored']) {
                body.position.set(scenario === 'translated' ? 0.71 : 0.13, 0.08, 0.27);
                body.rotation.y = scenario === 'translated' ? 1.16 : 0.41;
                body.scale.y = scenario === 'crouched' ? 0.72 : 1;
                if (scenario === 'restored') rig.relax();
                rig.update(model, pitch, 0.35, 0.014);
                body.updateMatrixWorld(true);
                poses++;
                for (const [name, sign, contact] of [
                  ['armL', -1, posed.left],
                  ['armR', 1, posed.right],
                ]) {
                  if (!contact) continue;
                  const arm = body.getObjectByName(name),
                    skin = arm.getObjectByProperty('isSkinnedMesh', true);
                  const wrist = skin.skeleton.bones[1].localToWorld(
                      new T.Vector3(0, -palmY * 0.5, palmY > 0.52 ? -0.017 : 0.012),
                    ),
                    target = new T.Vector3(...contact);
                  target.x += sign * 0.022;
                  target.y -= sign < 0 ? 0.022 : 0;
                  model.localToWorld(target);
                  maxWrist = Math.max(maxWrist, wrist.distanceTo(target));
                }
              }
            }
            if (id === 'm4a1' && palmY === 0.54) {
              rig.update(model, 0.08, 0, 0);
              camera.position.set(1.75, 1.51, -1.29);
              camera.lookAt(0.1, 1.31, 0.1);
              renderer.render(scene, camera);
              window.remoteImage = renderer.domElement.toDataURL('image/png');
            }
            rig.dispose();
            body.removeFromParent();
          }
        }
      }
      optic.dispose();
      renderer.dispose();
      return { weapons: profiles.length, arms, poses, maxWrist, magError };
    });
    assert(stats.maxWrist < 0.002, JSON.stringify(stats));
    assert(stats.magError < 0.002, JSON.stringify(stats));
    assert.deepEqual(errors, []);
    const src = await page.evaluate(() => window.remoteImage);
    fs.mkdirSync(path.join(root, 'graphics-qa'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'graphics-qa', 'operator-grip.png'),
      Buffer.from(src.split(',')[1], 'base64'),
    );
    console.log('PASS', JSON.stringify(stats));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
