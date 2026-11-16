/* Support Hub 5.7.0 — аниме-стиль «Сакура» для блочного мира.
   Сел-шейдинг, рисованные текстуры, живая вода, природа, чиби и эффекты добычи.
   Механика мира (генерация, крафт, бой) не меняется. */
(function () {
  'use strict';
  const C = window.HubVoxelCore;

  const PALETTE = {
    1: '#7ccf4e', 2: '#a97a52', 3: '#a9adb0', 4: '#8a6a48',
    5: '#f4a8c8', 6: '#d9ac72', 7: '#c9836b', 9: '#f0dfa8',
    12: '#3fb7ec', 16: '#ffe29a', 22: '#6b4f36', 23: '#335c4a',
    37: '#3d6fd6', 38: '#f2ede2', 39: '#e8b7c9',
  };
  if (C) for (const [id, color] of Object.entries(PALETTE)) {
    const n = Number(id);
    if (C.blocks[n] && !(n >= 29 && n <= 36)) C.blocks[n].color = color;
  }
  for (let level = 1; level <= 8; level++) if (C?.blocks[28 + level]) C.blocks[28 + level].color = PALETTE[12];

  function gradientMap(T) {
    const data = new Uint8Array([96, 150, 214, 255]);
    const tex = new T.DataTexture(data, 4, 1, T.RedFormat);
    tex.minFilter = tex.magFilter = T.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  let outlineMat = null;
  function outline(T, mesh, thickness = 0.03) {
    if (!outlineMat) outlineMat = new T.MeshBasicMaterial({ color: 0x241a26, side: T.BackSide });
    const g = mesh.geometry.clone();
    const pos = g.attributes.position, norm = g.attributes.normal;
    if (norm) for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) + norm.getX(i) * thickness,
        pos.getY(i) + norm.getY(i) * thickness,
        pos.getZ(i) + norm.getZ(i) * thickness);
    }
    const m = new T.Mesh(g, outlineMat);
    m.position.copy(mesh.position); m.rotation.copy(mesh.rotation); m.scale.copy(mesh.scale);
    return m;
  }

  // ---------- Рисованные мазки поверх базовых 16×16 текстур ----------
  function paintTexture(g, ox, oy, id, block) {
    if (!block?.color || block.flower || [27, 28].includes(id) || C?.doorState(id)) return;
    const rnd = (x, y, salt = 0) => C ? C.hash(x + id * 31, y, 1701 + salt) : Math.random();
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const stroke = (color, width, points) => {
      g.strokeStyle = color; g.lineWidth = width; g.beginPath();
      points.forEach(([x, y], i) => i ? g.lineTo(ox + x, oy + y) : g.moveTo(ox + x, oy + y)); g.stroke();
    };
    // Мягкий свет сверху-слева и тёмный мазок снизу — общий рисованный стиль.
    stroke('rgba(255,255,240,.18)', 1.4, [[1, 3], [5, 1], [10, 2], [14, 1]]);
    stroke('rgba(32,25,45,.12)', 1.2, [[1, 14], [6, 15], [12, 13], [15, 14]]);
    if (id === 1) {
      for (let i = 0; i < 8; i++) {
        const x = 1 + rnd(i, 2) * 14, y = 4 + rnd(i, 3) * 11;
        stroke(i % 2 ? 'rgba(224,255,157,.48)' : 'rgba(43,119,55,.32)', .8,
          [[x, y + 2], [x + (i % 2 ? 1 : -1), y], [x + 1, y - 2]]);
      }
    } else if (id === 5) {
      for (let i = 0; i < 10; i++) {
        const x = 2 + rnd(i, 5) * 12, y = 2 + rnd(i, 6) * 12;
        g.fillStyle = i % 3 ? 'rgba(255,225,239,.42)' : 'rgba(184,83,139,.2)';
        g.beginPath(); g.ellipse(ox + x, oy + y, 1.5, .8, rnd(i, 7) * 3, 0, Math.PI * 2); g.fill();
      }
    } else if ([4, 6, 22, 39].includes(id)) {
      for (let i = 0; i < 5; i++) {
        const y = 2 + i * 3;
        stroke(i % 2 ? 'rgba(255,238,198,.22)' : 'rgba(76,43,42,.2)', .75,
          [[1, y], [5, y - 1], [10, y + 1], [15, y]]);
      }
    } else if (id === 37) {
      for (let y = 3; y < 16; y += 4) {
        stroke('rgba(205,230,255,.4)', .8, [[0, y], [4, y - 1], [8, y], [12, y - 1], [16, y]]);
        for (let x = (y % 8 ? 2 : 0); x < 16; x += 4) stroke('rgba(23,48,123,.3)', .7, [[x, y], [x, y + 3]]);
      }
    } else if (id === 12) {
      for (let y = 3; y < 16; y += 4) {
        const shift = rnd(y, 9) * 3;
        stroke('rgba(222,253,255,.52)', .8, [[-2 + shift, y], [3 + shift, y - 1], [8 + shift, y], [13 + shift, y - 1]]);
      }
    } else if ([3, 7, 9, 24, 38].includes(id)) {
      for (let i = 0; i < 6; i++) {
        const x = 1 + rnd(i, 12) * 13, y = 2 + rnd(i, 13) * 12;
        stroke(i % 2 ? 'rgba(255,255,255,.2)' : 'rgba(51,44,61,.14)', .7,
          [[x, y], [x + 2 + rnd(i, 14) * 3, y + (i % 2 ? 1 : -1)]]);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = 2 + rnd(i, 17) * 9, y = 3 + rnd(i, 18) * 9;
        stroke('rgba(255,255,255,.14)', 1, [[x, y], [x + 4, y - 1]]);
      }
    }
    g.restore();
  }

  // ---------- Небо, лепестки, бабочки и светлячки ----------
  function makeSky(T, scene) {
    const group = new T.Group(); scene.add(group);
    const cloudMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const clouds = [];
    for (let i = 0; i < 14; i++) {
      const cloud = new T.Group(), puffs = 2 + (i % 3);
      for (let j = 0; j < puffs; j++) {
        const w = 5 + ((i * 7 + j * 13) % 6);
        const box = new T.Mesh(new T.BoxGeometry(w, 1.1 + (j % 2) * 0.5, 3.4 + ((i + j) % 3)), cloudMat);
        box.position.set(j * 3.2 - puffs, (j % 2) * 0.55, (j % 3) - 1); cloud.add(box);
      }
      const angle = i / 14 * Math.PI * 2;
      cloud.position.set(Math.cos(angle) * (30 + (i % 4) * 14), 44 + (i % 5) * 3, Math.sin(angle) * (30 + (i % 3) * 16));
      group.add(cloud); clouds.push({ obj: cloud, ox: cloud.position.x, oz: cloud.position.z, speed: 0.35 + (i % 4) * 0.12 });
    }

    const COUNT = 200, geo = new T.BufferGeometry(), positions = new Float32Array(COUNT * 3), seeds = [];
    for (let i = 0; i < COUNT; i++) seeds.push({ a: Math.random() * Math.PI * 2, r: 3 + Math.random() * 20,
      y: Math.random() * 14, fall: 0.5 + Math.random() * 0.7, sway: 0.4 + Math.random() * 0.9 });
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    const petalMat = new T.PointsMaterial({ color: 0xf7b8d2, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
    const petals = new T.Points(geo, petalMat); petals.frustumCulled = false; scene.add(petals);

    const wingGeo = new T.PlaneGeometry(0.18, 0.13), bodyGeo = new T.BoxGeometry(0.045, 0.045, 0.14);
    const bodyMat = new T.MeshBasicMaterial({ color: 0x38263c });
    const wingMats = [0xffd0e7, 0xa9e7ff, 0xffe7a3, 0xd5c0ff].map(color => new T.MeshBasicMaterial({ color, side: T.DoubleSide, transparent: true, opacity: 0.9 }));
    const butterflies = [];
    for (let i = 0; i < 14; i++) {
      const obj = new T.Group(), body = new T.Mesh(bodyGeo, bodyMat), left = new T.Group(), right = new T.Group();
      const lm = new T.Mesh(wingGeo, wingMats[i % wingMats.length]), rm = new T.Mesh(wingGeo, wingMats[i % wingMats.length]);
      lm.position.x = -0.09; rm.position.x = 0.09; left.add(lm); right.add(rm); obj.add(body, left, right); scene.add(obj);
      butterflies.push({ obj, left, right, phase: i * 1.73, speed: 0.55 + (i % 5) * 0.1,
        ox: Math.cos(i * 2.4) * (5 + i % 7), oz: Math.sin(i * 2.4) * (5 + i % 7), radius: 0.7 + (i % 4) * 0.35 });
    }

    const FIREFLIES = 64, flyGeo = new T.BufferGeometry(), flyPos = new Float32Array(FIREFLIES * 3), flyCol = new Float32Array(FIREFLIES * 3), flySeeds = [];
    for (let i = 0; i < FIREFLIES; i++) flySeeds.push({ phase: i * 2.17, radius: 0.5 + (i % 9) * 0.18,
      ox: Math.cos(i * 3.1) * (4 + i % 13), oz: Math.sin(i * 3.1) * (4 + i % 13), oy: 0.5 + (i % 7) * 0.55 });
    flyGeo.setAttribute('position', new T.BufferAttribute(flyPos, 3)); flyGeo.setAttribute('color', new T.BufferAttribute(flyCol, 3));
    const flyMat = new T.PointsMaterial({ size: 0.15, sizeAttenuation: true, vertexColors: true, transparent: true,
      opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending });
    const flies = new T.Points(flyGeo, flyMat); flies.frustumCulled = false; scene.add(flies);

    let habitats = { sakura: [], glows: [], water: [] }, habitatAt = -10000;
    function refreshHabitats(player, getBlock, t) {
      if (!getBlock || t - habitatAt < 1300) return; habitatAt = t;
      habitats = { sakura: [], glows: [], water: [] };
      const px = Math.floor(player.x), py = Math.floor(player.y), pz = Math.floor(player.z);
      for (let i = 0; i < 260; i++) {
        const x = px + Math.floor(Math.random() * 37) - 18, z = pz + Math.floor(Math.random() * 37) - 18;
        const y = Math.max(1, Math.min(C?.HEIGHT ? C.HEIGHT - 2 : 62, py + Math.floor(Math.random() * 17) - 6));
        const id = getBlock(x, y, z), at = [x + 0.5, y + 0.8, z + 0.5];
        if (id === 5) habitats.sakura.push(at); else if (id === 16) habitats.glows.push(at); else if (id === 12) habitats.water.push(at);
      }
    }

    return {
      tick(dt, t, player, getBlock) {
        for (const c of clouds) {
          c.ox += c.speed * dt; if (c.ox > 90) c.ox = -90;
          c.obj.position.x = player.x + c.ox; c.obj.position.z = player.z + c.oz;
        }
        for (let i = 0; i < COUNT; i++) {
          const s = seeds[i]; s.y -= s.fall * dt; if (s.y < 0) s.y += 14;
          positions[i * 3] = player.x + Math.cos(s.a + t * 0.0002) * s.r + Math.sin(t * 0.001 * s.sway + i) * 1.4;
          positions[i * 3 + 1] = player.y + s.y - 3;
          positions[i * 3 + 2] = player.z + Math.sin(s.a + t * 0.0002) * s.r;
        }
        geo.attributes.position.needsUpdate = true;
        refreshHabitats(player, getBlock, t);
        butterflies.forEach((b, i) => {
          const a = habitats.sakura.length ? habitats.sakura[(i * 7) % habitats.sakura.length] : null;
          const ax = a ? a[0] : player.x + b.ox, ay = a ? a[1] + 0.8 : player.y + 1.5 + (i % 4), az = a ? a[2] : player.z + b.oz;
          const phase = t * 0.001 * b.speed + b.phase;
          b.obj.position.set(ax + Math.cos(phase) * b.radius, ay + Math.sin(phase * 1.8) * 0.45, az + Math.sin(phase) * b.radius);
          b.obj.rotation.y = -phase; const flap = Math.sin(t * 0.019 + b.phase) * 0.85;
          b.left.rotation.y = flap; b.right.rotation.y = -flap;
        });
        for (let i = 0; i < FIREFLIES; i++) {
          const s = flySeeds[i], pool = habitats.glows.length ? habitats.glows : habitats.water.length ? habitats.water : habitats.sakura;
          const a = pool.length ? pool[(i * 11) % pool.length] : null, phase = t * 0.0011 + s.phase;
          const ax = a ? a[0] : player.x + s.ox, ay = a ? a[1] + 0.7 : player.y + s.oy, az = a ? a[2] : player.z + s.oz;
          flyPos[i * 3] = ax + Math.cos(phase * 1.3) * s.radius;
          flyPos[i * 3 + 1] = ay + Math.sin(phase * 2.1) * 0.65;
          flyPos[i * 3 + 2] = az + Math.sin(phase * 1.3) * s.radius;
          const glow = 0.25 + Math.pow(0.5 + 0.5 * Math.sin(t * 0.004 + s.phase), 2) * 0.75;
          flyCol[i * 3] = glow; flyCol[i * 3 + 1] = glow * 0.88; flyCol[i * 3 + 2] = glow * 0.35;
        }
        flyGeo.attributes.position.needsUpdate = true; flyGeo.attributes.color.needsUpdate = true;
      },
      dispose() {
        group.traverse(o => o.geometry?.dispose()); cloudMat.dispose(); geo.dispose(); petalMat.dispose();
        group.removeFromParent(); petals.removeFromParent();
        for (const b of butterflies) b.obj.removeFromParent();
        wingGeo.dispose(); bodyGeo.dispose(); bodyMat.dispose(); wingMats.forEach(m => m.dispose());
        flies.removeFromParent(); flyGeo.dispose(); flyMat.dispose();
      },
    };
  }

  // ---------- Чиби: шаг, моргание и эмоции ----------
  const HAIR = [0x3d7be0, 0xf08bb8, 0x8b5cf6, 0x6b4a2f, 0xf2d16b, 0x39b58a, 0xe05252];
  const EYES = [0x2456c9, 0x7a3fd1, 0x2f9e6e, 0x8a4b21, 0xc23a6e];
  function faceTexture(T, nick, expression = 'open') {
    const h = C ? C.hash(nick.length, nick.charCodeAt(0) || 1, 31) : 0.5;
    const eye = EYES[Math.floor(h * EYES.length) % EYES.length];
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d'); g.fillStyle = '#ffd9bd'; g.fillRect(0, 0, 64, 64);
    const css = '#' + eye.toString(16).padStart(6, '0');
    for (const cx of [18, 46]) {
      if (expression === 'blink') {
        g.fillStyle = '#3a2a2a'; g.fillRect(cx - 7, 33, 14, 3); continue;
      }
      g.fillStyle = '#ffffff'; g.fillRect(cx - 7, 26, 14, 16);
      g.fillStyle = css; g.fillRect(cx - 5, 28, 10, 13);
      g.fillStyle = '#1b1420'; g.fillRect(cx - 3, 31, 6, 10);
      g.fillStyle = '#ffffff'; g.fillRect(cx - 4, 28, 4, 4); g.fillRect(cx + 1, 36, 2, 2);
      g.fillStyle = '#3a2a2a';
      if (expression === 'worried') { g.save(); g.translate(cx, 23); g.rotate(cx < 32 ? 0.16 : -0.16); g.fillRect(-7, 0, 14, 3); g.restore(); }
      else g.fillRect(cx - 7, 22, 14, 3);
    }
    g.fillStyle = '#f5a3a3'; g.fillRect(6, 44, 10, 4); g.fillRect(48, 44, 10, 4);
    g.fillStyle = '#b05a5a';
    if (expression === 'happy') { g.fillRect(27, 47, 10, 5); g.fillStyle = '#fff'; g.fillRect(29, 47, 6, 2); }
    else if (expression === 'worried') { g.fillRect(29, 50, 7, 2); }
    else g.fillRect(29, 48, 6, 3);
    const tex = new T.CanvasTexture(canvas); tex.magFilter = T.NearestFilter; tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function buildAvatar(T, nick) {
    const h = C ? C.hash(nick.length, nick.charCodeAt(0) || 1, 77) : 0.5;
    const hairColor = HAIR[Math.floor(h * HAIR.length) % HAIR.length], group = new T.Group(), mats = [];
    const toon = color => { const m = new T.MeshToonMaterial({ color }); mats.push(m); return m; };
    const skin = toon(0xffd9bd), cloth = toon(new T.Color().setHSL(h, 0.55, 0.5).getHex()), pants = toon(0x3a4660), hair = toon(hairColor);
    const faces = { open: faceTexture(T, nick), blink: faceTexture(T, nick, 'blink'), happy: faceTexture(T, nick, 'happy'), worried: faceTexture(T, nick, 'worried') };
    const face = new T.MeshToonMaterial({ map: faces.open }); mats.push(face);
    const om = () => outlineMat || (outlineMat = new T.MeshBasicMaterial({ color: 0x241a26, side: T.BackSide }));
    function box(w, hgt, d, x, y, z, mat, outlined = true) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, hgt, d), mat); mesh.position.set(x, y, z);
      if (outlined) { const o = new T.Mesh(mesh.geometry, om()); o.scale.set(1.07, 1.07, 1.07); mesh.add(o); }
      group.add(mesh); return mesh;
    }
    function limb(w, hgt, d, x, y, z, mat) {
      const pivot = new T.Group(); pivot.position.set(x, y, z); group.add(pivot);
      const mesh = new T.Mesh(new T.BoxGeometry(w, hgt, d), mat); mesh.position.y = -hgt / 2;
      const o = new T.Mesh(mesh.geometry, om()); o.scale.set(1.07, 1.07, 1.07); mesh.add(o); pivot.add(mesh); return pivot;
    }
    const headMats = [skin, skin, hair, skin, face, hair];
    const head = new T.Mesh(new T.BoxGeometry(0.62, 0.62, 0.62), headMats); head.position.set(0, 1.28, 0);
    const ho = new T.Mesh(head.geometry, om()); ho.scale.set(1.06, 1.06, 1.06); head.add(ho); group.add(head);
    const cap = box(0.68, 0.16, 0.68, 0, 1.63, 0, hair), backHair = box(0.64, 0.4, 0.14, 0, 1.36, -0.32, hair, false);
    const torso = box(0.46, 0.42, 0.3, 0, 0.78, 0, cloth);
    const armL = limb(0.16, 0.42, 0.18, -0.33, 1.01, 0, skin), armR = limb(0.16, 0.42, 0.18, 0.33, 1.01, 0, skin);
    const legL = limb(0.19, 0.5, 0.22, -0.13, 0.51, 0, pants), legR = limb(0.19, 0.5, 0.22, 0.13, 0.51, 0, pants);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48;
    const g = canvas.getContext('2d'); g.fillStyle = '#2a1733cc'; g.fillRect(0, 0, 256, 48);
    g.fillStyle = '#ffd7ec'; g.font = 'bold 24px Segoe UI'; g.textAlign = 'center'; g.fillText(nick.slice(0, 18), 128, 32);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthTest: true }));
    sprite.position.y = 2.05; sprite.scale.set(2, 0.375, 1); group.add(sprite);
    let walk = 0, expression = 'open';
    return {
      group, mats, sprite,
      animate(dt, t, state) {
        walk += ((state.moving ? 1 : 0) - walk) * Math.min(1, dt * 10);
        const phase = t * 0.011, swing = Math.sin(phase) * 0.72 * walk;
        armL.rotation.x = swing; armR.rotation.x = -swing; legL.rotation.x = -swing * 0.82; legR.rotation.x = swing * 0.82;
        armL.rotation.z = -0.08; armR.rotation.z = 0.08;
        const bob = Math.abs(Math.sin(phase)) * 0.045 * walk + Math.sin(t * 0.002 + h * 6) * 0.008;
        head.position.y = 1.28 + bob; cap.position.y = 1.63 + bob; backHair.position.y = 1.36 + bob; torso.position.y = 0.78 + bob * 0.4;
        head.rotation.z = Math.sin(t * 0.0015 + h * 8) * 0.025;
        const blink = (t * 0.001 + h * 4) % 4.2 < 0.14;
        const next = state.health <= 6 ? 'worried' : blink ? 'blink' : state.moving ? 'happy' : 'open';
        if (next !== expression) { expression = next; face.map = faces[next]; face.needsUpdate = true; }
      },
      dispose() { Object.values(faces).forEach(tex => tex.dispose()); },
    };
  }

  // ---------- Вода: настоящая деформация меша и блики в шейдере ----------
  function animatedWater(T, atlas, grad) {
    const time = { value: 0 };
    const material = new T.MeshToonMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, gradientMap: grad });
    material.onBeforeCompile = shader => {
      shader.uniforms.uAnimeTime = time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
uniform float uAnimeTime;
varying float vAnimeWave;`).replace('#include <begin_vertex>', `#include <begin_vertex>
float animeWave = sin((position.x + uAnimeTime * 1.3) * 2.2) * 0.55 + cos((position.z - uAnimeTime) * 2.7) * 0.45;
transformed.y += animeWave * 0.028;
vAnimeWave = animeWave;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform float uAnimeTime;
varying float vAnimeWave;`).replace('#include <map_fragment>', `#include <map_fragment>
float animeShine = pow(max(0.0, sin(vAnimeWave * 9.0 + uAnimeTime * 2.2)), 12.0);
diffuseColor.rgb += vec3(0.26, 0.42, 0.46) * animeShine;`);
    };
    material.customProgramCacheKey = () => 'support-anime-water-1';
    return { material, time };
  }

  // ---------- Добыча B: звёзды, линии скорости и облачко poof ----------
  function sparkleTexture(T, cloud = false) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    if (cloud) {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grad.addColorStop(0, 'rgba(255,255,255,.95)'); grad.addColorStop(0.45, 'rgba(255,255,255,.65)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    } else {
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 1); g.lineTo(38, 25); g.lineTo(63, 32); g.lineTo(38, 39);
      g.lineTo(32, 63); g.lineTo(25, 39); g.lineTo(1, 32); g.lineTo(25, 25); g.closePath(); g.fill();
    }
    const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace; return tex;
  }

  function makeMiningFx(T, scene) {
    const group = new T.Group(); group.visible = false; scene.add(group);
    const starTexture = sparkleTexture(T), cloudTexture = sparkleTexture(T, true);
    const starMat = new T.SpriteMaterial({ map: starTexture, color: 0xffe8a3, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const stars = [];
    for (let i = 0; i < 10; i++) { const s = new T.Sprite(starMat); group.add(s); stars.push(s); }
    const linePos = [];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, y = ((i % 5) - 2) * 0.25, r = Math.sqrt(Math.max(0.2, 1 - y * y));
      const d = [Math.cos(a) * r, y, Math.sin(a) * r];
      linePos.push(d[0] * 1.05, d[1] * 1.05, d[2] * 1.05, d[0] * 0.5, d[1] * 0.5, d[2] * 0.5);
    }
    const lineGeo = new T.BufferGeometry(); lineGeo.setAttribute('position', new T.Float32BufferAttribute(linePos, 3));
    const lineMat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending });
    const lines = new T.LineSegments(lineGeo, lineMat); group.add(lines);
    let progress = 0, lastMine = 0;
    const bursts = [];
    function mine(at, value, color) {
      progress = value; lastMine = performance.now(); group.visible = true; group.position.set(at[0] + 0.5, at[1] + 0.5, at[2] + 0.5);
      if (color) { lineMat.color.set(color).lerp(new T.Color(0xffffff), 0.55); starMat.color.set(color).lerp(new T.Color(0xfff2b0), 0.65); }
    }
    function poof(at, color) {
      const count = 34, geo = new T.BufferGeometry(), pos = new Float32Array(count * 3), velocities = [];
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.25; pos[i * 3 + 1] = (Math.random() - 0.5) * 0.25; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        const a = Math.random() * Math.PI * 2, speed = 0.8 + Math.random() * 1.8;
        velocities.push([Math.cos(a) * speed, 0.6 + Math.random() * 1.8, Math.sin(a) * speed]);
      }
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const mat = new T.PointsMaterial({ map: cloudTexture, color: color || 0xffd8ed, size: 0.42, transparent: true,
        opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending });
      const obj = new T.Points(geo, mat); obj.position.set(at[0] + 0.5, at[1] + 0.5, at[2] + 0.5); scene.add(obj);
      bursts.push({ obj, geo, mat, velocities, life: 0.72, max: 0.72 });
      if (bursts.length > 8) { const old = bursts.shift(); old.obj.removeFromParent(); old.geo.dispose(); old.mat.dispose(); }
    }
    return {
      mine, poof,
      cancelMine() { group.visible = false; },
      tick(dt, t) {
        if (group.visible && performance.now() - lastMine > 160) group.visible = false;
        group.rotation.y = t * 0.002; lines.scale.setScalar(1.15 - progress * 0.28 + Math.sin(t * 0.02) * 0.06);
        lineMat.opacity = 0.35 + progress * 0.6;
        stars.forEach((s, i) => {
          const a = t * 0.003 * (i % 2 ? 1 : -1) + i * 2.4, r = 0.68 + (i % 3) * 0.16;
          s.position.set(Math.cos(a) * r, Math.sin(a * 1.7) * 0.65, Math.sin(a) * r);
          const size = (0.08 + (0.5 + 0.5 * Math.sin(t * 0.018 + i)) * 0.2) * (0.7 + progress * 0.6);
          s.scale.set(size, size, 1);
        });
        for (let n = bursts.length - 1; n >= 0; n--) {
          const b = bursts[n]; b.life -= dt; const p = b.geo.attributes.position.array;
          for (let i = 0; i < b.velocities.length; i++) {
            const v = b.velocities[i]; p[i * 3] += v[0] * dt; p[i * 3 + 1] += v[1] * dt; p[i * 3 + 2] += v[2] * dt;
            v[0] *= 0.97; v[1] = v[1] * 0.97 - 1.4 * dt; v[2] *= 0.97;
          }
          b.geo.attributes.position.needsUpdate = true; b.mat.opacity = Math.max(0, b.life / b.max); b.obj.scale.setScalar(1 + (1 - b.life / b.max) * 1.5);
          if (b.life <= 0) { b.obj.removeFromParent(); b.geo.dispose(); b.mat.dispose(); bursts.splice(n, 1); }
        }
      },
      dispose() {
        group.removeFromParent(); lineGeo.dispose(); lineMat.dispose(); starMat.dispose(); starTexture.dispose(); cloudTexture.dispose();
        for (const b of bursts) { b.obj.removeFromParent(); b.geo.dispose(); b.mat.dispose(); } bursts.length = 0;
      },
    };
  }

  function restyle(T, scene, renderer, atlas) {
    scene.background = new T.Color(0x8fd3ff); renderer.setClearColor(0x8fd3ff);
    if (scene.fog) { scene.fog.color.set(0xaee2ff); scene.fog.near = 28; scene.fog.far = 48; }
    const grad = gradientMap(T), material = new T.MeshToonMaterial({ map: atlas, vertexColors: true, alphaTest: 0.4, gradientMap: grad });
    const water = animatedWater(T, atlas, grad);
    for (const child of scene.children) {
      if (child.isHemisphereLight) { child.color.set(0xd6efff); child.groundColor.set(0x8fae62); child.intensity = 1.9; }
      if (child.isDirectionalLight) { child.color.set(0xfff3d0); child.intensity = 1.3; }
    }
    const sky = makeSky(T, scene), mining = makeMiningFx(T, scene);
    return {
      material, waterMaterial: water.material,
      mine: mining.mine, poof: mining.poof, cancelMine: mining.cancelMine,
      tick(dt, t, player, getBlock) { water.time.value = t * 0.001; sky.tick(dt, t, player, getBlock); mining.tick(dt, t); },
      dispose() { sky.dispose(); mining.dispose(); material.dispose(); water.material.dispose(); grad.dispose(); },
    };
  }

  window.HubVoxelAnime = { restyle, outline, buildAvatar, paintTexture };
})();
