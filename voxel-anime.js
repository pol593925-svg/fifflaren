/* Support Hub 5.5.0 — аниме-стиль «Сакура» для блочного мира.
   Только визуал: сел-шейдинг, контурная обводка, палитра, небо, лепестки, чиби-аватары.
   Механика мира (генерация, крафт, бой) не меняется. */
(function () {
  'use strict';
  const C = window.HubVoxelCore;

  // ---------- Палитра «Сакура» (только клиент, до создания атласа) ----------
  // Яркие сочные цвета как в варианте A. Листва обычных деревьев становится сакурой,
  // хвоя (23) остаётся зелёной — в тайге/тундре прежний вид.
  const PALETTE = {
    1: '#7ccf4e',   // дёрн — сочная трава
    2: '#a97a52',   // земля
    3: '#a9adb0',   // камень
    4: '#8a6a48',   // бревно
    5: '#f4a8c8',   // листва → сакура
    6: '#d9ac72',   // доски
    7: '#c9836b',   // кирпичи
    9: '#f0dfa8',   // песок
    12: '#3fb7ec',  // вода — бирюзовая
    16: '#ffe29a',  // светокамень
    22: '#6b4f36',  // хвойное бревно
  };
  if (C) for (const [id, color] of Object.entries(PALETTE)) {
    const n = Number(id);
    if (C.blocks[n] && !(n >= 29 && n <= 36)) C.blocks[n].color = color;
  }
  for (let level = 1; level <= 8; level++) if (C?.blocks[28 + level]) C.blocks[28 + level].color = PALETTE[12];

  // ---------- Сел-шейдинг ----------
  function gradientMap(T) {
    const data = new Uint8Array([96, 150, 214, 255]);
    const tex = new T.DataTexture(data, 4, 1, T.RedFormat);
    tex.minFilter = tex.magFilter = T.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // ---------- Контурная обводка (inverted hull) ----------
  let outlineMat = null;
  function outline(T, mesh, thickness = 0.03) {
    if (!outlineMat) outlineMat = new T.MeshBasicMaterial({ color: 0x241a26, side: T.BackSide });
    const g = mesh.geometry.clone();
    const pos = g.attributes.position, norm = g.attributes.normal;
    if (norm) for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        pos.getX(i) + norm.getX(i) * thickness,
        pos.getY(i) + norm.getY(i) * thickness,
        pos.getZ(i) + norm.getZ(i) * thickness);
    }
    const m = new T.Mesh(g, outlineMat);
    m.position.copy(mesh.position);
    m.rotation.copy(mesh.rotation);
    m.scale.copy(mesh.scale);
    return m;
  }

  // ---------- Небо: облака и лепестки сакуры ----------
  function makeSky(T, scene) {
    const group = new T.Group();
    scene.add(group);
    // Облака — плоские белые кубические «плюшки», как в аниме-скриншоте
    const cloudMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const clouds = [];
    for (let i = 0; i < 14; i++) {
      const cloud = new T.Group();
      const puffs = 2 + (i % 3);
      for (let j = 0; j < puffs; j++) {
        const w = 5 + ((i * 7 + j * 13) % 6);
        const box = new T.Mesh(new T.BoxGeometry(w, 1.1 + (j % 2) * 0.5, 3.4 + ((i + j) % 3)), cloudMat);
        box.position.set(j * 3.2 - puffs, (j % 2) * 0.55, (j % 3) - 1);
        cloud.add(box);
      }
      const angle = i / 14 * Math.PI * 2;
      cloud.position.set(Math.cos(angle) * (30 + (i % 4) * 14), 44 + (i % 5) * 3, Math.sin(angle) * (30 + (i % 3) * 16));
      group.add(cloud);
      clouds.push({ obj: cloud, ox: cloud.position.x, oz: cloud.position.z, speed: 0.35 + (i % 4) * 0.12 });
    }
    // Лепестки сакуры — розовые частицы вокруг игрока
    const COUNT = 200;
    const geo = new T.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const seeds = [];
    for (let i = 0; i < COUNT; i++) {
      seeds.push({ a: Math.random() * Math.PI * 2, r: 3 + Math.random() * 20, y: Math.random() * 14, fall: 0.5 + Math.random() * 0.7, sway: 0.4 + Math.random() * 0.9 });
    }
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    const petalMat = new T.PointsMaterial({ color: 0xf7b8d2, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
    const petals = new T.Points(geo, petalMat);
    petals.frustumCulled = false;
    scene.add(petals);

    return {
      tick(dt, t, player) {
        for (const c of clouds) {
          c.ox += c.speed * dt;
          if (c.ox > 90) c.ox = -90;
          c.obj.position.x = player.x + c.ox;
          c.obj.position.z = player.z + c.oz;
        }
        for (let i = 0; i < COUNT; i++) {
          const s = seeds[i];
          s.y -= s.fall * dt;
          if (s.y < 0) s.y += 14;
          positions[i * 3] = player.x + Math.cos(s.a + t * 0.0002) * s.r + Math.sin(t * 0.001 * s.sway + i) * 1.4;
          positions[i * 3 + 1] = player.y + s.y - 3;
          positions[i * 3 + 2] = player.z + Math.sin(s.a + t * 0.0002) * s.r;
        }
        geo.attributes.position.needsUpdate = true;
      },
      dispose() {
        group.traverse(o => o.geometry?.dispose());
        cloudMat.dispose(); geo.dispose(); petalMat.dispose();
        group.removeFromParent(); petals.removeFromParent();
      },
    };
  }

  // ---------- Чиби-аватар с большими глазами ----------
  const HAIR = [0x3d7be0, 0xf08bb8, 0x8b5cf6, 0x6b4a2f, 0xf2d16b, 0x39b58a, 0xe05252];
  const EYES = [0x2456c9, 0x7a3fd1, 0x2f9e6e, 0x8a4b21, 0xc23a6e];
  function faceTexture(T, nick) {
    const h = C ? C.hash(nick.length, nick.charCodeAt(0) || 1, 31) : 0.5;
    const eye = EYES[Math.floor(h * EYES.length) % EYES.length];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffd9bd'; g.fillRect(0, 0, 64, 64);           // кожа
    const css = '#' + eye.toString(16).padStart(6, '0');
    for (const cx of [18, 46]) {                                  // большие аниме-глаза
      g.fillStyle = '#ffffff'; g.fillRect(cx - 7, 26, 14, 16);
      g.fillStyle = css; g.fillRect(cx - 5, 28, 10, 13);
      g.fillStyle = '#1b1420'; g.fillRect(cx - 3, 31, 6, 10);
      g.fillStyle = '#ffffff'; g.fillRect(cx - 4, 28, 4, 4); g.fillRect(cx + 1, 36, 2, 2);
      g.fillStyle = '#3a2a2a'; g.fillRect(cx - 7, 22, 14, 3);     // бровь
    }
    g.fillStyle = '#f5a3a3'; g.fillRect(6, 44, 10, 4); g.fillRect(48, 44, 10, 4); // румянец
    g.fillStyle = '#b05a5a'; g.fillRect(29, 48, 6, 3);            // рот
    const tex = new T.CanvasTexture(canvas);
    tex.magFilter = T.NearestFilter; tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }
  function buildAvatar(T, nick) {
    const h = C ? C.hash(nick.length, nick.charCodeAt(0) || 1, 77) : 0.5;
    const hairColor = HAIR[Math.floor(h * HAIR.length) % HAIR.length];
    const group = new T.Group();
    const mats = [];
    const toon = (color) => { const m = new T.MeshToonMaterial({ color }); mats.push(m); return m; };
    const skin = toon(0xffd9bd), cloth = toon(new T.Color().setHSL(h, 0.55, 0.5).getHex());
    const pants = toon(0x3a4660), hair = toon(hairColor);
    const face = new T.MeshToonMaterial({ map: faceTexture(T, nick) }); mats.push(face);
    function box(w, hgt, d, x, y, z, mat, outlined = true) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, hgt, d), mat);
      mesh.position.set(x, y, z);
      if (outlined) { const o = new T.Mesh(mesh.geometry, outlineMat || (outlineMat = new T.MeshBasicMaterial({ color: 0x241a26, side: T.BackSide }))); o.scale.set(1.07, 1.07, 1.07); mesh.add(o); }
      group.add(mesh);
      return mesh;
    }
    // Голова: лицо на +Z (материал index 4)
    const headMats = [skin, skin, hair, skin, face, hair];
    const head = new T.Mesh(new T.BoxGeometry(0.62, 0.62, 0.62), headMats);
    head.position.set(0, 1.28, 0);
    const ho = new T.Mesh(head.geometry, outlineMat || (outlineMat = new T.MeshBasicMaterial({ color: 0x241a26, side: T.BackSide })));
    ho.scale.set(1.06, 1.06, 1.06); head.add(ho);
    group.add(head);
    box(0.68, 0.16, 0.68, 0, 1.63, 0, hair);            // шапочка причёски
    box(0.64, 0.4, 0.14, 0, 1.36, -0.32, hair, false);  // волосы сзади
    box(0.46, 0.42, 0.3, 0, 0.78, 0, cloth);            // тело
    box(0.16, 0.42, 0.18, -0.33, 0.8, 0, skin);         // рука Л
    box(0.16, 0.42, 0.18, 0.33, 0.8, 0, skin);          // рука П
    box(0.19, 0.5, 0.22, -0.13, 0.26, 0, pants);        // нога Л
    box(0.19, 0.5, 0.22, 0.13, 0.26, 0, pants);         // нога П
    // Ник над головой
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48;
    const g = canvas.getContext('2d');
    g.fillStyle = '#2a1733cc'; g.fillRect(0, 0, 256, 48);
    g.fillStyle = '#ffd7ec'; g.font = 'bold 24px Segoe UI'; g.textAlign = 'center';
    g.fillText(nick.slice(0, 18), 128, 32);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthTest: true }));
    sprite.position.y = 2.05; sprite.scale.set(2, 0.375, 1);
    group.add(sprite);
    return { group, mats, sprite };
  }

  // ---------- Подключение к живой сцене ----------
  function restyle(T, scene, renderer, atlas) {
    scene.background = new T.Color(0x8fd3ff);
    renderer.setClearColor(0x8fd3ff);
    if (scene.fog) { scene.fog.color.set(0xaee2ff); scene.fog.near = 28; scene.fog.far = 48; }
    const grad = gradientMap(T);
    const material = new T.MeshToonMaterial({ map: atlas, vertexColors: true, alphaTest: 0.4, gradientMap: grad });
    const waterMaterial = new T.MeshToonMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.68, depthWrite: false, gradientMap: grad });
    // Свет: яркое небо + тёплое солнце, мягкие тени в стиле сел-шейдинга
    for (const child of scene.children) {
      if (child.isHemisphereLight) { child.color.set(0xd6efff); child.groundColor.set(0x8fae62); child.intensity = 1.9; }
      if (child.isDirectionalLight) { child.color.set(0xfff3d0); child.intensity = 1.3; }
    }
    const sky = makeSky(T, scene);
    return {
      material, waterMaterial,
      tick: (dt, t, player) => sky.tick(dt, t, player),
      dispose() { sky.dispose(); material.dispose(); waterMaterial.dispose(); grad.dispose(); },
    };
  }

  window.HubVoxelAnime = { restyle, outline, buildAvatar };
})();
