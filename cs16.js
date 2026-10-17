/* ==========================================================================
   CS 1.6 — de_dust2 (упрощённая браузерная версия) — Support Hub 3.15.0
   Две команды T/CT (1v1..5v5), матч до 16 побед, магазин (B), гранаты.
   ========================================================================== */
(function () {
  'use strict';

  const SERVER = 'https://support-hub-server-v3.onrender.com';

  // ---------- КАРТА (сетка 42x42, ячейка 4 юнита) ----------
  const MW = 42, MH = 42, CELL = 4;
  const WALL_H = 4, DOOR_H = 2.6, CRATE_H = 1.15;
  const grid = [];
  for (let y = 0; y < MH; y++) grid.push(new Array(MW).fill(1));
  function carve(x1, y1, x2, y2) {
    for (let y = Math.max(0, y1); y <= Math.min(MH - 1, y2); y++)
      for (let x = Math.max(0, x1); x <= Math.min(MW - 1, x2); x++) grid[y][x] = 0;
  }
  function door(x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) grid[y][x] = 2;
  }
  function crate(x, y) { grid[y][x] = 3; }
  function buildMap() {
    carve(16, 1, 25, 6);    // CT спавн
    carve(2, 1, 14, 8);     // плент B
    carve(4, 8, 7, 34);     // туннели B
    carve(9, 34, 29, 39);   // T спавн
    carve(4, 34, 9, 36);    // стык туннели → T
    carve(18, 10, 22, 34);  // мид
    carve(33, 1, 38, 35);   // лонг
    carve(26, 1, 38, 9);    // плент A
    carve(22, 6, 27, 10);   // шорт (мид → A)
    carve(8, 2, 16, 5);     // B-двери коридор (CT → B)
    carve(25, 2, 27, 3);    // стык CT → плент A
    carve(15, 11, 18, 13);  // CT → мид
    door(18, 19, 22, 20);   // двери мид
    door(8, 2, 10, 3);      // B-двери
    door(15, 12, 16, 13);   // двери CT-мид
    door(34, 29, 37, 30);   // лонг-двери
    crate(4, 3); crate(6, 5); crate(11, 6); crate(3, 6);            // B сайт
    crate(30, 3); crate(33, 6); crate(28, 7); crate(36, 4); crate(31, 7); // A сайт
    crate(20, 14); crate(19, 27); crate(36, 20); crate(35, 12); crate(6, 20); crate(6, 28);
  }
  buildMap();
  function cellAt(wx, wz) {
    const cx = Math.floor(wx / CELL), cy = Math.floor(wz / CELL);
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 1;
    return grid[cy][cx];
  }
  function cellH(c) { return c === 1 ? WALL_H : c === 2 ? DOOR_H : c === 3 ? CRATE_H : 0; }
  // Горизонтально твёрда ли ячейка для тела с нижней кромкой yLow
  function solidFor(c, yLow) { const h = cellH(c); return h > 0 && yLow < h; }

  // Луч по сетке (DDA): вернёт {t, nx, nz} или null
  function rayWall(ox, oy, oz, dx, dy, dz, maxT) {
    let cx = Math.floor(ox / CELL), cy = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1, stepY = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
    const tDeltaY = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tMaxX = dx !== 0 ? (((dx > 0 ? (cx + 1) * CELL : cx * CELL) - ox) / dx) : Infinity;
    let tMaxY = dz !== 0 ? (((dz > 0 ? (cy + 1) * CELL : cy * CELL) - oz) / dz) : Infinity;
    let t = 0, nx = 0, nz = 0;
    for (let i = 0; i < 128; i++) {
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; cx += stepX; nx = -stepX; nz = 0; }
      else { t = tMaxY; tMaxY += tDeltaY; cy += stepY; nx = 0; nz = -stepY; }
      if (t > maxT) return null;
      const c = (cx < 0 || cy < 0 || cx >= MW || cy >= MH) ? 1 : grid[cy][cx];
      if (c !== 0) {
        const hy = oy + dy * t;
        const h = cellH(c);
        // Попали в объём ячейки (сверху может перелететь)
        if (hy >= 0 && hy <= h) return { t, nx, nz, cell: c };
        if (dy > 0 && hy > h) return null; // летим выше стены
      }
    }
    return null;
  }
  function losClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.001) return true;
    return !rayWall(ax, ay, az, dx / dist, dy / dist, dz / dist, dist - 0.1);
  }

  // ---------- ОРУЖИЕ ----------
  const WEAPONS = {
    knife:  { name: 'Нож',            dmg: 40,  rpm: 80,  mag: Infinity, reserve: Infinity, reload: 0,   spread: 0,   auto: false, melee: true, price: 0 },
    glock:  { name: 'Glock-18',       dmg: 25,  rpm: 352, mag: 20, reserve: 120, reload: 2.0, spread: 1.7, auto: false, price: 0 },
    usp:    { name: 'USP',            dmg: 34,  rpm: 352, mag: 12, reserve: 100, reload: 2.2, spread: 1.2, auto: false, price: 0 },
    deagle: { name: 'Desert Eagle',   dmg: 53,  rpm: 266, mag: 7,  reserve: 35,  reload: 2.0, spread: 0.9, auto: false, price: 650 },
    ak47:   { name: 'AK-47',          dmg: 33,  rpm: 600, mag: 30, reserve: 90,  reload: 2.5, spread: 1.9, auto: true,  price: 2500, team: 't' },
    m4a1:   { name: 'M4A1',           dmg: 33,  rpm: 666, mag: 30, reserve: 90,  reload: 2.3, spread: 1.5, auto: true,  price: 3100, team: 'ct' },
    awp:    { name: 'AWP',            dmg: 115, rpm: 41,  mag: 10, reserve: 30,  reload: 3.0, spread: 3.2, spreadScoped: 0.04, auto: false, price: 4750, scope: true },
  };
  const BUY_ITEMS = [
    { id: 'kevlar',    label: '🦺 Бронежилет',   price: 650 },
    { id: 'deagle',    label: '🔫 Desert Eagle', price: 650 },
    { id: 'ak47',      label: '🔫 AK-47 (T)',    price: 2500 },
    { id: 'm4a1',      label: '🔫 M4A1 (CT)',    price: 3100 },
    { id: 'awp',       label: '🎯 AWP',          price: 4750 },
    { id: 'hegrenade', label: '💣 HE-граната',   price: 300 },
    { id: 'flashbang', label: '✨ Флешка',       price: 200 },
    { id: 'defuser',   label: '🧰 Набор сапёра (CT)', price: 200 },
  ];

  // ---------- СКИНЫ (магазин за казино-деньги) ----------
  const SKINS = {
    banana:    { name: '🍌 Банан',     price: 350,  color: 0xf7d54d },
    waves:     { name: '🌊 Волны',     price: 400,  color: 0x3d9be9 },
    azimov:    { name: '🔥 Азимов',    price: 500,  color: 0xff7a1a },
    radiation: { name: '☢️ Радиация',  price: 600,  color: 0x6dff4d, glow: true },
    dragon:    { name: '🐉 Дракон',    price: 800,  color: 0xd42a2a },
    neon:      { name: '💜 Неон',      price: 1000, color: 0xb44dff, glow: true },
    obsidian:  { name: '🖤 Обсидиан',  price: 1200, color: 0x232323, trim: 0xff2222 },
    gold:      { name: '⭐ Золото',    price: 1500, color: 0xffd700 },
    prismatic: { name: '🌈 Призматик', price: 2000, color: 0xffffff, rainbow: true },
    diamond:   { name: '💎 Алмаз',     price: 3000, color: 0x9fe8ff, glow: true },
  };
  let mySkin = '';             // экипированный скин ('' = стандарт)
  let skinsBalance = 0, skinsOwned = [];

  // ---------- 3.15.3: НАСТОЯЩИЕ 3D-МОДЕЛИ ОРУЖИЯ (GLB) ----------
  // Конфиг: поворот (чтобы ствол смотрел в -Z, верх +Y) и длина в мирах.
  const GLB_MODELS = {
    ak47:    { url: 'models/ak47.glb',    rotY: -Math.PI / 2, len: 0.85 },
    awp:     { url: 'models/awp.glb',     rotY: -Math.PI / 2, len: 1.1 },
    m4a1:    { url: 'models/m4a4.glb',    rotY:  Math.PI / 2, len: 0.8 },
    deagle:  { url: 'models/deagle.glb',  rotY:  Math.PI / 2, len: 0.38 },
    usp:     { url: 'models/pistol.glb',                  len: 0.36 },
    glock:   { url: 'models/pistol.glb',                  len: 0.34 },
    knife:   { url: 'models/bayonet.glb', rotY:  Math.PI / 2, len: 0.55 },
    c4:      { url: 'models/c4.glb',      rotX: -Math.PI / 2, len: 0.42 },
    grenade: { url: 'models/grenade.glb',                  len: 0.3 },
  };
  const glbCache = {}; // weapon -> { model: Group|null }
  // Мини-загрузчик GLB: статические меши + материалы (baseColor/текстура), без скиннинга
  function loadGLBAll() {
    for (const id of Object.keys(GLB_MODELS)) {
      glbCache[id] = { model: null };
      fetch(GLB_MODELS[id].url)
        .then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
        .then(buf => { const m = parseGLB(buf, id); if (m) glbCache[id].model = m; })
        .catch(() => {});
    }
  }
  function parseGLB(buf, id) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) return null; // 'glTF'
    let off = 12, json = null, bin = null;
    const td = new TextDecoder();
    while (off + 8 <= buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      if (type === 0x4E4F534A) json = JSON.parse(td.decode(new Uint8Array(buf, off + 8, len)));
      else if (type === 0x004E4942) bin = new Uint8Array(buf, off + 8, len);
      off += 8 + len;
    }
    if (!json || !bin) return null;
    const binBuf = bin.buffer, binOff = bin.byteOffset;
    // изображения -> objectURL -> текстуры (асинхронно подгружаются в материал)
    const imgURL = (json.images || []).map(img => {
      if (img.bufferView == null) return null;
      const bv = json.bufferViews[img.bufferView];
      const bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      return URL.createObjectURL(new Blob([bytes], { type: img.mimeType || 'image/png' }));
    });
    const textures = (json.textures || []).map(t => {
      if (t.source == null || !imgURL[t.source]) return null;
      const tx = new THREE.TextureLoader().load(imgURL[t.source]);
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.flipY = false; // конвенция glTF
      return tx;
    });
    const compN = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const readAcc = (i) => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
      const start = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0);
      const n = compN[a.type], sz = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
      const stride = bv.byteStride || n * sz;
      const out = new Float32Array(a.count * n);
      for (let k = 0; k < a.count; k++) {
        const base = start + k * stride;
        for (let c = 0; c < n; c++) {
          const o = base + c * sz;
          let v = 0;
          if (a.componentType === 5126) v = dv.getFloat32(o, true);
          else if (a.componentType === 5125) v = dv.getUint32(o, true);
          else if (a.componentType === 5123) v = dv.getUint16(o, true);
          else if (a.componentType === 5121) v = dv.getUint8(o);
          else if (a.componentType === 5122) v = dv.getInt16(o, true);
          else if (a.componentType === 5120) v = dv.getInt8(o);
          out[k * n + c] = v;
        }
      }
      return out;
    };
    const readIdx = (i) => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
      const start = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0);
      if (a.componentType === 5125) return new Uint32Array(binBuf, start, a.count);
      if (a.componentType === 5123) return new Uint16Array(binBuf, start, a.count);
      return null;
    };
    const mats = (json.materials || []).map(m => {
      const p = m.pbrMetallicRoughness || {};
      const col = p.baseColorFactor || [1, 1, 1, 1];
      const mt = new THREE.MeshLambertMaterial({ color: new THREE.Color(col[0], col[1], col[2]) });
      if (p.baseColorTexture != null && textures[p.baseColorTexture.index]) {
        mt.map = textures[p.baseColorTexture.index];
        mt.color.set(0xffffff);
      }
      if (m.doubleSided) mt.side = THREE.DoubleSide;
      if (m.alphaMode === 'BLEND') { mt.transparent = true; mt.opacity = col[3]; }
      return mt;
    });
    const buildNode = (ni) => {
      const n = json.nodes[ni];
      const g = new THREE.Group();
      if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(g.position, g.quaternion, g.scale);
      else {
        if (n.translation) g.position.fromArray(n.translation);
        if (n.rotation) g.quaternion.fromArray(n.rotation);
        if (n.scale) g.scale.fromArray(n.scale);
      }
      if (n.mesh != null) {
        for (const prim of (json.meshes[n.mesh].primitives || [])) {
          if (prim.mode != null && prim.mode !== 4) continue;
          const geo = new THREE.BufferGeometry();
          if (prim.attributes.POSITION != null) geo.setAttribute('position', new THREE.BufferAttribute(readAcc(prim.attributes.POSITION), 3));
          if (prim.attributes.NORMAL != null) geo.setAttribute('normal', new THREE.BufferAttribute(readAcc(prim.attributes.NORMAL), 3));
          if (prim.attributes.TEXCOORD_0 != null) geo.setAttribute('uv', new THREE.BufferAttribute(readAcc(prim.attributes.TEXCOORD_0), 2));
          if (prim.indices != null) { const ix = readIdx(prim.indices); if (ix) geo.setIndex(new THREE.BufferAttribute(ix, 1)); }
          if (!geo.getAttribute('normal')) geo.computeVertexNormals();
          g.add(new THREE.Mesh(geo, mats[prim.material] || new THREE.MeshLambertMaterial({ color: 0x888888 })));
        }
      }
      for (const c of (n.children || [])) g.add(buildNode(c));
      return g;
    };
    const root = new THREE.Group();
    for (const ni of ((json.scenes[json.scene || 0]).nodes || [])) root.add(buildNode(ni));
    // нормализация: поворот по конфигу, масштаб до нужной длины, центровка
    const cfg = GLB_MODELS[id];
    if (cfg.rotY) root.rotation.y = cfg.rotY;
    if (cfg.rotX) root.rotation.x = cfg.rotX;
    root.updateMatrixWorld(true);
    let bb = new THREE.Box3().setFromObject(root);
    let dim = bb.getSize(new THREE.Vector3());
    const maxDim = Math.max(dim.x, dim.y, dim.z) || 1;
    root.scale.setScalar((cfg.len || 0.8) / maxDim);
    root.updateMatrixWorld(true);
    bb = new THREE.Box3().setFromObject(root);
    const ctr = bb.getCenter(new THREE.Vector3());
    root.position.sub(ctr);
    const wrap = new THREE.Group();
    wrap.add(root);
    return wrap;
  }
  // Клон GLB-модели оружия с тонировкой скином
  function glbGunClone(weapon, skin) {
    const entry = glbCache[weapon];
    if (!entry || !entry.model) return null;
    const m = entry.model.clone();
    const s = SKINS[skin];
    if (s) {
      const tint = s.rainbow ? 0xffffff : s.color;
      m.traverse(o => {
        if (o.isMesh) o.material = (s.glow || s.rainbow) ? new THREE.MeshBasicMaterial({ color: tint }) : new THREE.MeshLambertMaterial({ color: tint });
      });
    }
    return m;
  }

  // ---------- БОМБА (пленты A и B — клетки карты) ----------
  const SITE_A = { x1: 27, y1: 1, x2: 38, y2: 9 };
  const SITE_B = { x1: 2, y1: 1, x2: 14, y2: 8 };
  const BOMB_POS = { A: [32 * CELL + 2, 0.25, 4 * CELL + 2], B: [8 * CELL + 2, 0.25, 3 * CELL + 2] };
  let bombPlanted = null;      // {site, pos, explodesAt}
  let bombMesh = null, bombLight = null, lastBeep = -1;
  let action = null;           // {type:'plant'|'defuse', t, need, site?}
  let kickUntil = 0;

  // ---------- СОСТОЯНИЕ КЛИЕНТА ----------
  let sock = null;
  let inited = false, joined = false;
  let myNick = '';
  let state = { phase: 'lobby', mode: 5, round: 0, scores: { t: 0, ct: 0 }, players: [], host: null, freezeEnds: 0, roundEnds: 0, buyUntil: 0, winner: null };
  let clockOffset = 0; // serverNow - clientNow
  let me = { team: null, money: 800, hp: 100, armor: 0, alive: true, weapon: 'usp' };
  let primary = null;           // основное оружие (купленное)
  let current = 'usp';          // текущий слот
  let ammo = {};                // weapon -> {mag, reserve}
  let nades = { he: 0, flash: 0 };
  let scoped = false, reloading = 0, lastShot = 0, bloom = 0;
  let freezeLeft = 0;

  // Игрок (физическое тело)
  const P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false };
  const EYE = 1.62, RADIUS = 0.7, HEIGHT = 1.8;
  const GRAV = 24, JUMP_V = 8.4;

  const remotes = new Map(); // nick -> {group, body, head, tag, tx,tz,ty, tyaw, tpitch, cur:{...}, weapon, team, alive, lastSeen}
  const tracers = [];

  // ---------- THREE ----------
  let renderer3, scene, camera, canvasEl;
  function texCanvas(fn, size) {
    const c = document.createElement('canvas'); c.width = c.height = size || 128;
    fn(c.getContext('2d'), c.width);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function makeTextures() {
    const sand = texCanvas((g, s) => {
      g.fillStyle = '#c9a86b'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${120 + Math.random() * 90 | 0},${95 + Math.random() * 60 | 0},${50 + Math.random() * 40 | 0},0.25)`;
        g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    });
    const wall = texCanvas((g, s) => {
      g.fillStyle = '#b09468'; g.fillRect(0, 0, s, s);
      const bh = s / 4;
      for (let r = 0; r < 4; r++) {
        for (let cix = 0; cix < 2; cix++) {
          const off = (r % 2) * s / 4;
          g.fillStyle = (r + cix) % 2 ? '#ab8f63' : '#b89c70';
          g.fillRect(off + cix * s / 2 + 2, r * bh + 2, s / 2 - 4, bh - 4);
        }
      }
      g.fillStyle = 'rgba(60,45,25,0.35)';
      for (let i = 0; i < 300; i++) g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    });
    const crateT = texCanvas((g, s) => {
      g.fillStyle = '#8a5a2b'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#5f3c1a'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
      g.beginPath(); g.moveTo(3, 3); g.lineTo(s - 3, s - 3); g.moveTo(s - 3, 3); g.lineTo(3, s - 3); g.stroke();
      for (let i = 1; i < 4; i++) { g.strokeStyle = 'rgba(70,42,15,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); }
    });
    const door = texCanvas((g, s) => {
      g.fillStyle = '#6b4a26'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#63431f' : '#74522c'; g.fillRect(i * s / 6 + 1, 0, s / 6 - 2, s); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, s * 0.42, s, s * 0.16);
    });
    return { sand, wall, crateT, door };
  }
  function initScene() {
    renderer3 = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer3.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcbb287);
    scene.fog = new THREE.FogExp2(0xcbb287, 0.012);
    camera = new THREE.PerspectiveCamera(75, 1, 0.08, 400);
    scene.add(camera); // 3.15.1: к камере крепится оружие от первого лица
    const T = makeTextures();
    scene.add(new THREE.HemisphereLight(0xfff0d0, 0x7a6440, 1.05));
    const sun = new THREE.DirectionalLight(0xffe8c0, 0.9);
    sun.position.set(60, 120, 30);
    scene.add(sun);
    // Пол
    T.sand.repeat.set(MW, MH);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(MW * CELL, MH * CELL),
      new THREE.MeshLambertMaterial({ map: T.sand })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(MW * CELL / 2, 0, MH * CELL / 2);
    scene.add(floor);
    // Стены / двери / ящики — инстансы
    const walls = [], doors = [], crates = [];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const c = grid[y][x];
      const px = x * CELL + CELL / 2, pz = y * CELL + CELL / 2;
      if (c === 1) walls.push([px, WALL_H / 2, pz]);
      else if (c === 2) doors.push([px, DOOR_H / 2, pz]);
      else if (c === 3) crates.push([px, CRATE_H / 2, pz]);
    }
    function inst(list, h, tex) {
      if (!list.length) return;
      tex.repeat.set(1, 1);
      const m = new THREE.InstancedMesh(
        new THREE.BoxGeometry(CELL, h, CELL),
        new THREE.MeshLambertMaterial({ map: tex }),
        list.length
      );
      const M = new THREE.Matrix4();
      list.forEach((p, i) => { M.setPosition(p[0], p[1], p[2]); m.setMatrixAt(i, M); });
      scene.add(m);
    }
    inst(walls, WALL_H, T.wall);
    inst(doors, DOOR_H, T.door);
    inst(crates, CRATE_H, T.crateT);
    resize3();
  }
  function resize3() {
    if (!renderer3) return;
    const w = canvasEl.clientWidth || 800, h = canvasEl.clientHeight || 500;
    renderer3.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------- ФИЗИКА ИГРОКА ----------
  function collideAxis(nx, nz) {
    // круг радиуса RADIUS против твёрдых ячеек
    const r = RADIUS;
    const minCx = Math.floor((nx - r) / CELL), maxCx = Math.floor((nx + r) / CELL);
    const minCy = Math.floor((nz - r) / CELL), maxCy = Math.floor((nz + r) / CELL);
    for (let cy = minCy; cy <= maxCy; cy++) for (let cx = minCx; cx <= maxCx; cx++) {
      const c = (cx < 0 || cy < 0 || cx >= MW || cy >= MH) ? 1 : grid[cy][cx];
      if (!solidFor(c, P.y + 0.3)) continue; // можно перепрыгнуть
      // ближайшая точка AABB ячейки
      const bx = Math.max(cx * CELL, Math.min(nx, cx * CELL + CELL));
      const bz = Math.max(cy * CELL, Math.min(nz, cy * CELL + CELL));
      const ddx = nx - bx, ddz = nz - bz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < r * r) {
        if (d2 < 1e-9) {
          // центр внутри ячейки — толкаем к ближайшей грани
          const cxm = cx * CELL + CELL / 2, czm = cy * CELL + CELL / 2;
          const ex = CELL / 2 + r - Math.abs(nx - cxm), ez = CELL / 2 + r - Math.abs(nz - czm);
          if (ex < ez) nx = cxm + Math.sign(nx - cxm || 1) * (CELL / 2 + r);
          else nz = czm + Math.sign(nz - czm || 1) * (CELL / 2 + r);
          continue;
        }
        const d = Math.sqrt(d2);
        const push = (r - d);
        nx += (ddx / d) * push; nz += (ddz / d) * push;
      }
    }
    return [nx, nz];
  }
  // Коллизия с другими игроками (нельзя проходить насквозь)
  function collidePlayers(nx, nz) {
    for (const r of remotes.values()) {
      if (!r.alive) continue;
      const dx = nx - r.x, dz = nz - r.z;
      const d2 = dx * dx + dz * dz, minD = 1.15;
      if (d2 < minD * minD && d2 > 1e-9 && Math.abs(P.y - r.y) < 1.5) {
        const d = Math.sqrt(d2), push = (minD - d);
        nx += (dx / d) * push; nz += (dz / d) * push;
      }
    }
    return [nx, nz];
  }
  function stepPlayer(dt, keys) {
    const speed = (keys.shift ? 2.9 : 5.4) * (scoped ? 0.45 : 1) * (current === 'awp' ? 0.85 : 1);
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    let wx = 0, wz = 0;
    if (keys.w) { wx -= sin; wz -= cos; }
    if (keys.s) { wx += sin; wz += cos; }
    if (keys.a) { wx -= cos; wz += sin; }
    if (keys.d) { wx += cos; wz -= sin; }
    const wl = Math.hypot(wx, wz) || 1;
    wx = wx / wl * speed; wz = wz / wl * speed;
    // трение/разгон в стиле квейка-лайт
    const accel = P.onGround ? 12 : 2.5;
    P.vx += (wx - P.vx) * Math.min(1, accel * dt);
    P.vz += (wz - P.vz) * Math.min(1, accel * dt);
    // гравитация и прыжок
    P.vy -= GRAV * dt;
    if (keys.space && P.onGround) { P.vy = JUMP_V; P.onGround = false; keys.space = false; }
    // по осям с коллизией
    let nx = P.x + P.vx * dt;
    let nz = P.z;
    [nx, nz] = collideAxis(nx, nz);
    nz = P.z + P.vz * dt;
    [nx, nz] = collideAxis(nx, nz);
    [nx, nz] = collidePlayers(nx, nz);
    [nx, nz] = collideAxis(nx, nz);
    P.x = nx; P.z = nz;
    let ny = P.y + P.vy * dt;
    P.onGround = false;
    if (ny <= 0) { ny = 0; P.vy = 0; P.onGround = true; }
    else {
      // потолок / крышка ящика под ногами
      const cUnder = cellAt(P.x, P.z);
      const hUnder = cellH(cUnder);
      if (hUnder > 0 && hUnder < WALL_H && ny > hUnder - 0.01 && P.y >= hUnder - 0.25 && P.vy <= 0) {
        ny = hUnder; P.vy = 0; P.onGround = true;
      }
    }
    P.y = ny;
  }

  // ---------- ЗВУК (WebAudio-синтез, без файлов) ----------
  let AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function sfxNoise(dur, freq, gain, type) {
    const a = ac(); if (!a) return;
    const n = a.sampleRate * dur, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  function sfxShot(w) {
    if (w === 'awp') sfxNoise(0.35, 700, 0.5);
    else if (w === 'deagle') sfxNoise(0.2, 1100, 0.4);
    else if (w === 'knife') sfxNoise(0.08, 2500, 0.15, 'highpass');
    else sfxNoise(0.14, 1600, 0.3);
  }
  function sfxExplosion() { sfxNoise(0.7, 300, 0.7); }
  function sfxFlash() { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 3200; g.gain.value = 0.12; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.35); }
  function sfxBeep() { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 1900; g.gain.value = 0.14; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.08); }
  function sfxHit() { sfxNoise(0.05, 3000, 0.2, 'highpass'); }

  // ---------- DOM ----------
  const root = () => document.getElementById('tab-cs16');
  function el(tag, style, parent, html) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (html != null) e.innerHTML = html;
    (parent || root()).appendChild(e);
    return e;
  }
  let ui = {};
  function buildUI() {
    const r = root();
    r.style.cssText = 'position:relative; padding:0; overflow:hidden; height:calc(100vh - 210px); min-height:480px; background:#141210;';
    r.innerHTML = '';
    // 3.15.1: дети HUD не должны перехватывать клики мыши (из-за этого не работал прицел)
    const st = document.createElement('style');
    st.textContent = '#tab-cs16 .cs16-hud, #tab-cs16 .cs16-hud * { pointer-events: none !important; }';
    document.head.appendChild(st);
    ui.canvas = el('canvas', 'position:absolute; inset:0; width:100%; height:100%; display:none;', r);
    canvasEl = ui.canvas;
    // Лобби
    ui.lobby = el('div', 'position:absolute; inset:0; overflow:auto; padding:16px; background:linear-gradient(160deg,#1d1a14,#141210); color:#eee;', r);
    // HUD
    ui.hud = el('div', 'position:absolute; inset:0; pointer-events:none; display:none;', r);
    ui.hud.className = 'cs16-hud';
    ui.topBar = el('div', 'position:absolute; top:8px; left:50%; transform:translateX(-50%); text-align:center; font:bold 15px monospace; color:#fff; text-shadow:0 1px 3px #000;', ui.hud);
    ui.scoreT = el('div', 'position:absolute; top:8px; left:14px; font:bold 15px monospace; color:#e8c34a; text-shadow:0 1px 3px #000;', ui.hud);
    ui.scoreCT = el('div', 'position:absolute; top:8px; right:14px; font:bold 15px monospace; color:#5aa2e8; text-shadow:0 1px 3px #000;', ui.hud);
    ui.hpBar = el('div', 'position:absolute; bottom:16px; left:14px; width:210px;', ui.hud);
    ui.hpTxt = el('div', 'font:bold 13px monospace; color:#fff; text-shadow:0 1px 2px #000;', ui.hpBar);
    ui.armorTxt = el('div', 'font:bold 12px monospace; color:#9fd0ff; text-shadow:0 1px 2px #000;', ui.hpBar);
    ui.money = el('div', 'position:absolute; bottom:44px; right:16px; font:bold 18px monospace; color:#7ee08a; text-shadow:0 1px 3px #000;', ui.hud);
    ui.ammo = el('div', 'position:absolute; bottom:16px; right:16px; font:bold 14px monospace; color:#fff; text-shadow:0 1px 3px #000;', ui.hud);
    ui.nadeTxt = el('div', 'position:absolute; bottom:70px; right:16px; font:12px monospace; color:#ffd27e; text-shadow:0 1px 2px #000;', ui.hud);
    ui.killfeed = el('div', 'position:absolute; top:38px; right:12px; text-align:right; font:12px monospace; color:#ffd; text-shadow:0 1px 2px #000;', ui.hud);
    ui.crosshair = el('div', 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font:18px monospace; color:#0f0; text-shadow:0 0 3px #000;', ui.hud, '+');
    ui.hitmark = el('div', 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font:bold 20px monospace; color:#ff4444; display:none;', ui.hud, '✕');
    ui.banner = el('div', 'position:absolute; top:22%; left:50%; transform:translateX(-50%); font:bold 26px monospace; color:#ffc107; text-shadow:0 2px 6px #000; display:none; text-align:center;', ui.hud);
    ui.centerMsg = el('div', 'position:absolute; top:38%; left:50%; transform:translate(-50%,-50%); font:bold 18px monospace; color:#fff; text-shadow:0 2px 6px #000; display:none; text-align:center;', ui.hud);
    ui.scope = el('div', 'position:absolute; inset:0; display:none; background:radial-gradient(circle at center, transparent 26%, #000 27%);', ui.hud);
    el('div', 'position:absolute; left:0; right:0; top:50%; height:1px; background:#000;', ui.scope);
    el('div', 'position:absolute; top:0; bottom:0; left:50%; width:1px; background:#000;', ui.scope);
    ui.flash = el('div', 'position:absolute; inset:0; background:#fff; opacity:0;', ui.hud);
    ui.dmgVin = el('div', 'position:absolute; inset:0; box-shadow:inset 0 0 120px rgba(255,0,0,0.7); opacity:0;', ui.hud);
    // 3.15.1: подсказка действия (E), прогресс закладки/разминирования, таймер бомбы
    ui.hint = el('div', 'position:absolute; bottom:26%; left:50%; transform:translateX(-50%); font:bold 15px monospace; color:#ffd76a; text-shadow:0 1px 4px #000; display:none;', ui.hud);
    ui.actWrap = el('div', 'position:absolute; bottom:22%; left:50%; transform:translateX(-50%); width:240px; height:12px; background:rgba(0,0,0,0.6); border:1px solid #ffc107; display:none;', ui.hud);
    ui.actFill = el('div', 'height:100%; width:0%; background:#ffc107;', ui.actWrap);
    ui.bombTimer = el('div', 'position:absolute; top:52px; left:50%; transform:translateX(-50%); font:bold 26px monospace; color:#ff4444; text-shadow:0 2px 6px #000; display:none;', ui.hud);
    // Магазин
    ui.buy = el('div', 'position:absolute; inset:0; display:none; background:rgba(0,0,0,0.55); pointer-events:auto;', r);
    const bw = el('div', 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#1c1a16; border:1px solid #8a6b3a; padding:14px 18px; min-width:340px; color:#eee;', ui.buy);
    el('div', 'font:bold 16px monospace; color:#ffc107; margin-bottom:8px;', bw, '🛒 ПОКУПКИ <span style="float:right;color:#7ee08a;" id="cs16BuyMoney"></span>');
    ui.buyList = el('div', '', bw);
    el('div', 'font:11px monospace; color:#999; margin-top:8px;', bw, 'B — закрыть · 1-9 — купить быстро · покупка в начале раунда (freeze + 15 сек)');
    // 3.15.3: панель хоста после конца матча — реванш или выход в меню
    ui.hostPanel = el('div', 'position:absolute; left:50%; top:62%; transform:translateX(-50%); display:none; background:rgba(20,16,10,0.92); border:1px solid #8a6b3a; border-radius:6px; padding:12px 16px; text-align:center; pointer-events:auto;', ui.hud);
    el('div', 'font:bold 13px monospace; color:#ffc107; margin-bottom:8px;', ui.hostPanel, '👑 Хост: управление матчем');
    const hpRow = el('div', '', ui.hostPanel);
    const rematchBtn = el('button', 'padding:8px 18px; margin:0 6px; font:bold 14px monospace; cursor:pointer; background:#2d6a22; color:#dfffcf; border:1px solid #4a8a3a;', hpRow, '🔄 НАЧАТЬ ЗАНОВО');
    const menuBtn = el('button', 'padding:8px 18px; margin:0 6px; font:bold 14px monospace; cursor:pointer; background:#6a2d22; color:#ffd9cf; border:1px solid #8a4a3a;', hpRow, '🏳️ ВЫЙТИ В МЕНЮ');
    rematchBtn.onclick = () => sock && sock.emit('cs16_rematch');
    menuBtn.onclick = () => { if (confirm('Завершить матч и выйти в меню? Команды будут сброшены.')) sock && sock.emit('cs16_tomenu'); };
    window.addEventListener('resize', resize3);
  }
  function renderBuyList() {
    ui.buyList.innerHTML = '';
    const mEl = document.getElementById('cs16BuyMoney');
    if (mEl) mEl.textContent = '$' + me.money;
    for (const [i, it] of BUY_ITEMS.entries()) {
      const w = WEAPONS[it.id];
      const teamGate = (w && w.team) || it.team;
      let dis = (teamGate && teamGate !== me.team) || me.money < it.price;
      if (it.id === 'defuser' && me.kit) dis = true;
      const b = el('button', `display:block; width:100%; margin:4px 0; padding:7px 10px; text-align:left; font:13px monospace; cursor:pointer; background:${dis ? '#333' : '#2d4a22'}; color:${dis ? '#777' : '#dfffcf'}; border:1px solid #555;`, ui.buyList);
      b.textContent = `[${i + 1}] ${it.label} — $${it.price}` + (it.id === 'defuser' && me.kit ? ' ✓ есть' : '');
      if (dis) b.disabled = true;
      b.onclick = () => { sock && sock.emit('cs16_buy', it.id); };
    }
  }
  function banner(txt, color, ms) {
    ui.banner.textContent = txt;
    ui.banner.style.color = color || '#ffc107';
    ui.banner.style.display = 'block';
    clearTimeout(banner._t);
    if (ms) banner._t = setTimeout(() => { ui.banner.style.display = 'none'; }, ms);
  }
  function centerMsg(txt, ms) {
    ui.centerMsg.innerHTML = txt;
    ui.centerMsg.style.display = 'block';
    clearTimeout(centerMsg._t);
    if (ms) centerMsg._t = setTimeout(() => { ui.centerMsg.style.display = 'none'; }, ms);
  }
  function killfeed(txt) {
    const d = el('div', 'margin:2px 0; background:rgba(0,0,0,0.45); padding:2px 8px; border-radius:3px;', ui.killfeed, txt);
    while (ui.killfeed.children.length > 6) ui.killfeed.removeChild(ui.killfeed.firstChild);
    setTimeout(() => d.remove(), 6000);
  }

  // ---------- ЛОББИ ----------
  // ---------- МАГАЗИН СКИНОВ ----------
  async function loadSkins() {
    try {
      const r = await fetch(`${SERVER}/api/cs16/skins?username=${encodeURIComponent(myNick)}`);
      const d = await r.json();
      if (d.success) { skinsBalance = d.balance; skinsOwned = d.owned || []; mySkin = d.equipped || ''; refreshSkinsPanel(); refreshViewmodelSkin(); }
    } catch (e) {}
  }
  function refreshSkinsPanel() {
    const p = document.getElementById('cs16SkinsPanel');
    if (!p) return;
    const bal = document.getElementById('cs16SkinsBalance');
    if (bal) bal.textContent = '💰 ' + skinsBalance + '$ (казино)';
    const list = document.getElementById('cs16SkinsList');
    if (!list) return;
    list.innerHTML = Object.entries(SKINS).map(([id, s]) => {
      const owned = skinsOwned.includes(id);
      const eq = mySkin === id;
      return `<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; margin:4px 0; background:#26221a; border-radius:4px;">
        <span style="display:inline-block; width:26px; height:14px; border-radius:3px; background:#${s.color.toString(16).padStart(6, '0')}; ${s.glow ? 'box-shadow:0 0 8px #' + s.color.toString(16).padStart(6, '0') : ''};"></span>
        <span style="flex:1;">${s.name}</span>
        ${eq ? '<b style="color:#7ee08a;">НАДЕТ</b>' : owned
          ? `<button class="cs16EquipBtn" data-s="${id}" style="padding:4px 12px; cursor:pointer; background:#2d4a22; color:#dfffcf; border:1px solid #4a8a3a;">Надеть</button>`
          : `<button class="cs16BuySkinBtn" data-s="${id}" style="padding:4px 12px; cursor:pointer; background:#4a3a1a; color:#ffd76a; border:1px solid #8a6b3a;">Купить $${s.price}</button>`}
      </div>`;
    }).join('');
    list.querySelectorAll('.cs16BuySkinBtn').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await fetch(`${SERVER}/api/cs16/skins/buy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: myNick, skin: b.dataset.s }) });
        const d = await r.json();
        if (d.success) { skinsBalance = d.balance; skinsOwned = d.owned; loadSkins(); }
        else alert(d.message || 'Ошибка покупки');
      } catch (e) { alert('Нет связи'); }
    });
    list.querySelectorAll('.cs16EquipBtn').forEach(b => b.onclick = async () => {
      try {
        const r = await fetch(`${SERVER}/api/cs16/skins/equip`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: myNick, skin: b.dataset.s }) });
        const d = await r.json();
        if (d.success) { mySkin = d.equipped; loadSkins(); }
      } catch (e) {}
    });
    const un = document.getElementById('cs16SkinUnequip');
    if (un) un.style.display = mySkin ? '' : 'none';
  }

  function renderLobby() {
    const inMatch = state.phase !== 'lobby';
    const isFiff = myNick.toLowerCase() === 'fifflaren';
    ui.lobby.style.display = 'block';
    ui.canvas.style.display = 'none';
    ui.hud.style.display = 'none';
    const adminBtns = (p) => isFiff && p.nick.toLowerCase() !== 'fifflaren'
      ? ` <button class="cs16HostBtn" data-n="${esc(p.nick)}" title="Сделать хостом" style="padding:0 6px; cursor:pointer;">👑</button><button class="cs16KickBtn" data-n="${esc(p.nick)}" title="Кикнуть из комнаты" style="padding:0 6px; cursor:pointer; color:#ff7777;">🥾</button>`
      : '';
    const rows = (team) => state.players.filter(p => p.team === team)
      .map(p => `<div style="padding:3px 8px; background:#26221a; margin:3px 0; border-radius:4px;">${esc(p.nick)} <span style="color:#888; font-size:11px;">${p.kills || 0}/${p.deaths || 0}</span>${adminBtns(p)}</div>`).join('');
    const spectators = state.players.filter(p => !p.team).map(p => esc(p.nick)).join(', ');
    ui.lobby.innerHTML = `
      <div style="max-width:760px; margin:0 auto;">
        <div style="font:bold 26px monospace; color:#e8c34a; text-align:center;">🔫 COUNTER-STRIKE 1.6 <span style="color:#999; font-size:13px;">de_dust2 · матч до 16 побед · C4</span></div>
        ${inMatch ? `<div style="text-align:center; margin:10px 0; padding:8px; background:#3a2a1a; border:1px solid #8a6b3a;">⚔️ Идёт матч — раунд ${state.round}, счёт <b style="color:#e8c34a">${state.scores.t}</b> : <b style="color:#5aa2e8">${state.scores.ct}</b>. Дождись конца, в следующем матче сможешь играть.</div>` : ''}
        <div style="display:flex; gap:14px; margin-top:12px;">
          <div style="flex:1; background:#241f16; border:1px solid #6a5527; border-radius:6px; padding:10px;">
            <div style="font:bold 15px monospace; color:#e8c34a;">ТЕРРОРИСТЫ (${state.players.filter(p => p.team === 't').length}/${state.mode})</div>
            <div id="cs16TList">${rows('t')}</div>
            <button id="cs16JoinT" style="margin-top:6px; width:100%; padding:7px; background:#7a5f22; border:none; color:#ffe9ad; font:bold 13px monospace; cursor:pointer;">Вступить в Т</button>
          </div>
          <div style="flex:1; background:#1a2028; border:1px solid #2f557f; border-radius:6px; padding:10px;">
            <div style="font:bold 15px monospace; color:#5aa2e8;">КОНТР-ТЕРРОРИСТЫ (${state.players.filter(p => p.team === 'ct').length}/${state.mode})</div>
            <div id="cs16CTList">${rows('ct')}</div>
            <button id="cs16JoinCT" style="margin-top:6px; width:100%; padding:7px; background:#274a72; border:none; color:#cfe8ff; font:bold 13px monospace; cursor:pointer;">Вступить в CT</button>
          </div>
        </div>
        <div style="margin-top:12px; background:#201c15; border-radius:6px; padding:10px; text-align:center;">
          <div style="font:13px monospace; color:#ccc;">Размер команд:
            ${[1,2,3,4,5].map(n => `<button class="cs16ModeBtn" data-n="${n}" style="padding:4px 12px; margin:0 3px; cursor:pointer; background:${state.mode === n ? '#8a6b3a' : '#333'}; color:#fff; border:1px solid #555; font:bold 13px monospace;">${n}v${n}</button>`).join('')}
          </div>
          <div style="font:12px monospace; color:#999; margin-top:6px;">Хост: <b style="color:#ffc107">${esc(state.host || '—')}</b>${state.host === myNick ? ' (это ты — жми старт, когда все распределятся)' : ''}</div>
          ${spectators ? `<div style="font:12px monospace; color:#888; margin-top:4px;">Без команды: ${spectators}</div>` : ''}
          <button id="cs16StartBtn" style="margin-top:8px; padding:10px 30px; font:bold 16px monospace; cursor:pointer; background:${state.host === myNick ? '#2d6a22' : '#333'}; color:#dfffcf; border:1px solid #4a8a3a;">▶ НАЧАТЬ МАТЧ</button>
          <div style="margin-top:8px;">
            <button id="cs16SkinsBtn" style="padding:8px 20px; font:bold 14px monospace; cursor:pointer; background:#3a2a4a; color:#e0c8ff; border:1px solid #7a5aa8;">🎨 МАГАЗИН СКИНОВ</button>
          </div>
        </div>
        <div id="cs16SkinsPanel" style="display:none; margin-top:12px; background:#191622; border:1px solid #4a3a6a; border-radius:6px; padding:12px;">
          <div style="font:bold 15px monospace; color:#d8b8ff;">🎨 Скины оружия <span id="cs16SkinsBalance" style="float:right; color:#7ee08a;"></span></div>
          <div style="font:11px monospace; color:#9988bb; margin:4px 0 8px;">Покупаются за деньги казино. Скин видят все игроки — и у тебя в руках, и у модельки.</div>
          <div id="cs16SkinsList"></div>
          <button id="cs16SkinUnequip" style="margin-top:6px; padding:5px 14px; cursor:pointer; background:#333; color:#ccc; border:1px solid #555;">Снять скин</button>
        </div>
        ${isFiff ? `<div style="margin-top:12px; background:#2a1515; border:1px solid #7a3a3a; border-radius:6px; padding:10px; font:12px monospace; color:#e8b8b8;">👑 Ты Fifflaren: кнопки <b>👑</b> у ника — отдать хост, <b>🥾</b> — кикнуть из комнаты (если хост афк).</div>` : ''}
        <div style="margin-top:10px; font:12px monospace; color:#888; line-height:1.7;">
          Управление: WASD — движение · Shift — тихий шаг · Пробел — прыжок · Мышь — прицел · ЛКМ — огонь · ПКМ (AWP) — прицел ·
          R — перезарядка · B — магазин (1-9 — быстрая покупка) · G — HE-граната · F — флешка · 1/2/3 — основное/пистолет/нож · <b style="color:#ffd76a;">E — закладка/разминирование C4</b> · <b style="color:#7ec2ff;">M — смена команды</b>
        </div>
      </div>`;
    const jt = document.getElementById('cs16JoinT'), jc = document.getElementById('cs16JoinCT');
    if (jt) jt.onclick = () => sock && sock.emit('cs16_team', 't');
    if (jc) jc.onclick = () => sock && sock.emit('cs16_team', 'ct');
    document.querySelectorAll('.cs16ModeBtn').forEach(b => { b.onclick = () => sock && sock.emit('cs16_mode', Number(b.dataset.n)); });
    const sb = document.getElementById('cs16StartBtn');
    if (sb) sb.onclick = () => sock && sock.emit('cs16_start');
    document.querySelectorAll('.cs16HostBtn').forEach(b => b.onclick = () => sock && sock.emit('cs16_sethost', b.dataset.n));
    document.querySelectorAll('.cs16KickBtn').forEach(b => b.onclick = () => { if (confirm('Кикнуть ' + b.dataset.n + ' из комнаты КС?')) sock && sock.emit('cs16_kick', b.dataset.n); });
    const sk = document.getElementById('cs16SkinsBtn');
    if (sk) sk.onclick = () => {
      const p = document.getElementById('cs16SkinsPanel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
      if (p.style.display === 'block') loadSkins();
    };
    const un = document.getElementById('cs16SkinUnequip');
    if (un) un.onclick = async () => {
      try {
        const r = await fetch(`${SERVER}/api/cs16/skins/equip`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: myNick, skin: '' }) });
        const d = await r.json();
        if (d.success) { mySkin = ''; loadSkins(); }
      } catch (e) {}
    };
    refreshSkinsPanel();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------- СЕТЬ ----------
  function ensureSocket() {
    if (sock) return;
    sock = io(SERVER, { reconnectionAttempts: Infinity });
    sock.on('connect', () => { joined = false; doJoin(); });
    sock.on('disconnect', () => { centerMsg('🔌 Связь с сервером потеряна...', 0); });
    sock.on('cs16_state', (s) => {
      state = s;
      if (s.now) clockOffset = s.now - Date.now();
      me.team = (s.players.find(p => p.nick === myNick) || {}).team ?? me.team;
      if (s.phase === 'lobby') { renderLobby(); return; }
      ui.lobby.style.display = 'none';
      ui.canvas.style.display = 'block';
      ui.hud.style.display = 'block';
      resize3();
    });
    sock.on('cs16_you', (y) => {
      me.money = y.money; me.hp = y.hp; me.armor = y.armor; me.team = y.team; me.alive = y.alive; me.kit = y.kit;
      if (y.weapon && y.weapon !== current && WEAPONS[y.weapon]) { primary = y.weapon; }
    });
    sock.on('cs16_err', (m) => { killfeed('⚠️ ' + esc(m)); if (ui.buy.style.display === 'block') renderBuyList(); });
    sock.on('cs16_swapped', (d) => {
      killfeed(`🔁 Ты перешёл в команду ${d.team === 't' ? 'ТЕРРОРИСТОВ' : 'КОНТР-ТЕРРОРИСТОВ'}`);
      current = d.team === 't' ? 'glock' : 'usp';
      primary = null;
      if (ui.buy.style.display === 'block') renderBuyList();
    });
    sock.on('cs16_bought', (d) => {
      buyOk(d.item);
      me.money = d.money;
      killfeed('🛒 Куплено: ' + esc(WEAPONS[d.item] ? WEAPONS[d.item].name : d.item));
      if (ui.buy.style.display === 'block') renderBuyList();
    });
    // ---------- C4 ----------
    sock.on('cs16_bomb_planted', (d) => {
      bombPlanted = { site: d.site, pos: d.pos, explodesAt: d.explodesAt };
      if (d.now) clockOffset = d.now - Date.now();
      spawnBombMesh(d.pos);
      banner(`💣 БОМБА ЗАЛОЖЕНА НА ${d.site}`, '#ff5544', 3000);
      killfeed(`💣 ${esc(d.planter)} заложил бомбу на ${d.site}`);
      action = null;
    });
    sock.on('cs16_bomb_defused', (d) => {
      killfeed(`🧰 ${esc(d.nick)} обезвредил бомбу`);
      bombPlanted = null; action = null; removeBombMesh();
    });
    sock.on('cs16_bomb_exploded', (d) => {
      if (d.pos) { explodeFx(d.pos, 'he'); shake = Math.max(shake, 0.8); sfxExplosion(); }
      bombPlanted = null; action = null; removeBombMesh();
    });
    sock.on('cs16_kicked', () => {
      kickUntil = Date.now() + 30000;
      joined = false;
      banner('🥾 Тебя выкинул из комнаты Fifflaren', '#ff7777', 5000);
    });
    sock.on('cs16_round_start', (d) => {
      state.round = d.round; state.scores = d.scores;
      const sp = (d.spawns || []).find(x => {
        const pl = state.players.find(p => p.id === x.id);
        return pl && pl.nick === myNick;
      });
      me.alive = true; me.hp = 100;
      scoped = false; reloading = 0; bloom = 0;
      nades.he = 0; nades.flash = 0;
      // Сброс боезапаса
      ammo = {};
      for (const k of ['glock', 'usp', 'deagle', 'ak47', 'm4a1', 'awp']) ammo[k] = { mag: WEAPONS[k].mag, reserve: WEAPONS[k].reserve };
      if (!primary) current = me.team === 't' ? 'glock' : 'usp';
      else current = primary;
      if (sp) { P.x = sp.pos[0]; P.y = 0; P.z = sp.pos[2]; P.vx = P.vy = P.vz = 0; }
      // ставим соперников на их спавны, чтобы не мелькали в углу
      const spawnNicks = new Set();
      for (const s of (d.spawns || [])) {
        const pl = state.players.find(p => p.id === s.id);
        if (!pl || pl.nick === myNick) continue;
        spawnNicks.add(pl.nick);
        const r = addRemote(pl.nick, pl.team);
        r.alive = true; // 3.15.2: воскрешаем модельки на новый раунд
        r.group.rotation.z = 0;
        r.x = r.tx = s.pos[0]; r.y = r.ty = s.pos[1] - EYE; r.z = r.tz = s.pos[2];
      }
      // 3.15.5: трупы/лишние модельки не из этого раунда — убираем с карты
      for (const n of [...remotes.keys()]) if (!spawnNicks.has(n)) removeRemote(n);
      bombPlanted = null; action = null; lastBeep = -1;
      removeBombMesh();
      banner(`РАУНД ${d.round}`, '#ffc107', 2500);
      centerMsg('🛒 Покупки: жми <b>B</b>', 4000);
      closeBuy();
    });
    sock.on('cs16_live', () => { banner('❗ РАУНД НАЧАЛСЯ', '#ff5544', 1500); closeBuy(); });
    sock.on('cs16_pos', (d) => {
      let r = remotes.get(d.nick);
      if (!r) r = addRemote(d.nick, d.team);
      r.tx = d.pos[0]; r.ty = d.pos[1]; r.tz = d.pos[2];
      r.tyaw = d.yaw; r.tpitch = d.pitch; r.weapon = d.weapon; r.skin = d.skin || ''; r.lastSeen = performance.now();
      r.moving = !!d.move;
    });
    sock.on('cs16_shoot', (d) => {
      const r = remotes.get(d.nick);
      if (r) { r.muzzle = performance.now(); }
      spawnTracer(d.origin, d.dir, WEAPONS[d.weapon] ? Math.min(120, WEAPONS[d.weapon].dmg * 3) : 60, true);
      sfxShot(d.weapon);
    });
    sock.on('cs16_hit', (d) => {
      if (d.target === myNick) {
        me.hp = d.hp;
        ui.dmgVin.style.opacity = '1';
        setTimeout(() => { ui.dmgVin.style.opacity = '0'; }, 220);
        if (me.hp <= 0) me.alive = false;
      }
      ui.hitmark.style.display = 'block';
      setTimeout(() => { ui.hitmark.style.display = 'none'; }, 120);
      sfxHit();
    });
    sock.on('cs16_death', (d) => {
      killfeed(d.killer
        ? `☠️ ${esc(d.killer)} → ${esc(d.nick)}${d.head ? ' 🎯' : ''}`
        : (d.weapon === 'swap' ? `🔁 ${esc(d.nick)} сменил команду` : `💥 ${esc(d.nick)} разорвало гранатой`));
      if (d.nick === myNick) {
        me.alive = false; scoped = false; closeBuy();
        primary = null; current = me.team === 't' ? 'glock' : 'usp'; // убитый роняет основное оружие
        centerMsg(d.weapon === 'swap'
          ? '🔁 Команда сменена — ты появишься в новой команде со следующего раунда'
          : `☠️ Тебя убил <b>${esc(d.killer || 'граната')}</b><br><span style="font-size:13px; color:#999;">Жди следующий раунд</span>`, 0);
      }
      const r = remotes.get(d.nick);
      if (r) r.alive = false;
    });
    sock.on('cs16_nade', (d) => { spawnNade(d.pos, d.vel, d.kind || 'he', false); });
    sock.on('cs16_boom', (d) => {
      explodeFx(d.pos, d.kind);
      if (d.kind === 'flash') {
        const dist = Math.hypot(P.x - d.pos[0], (P.y + EYE) - d.pos[1], P.z - d.pos[2]);
        if (dist < 14 && losClear(P.x, P.y + EYE, P.z, d.pos[0], d.pos[1], d.pos[2])) {
          const a = Math.max(0, 1.25 - dist / 12);
          flashAlpha = Math.max(flashAlpha, a);
          sfxFlash();
        }
      } else {
        const dist = Math.hypot(P.x - d.pos[0], (P.y + EYE) - d.pos[1], P.z - d.pos[2]);
        if (dist < 6.5 && losClear(P.x, P.y + EYE, P.z, d.pos[0], d.pos[1], d.pos[2]) && me.alive) {
          const dmg = Math.round(98 * (1 - dist / 6.5));
          if (dmg > 0) sock.emit('cs16_boomdmg', dmg);
        }
        if (dist < 30) shake = Math.max(shake, 0.5 * (1 - dist / 30));
        sfxExplosion();
      }
    });
    sock.on('cs16_round_end', (d) => {
      const ctWin = d.winner === 'ct';
      banner(ctWin ? '🛡️ CT ВЫИГРАЛИ РАУНД' : '🔪 Т ВЫИГРАЛИ РАУНД', ctWin ? '#5aa2e8' : '#e8c34a', 4000);
      killfeed(`🏁 Раунд ${d.round}: ${d.reason}`);
      me.alive = false;
      centerMsg('', 0); ui.centerMsg.style.display = 'none';
      closeBuy();
    });
    sock.on('cs16_match_end', (d) => {
      const txt = d.winner === 'draw' ? '🤝 НИЧЬЯ' : d.winner === 't' ? '🔪 ПОБЕДА ТЕРРОРИСТОВ' : '🛡️ ПОБЕДА КОНТРОВ';
      banner(`${txt} — ${d.scores.t}:${d.scores.ct}`, '#ffc107', 11000);
      setTimeout(() => { remotesClear(); }, 1000);
    });
    sock.on('cs16_leave', (d) => { removeRemote(d.nick); });
  }
  function doJoin() {
    if (Date.now() < kickUntil) return; // кик от Fifflaren — пауза 30 сек
    if (sock && sock.connected && myNick && !joined) { sock.emit('cs16_join', myNick); joined = true; }
  }

  // ---------- УДАЛЁННЫЕ ИГРОКИ ----------
  function makeTag(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 56;
    const g = c.getContext('2d');
    g.font = 'bold 30px monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.55)';
    const w = g.measureText(text).width + 18;
    g.fillRect(128 - w / 2, 4, w, 44);
    g.fillStyle = color;
    g.fillText(text, 128, 38);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.scale.set(2.6, 0.57, 1);
    sp.position.y = 2.25;
    return sp;
  }
  function addRemote(nick, team) {
    const jacket = team === 't' ? 0xc9a13b : 0x3b7ac9;
    const pants = 0x3a3f45;
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.4), mat(jacket));
    torso.position.y = 1.18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mat(0xd8b08c));
    head.position.y = 1.72;
    // ноги (пивоты в бедрах — качаются при ходьбе)
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.18, 0.86, 0); legR.position.set(0.18, 0.86, 0);
    const legMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.26), mat(pants));
    legMeshL.position.y = -0.43;
    const legMeshR = legMeshL.clone();
    legL.add(legMeshL); legR.add(legMeshR);
    // руки
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.44, 1.46, 0); armR.position.set(0.44, 1.46, 0);
    const armMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), mat(jacket));
    armMeshL.position.y = -0.28;
    const armMeshR = armMeshL.clone();
    armL.add(armMeshL); armR.add(armMeshR);
    // крепление оружия в правую руку
    const gunHolder = new THREE.Group();
    gunHolder.position.set(0, -0.52, -0.15);
    armR.add(gunHolder);
    g.add(torso, head, legL, legR, armL, armR);
    // 3.15.5: табличку с ником видят только свои — ники врагов не показываем
    if (team && me.team && team === me.team) g.add(makeTag(nick, team === 't' ? '#ffd95e' : '#7ec2ff'));
    scene.add(g);
    const r = { group: g, torso, head, legL, legR, armL, armR, gunHolder, gun: null, gunWeapon: '', gunSkin: '',
      x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, yaw: 0, tyaw: 0, pitch: 0, tpitch: 0,
      weapon: 'usp', skin: '', team, alive: false, moving: false, muzzle: 0, walkPhase: Math.random() * 6 };
    remotes.set(nick, r);
    return r;
  }
  // Оружие в руках пересобираем при смене оружия/скина
  function setRemoteGun(r) {
    const hasGlb = !!(glbCache[r.weapon || 'usp'] && glbCache[r.weapon || 'usp'].model);
    if (r.gunWeapon === r.weapon && r.gunSkin === r.skin && r.gunGlb === hasGlb) return;
    r.gunWeapon = r.weapon; r.gunSkin = r.skin; r.gunGlb = hasGlb;
    while (r.gunHolder.children.length) r.gunHolder.remove(r.gunHolder.children[0]);
    r.gun = buildGun(r.weapon || 'usp', r.skin, 1);
    r.gunHolder.add(r.gun);
  }
  // Модель оружия из примитивов по мотивам CS:GO (АК с изогнутым магазином, AWP с прицелом и затвором),
  // красится скином. scale>1.5 — вид от первого лица (более детально).
  function buildGun(weapon, skin, scale) {
    const g = new THREE.Group();
    // 3.15.3: настоящая GLB-модель, если уже загрузилась
    const glb = glbGunClone(weapon, skin);
    if (glb) {
      glb.scale.multiplyScalar((scale || 1) * 0.9);
      g.add(glb);
      return g;
    }
    const s = SKINS[skin];
    const bodyC = s ? s.color : 0x6a6a74;
    const trimC = s && s.trim ? s.trim : 0x33333a;
    const woodC = 0x8a5a28;
    const mat = (c) => (s && (s.glow || s.rainbow)) ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c });
    const dark = new THREE.MeshLambertMaterial({ color: 0x232327 });
    const wood = new THREE.MeshLambertMaterial({ color: woodC });
    const sc = scale || 1;
    const det = sc > 1.5; // детализация для первого лица
    const add = (geo, m, x, y, z, rx, ry, rz) => {
      const mm = new THREE.Mesh(geo, m);
      mm.scale.setScalar(sc); // размеры умножаем на масштаб, позиции — отдельно
      mm.position.set(x * sc, y * sc, z * sc);
      if (rx) mm.rotation.x = rx; if (ry) mm.rotation.y = ry; if (rz) mm.rotation.z = rz;
      g.add(mm); return mm;
    };
    if (weapon === 'knife') {
      add(new THREE.BoxGeometry(0.035, 0.05, 0.36), new THREE.MeshLambertMaterial({ color: 0xd6dbe2 }), 0, 0.02, -0.26);
      add(new THREE.BoxGeometry(0.045, 0.1, 0.14), dark, 0, -0.03, -0.02);
      add(new THREE.BoxGeometry(0.05, 0.03, 0.05), dark, 0, -0.09, -0.08);
      return g;
    }
    if (weapon === 'glock' || weapon === 'usp' || weapon === 'deagle') {
      // затвор + рамка + рукоять + дульце
      const L = weapon === 'deagle' ? 0.42 : 0.36;
      add(new THREE.BoxGeometry(0.075, 0.09, L), mat(bodyC), 0, 0.03, -L / 2 + 0.05);
      add(new THREE.BoxGeometry(0.07, 0.07, L * 0.7), dark, 0, -0.035, -L / 2 + 0.08);
      add(new THREE.BoxGeometry(0.06, 0.18, 0.09), mat(trimC), 0, -0.11, 0.02, 0.22);
      add(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8), dark, 0, 0.03, -L + 0.02, Math.PI / 2);
      if (det && weapon === 'deagle') add(new THREE.BoxGeometry(0.078, 0.03, 0.12), mat(bodyC), 0, 0.085, -0.1); // характерный гребень
      return g;
    }
    if (weapon === 'ak47') {
      add(new THREE.BoxGeometry(0.08, 0.13, 0.5), mat(bodyC), 0, 0, -0.18);                 // ствольная коробка
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 8), dark, 0, 0.01, -0.58, Math.PI / 2); // ствол
      add(new THREE.BoxGeometry(0.03, 0.08, 0.04), dark, 0, 0.07, -0.7);                     // мушка
      add(new THREE.BoxGeometry(0.07, 0.14, 0.2), wood, 0, -0.05, 0.22, -0.12);              // приклад
      add(new THREE.BoxGeometry(0.06, 0.16, 0.09), wood, 0, -0.13, -0.12, 0.35);             // пистолетная рукоять
      add(new THREE.BoxGeometry(0.055, 0.16, 0.1), mat(trimC), 0, -0.15, -0.28, 0.5);        // магазин (верх)
      add(new THREE.BoxGeometry(0.055, 0.14, 0.09), mat(trimC), 0, -0.24, -0.33, 0.9);       // магазин (изгиб)
      add(new THREE.BoxGeometry(0.05, 0.05, 0.16), wood, 0, -0.045, -0.5);                   // цевьё
      return g;
    }
    if (weapon === 'm4a1') {
      add(new THREE.BoxGeometry(0.08, 0.13, 0.52), mat(bodyC), 0, 0, -0.18);
      add(new THREE.CylinderGeometry(0.026, 0.026, 0.3, 8), dark, 0, 0.01, -0.58, Math.PI / 2);
      add(new THREE.BoxGeometry(0.05, 0.07, 0.3), mat(trimC), 0, 0.1, -0.2);                 // ручка переноса
      add(new THREE.BoxGeometry(0.07, 0.13, 0.22), mat(bodyC), 0, -0.04, 0.24, -0.1);        // приклад
      add(new THREE.BoxGeometry(0.06, 0.16, 0.09), dark, 0, -0.13, -0.1, 0.3);
      add(new THREE.BoxGeometry(0.055, 0.18, 0.1), mat(trimC), 0, -0.15, -0.26);             // прямой магазин
      add(new THREE.BoxGeometry(0.05, 0.06, 0.18), mat(bodyC), 0, -0.04, -0.48);             // цевьё
      add(new THREE.BoxGeometry(0.03, 0.09, 0.04), dark, 0, 0.06, -0.72);                    // передняя мушка
      return g;
    }
    if (weapon === 'awp') {
      add(new THREE.BoxGeometry(0.08, 0.13, 0.6), mat(bodyC), 0, 0, -0.15);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), dark, 0, 0.01, -0.68, Math.PI / 2); // длинный ствол
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), dark, 0, 0.12, -0.12, Math.PI / 2); // оптика
      add(new THREE.BoxGeometry(0.02, 0.05, 0.06), dark, 0, 0.05, -0.02);                    // крепление прицела
      add(new THREE.BoxGeometry(0.02, 0.05, 0.06), dark, 0, 0.05, -0.22);
      add(new THREE.BoxGeometry(0.08, 0.16, 0.28), mat(bodyC), 0, -0.06, 0.26, -0.08);       // ложе с щекой
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), dark, 0.06, 0.04, 0.08, 0, 0, Math.PI / 2); // затвор
      add(new THREE.BoxGeometry(0.06, 0.16, 0.09), wood, 0, -0.13, -0.08, 0.35);
      add(new THREE.BoxGeometry(0.02, 0.16, 0.03), dark, -0.04, -0.12, -0.78, 0.3);          // сошка
      add(new THREE.BoxGeometry(0.02, 0.16, 0.03), dark, 0.04, -0.12, -0.78, 0.3);
      return g;
    }
    // запасной вариант
    add(new THREE.BoxGeometry(0.07, 0.14, 0.7), mat(bodyC), 0, 0, -0.3);
    add(new THREE.BoxGeometry(0.06, 0.17, 0.08), mat(trimC), 0, -0.13, -0.08);
    return g;
  }
  function removeRemote(nick) {
    const r = remotes.get(nick);
    if (r) { scene.remove(r.group); remotes.delete(nick); }
  }
  function remotesClear() { for (const n of [...remotes.keys()]) removeRemote(n); for (const n of nadesList) scene.remove(n.mesh); nadesList.length = 0; }

  // ---------- ЭФФЕКТЫ ----------
  function spawnTracer(origin, dir, len, isRemote) {
    const o = new THREE.Vector3(origin[0], origin[1], origin[2]);
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const end = o.clone().add(d.multiplyScalar(len));
    const geo = new THREE.BufferGeometry().setFromPoints([o, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }));
    scene.add(line);
    tracers.push({ line, die: performance.now() + 70 });
  }
  const nadesList = [];
  let flashAlpha = 0, shake = 0;
  function spawnNade(pos, vel, kind, isMine) {
    let mesh;
    const glbN = glbCache.grenade && glbCache.grenade.model;
    if (glbN) {
      mesh = glbN.clone();
      mesh.scale.multiplyScalar(1.1);
      mesh.traverse(o => { if (o.isMesh && kind === 'flash') o.material = new THREE.MeshLambertMaterial({ color: 0xdddddd }); });
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshLambertMaterial({ color: kind === 'flash' ? 0xeeeeee : 0x3a5f2a })
      );
    }
    mesh.position.set(pos[0], pos[1], pos[2]);
    scene.add(mesh);
    nadesList.push({ mesh, vx: vel[0], vy: vel[1], vz: vel[2], kind, fuse: 1.5, mine: isMine, boomSent: false });
  }
  function stepNades(dt) {
    for (let i = nadesList.length - 1; i >= 0; i--) {
      const n = nadesList[i];
      n.vy -= 16 * dt;
      let nx = n.mesh.position.x + n.vx * dt;
      let nz = n.mesh.position.z + n.vz * dt;
      let ny = n.mesh.position.y + n.vy * dt;
      // стены по осям
      if (solidFor(cellAt(nx, n.mesh.position.z), ny - 0.16)) { nx = n.mesh.position.x; n.vx = -n.vx * 0.42; }
      if (solidFor(cellAt(nx, nz), ny - 0.16)) { nz = n.mesh.position.z; n.vz = -n.vz * 0.42; }
      // пол
      if (ny < 0.16) { ny = 0.16; n.vy = -n.vy * 0.38; n.vx *= 0.72; n.vz *= 0.72; if (Math.abs(n.vy) < 1) n.vy = 0; }
      // крышка ящика
      const cU = cellAt(nx, nz), hU = cellH(cU);
      if (hU > 0 && hU < WALL_H && ny - 0.16 < hU && n.mesh.position.y >= hU - 0.1 && n.vy <= 0) { ny = hU + 0.16; n.vy = 0; n.vx *= 0.8; n.vz *= 0.8; }
      n.mesh.position.set(nx, ny, nz);
      n.fuse -= dt;
      if (n.fuse <= 0) {
        scene.remove(n.mesh);
        nadesList.splice(i, 1);
        if (n.mine && !n.boomSent) {
          n.boomSent = true;
          sock && sock.emit('cs16_boom', { pos: [nx, ny, nz], kind: n.kind });
        }
      }
    }
  }
  function explodeFx(pos, kind) {
    const color = kind === 'flash' ? 0xffffff : 0xff7722;
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    s.position.set(pos[0], pos[1], pos[2]);
    scene.add(s);
    const born = performance.now();
    (function anim() {
      const k = (performance.now() - born) / 350;
      if (k >= 1) { scene.remove(s); return; }
      s.scale.setScalar(0.5 + k * (kind === 'flash' ? 4 : 6));
      s.material.opacity = 0.9 * (1 - k);
      requestAnimationFrame(anim);
    })();
  }

  // ---------- БОМБА C4 (мешка) ----------
  function spawnBombMesh(pos) {
    removeBombMesh();
    bombMesh = new THREE.Group();
    const glbC4 = glbCache.c4 && glbCache.c4.model;
    if (glbC4) {
      const m = glbC4.clone();
      m.scale.multiplyScalar(1.15);
      bombMesh.add(m);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
      bombMesh.add(box);
    }
    bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bombLight.position.set(0.15, 0.15, 0);
    bombMesh.add(bombLight);
    bombMesh.position.set(pos[0], pos[1] + 0.11, pos[2]);
    scene.add(bombMesh);
  }
  function removeBombMesh() { if (bombMesh) { scene.remove(bombMesh); bombMesh = null; bombLight = null; } }

  // ---------- ДЕЙСТВИЕ ПО E (закладка / разминирование) ----------
  function siteOf() {
    const cx = P.x / CELL, cy = P.z / CELL;
    const inR = (s) => cx >= s.x1 && cx <= s.x2 + 1 && cy >= s.y1 && cy <= s.y2 + 1;
    if (inR(SITE_A)) return 'A';
    if (inR(SITE_B)) return 'B';
    return null;
  }
  function nearBomb() {
    if (!bombPlanted || !bombPlanted.pos) return false;
    return Math.hypot(P.x - bombPlanted.pos[0], P.z - bombPlanted.pos[2]) < 3.2 && Math.abs(P.y - bombPlanted.pos[1]) < 2.5;
  }
  function updateAction(dt) {
    if (!me.alive || state.phase !== 'live' || !ui.hint) { action = null; return; }
    let want = null;
    if (me.team === 't' && !bombPlanted && siteOf()) want = { type: 'plant', need: 3, site: siteOf() };
    else if (me.team === 'ct' && bombPlanted && nearBomb()) want = { type: 'defuse', need: me.kit ? 5 : 10 };
    if (!want || !keys.e) action = null;
    else if (!action || action.type !== want.type) action = { ...want, t: 0 };
    else {
      const moving = keys.w || keys.a || keys.s || keys.d || keys.space;
      if (moving) action.t = 0;
      else action.t += dt;
      if (action.t >= action.need) {
        if (action.type === 'plant') sock && sock.emit('cs16_plant', { site: action.site, pos: BOMB_POS[action.site] });
        else sock && sock.emit('cs16_defuse');
        action = null;
      }
    }
    if (want) {
      ui.hint.textContent = me.team === 't'
        ? (action && action.t > 0.1 ? `💣 ЗАКЛАДКА БОМБЫ НА ${action.site}...` : `Зажми E — закладка бомбы (плент ${want.site})`)
        : (action && action.t > 0.1 ? '🧰 ОБЕЗВРЕЖИВАНИЕ...' : `Зажми E — разминировать (${me.kit ? '5 сек — набор есть' : '10 сек — нет набора'})`);
      ui.hint.style.display = 'block';
    } else ui.hint.style.display = 'none';
    if (action && action.t > 0) {
      ui.actWrap.style.display = 'block';
      ui.actFill.style.width = Math.min(100, action.t / action.need * 100) + '%';
    } else ui.actWrap.style.display = 'none';
  }

  // ---------- ОРУЖИЕ ОТ ПЕРВОГО ЛИЦА ----------
  let vm = null, vmWeapon = '', vmSkin = '', vmGlb = false, vmKick = 0, vmSwayX = 0, vmSwayY = 0;
  function refreshViewmodelSkin() { vmSkin = ' '; } // принудительная пересборка
  function updateViewmodel(dt, t) {
    if (!camera) return;
    if (vmWeapon !== current || vmSkin !== mySkin || vmGlb !== !!(glbCache[current] && glbCache[current].model)) {
      vmWeapon = current; vmSkin = mySkin; vmGlb = !!(glbCache[current] && glbCache[current].model);
      if (vm) camera.remove(vm);
      vm = buildGun(current, mySkin, 1.8);
      vm.position.set(0.3, -0.3, -0.55);
      camera.add(vm);
    }
    if (!vm) return;
    const moving = (keys.w || keys.a || keys.s || keys.d) && P.onGround;
    vm.position.y = -0.3 + (moving ? Math.abs(Math.sin(t / 110)) * 0.014 : 0);
    vm.position.x = 0.3 + (moving ? Math.sin(t / 220) * 0.008 : 0);
    // отводка за мышью (ствол чуть отстаёт от движения)
    vmSwayX *= Math.max(0, 1 - dt * 7);
    vmSwayY *= Math.max(0, 1 - dt * 7);
    vm.rotation.y = -vmSwayX * 2.2;
    if (reloading > 0 && WEAPONS[current].reload) {
      const k = 1 - reloading / WEAPONS[current].reload;
      vm.rotation.x = -0.7 * Math.sin(Math.min(1, k) * Math.PI) - vmSwayY * 1.4;
    } else vm.rotation.x = -vmSwayY * 1.4;
    vmKick = Math.max(0, vmKick - dt * 6);
    vm.position.z = -0.55 + vmKick * 0.09;
    vm.visible = me.alive && !scoped;
  }

  // ---------- СТРЕЛЬБА ----------
  const keys = {};
  // Слоты оружия и переключение (колесико/клавиши — как в CS)
  let lastWeaponSlot = '';
  function ownedSlots() {
    const pistol = me.team === 't' ? 'glock' : 'usp';
    const arr = [];
    if (primary && WEAPONS[primary]) arr.push(primary);
    arr.push(pistol, 'knife');
    return arr;
  }
  function switchSlot(id) {
    if (!WEAPONS[id] || id === current) return;
    lastWeaponSlot = current;
    current = id;
    reloading = 0;
  }
  function cycleSlot(dir) {
    const arr = ownedSlots();
    let i = arr.indexOf(current);
    if (i < 0) i = 0;
    switchSlot(arr[(i + dir + arr.length) % arr.length]);
  }
  function dirFromCam() {
    const cp = Math.cos(P.pitch);
    return [-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp];
  }
  function tryShoot() {
    if (!me.alive || state.phase !== 'live') return;
    const w = WEAPONS[current];
    const now = performance.now();
    if (reloading > 0 || now - lastShot < 60000 / w.rpm) return;
    const a = ammo[current];
    if (a && a.mag <= 0) { startReload(); return; }
    lastShot = now;
    if (a) a.mag--;
    vmKick = 1; // отдача viewmodel
    sfxShot(current);
    if (w.melee) {
      // нож: короткая дистанция
      const d = dirFromCam();
      const hit = rayPlayers(P.x, P.y + EYE, P.z, d, 2.4);
      if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: 'knife', head: false, zone: 'body' });
      spawnTracer([P.x, P.y + EYE, P.z], d, 2, false);
      return;
    }
    // разброс
    bloom = Math.min(bloom + (w.auto ? 0.35 : 0.8), 2.5);
    const spreadDeg = (scoped && w.scope ? w.spreadScoped : w.spread) + bloom * 0.35;
    const sr = spreadDeg * Math.PI / 180;
    let d = dirFromCam();
    d = [d[0] + (Math.random() - 0.5) * sr, d[1] + (Math.random() - 0.5) * sr, d[2] + (Math.random() - 0.5) * sr];
    const dl = Math.hypot(d[0], d[1], d[2]); d = [d[0] / dl, d[1] / dl, d[2] / dl];
    const MAXT = 200;
    const wall = rayWall(P.x, P.y + EYE, P.z, d[0], d[1], d[2], MAXT);
    const wallT = wall ? wall.t : MAXT;
    const hit = rayPlayers(P.x, P.y + EYE, P.z, d, wallT);
    spawnTracer([P.x, P.y + EYE - 0.1, P.z], d, hit ? hit.t : wallT, false);
    if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: current, head: hit.head, zone: hit.zone });
    // отдача
    P.pitch = Math.min(1.45, P.pitch + (current === 'awp' ? 0.035 : 0.008 + Math.random() * 0.006));
    P.yaw += (Math.random() - 0.5) * 0.004;
  }
  function rayPlayers(ox, oy, oz, d, maxT) {
    let best = null;
    for (const [nick, r] of remotes) {
      if (!r.alive || r.team === me.team) continue;
      // тело — вертикальный цилиндр
      const rx = r.x - ox, rz = r.z - oz;
      const a = d[0] * d[0] + d[2] * d[2];
      let tBody = null;
      if (a > 1e-8) {
        const b = -(rx * d[0] + rz * d[2]);
        const c = rx * rx + rz * rz - 0.62 * 0.62;
        const disc = b * b - a * c;
        if (disc >= 0) {
          const t = (-b - Math.sqrt(disc)) / a;
          if (t > 0 && t < maxT) {
            const hy = oy + d[1] * t;
            if (hy >= r.y && hy <= r.y + 1.85) tBody = t;
          }
        }
      }
      // голова — сфера
      const hx = r.x - ox, hy = r.y + 1.58 - oy, hz = r.z - oz;
      const bb = -(hx * d[0] + hy * d[1] + hz * d[2]);
      const cc = hx * hx + hy * hy + hz * hz - 0.34 * 0.34;
      const dd = bb * bb - cc;
      let tHead = null;
      if (dd >= 0) {
        const t = bb - Math.sqrt(dd);
        if (t > 0 && t < maxT) tHead = t;
      }
      const t = tHead != null ? tHead : tBody;
      if (t != null && (!best || t < best.t)) {
        const hy = oy + d[1] * t;
        const zone = tHead != null && (tBody == null || tHead <= tBody) ? 'head' : (hy < r.y + 0.85 ? 'leg' : 'body');
        best = { t, nick, head: zone === 'head', zone };
      }
    }
    return best;
  }
  function startReload() {
    const w = WEAPONS[current];
    const a = ammo[current];
    if (!a || reloading > 0 || a.mag >= w.mag || a.reserve <= 0) return;
    reloading = w.reload;
  }
  function finishReload() {
    const w = WEAPONS[current];
    const a = ammo[current];
    const need = w.mag - a.mag, take = Math.min(need, a.reserve);
    a.mag += take; a.reserve -= take;
  }
  function throwNade(kind) {
    if (!me.alive || state.phase !== 'live') return;
    if (kind === 'he' && nades.he <= 0) return;
    if (kind === 'flash' && nades.flash <= 0) return;
    const d = dirFromCam();
    const v = 13;
    const vel = [d[0] * v + P.vx * 0.5, d[1] * v + 3.2, d[2] * v + P.vz * 0.5];
    spawnNade([P.x, P.y + EYE, P.z], vel, kind, true);
    sock && sock.emit('cs16_nade', { pos: [P.x, P.y + EYE, P.z], vel, kind });
    if (kind === 'he') nades.he--; else nades.flash--;
  }
  function buyOk(id) {
    if (id === 'hegrenade') nades.he = Math.min(1, nades.he + 1);
    else if (id === 'flashbang') nades.flash = Math.min(2, nades.flash + 1);
    else if (id === 'kevlar') me.armor = 100;
    else if (id === 'defuser') me.kit = true;
    else if (WEAPONS[id]) { primary = id; current = id; if (!ammo[id]) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }; }
  }

  // ---------- ПОКУПКИ ----------
  function openBuy() {
    const nowSrv = Date.now() + clockOffset;
    const ok = state.phase === 'freeze' || (state.phase === 'live' && nowSrv < state.buyUntil);
    if (!ok || !me.alive) { killfeed('🛒 Сейчас купить нельзя'); return; }
    renderBuyList();
    ui.buy.style.display = 'block';
  }
  function closeBuy() { if (ui.buy) ui.buy.style.display = 'none'; }

  // ---------- ВВОД ----------
  let pointerLocked = false;
  function bindInput() {
    document.addEventListener('pointerlockerror', () => {
      centerMsg('🖱️ Не удалось захватить мышь — кликни по игре ещё раз', 2500);
    });
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === canvasEl;
      if (!pointerLocked && me.alive && state.phase === 'live') {
        centerMsg('🖱️ Кликни по игре, чтобы продолжить', 0);
      } else if (pointerLocked) {
        ui.centerMsg.style.display = 'none';
      }
    });
    canvasEl.addEventListener('mousedown', (e) => {
      if (state.phase === 'lobby') return;
      if (!pointerLocked) { canvasEl.requestPointerLock(); return; }
      if (e.button === 0) {
        const w = WEAPONS[current];
        if (w.auto) { keys.fire = true; tryShoot(); } else tryShoot();
      } else if (e.button === 2 && WEAPONS[current].scope) {
        scoped = !scoped;
      }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) keys.fire = false; });
    canvasEl.addEventListener('contextmenu', e => e.preventDefault());
    // 3.15.2: колесико мыши — перебор оружия как в CS 1.6
    canvasEl.addEventListener('wheel', (e) => {
      if (!pointerLocked || !me.alive) return;
      e.preventDefault();
      cycleSlot(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener('mousemove', (e) => {
      if (!pointerLocked || !me.alive) return;
      const sens = scoped ? 0.0009 : 0.0023;
      P.yaw -= e.movementX * sens;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * sens));
      vmSwayX = Math.max(-0.09, Math.min(0.09, vmSwayX + e.movementX * 0.00035));
      vmSwayY = Math.max(-0.09, Math.min(0.09, vmSwayY + e.movementY * 0.00035));
    });
    window.addEventListener('keydown', (e) => {
      if (state.phase === 'lobby' || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      keys[e.key.toLowerCase()] = true;
      if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
      const k = e.key.toLowerCase();
      // 3.15.3: покупка цифрами, пока открыт магазин
      if (ui.buy.style.display === 'block') {
        const n = parseInt(k, 10);
        if (n >= 1 && n <= 9) {
          const btns = ui.buyList.querySelectorAll('button');
          if (btns[n - 1] && !btns[n - 1].disabled) btns[n - 1].click();
        }
        if (k === 'b' || k === 'escape') closeBuy();
        return;
      }
      if (k === 'b') openBuy();
      if (k === 'm') { sock && me.team && sock.emit('cs16_swap'); }
      if (k === 'r') startReload();
      if (k === 'g') throwNade('he');
      if (k === 'f') throwNade('flash');
      if (k === '1' && primary) switchSlot(primary);
      if (k === '2') switchSlot(me.team === 't' ? 'glock' : 'usp');
      if (k === '3') switchSlot('knife');
      if (k === 'q' && lastWeaponSlot) switchSlot(lastWeaponSlot);
    });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; if (e.code === 'Space') keys.space = false; });
  }

  // ---------- HUD UPDATE ----------
  function updateHud() {
    if (state.phase === 'lobby') return;
    const nowSrv = Date.now() + clockOffset;
    const ends = state.phase === 'freeze' ? state.freezeEnds : state.roundEnds;
    const left = Math.max(0, ends - nowSrv);
    const mm = String(Math.floor(left / 60000)), ss = String(Math.floor(left % 60000 / 1000)).padStart(2, '0');
    const phaseTxt = state.phase === 'freeze' ? 'ПОКУПКИ' : state.phase === 'live' ? '' : '—';
    ui.topBar.textContent = `РАУНД ${state.round} · ${mm}:${ss} ${phaseTxt}`;
    ui.scoreT.textContent = `🔪 Т ${state.scores.t}`;
    ui.scoreCT.textContent = `🛡️ CT ${state.scores.ct}`;
    ui.hpTxt.textContent = `❤️ ${Math.max(0, me.hp)}`;
    ui.armorTxt.textContent = me.armor > 0 ? `🦺 ${me.armor}` : '';
    ui.money.textContent = '$' + me.money;
    const w = WEAPONS[current];
    const a = ammo[current];
    ui.ammo.textContent = w.melee ? '∞' : (a ? `${a.mag} / ${a.reserve}` : '');
    ui.nadeTxt.textContent = `💣 HE ×${nades.he}  ✨ ×${nades.flash}`;
    ui.crosshair.style.display = (scoped || !me.alive) ? 'none' : 'block';
    ui.scope.style.display = scoped ? 'block' : 'none';
    ui.flash.style.opacity = String(Math.min(1, flashAlpha));
    if (reloading > 0) ui.ammo.textContent = 'перезарядка...';
    // таймер бомбы
    if (bombPlanted) {
      const bleft = Math.max(0, bombPlanted.explodesAt - nowSrv);
      ui.bombTimer.textContent = '💣 ' + Math.ceil(bleft / 1000);
      ui.bombTimer.style.display = 'block';
      ui.bombTimer.style.color = bleft < 10000 ? '#ff2222' : '#ffaa44';
    } else ui.bombTimer.style.display = 'none';
    // панель хоста после матча
    ui.hostPanel.style.display = (state.phase === 'matchend' && state.host === myNick) ? 'block' : 'none';
  }

  // ---------- ГЛАВНЫЙ ЦИКЛ ----------
  let lastT = 0, posAcc = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!renderer3 || state.phase === 'lobby' || ui.lobby.style.display === 'block') return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    // таймеры клиента
    bloom = Math.max(0, bloom - dt * 3);
    flashAlpha = Math.max(0, flashAlpha - dt * 0.55);
    shake = Math.max(0, shake - dt * 2);
    if (reloading > 0) { reloading -= dt; if (reloading <= 0) { reloading = 0; finishReload(); } }
    // физика
    if (me.alive && state.phase !== 'matchend') {
      const canMove = state.phase !== 'freeze';
      stepPlayer(dt, canMove ? keys : { w: 0 });
      if (keys.fire) tryShoot();
    }
    // интерполяция удалённых + анимация ног
    const lerp = Math.min(1, dt * 10);
    for (const r of remotes.values()) {
      r.x += (r.tx - r.x) * lerp;
      r.y += (r.ty - r.y) * lerp;
      r.z += (r.tz - r.z) * lerp;
      let dy = r.tyaw - r.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      r.yaw += dy * lerp;
      r.pitch += (r.tpitch - r.pitch) * lerp;
      r.group.position.set(r.x, r.y, r.z);
      r.group.rotation.y = r.yaw;
      setRemoteGun(r);
      if (r.alive) {
        r.group.rotation.z = 0;
        r.group.visible = true;
        if (r.moving) r.walkPhase += dt * 9;
        const sw = r.moving ? Math.sin(r.walkPhase) * 0.65 : 0;
        r.legL.rotation.x = sw;              // ноги ходят вразножку
        r.legR.rotation.x = -sw;
        r.armL.rotation.x = -sw * 0.6;
        r.armR.rotation.x = -1.15;           // правая с оружием перед собой
        const bob = r.moving ? Math.abs(Math.sin(r.walkPhase)) * 0.05 : 0;
        r.torso.position.y = 1.18 + bob;
        r.head.position.y = 1.72 + bob;
      } else {
        r.group.visible = true;
        r.group.rotation.z = -Math.PI / 2;   // убитый — лежит
        r.group.position.y = r.y + 0.35;
        r.legL.rotation.x = 0.15; r.legR.rotation.x = -0.1;
        r.armL.rotation.x = 0.3; r.armR.rotation.x = 0.2;
      }
    }
    stepNades(dt);
    updateAction(dt);
    updateViewmodel(dt, t);
    // мигание и писк бомбы
    if (bombMesh && bombLight && bombPlanted) {
      const left = bombPlanted.explodesAt - (Date.now() + clockOffset);
      bombLight.visible = Math.floor(performance.now() / (left < 10000 ? 180 : 600)) % 2 === 0;
      const sec = Math.ceil(left / 1000);
      if (sec !== lastBeep && left < 11000 && left > 0) { lastBeep = sec; sfxBeep(); }
    }
    // трассеры
    for (let i = tracers.length - 1; i >= 0; i--) {
      if (performance.now() > tracers[i].die) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
    }
    // камера
    camera.position.set(P.x, P.y + EYE, P.z);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * shake * 0.25;
    }
    camera.rotation.order = 'YXZ';
    camera.rotation.y = P.yaw;
    camera.rotation.x = P.pitch;
    camera.fov += ((scoped ? 16 : 75) - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
    updateHud();
    // отправка позиции 15 раз/сек
    posAcc += dt;
    if (posAcc > 1 / 15 && sock && sock.connected && me.alive) {
      posAcc = 0;
      const moving = keys.w || keys.a || keys.s || keys.d;
      sock.emit('cs16_pos', { pos: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)], yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), weapon: current, move: !!moving, skin: mySkin });
    }
    renderer3.render(scene, camera);
  }

  // ---------- ВХОД ВО ВКЛАДКУ ----------
  window.__cs16Open = function (nick) {
    myNick = nick;
    if (!inited) {
      inited = true;
      buildUI();
      initScene();
      bindInput();
      loadGLBAll();
      ensureSocket();
      loadSkins();
      requestAnimationFrame(loop);
    }
    doJoin();
  };
})();
