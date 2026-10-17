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
  ];

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
        const d = Math.sqrt(d2) || 0.001;
        const push = (r - d);
        nx += (ddx / d) * push; nz += (ddz / d) * push;
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
    ui.canvas = el('canvas', 'position:absolute; inset:0; width:100%; height:100%; display:none;', r);
    canvasEl = ui.canvas;
    // Лобби
    ui.lobby = el('div', 'position:absolute; inset:0; overflow:auto; padding:16px; background:linear-gradient(160deg,#1d1a14,#141210); color:#eee;', r);
    // HUD
    ui.hud = el('div', 'position:absolute; inset:0; pointer-events:none; display:none;', r);
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
    // Магазин
    ui.buy = el('div', 'position:absolute; inset:0; display:none; background:rgba(0,0,0,0.55); pointer-events:auto;', r);
    const bw = el('div', 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#1c1a16; border:1px solid #8a6b3a; padding:14px 18px; min-width:340px; color:#eee;', ui.buy);
    el('div', 'font:bold 16px monospace; color:#ffc107; margin-bottom:8px;', bw, '🛒 ПОКУПКИ <span style="float:right;color:#7ee08a;" id="cs16BuyMoney"></span>');
    ui.buyList = el('div', '', bw);
    el('div', 'font:11px monospace; color:#999; margin-top:8px;', bw, 'B — закрыть · покупка только в начале раунда (freeze + 15 сек)');
    window.addEventListener('resize', resize3);
  }
  function renderBuyList() {
    ui.buyList.innerHTML = '';
    const mEl = document.getElementById('cs16BuyMoney');
    if (mEl) mEl.textContent = '$' + me.money;
    for (const it of BUY_ITEMS) {
      const w = WEAPONS[it.id];
      const dis = (w && w.team && w.team !== me.team) || me.money < it.price;
      const b = el('button', `display:block; width:100%; margin:4px 0; padding:7px 10px; text-align:left; font:13px monospace; cursor:pointer; background:${dis ? '#333' : '#2d4a22'}; color:${dis ? '#777' : '#dfffcf'}; border:1px solid #555;`, ui.buyList);
      b.textContent = `${it.label} — $${it.price}`;
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
  function renderLobby() {
    const inMatch = state.phase !== 'lobby';
    ui.lobby.style.display = 'block';
    ui.canvas.style.display = 'none';
    ui.hud.style.display = 'none';
    const rows = (team) => state.players.filter(p => p.team === team)
      .map(p => `<div style="padding:3px 8px; background:#26221a; margin:3px 0; border-radius:4px;">${esc(p.nick)} <span style="color:#888; font-size:11px;">${p.kills || 0}/${p.deaths || 0}</span></div>`).join('');
    const spectators = state.players.filter(p => !p.team).map(p => esc(p.nick)).join(', ');
    ui.lobby.innerHTML = `
      <div style="max-width:760px; margin:0 auto;">
        <div style="font:bold 26px monospace; color:#e8c34a; text-align:center;">🔫 COUNTER-STRIKE 1.6 <span style="color:#999; font-size:13px;">de_dust2 · матч до 16 побед</span></div>
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
        </div>
        <div style="margin-top:10px; font:12px monospace; color:#888; line-height:1.7;">
          Управление: WASD — движение · Shift — тихий шаг · Пробел — прыжок · Мышь — прицел · ЛКМ — огонь · ПКМ (AWP) — прицел ·
          R — перезарядка · B — магазин · G — HE-граната · F — флешка · 1/2/3 — основное/пистолет/нож
        </div>
      </div>`;
    const jt = document.getElementById('cs16JoinT'), jc = document.getElementById('cs16JoinCT');
    if (jt) jt.onclick = () => sock && sock.emit('cs16_team', 't');
    if (jc) jc.onclick = () => sock && sock.emit('cs16_team', 'ct');
    document.querySelectorAll('.cs16ModeBtn').forEach(b => { b.onclick = () => sock && sock.emit('cs16_mode', Number(b.dataset.n)); });
    const sb = document.getElementById('cs16StartBtn');
    if (sb) sb.onclick = () => sock && sock.emit('cs16_start');
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
      me.money = y.money; me.hp = y.hp; me.armor = y.armor; me.team = y.team; me.alive = y.alive;
      if (y.weapon && y.weapon !== current && WEAPONS[y.weapon]) { primary = y.weapon; }
    });
    sock.on('cs16_err', (m) => { killfeed('⚠️ ' + esc(m)); if (ui.buy.style.display === 'block') renderBuyList(); });
    sock.on('cs16_bought', (d) => {
      buyOk(d.item);
      me.money = d.money;
      killfeed('🛒 Куплено: ' + esc(WEAPONS[d.item] ? WEAPONS[d.item].name : d.item));
      if (ui.buy.style.display === 'block') renderBuyList();
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
      for (const s of (d.spawns || [])) {
        const pl = state.players.find(p => p.id === s.id);
        if (!pl || pl.nick === myNick) continue;
        const r = addRemote(pl.nick, pl.team);
        r.x = r.tx = s.pos[0]; r.y = r.ty = s.pos[1] - EYE; r.z = r.tz = s.pos[2];
      }
      banner(`РАУНД ${d.round}`, '#ffc107', 2500);
      centerMsg('🛒 Покупки: жми <b>B</b>', 4000);
      closeBuy();
    });
    sock.on('cs16_live', () => { banner('❗ РАУНД НАЧАЛСЯ', '#ff5544', 1500); closeBuy(); });
    sock.on('cs16_pos', (d) => {
      let r = remotes.get(d.nick);
      if (!r) r = addRemote(d.nick, d.team);
      r.tx = d.pos[0]; r.ty = d.pos[1]; r.tz = d.pos[2];
      r.tyaw = d.yaw; r.tpitch = d.pitch; r.weapon = d.weapon; r.lastSeen = performance.now();
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
        : `💥 ${esc(d.nick)} разорвало гранатой`);
      if (d.nick === myNick) {
        me.alive = false; scoped = false; closeBuy();
        centerMsg(`☠️ Тебя убил <b>${esc(d.killer || 'граната')}</b><br><span style="font-size:13px; color:#999;">Жди следующий раунд</span>`, 0);
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
    const color = team === 't' ? 0xc9a13b : 0x3b7ac9;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.15, 10), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8b08c }));
    head.position.y = 1.58;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    gun.position.set(0.28, 1.25, -0.4);
    g.add(body); g.add(head); g.add(gun);
    g.add(makeTag(nick, team === 't' ? '#ffd95e' : '#7ec2ff'));
    scene.add(g);
    const r = { group: g, body, head, gun, tag: g.children[3], x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, yaw: 0, tyaw: 0, pitch: 0, tpitch: 0, weapon: 'usp', team, alive: true, moving: false, muzzle: 0 };
    remotes.set(nick, r);
    return r;
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
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshLambertMaterial({ color: kind === 'flash' ? 0xeeeeee : 0x3a5f2a })
    );
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

  // ---------- СТРЕЛЬБА ----------
  const keys = {};
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
    sfxShot(current);
    if (w.melee) {
      // нож: короткая дистанция
      const d = dirFromCam();
      const hit = rayPlayers(P.x, P.y + EYE, P.z, d, 2.4);
      if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: 'knife', head: false });
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
    if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: current, head: hit.head });
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
      if (t != null && (!best || t < best.t)) best = { t, nick, head: tHead != null && (tBody == null || tHead <= tBody) };
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
    window.addEventListener('mousemove', (e) => {
      if (!pointerLocked || !me.alive) return;
      const sens = scoped ? 0.0009 : 0.0023;
      P.yaw -= e.movementX * sens;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * sens));
    });
    window.addEventListener('keydown', (e) => {
      if (state.phase === 'lobby' || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      keys[e.key.toLowerCase()] = true;
      if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
      const k = e.key.toLowerCase();
      if (k === 'b') { if (ui.buy.style.display === 'block') closeBuy(); else openBuy(); }
      if (k === 'r') startReload();
      if (k === 'g') throwNade('he');
      if (k === 'f') throwNade('flash');
      if (k === '1' && primary) current = primary;
      if (k === '2') current = me.team === 't' ? 'glock' : 'usp';
      if (k === '3') current = 'knife';
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
    // интерполяция удалённых
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
      r.group.visible = r.alive;
      const bob = r.moving ? Math.sin(t / 120) * 0.05 : 0;
      r.body.position.y = 0.85 + bob;
      r.head.position.y = 1.58 + bob;
    }
    stepNades(dt);
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
      sock.emit('cs16_pos', { pos: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)], yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), weapon: current, move: !!moving });
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
      ensureSocket();
      requestAnimationFrame(loop);
    }
    doJoin();
  };
})();
