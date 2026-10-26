/* ==========================================================================
   CS 1.6 — de_dust2 (упрощённая браузерная версия) — Support Hub 3.15.0
   Две команды T/CT (1v1..5v5), матч до 16 побед, магазин (B), гранаты.
   ========================================================================== */
(function () {
  'use strict';

  const SERVER = 'https://support-hub-server-v3.onrender.com';

  // ---------- КАРТА (сетка 42x42, ячейка 4 юнита; 3.24.0: строковые карты, 2 карты) ----------
  const MW = 42, MH = 42, CELL = 4;
  const WALL_H = 4, DOOR_H = 2.6, CRATE_H = 1.15;
  // 3.16.0: подземные туннели — глубина по типу ячейки (4 самый глубокий, 6/5/7 — ступени спуска)
  const TUN_FLOOR = { 4: -3.2, 7: -2.4, 5: -1.6, 6: -0.8 };
  const TUN_CEIL = -1.3;   // потолок глубокого туннеля (ниже уровня земли 0)
  // 3.24.0: вентиляция (пол 0, потолок низкий — только сидя) и наземные мосты с лестницами
  const VENT_CEIL = 1.35, BRIDGE_H = 2.3;
  // 3.24.2: снайперская вышка (TOWER_H — выше стены, с лестницей только со стороны лестницы)
  const TOWER_H = 4.2;
  const CH2C = { '#': 1, '.': 0, 'D': 2, 'C': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'V': 8, 'B': 9, 'S': 10, 'T': 11 };
  // СТРОКИ КАРТ СИНХРОНИЗИРОВАНЫ С СЕРВЕРОМ (server.js CS16_MAP_ROWS) — править через genmap.js!
  const MAP_ROWS = {
    dust2: [
      "##########################################",
      "##.............#.....STT...............###",
      "##......DDD...........TT...............###",
      "##..C...DDD...................C........###",
      "##........................6574756...C..###",
      "#6....C...................6574756......###",
      "#5.C.....65C444756...............C.....###",
      "#7.......657444756####......C..C.......###",
      "#4.............#######.................###",
      "#4##.VC.##############.................###",
      "#4##.VC.##########..........#####......###",
      "#4##.V..#######........##########......###",
      "#4##.V..#######DD......##########..C...###",
      "#4##.V..#######DD......##########......###",
      "#4##.V..##########..C..##########......###",
      "#4##.V..##########.....##########......###",
      "#4##.V..##########.....##########......###",
      "#4##.V..##########.....##########......###",
      "#4##.DD.###.....C#.....##########......###",
      "#4##.DD.###.C.....DDDDD##########......###",
      "#4##.VC.###......#DDDDD##########...C..###",
      "#4##....6574444756.....##########......###",
      "#4##....6574444756.....##########......###",
      "#4##....##########.....##########......###",
      "#4##....##########.....##########......###",
      "#4##...................##########......###",
      "#4##........DC.........##########......###",
      "#4##........DD.....C...##########......###",
      "#4##..C................##########......###",
      "#4##....##########................DDDD.###",
      "#4##....##########........CDD.....DDDD.###",
      "#7##....##########.........DD.C........###",
      "#5......##########.....................###",
      "#6......##########.....##########......###",
      "####...................66.TT.6556......###",
      "####...................55STT.6556......###",
      "####...................77.....########...#",
      "#########..............55.....########...#",
      "#########..............66.....########...#",
      "#########.....................65744444756#",
      "##########################################",
      "##########################################",
    ],
    inferno: [
      "##########################################",
      "##.............#.....STT.................#",
      "##......DDD...........TT....6556.........#",
      "##..C...DDD.................65C6.........#",
      "##..................................C....#",
      "##.....C.........................C.......#",
      "##..........C..#............C..C.........#",
      "##.C...........#...#####656.......C....C.#",
      "##.............#...#####656........VVVC..#",
      "##.......#######...###############.......#",
      "##.......#######.......###########.......#",
      "##.......#########.....###########.......#",
      "##.......#########.....###########.SBBBS.#",
      "##.......#########.....###########.......#",
      "##.......#....####..C..###########D......#",
      "##..DDD.CV....####.....###########D......#",
      "##..DDD..#....####.....###########D......#",
      "##.......###.#####.....###########.......#",
      "##.......###.#####DDDDD###########..C....#",
      "##.S.....###.#####DDDDD###########.......#",
      "##.BBB...###.#####.....###########.......#",
      "##...S...###.#####.....###########.......#",
      "##.......###.#####.....###########.......#",
      "##.......###.#####.....###################",
      "##...C...###.#####.66..###################",
      "##.................55..###################",
      "##.................77..###################",
      "##.S...............44..###################",
      "##.BBB.............4C..###################",
      "##...S...657444756.44..###################",
      "##.......657444756.44..#C#################",
      "##.......#########.77..###################",
      "##.......#########.55............#########",
      "##.......#########.66............#########",
      "##....V..................TT..#############",
      "######V#######..........STTC.#############",
      "######V#######...............#############",
      "##############...............#############",
      "##############...............#############",
      "##############...............#############",
      "##########################################",
      "##########################################",
    ]
  };
  const MAP_META = {
    dust2: {
      name: 'de_dust2',
      sites: { A: { x1: 27, y1: 1, x2: 38, y2: 9 }, B: { x1: 2, y1: 1, x2: 14, y2: 8 } },
    },
    inferno: {
      name: 'de_inferno',
      sites: { A: { x1: 26, y1: 1, x2: 38, y2: 8 }, B: { x1: 2, y1: 1, x2: 14, y2: 8 } },
    },
  };
  let curMap = 'dust2';
  let grid = [];
  let SITE_A = MAP_META.dust2.sites.A, SITE_B = MAP_META.dust2.sites.B;
  const stairsDir = new Map(); // "x,y" -> [dx,dy] направление лестницы вверх к мосту
  const dmgNums = []; // 3.24.3: летящие числа урона (спрайты)
  function loadMap(name) {
    if (!MAP_ROWS[name]) name = 'dust2';
    curMap = name;
    grid = [];
    stairsDir.clear();
    const rows = MAP_ROWS[name];
    for (let y = 0; y < MH; y++) {
      const row = [];
      for (let x = 0; x < MW; x++) row.push(CH2C[rows[y][x]] != null ? CH2C[rows[y][x]] : 1);
      grid.push(row);
    }
    // направления лестниц: соседний мост определяет, куда «вверх»
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (grid[y][x] !== 10) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && (grid[ny][nx] === 9 || grid[ny][nx] === 11)) { stairsDir.set(x + ',' + y, [dx, dy]); break; }
      }
    }
    SITE_A = MAP_META[name].sites.A; SITE_B = MAP_META[name].sites.B;
  }
  loadMap('dust2');
  function cellAt(wx, wz) {
    const cx = Math.floor(wx / CELL), cy = Math.floor(wz / CELL);
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 1;
    return grid[cy][cx];
  }
  function cellH(c) { return c === 1 ? WALL_H : c === 2 ? DOOR_H : c === 3 ? CRATE_H : c === 11 ? TOWER_H : 0; }
  // Уровень пола ячейки (wx/wz нужны для интерполяции лестниц)
  function floorAt(c, wx, wz) {
    if (c === 9) return BRIDGE_H;
    if (c === 11) return TOWER_H;
    if (c === 10) {
      const d = stairsDir.get(Math.floor((wx || 0) / CELL) + ',' + Math.floor((wz || 0) / CELL));
      if (!d) return 0;
      // 3.24.2: лестница к вышке выше, чем к мосту
      const sx = Math.floor((wx || 0) / CELL), sy = Math.floor((wz || 0) / CELL);
      const topH = ((grid[sy] && (grid[sy][sx - 1] === 11 || grid[sy][sx + 1] === 11)) || (grid[sy - 1] && grid[sy - 1][sx] === 11) || (grid[sy + 1] && grid[sy + 1][sx] === 11)) ? TOWER_H : BRIDGE_H;
      const lx = (wx - Math.floor(wx / CELL) * CELL), lz = (wz - Math.floor(wz / CELL) * CELL);
      const prog = d[0] > 0 ? lx / CELL : d[0] < 0 ? (CELL - lx) / CELL : d[1] > 0 ? lz / CELL : (CELL - lz) / CELL;
      return Math.max(0, Math.min(1, prog)) * topH;
    }
    return TUN_FLOOR[c] || 0;
  }
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
      if (c === 4) { // 3.16.0: глубокий туннель (пол -3.2, потолок -1.3) — снаружи корка непростреливается
        const hy = oy + dy * t;
        if (hy < TUN_CEIL && hy > TUN_FLOOR[4]) continue; // внутри туннеля — летит дальше
        return { t, nx, nz, cell: c };
      }
      // 3.24.0: вентиляция — снаружи непростреливается, внутри (ниже потолка) летит
      if (c === 8) {
        const hy = oy + dy * t;
        if (hy > 0 && hy < VENT_CEIL) continue;
        return { t, nx, nz, cell: c };
      }
      if (c === 9 || c === 10) continue; // мосты/лестницы — можно стрелять снизу
      if (c !== 0 && c !== 5 && c !== 6 && c !== 7) {
        const hy = oy + dy * t;
        const h = cellH(c);
        // Попали в объём ячейки (сверху может перелететь)
        if (hy >= 0 && hy <= h) return { t, nx, nz, cell: c };
        if (dy > 0 && hy > h) continue; // летим выше стены
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
    knife:  { name: 'Нож',            dmg: 40,  rpm: 80,  mag: Infinity, reserve: Infinity, reload: 0,   spread: 0,   auto: false, melee: true, price: 0, move: 1.2, heavy: 55 },
    glock:  { name: 'Glock-18',       dmg: 25,  rpm: 352, mag: 20, reserve: 120, reload: 2.0, spread: 1.7, auto: false, price: 0, move: 1.1, burst: true },
    usp:  { name: 'USP',            dmg: 34,  rpm: 352, mag: 12, reserve: 100, reload: 2.2, spread: 1.2, auto: false, price: 0, move: 1.08 },
    deagle:  { name: 'Desert Eagle',   dmg: 53,  rpm: 266, mag: 7,  reserve: 35,  reload: 2.0, spread: 0.9, auto: false, price: 650, move: 1.05 },
    ak47:  { name: 'AK-47',          dmg: 33,  rpm: 600, mag: 30, reserve: 90,  reload: 2.5, spread: 1.9, auto: true,  price: 2500, team: 't', move: 0.95 },
    m4a1:  { name: 'M4A1',           dmg: 33,  rpm: 666, mag: 30, reserve: 90,  reload: 2.3, spread: 1.5, auto: true,  price: 3100, team: 'ct', move: 0.95 },
    awp:  { name: 'AWP',            dmg: 115, rpm: 41,  mag: 10, reserve: 30,  reload: 3.0, spread: 3.2, spreadScoped: 0.04, auto: false, price: 4750, scope: true, move: 0.85 },
    // 3.24.0: новые стволы
    mp5:  { name: 'MP5',        dmg: 26, rpm: 750, mag: 30, reserve: 120, reload: 2.3, spread: 1.3, auto: true,  price: 1500, move: 1.03 },
    p90:  { name: 'P90',        dmg: 26, rpm: 900, mag: 50, reserve: 100, reload: 2.6, spread: 1.9, auto: true,  price: 2350, move: 1.02 },
    ump45:  { name: 'UMP-45',     dmg: 30, rpm: 666, mag: 25, reserve: 100, reload: 2.2, spread: 1.5, auto: true,  price: 1200, move: 1.03 },
    galil:  { name: 'Galil',      dmg: 30, rpm: 675, mag: 35, reserve: 90,  reload: 2.3, spread: 1.8, auto: true,  price: 2000, team: 't', move: 0.97 },
    famas:  { name: 'FAMAS',      dmg: 30, rpm: 675, mag: 25, reserve: 90,  reload: 2.1, spread: 1.6, auto: true,  price: 2250, team: 'ct', move: 0.97, burst: true },
    scout:  { name: 'Scout',      dmg: 70, rpm: 48,  mag: 10, reserve: 60,  reload: 2.6, spread: 2.8, spreadScoped: 0.06, auto: false, price: 1700, scope: true, move: 0.9 },
    sg552:  { name: 'SG-552',     dmg: 33, rpm: 666, mag: 30, reserve: 90,  reload: 2.4, spread: 1.7, auto: true,  price: 3500, team: 't', scope: true, spreadScoped: 0.15, move: 0.94 },
    aug:  { name: 'AUG',        dmg: 33, rpm: 666, mag: 30, reserve: 90,  reload: 2.4, spread: 1.6, auto: true,  price: 3500, team: 'ct', scope: true, spreadScoped: 0.15, move: 0.94 },
    m249:  { name: 'M249',       dmg: 31, rpm: 750, mag: 100, reserve: 200, reload: 4.5, spread: 2.4, auto: true, price: 5200, move: 0.78 },
    fiveseven:  { name: 'Five-Seven', dmg: 25, rpm: 400, mag: 20, reserve: 100, reload: 2.0, spread: 1.4, auto: false, price: 500, team: 'ct', move: 1.08 },
    tec9:  { name: 'Tec-9',      dmg: 24, rpm: 500, mag: 24, reserve: 120, reload: 2.0, spread: 1.6, auto: false, price: 500, team: 't', move: 1.08 },
    elite:  { name: 'Dual Elites', dmg: 26, rpm: 750, mag: 30, reserve: 120, reload: 2.6, spread: 1.7, auto: false, price: 800, move: 1.06 },
    smokegrenade: { name: 'Дымовая', dmg: 0, rpm: 0, mag: 1, reserve: 0, reload: 0, spread: 0, auto: false, price: 300, nade: 'smoke' },
  };
  const Combat = window.CS16Combat;
  for (const [id, profile] of Object.entries(Combat.weapons)) Object.assign(WEAPONS[id], profile);
  const BUY_ITEMS = [
    { id: 'kevlar',     label: '🦺 Бронежилет',    price: 650 },
    { id: 'deagle',     label: '🔫 Desert Eagle',  price: 650 },
    { id: 'tec9',       label: '🔫 Tec-9 (T)',     price: 500 },
    { id: 'fiveseven',  label: '🔫 Five-Seven (CT)', price: 500 },
    { id: 'elite',      label: '🔫 Dual Elites',   price: 800 },
    { id: 'mp5',        label: '🔫 MP5',           price: 1500 },
    { id: 'ump45',      label: '🔫 UMP-45',        price: 1200 },
    { id: 'p90',        label: '🔫 P90',           price: 2350 },
    { id: 'galil',      label: '🔫 Galil (T)',     price: 2000 },
    { id: 'famas',      label: '🔫 FAMAS (CT)',    price: 2250 },
    { id: 'ak47',       label: '🔫 AK-47 (T)',     price: 2500 },
    { id: 'm4a1',       label: '🔫 M4A1 (CT)',     price: 3100 },
    { id: 'sg552',      label: '🔫 SG-552 (T)',    price: 3500 },
    { id: 'aug',        label: '🔫 AUG (CT)',      price: 3500 },
    { id: 'scout',      label: '🎯 Scout',         price: 1700 },
    { id: 'awp',        label: '🎯 AWP',           price: 4750 },
    { id: 'm249',       label: '🔫 M249',          price: 5200 },
    { id: 'hegrenade',  label: '💣 HE-граната',    price: 300 },
    { id: 'flashbang',  label: '✨ Флешка',        price: 200 },
    { id: 'smokegrenade', label: '🌫 Дымовая',     price: 300 },
    { id: 'defuser',    label: '🧰 Набор сапёра (CT)', price: 200 },
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
    ak47:  { url: 'models/ak47.glb',    rotY: -Math.PI / 2, len: 0.85 },
    awp:  { url: 'models/awp.glb',     rotY: -Math.PI / 2, len: 1.1 },
    m4a1:  { url: 'models/m4a4.glb',    rotY:  Math.PI / 2, len: 0.8 },
    deagle:  { url: 'models/deagle.glb',  rotY:  Math.PI / 2, len: 0.38 },
    usp:  { url: 'models/pistol.glb',                  len: 0.36 },
    glock:  { url: 'models/pistol.glb',                  len: 0.34 },
    knife:  { url: 'models/bayonet.glb', rotY:  Math.PI / 2, len: 0.55 },
    c4:      { url: 'models/c4.glb',      rotX: -Math.PI / 2, len: 0.42 },
    grenade: { url: 'models/grenade.glb',                  len: 0.3 },
  };
  // Original Blender exports face -Z; their native orientation needs no correction.
  Object.assign(GLB_MODELS, {
  "knife": {
    "url": "models/csgo/knife.glb",
    "len": 0.4
  },
  "glock": {
    "url": "models/csgo/glock.glb",
    "len": 0.23
  },
  "usp": {
    "url": "models/csgo/usp.glb",
    "len": 0.25
  },
  "deagle": {
    "url": "models/csgo/deagle.glb",
    "len": 0.3
  },
  "ak47": {
    "url": "models/csgo/ak47.glb",
    "len": 0.89
  },
  "m4a1": {
    "url": "models/csgo/m4a1.glb",
    "len": 0.82
  },
  "awp": {
    "url": "models/csgo/awp.glb",
    "len": 1.02
  },
  "mp5": {
    "url": "models/csgo/mp5.glb",
    "len": 0.68
  },
  "p90": {
    "url": "models/csgo/p90.glb",
    "len": 0.61
  },
  "ump45": {
    "url": "models/csgo/ump45.glb",
    "len": 0.69
  },
  "galil": {
    "url": "models/csgo/galil.glb",
    "len": 0.85
  },
  "famas": {
    "url": "models/csgo/famas.glb",
    "len": 0.72
  },
  "scout": {
    "url": "models/csgo/scout.glb",
    "len": 0.93
  },
  "sg552": {
    "url": "models/csgo/sg552.glb",
    "len": 0.8
  },
  "aug": {
    "url": "models/csgo/aug.glb",
    "len": 0.79
  },
  "m249": {
    "url": "models/csgo/m249.glb",
    "len": 0.98
  },
  "fiveseven": {
    "url": "models/csgo/fiveseven.glb",
    "len": 0.25
  },
  "tec9": {
    "url": "models/csgo/tec9.glb",
    "len": 0.29
  },
  "elite": {
    "url": "models/csgo/elite.glb",
    "len": 0.23
  }
});
  GLB_MODELS.smokegrenade = GLB_MODELS.grenade;
  let handsModel = null, combatArtPromise = null;
  function loadCombatArt() {
    if (!combatArtPromise) combatArtPromise = Promise.all([
      loadGLBAll(), CS16Graphics.loadOperators(THREE),
      new THREE.GLTFLoader().loadAsync('models/csgo/hands.glb').then(g => { handsModel = g.scene; })
    ]).catch(error => { combatArtPromise = null; throw error; });
    return combatArtPromise;
  }
  const glbCache = {}; // weapon -> { model: Group|null }
  // Full glTF loader preserves Blender PBR textures and material properties.
  function loadGLBAll() {
    const loader = new THREE.GLTFLoader();
    return Promise.all(Object.entries(GLB_MODELS).map(async ([id, cfg]) => {
      glbCache[id] = { model: null };
      try {
        const asset = await loader.loadAsync(cfg.url);
        const model = new THREE.Group();
        model.add(asset.scene);
        if (cfg.rotY) model.rotation.y = cfg.rotY;
        if (cfg.rotX) model.rotation.x = cfg.rotX;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.scale.setScalar(cfg.len / (Math.max(size.x, size.y, size.z) || 1));
        model.updateMatrixWorld(true);
        model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
        const wrap = new THREE.Group();
        wrap.add(model);
        model.traverse(o => {
          if (!o.isMesh) return;
          o.receiveShadow = true;
          for (const material of [].concat(o.material)) {
            material.envMapIntensity = 0.75;
            if (material.map) material.map.anisotropy = Math.min(8, renderer3.capabilities.getMaxAnisotropy());
          }
        });
        glbCache[id].model = wrap;
      } catch (error) { throw new Error('Weapon model unavailable: ' + id + ': ' + error.message); }
    }));
  }
  // Клон GLB-модели оружия с тонировкой скином
  function glbGunClone(weapon, skin) {
    const entry = glbCache[weapon];
    if (!entry || !entry.model) return null;
    const m = entry.model.clone();
    const s = SKINS[skin];
    if (s) {
      // 3.23.0: рисованный узор скина вместо плоского цвета
      const map = skinTex(skin);
      m.traverse(o => {
        if (o.isMesh) {
          const original = [].concat(o.material)[0];
          // Keep normal/roughness detail when applying the player's existing skin.
          const material = original.clone();
          material.map = map; material.color.setHex(0xffffff);
          material.roughness = skin === 'gold' ? .25 : .48;
          material.metalness = skin === 'gold' ? .9 : .45;
          if (s.glow || s.rainbow) { material.emissiveMap = map; material.emissive.setHex(0xffffff); material.emissiveIntensity = .35; }
          material.userData.cs16Owned = true; o.material = material;
        }
      });
    }
    return m;
  }

  // ---------- БОМБА (пленты A и B — клетки карты; SITE_A/SITE_B задаются выбранной картой) ----------
  let bombPlanted = null;      // {site, pos, explodesAt}
  let bombMesh = null, bombLight = null, bombBeam = null, lastBeep = -1;
  let action = null;           // {type:'plant'|'defuse', t, need, site?}
  let kickUntil = 0;
  let stepAcc = 0;             // 3.24.0: таймер собственных шагов
  let specTarget = null;       // 3.24.0: ник игрока, за которым наблюдаем после смерти
  const enemyBlips = new Map(); // 3.24.0: радар — враги, стрелявшие недавно: nick -> time
  let radarBase = null;        // offscreen-карта радара

  // ---------- СОСТОЯНИЕ КЛИЕНТА ----------
  let sock = null;
  let inited = false, joined = false;
  let myNick = '';
  let state = { phase: 'lobby', mode: 5, round: 0, scores: { t: 0, ct: 0 }, players: [], host: null, freezeEnds: 0, roundEnds: 0, buyUntil: 0, winner: null };
  let clockOffset = 0; // serverNow - clientNow
  let me = { team: null, money: 800, hp: 100, armor: 0, alive: true, weapon: 'usp' };
  let primary = null;           // основное оружие (купленное)
  let secondary = null;         // 3.24.0: купленный пистолет (второй слот)
  const PISTOLS = { glock: 1, usp: 1, deagle: 1, tec9: 1, fiveseven: 1, elite: 1 };
  let current = 'usp';          // текущий слот
  let ammo = {};                // weapon -> {mag, reserve}
  let nades = { he: 0, flash: 0, smoke: 0 };
  let scoped = false, reloading = 0, lastShot = 0, bloom = 0;
  let sprayN = 0, sprayTimer = null; // 3.23.0: нарастание разброса при зажиме (спрей-паттерн)
  let freezeLeft = 0;

  // Игрок (физическое тело)
  const P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false };
  const EYE = 1.62, RADIUS = 0.7, HEIGHT = 1.8;
  const GRAV = 24, JUMP_V = 8.4;

  const remotes = new Map(); // nick -> {group, body, head, tag, tx,tz,ty, tyaw, tpitch, cur:{...}, weapon, team, alive, lastSeen}
  const tracers = [];

  // ---------- THREE ----------
  let renderer3, scene, camera, canvasEl;
  // ---------- 3.23.0: СКИНЫ-РИСУНКИ (как настоящие скины CS:GO, а не заливка цветом) ----------
  const skinTexCache = {};
  function skinTex(id) {
    if (skinTexCache[id] !== undefined) return skinTexCache[id];
    const s = SKINS[id];
    const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
    const [r, g, b] = s ? hex(s.color) : [116, 118, 128];
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const cl = (v, d) => Math.max(0, Math.min(255, v + d));
    // база — вертикальный градиент даёт объём металлу
    const grad = x.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `rgb(${cl(r, 30)},${cl(g, 30)},${cl(b, 30)})`);
    grad.addColorStop(0.55, `rgb(${r},${g},${b})`);
    grad.addColorStop(1, `rgb(${cl(r, -36)},${cl(g, -36)},${cl(b, -36)})`);
    x.fillStyle = grad; x.fillRect(0, 0, 256, 256);
    const rnd = (a, b2) => a + Math.random() * (b2 - a);
    if (!s) {
      // стандарт: серый металл с шумом и панельными швами
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 20},${20 + Math.random() * 30 | 0},${30},${rnd(0.02, 0.07)})`; x.fillRect(Math.random() * 256, Math.random() * 256, rnd(1, 3), rnd(1, 3)); }
      x.strokeStyle = 'rgba(30,30,36,0.5)'; x.lineWidth = 2;
      for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); }
      x.fillStyle = 'rgba(20,20,26,0.8)';
      for (let i = 0; i < 12; i++) x.fillRect(Math.random() * 250, Math.random() * 250, 3, 3); // болты
    } else if (id === 'banana') {
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(120,72,20,${rnd(0.15, 0.5)})`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, rnd(1.5, 5), 0, 7); x.fill(); }
      x.strokeStyle = 'rgba(90,50,10,0.35)'; x.lineWidth = 3;
      for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(Math.random() * 256, 0); x.quadraticCurveTo(Math.random() * 256, 128, Math.random() * 256, 256); x.stroke(); }
    } else if (id === 'waves') {
      const gr2 = x.createLinearGradient(0, 0, 0, 256);
      gr2.addColorStop(0, '#2f7fd0'); gr2.addColorStop(1, '#123a6e');
      x.fillStyle = gr2; x.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 6; row++) {
        x.strokeStyle = `rgba(235,248,255,${0.85 - row * 0.08})`; x.lineWidth = 4 - row * 0.4;
        x.beginPath();
        for (let px2 = 0; px2 <= 256; px2 += 4) x.lineTo(px2, 30 + row * 38 + Math.sin(px2 / 18 + row) * 10);
        x.stroke();
      }
      x.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 40; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    } else if (id === 'azimov') {
      // оранжево-бело-чёрные угловые полосы
      x.fillStyle = '#e8e4dc'; x.fillRect(0, 0, 256, 256);
      const poly = (pts, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fill(); };
      poly([0, 256, 256, 60, 256, 150, 90, 256], '#1a1a1e');
      poly([0, 90, 170, 0, 256, 0, 0, 190], '#ff7a1a');
      poly([0, 150, 256, 0, 256, 26, 0, 186], '#ffffff');
      poly([40, 256, 256, 110, 256, 132, 70, 256], '#ff7a1a');
      x.fillStyle = 'rgba(20,20,24,0.9)';
      for (let i = 0; i < 10; i++) x.fillRect(Math.random() * 250, Math.random() * 250, 4, 4);
    } else if (id === 'radiation') {
      // жёлто-чёрные полосы опасности + символ
      x.save(); x.translate(128, 128); x.rotate(-0.5);
      for (let i = -6; i < 6; i++) { x.fillStyle = i % 2 ? '#151515' : '#e8d21f'; x.fillRect(i * 32, -200, 32, 400); }
      x.restore();
      x.fillStyle = 'rgba(40,60,30,0.55)'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#d8ff4a';
      x.beginPath(); x.arc(128, 128, 46, 0, 7); x.fill();
      x.fillStyle = '#151515';
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 44, i * 2.09 + 0.5, i * 2.09 + 1.6); x.closePath(); x.fill(); }
      x.beginPath(); x.arc(128, 128, 10, 0, 7); x.fill();
    } else if (id === 'dragon') {
      // тёмно-красная чешуя
      for (let row = 0; row < 8; row++) for (let cix = 0; cix < 8; cix++) {
        const sx = cix * 32 + (row % 2) * 16, sy = row * 32;
        x.fillStyle = `rgb(${140 + Math.random() * 60 | 0},${20 + Math.random() * 20 | 0},${18 + Math.random() * 16 | 0})`;
        x.beginPath(); x.arc(sx, sy, 17, 0, Math.PI, false); x.fill();
        x.strokeStyle = 'rgba(40,6,6,0.8)'; x.lineWidth = 2; x.stroke();
      }
      x.fillStyle = 'rgba(255,140,60,0.25)'; x.fillRect(0, 100, 256, 40); // свечение живота
    } else if (id === 'neon') {
      x.fillStyle = '#170a24'; x.fillRect(0, 0, 256, 256);
      x.shadowColor = '#c86bff'; x.shadowBlur = 14;
      x.strokeStyle = '#b44dff'; x.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        x.beginPath();
        let px2 = Math.random() * 256, py2 = Math.random() * 256;
        x.moveTo(px2, py2);
        for (let j = 0; j < 4; j++) { px2 += rnd(-70, 70); py2 += rnd(-70, 70); x.lineTo(px2, py2); }
        x.stroke();
      }
      x.strokeStyle = '#e9ccff'; x.lineWidth = 1.6; x.shadowBlur = 8;
      for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(Math.random() * 256, Math.random() * 256); x.lineTo(Math.random() * 256, Math.random() * 256); x.stroke(); }
      x.shadowBlur = 0;
    } else if (id === 'obsidian') {
      x.fillStyle = '#101014'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = '#ff2222'; x.lineWidth = 2; x.shadowColor = '#ff2222'; x.shadowBlur = 10;
      for (let i = 0; i < 10; i++) {
        x.beginPath();
        let px2 = Math.random() * 256, py2 = Math.random() * 256;
        x.moveTo(px2, py2);
        for (let j = 0; j < 6; j++) { px2 += rnd(-40, 40); py2 += rnd(-40, 40); x.lineTo(px2, py2); }
        x.stroke();
      }
      x.shadowBlur = 0;
    } else if (id === 'gold') {
      const gg = x.createLinearGradient(0, 0, 256, 256);
      gg.addColorStop(0, '#fff0b0'); gg.addColorStop(0.4, '#ffd700'); gg.addColorStop(0.7, '#b8860b'); gg.addColorStop(1, '#ffdf40');
      x.fillStyle = gg; x.fillRect(0, 0, 256, 256);
      x.fillStyle = 'rgba(255,255,255,0.35)';
      x.beginPath(); x.moveTo(0, 60); x.lineTo(256, 0); x.lineTo(256, 26); x.lineTo(0, 100); x.closePath(); x.fill(); // блик
      x.strokeStyle = 'rgba(120,80,10,0.4)'; x.lineWidth = 1;
      for (let i = 0; i < 24; i++) { x.beginPath(); x.moveTo(Math.random() * 256, Math.random() * 256); x.lineTo(Math.random() * 256, Math.random() * 256); x.stroke(); }
    } else if (id === 'prismatic') {
      const pg = x.createLinearGradient(0, 0, 256, 256);
      ['#ff5252', '#ffb142', '#ffee58', '#69f0ae', '#40c4ff', '#7c4dff', '#e040fb'].forEach((col, i, arr) => pg.addColorStop(i / (arr.length - 1), col));
      x.fillStyle = pg; x.fillRect(0, 0, 256, 256);
      x.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 26; i++) { const sx = Math.random() * 256, sy = Math.random() * 256; x.fillRect(sx, sy, 2, 2); x.fillRect(sx - 3, sy + 1, 8, 1); x.fillRect(sx + 1, sy - 3, 1, 8); }
    } else if (id === 'diamond') {
      x.fillStyle = '#bfeaff'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 26; i++) {
        const sx = Math.random() * 256, sy = Math.random() * 256, sz = rnd(14, 42);
        x.fillStyle = `rgba(255,255,255,${rnd(0.15, 0.45)})`;
        x.beginPath(); x.moveTo(sx, sy - sz / 2); x.lineTo(sx + sz / 2, sy + sz / 2); x.lineTo(sx - sz / 2, sy + sz / 2); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(120,190,235,0.6)'; x.lineWidth = 1; x.stroke();
      }
      x.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 10; i++) { const sx = Math.random() * 250, sy = Math.random() * 250; x.fillRect(sx, sy, 3, 3); }
    }
    // лёгкая металлическая зернистость поверх любого скина
    for (let i = 0; i < 350; i++) { x.fillStyle = `rgba(255,255,255,${rnd(0.02, 0.06)})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1, 2); }
    const t = new THREE.CanvasTexture(c);
    if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    skinTexCache[id] = t;
    return t;
  }
  let worldGraphics = null, worldReady = false;
  let graphicsQuality = 'high';
  try { graphicsQuality = localStorage.getItem('cs16-graphics-quality') || 'high'; } catch (_) {}
  function initScene() {
    renderer3 = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    CS16Graphics.configureRenderer(renderer3, { quality: graphicsQuality });
    camera = new THREE.PerspectiveCamera(75, 1, 0.08, 600);
    buildWorld();
  }
  function rebuildWorld(name) {
    loadMap(name);
    remotesClear();
    clearShotEffects(); nadesList.length = 0; smokes.forEach(s=>{scene.remove(s.mesh);s.mesh.children.forEach(sp=>sp.material.dispose());}); smokes.length = 0; if(ui.smokeVeil)ui.smokeVeil.style.opacity='0'; dmgNums.length = 0;
    bombPlanted = null; removeBombMesh();
    buildWorld();
  }
  function buildWorld() {
    worldReady = false;
    if (worldGraphics) worldGraphics.dispose();
    scene = new THREE.Scene();
    scene.add(camera);
    ui.loading.style.display = 'flex';
    ui.loadingText.textContent = 'Загрузка ' + MAP_META[curMap].name;
    ui.loadingRetry.hidden = true;
    const active = CS16Graphics.createWorld({ THREE, renderer: renderer3, scene, camera,
      map: curMap, grid, CELL, TUN_FLOOR, TUN_CEIL, VENT_CEIL, quality: graphicsQuality });
    worldGraphics = active;
    Promise.all([active.ready, loadCombatArt()]).then(() => {
      if (worldGraphics !== active) return;
      worldReady = true;
      ui.loading.style.display = 'none';
      ensureSocket();
      doJoin();
    }).catch(error => {
      if (worldGraphics !== active) return;
      console.error('CS graphics load:', error);
      ui.loadingText.textContent = 'Не удалось загрузить карту. Повтори загрузку.';
      ui.loadingRetry.hidden = false;
    });
    buildRadarBase();
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
    // 3.24.0: приседание на Ctrl (медленнее, ниже обзор — зато пролезаешь в вентиляцию)
    P.crouched = !!keys.ctrl;
    // 3.24.1: скорость зависит от оружия (нож — быстрый, AWP/пулемёт — тяжёлые), как в CS 1.6
    const speed = (keys.shift ? 2.9 : 5.4) * (scoped ? 0.45 : 1) * (WEAPONS[current].move || 1) * (P.crouched ? 0.52 : 1);
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
    const cHere2 = cellAt(P.x, P.z);
    let flHere = floorAt(cHere2, P.x, P.z);
    // 3.24.0: под мостом/лестницей — пол как обычно (уровень 0), а не верх моста
    if ((cHere2 === 9 || cHere2 === 10) && P.y + HEIGHT < flHere) flHere = 0;
    if (ny <= flHere) { ny = flHere; P.vy = 0; P.onGround = true; }
    else {
      // потолок / крышка ящика под ногами
      const cUnder = cellAt(P.x, P.z);
      const hUnder = cellH(cUnder);
      if (hUnder > 0 && hUnder < WALL_H && ny > hUnder - 0.01 && P.y >= hUnder - 0.25 && P.vy <= 0) {
        ny = hUnder; P.vy = 0; P.onGround = true;
      }
    }
    P.y = ny;
    // 3.16.0: потолок глубокого туннеля (нельзя прыгнуть сквозь землю)
    if (cellAt(P.x, P.z) === 4 && ny + HEIGHT > TUN_CEIL) {
      P.y = TUN_CEIL - HEIGHT;
      if (P.vy > 0) P.vy = 0;
    }
    // 3.24.0: потолок вентиляции — стоя не пролезешь, только сидя (Ctrl)
    if (cellAt(P.x, P.z) === 8) {
      const hEff = P.crouched ? 1.28 : HEIGHT;
      if (P.y + hEff > VENT_CEIL) { P.y = VENT_CEIL - hEff; if (P.vy > 0) P.vy = 0; }
    }
  }
  // высота глаз с учётом приседания
  function eyeH() { return P.crouched ? 1.02 : EYE; }

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
  function sfxBeep(vol) { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 1900; g.gain.value = 0.2 * (vol == null ? 1 : vol); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.08); }
  // 3.24.0: звуки шагов — свой (полный) и чужие (по дистанции)
  function sfxStep(surf, vol) {
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    const buf = a.createBuffer(1, a.sampleRate * 0.09, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, surf === 'tun' ? 3 : 2.2);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = surf === 'tun' ? 900 : 480;
    const g = a.createGain(); g.gain.value = 0.5 * (vol == null ? 1 : vol);
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
  }
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
    st.textContent = '#tab-cs16 .cs16-hud { pointer-events:none; } #tab-cs16 .cs16-hud .cs16-hostPanel, #tab-cs16 .cs16-hud .cs16-hostPanel * { pointer-events:auto; }';
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
    // 3.24.0: стрелка направления урона (кольцо вокруг прицела, ▲ указывает откуда стреляли)
    ui.dmgDir = el('div', 'position:absolute; left:50%; top:50%; width:110px; height:110px; transform:translate(-50%,-50%); opacity:0; transition:opacity .25s;', ui.hud);
    el('div', 'position:absolute; left:50%; top:-2px; transform:translateX(-50%); font:16px monospace; color:#ff3333; text-shadow:0 0 4px #000;', ui.dmgDir, '▲');
    // 3.24.0: миникарта-радар (как в CS:GO) — левый верхний угол
    ui.radar = el('canvas', 'position:absolute; top:56px; left:12px; width:170px; height:170px; border-radius:50%; box-shadow:0 0 0 2px rgba(0,0,0,0.5);', ui.hud);
    ui.radar.width = 340; ui.radar.height = 340;
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
    // 3.24.0: таблица K/D в конце матча
    ui.scoreboard = el('div', 'position:absolute; left:50%; top:32%; transform:translate(-50%,-50%); display:none; background:rgba(16,14,10,0.94); border:1px solid #8a6b3a; border-radius:8px; padding:14px 20px; min-width:440px; pointer-events:auto; z-index:25; color:#eee; font:13px monospace;', ui.hud);
    // 3.15.9: ESC-меню в матче — продолжить / рестарт и выход (хост/Fifflaren) / покинуть матч
    ui.esc = el('div', 'position:absolute; inset:0; display:none; background:rgba(0,0,0,0.6); pointer-events:auto; z-index:30;', r);
    const ew = el('div', 'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#1c1a16; border:1px solid #8a6b3a; border-radius:8px; padding:18px 22px; min-width:320px; color:#eee; text-align:center;', ui.esc);
    el('div', 'font:bold 18px monospace; color:#ffc107; margin-bottom:14px;', ew, '⏸ ПАУЗА');
    ui.escResume = el('button', 'display:block; width:100%; margin:6px 0; padding:10px; font:bold 15px monospace; cursor:pointer; background:#2d4a22; color:#dfffcf; border:1px solid #4a8a3a;', ew, '▶ Продолжить');
    ui.escRestart = el('button', 'display:block; width:100%; margin:6px 0; padding:10px; font:bold 15px monospace; cursor:pointer; background:#2d4a66; color:#cfe4ff; border:1px solid #4a6a9a;', ew, '🔄 НАЧАТЬ ЗАНОВО (счёт 0:0)');
    ui.escTomenu = el('button', 'display:block; width:100%; margin:6px 0; padding:10px; font:bold 15px monospace; cursor:pointer; background:#6a2d22; color:#ffd9cf; border:1px solid #8a4a3a;', ew, '🏳️ ЗАКОНЧИТЬ МАТЧ (в меню)');
    ui.escLeave = el('button', 'display:block; width:100%; margin:6px 0; padding:10px; font:bold 15px monospace; cursor:pointer; background:#333; color:#ccc; border:1px solid #555;', ew, '🚪 Покинуть матч');
    el('div', 'font:11px monospace; color:#999; margin-top:10px;', ew, 'ESC — закрыть меню');
    ui.escResume.onclick = () => { closeEsc(); canvasEl.requestPointerLock(); };
    ui.escRestart.onclick = () => { closeEsc(); sock && sock.emit('cs16_restart'); };
    ui.escTomenu.onclick = () => { if (confirm('Завершить матч всем и выйти в меню?')) { closeEsc(); sock && sock.emit('cs16_tomenu'); } };
    ui.escLeave.onclick = () => {
      closeEsc();
      if (sock) { sock.emit('cs16_leave'); joined = false; }
      setTimeout(() => doJoin(), 400); // вернёмся в лобби зрителем
    };
    for (const [name, node] of Object.entries(ui)) node.classList.add('cs16-' + name);
    ui.crosshair.textContent = '';
    ui.weaponName = el('div', '', ui.hud); ui.weaponName.className = 'cs16-weaponName';
    ui.location = el('div', '', ui.hud); ui.location.className = 'cs16-location';
    const qualityLabel = el('label', '', ew, 'Графика '); qualityLabel.className = 'cs16-quality';
    ui.quality = el('select', '', qualityLabel);
    ui.quality.setAttribute('aria-label', 'Качество графики');
    for (const [value, label] of [['high','Высокая'],['balanced','Сбалансированная'],['low','Производительность']]) {
      const option = new Option(label, value); ui.quality.add(option);
    }
    ui.quality.value = graphicsQuality;
    ui.quality.onchange = () => {
      graphicsQuality = ui.quality.value;
      try { localStorage.setItem('cs16-graphics-quality', graphicsQuality); } catch (_) {}
      if (worldGraphics) worldGraphics.setQuality(graphicsQuality);
      resize3();
    };
    ui.loading = el('div', '', r); ui.loading.className = 'cs16-loading';
    el('div', '', ui.loading, 'SUPPORT HUB / COUNTER-STRIKE').className = 'cs16-loading-label';
    ui.loadingText = el('div', '', ui.loading, 'Загрузка карты');
    ui.loadingText.setAttribute('role', 'status');
    ui.loadingRetry = el('button', '', ui.loading, 'Повторить');
    ui.loadingRetry.hidden = true; ui.loadingRetry.onclick = () => buildWorld();
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
      if(w&&!w.nade){const details=document.createElement('small');details.style.cssText='display:block;opacity:.7;margin-top:3px';details.textContent='Урон '+w.dmg+' · Бронепробитие '+Math.round(w.penetration*100)+'% · '+w.rpm+' выстр./мин · Магазин '+w.mag;b.append(details);}
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
      ? `<span class="cs16-playerActions"><button class="cs16HostBtn" data-n="${esc(p.nick)}" title="Сделать хостом">Хост</button><button class="cs16KickBtn" data-n="${esc(p.nick)}" title="Кикнуть из комнаты">Кик</button></span>`
      : '';
    const rows = (team) => state.players.filter(p => p.team === team)
      .map(p => `<div style="padding:3px 8px; background:#26221a; margin:3px 0; border-radius:4px;">${esc(p.nick)}${p.bot ? ' 🤖' : ''} ${p.lvl ? `<span style="color:#ffc107; font-size:11px;" title="Уровень">⭐${p.lvl}</span>` : ''} <span style="color:#888; font-size:11px;">${p.kills || 0}/${p.deaths || 0}</span>${adminBtns(p)}</div>`).join('');
    const spectators = state.players.filter(p => !p.team).map(p => `<div class="cs16-spectator"><span>${esc(p.nick)}${p.nick === state.host ? ' <small>ХОСТ</small>' : ''}</span>${adminBtns(p)}</div>`).join('');
    const mapName = curMap === 'inferno' ? 'de_inferno' : 'de_dust2';
    const gmName = state.gm === 'gg' ? 'Gun-Game' : 'Классика (C4)';
    ui.lobby.innerHTML = `
      <div style="max-width:760px; margin:0 auto;">
        <div style="font:bold 26px monospace; color:#e8c34a; text-align:center;">COUNTER-STRIKE <span style="color:#999; font-size:13px;">${mapName} · ${gmName}${state.gm !== 'gg' ? ' · матч до 16 побед · MR15' : ''}</span></div>
        <div style="display:flex; gap:10px; justify-content:center; margin-top:8px; font:12px monospace; color:#ccc; flex-wrap:wrap;">
          <span>Карта:
            <button class="cs16MapBtn" data-m="dust2" style="padding:3px 10px; cursor:pointer; background:${(!state.map || state.map === 'dust2') ? '#8a6b3a' : '#333'}; color:#fff; border:1px solid #555;">de_dust2</button>
            <button class="cs16MapBtn" data-m="inferno" style="padding:3px 10px; cursor:pointer; background:${state.map === 'inferno' ? '#8a6b3a' : '#333'}; color:#fff; border:1px solid #555;">de_inferno</button>
          </span>
          <span>Режим:
            <button class="cs16GmBtn" data-g="classic" style="padding:3px 10px; cursor:pointer; background:${(!state.gm || state.gm === 'classic') ? '#8a6b3a' : '#333'}; color:#fff; border:1px solid #555;">Классика</button>
            <button class="cs16GmBtn" data-g="gg" style="padding:3px 10px; cursor:pointer; background:${state.gm === 'gg' ? '#8a6b3a' : '#333'}; color:#fff; border:1px solid #555;">Gun-Game</button>
          </span>
          <span>Боты:
            <button id="cs16BotAdd" style="padding:3px 10px; cursor:pointer; background:#2d4a22; color:#dfffcf; border:1px solid #4a8a3a;">+ Добавить</button>
            <button id="cs16BotDel" style="padding:3px 10px; cursor:pointer; background:#4a2d22; color:#ffd9cf; border:1px solid #8a4a3a;">− Убрать</button>
          </span>
        </div>
        ${inMatch ? `<div style="text-align:center; margin:10px 0; padding:8px; background:#1a2a3a; border:1px solid #3a6a9a;">⚔️ Матч идёт — раунд ${state.round}, счёт <b style="color:#e8c34a">${state.scores.t}</b> : <b style="color:#5aa2e8">${state.scores.ct}</b>. Вступай в команду — начнёшь играть со следующего раунда!</div>` : ''}
        <div class="cs16-teamCards" style="display:flex; gap:14px; margin-top:12px;">
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
        <div class="cs16-matchControls" style="margin-top:12px; background:#201c15; border-radius:6px; padding:10px; text-align:center;">
          <div style="font:13px monospace; color:#ccc;">Размер команд:
            ${[1,2,3,4,5].map(n => `<button class="cs16ModeBtn" data-n="${n}" style="padding:4px 12px; margin:0 3px; cursor:pointer; background:${state.mode === n ? '#8a6b3a' : '#333'}; color:#fff; border:1px solid #555; font:bold 13px monospace;">${n}v${n}</button>`).join('')}
          </div>
          <div class="cs16-hostStatus"><span>Хост: <b>${esc(state.host || '—')}</b>${state.host === myNick ? ' · это ты' : ''}</span>
            ${isFiff && state.host !== myNick ? `<button class="cs16HostBtn cs16-takeHost" data-n="${esc(myNick)}">Забрать хост себе</button>` : ''}
            ${isFiff && state.host && state.host.toLowerCase() !== myNick.toLowerCase() ? `<button class="cs16KickBtn" data-n="${esc(state.host)}">Кикнуть хоста</button>` : ''}
          </div>
          ${spectators ? `<div class="cs16-spectators"><div class="cs16-sectionLabel">БЕЗ КОМАНДЫ</div>${spectators}</div>` : ''}
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
        ${isFiff ? `<div class="cs16-adminHint">Управление комнатой: назначай хоста или исключай игроков, в том числе без команды.</div>` : ''}
        <div style="margin-top:10px; font:12px monospace; color:#888; line-height:1.7;">
          Управление: WASD — движение · Shift — тихий шаг · Ctrl — присесть (вентиляции) · Пробел — прыжок · Мышь — прицел · ЛКМ — огонь · ПКМ (AWP) — прицел ·
          R — перезарядка · B — магазин (1-9 — быстрая покупка) · G — HE · F — флешка · T — дым · 1/2/3 — основное/пистолет/нож · 4 — следующий ствол · <b style="color:#ffd76a;">E — закладка/разминирование C4</b> · <b style="color:#7ec2ff;">M — смена команды</b> · после смерти — пробел: переключать за кем следить
        </div>
      </div>`;
    const jt = document.getElementById('cs16JoinT'), jc = document.getElementById('cs16JoinCT');
    if (jt) jt.onclick = () => sock && sock.emit('cs16_team', 't');
    if (jc) jc.onclick = () => sock && sock.emit('cs16_team', 'ct');
    document.querySelectorAll('.cs16ModeBtn').forEach(b => { b.onclick = () => sock && sock.emit('cs16_mode', Number(b.dataset.n)); });
    document.querySelectorAll('.cs16MapBtn').forEach(b => { b.onclick = () => sock && sock.emit('cs16_map', b.dataset.m); });
    document.querySelectorAll('.cs16GmBtn').forEach(b => { b.onclick = () => sock && sock.emit('cs16_gm', b.dataset.g); });
    const ba = document.getElementById('cs16BotAdd'), bd = document.getElementById('cs16BotDel');
    if (ba) ba.onclick = () => sock && sock.emit('cs16_botadd');
    if (bd) bd.onclick = () => sock && sock.emit('cs16_botdel');
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
      const my = s.players.find(p => p.nick === myNick);
      if (my) { me.team = my.team ?? me.team; me.money = my.money; } // 3.15.6: деньги/команда из общего состояния (доход за раунд, награды)
      // 3.24.0: смена карты — пересобираем мир
      if (s.map && s.map !== curMap && typeof rebuildWorld === 'function') rebuildWorld(s.map);
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
      nades.he = 0; nades.flash = 0; nades.smoke = 0;
      // Сброс боезапаса (все стволы)
      ammo = {};
      for (const k in WEAPONS) { const w = WEAPONS[k]; if (w.melee || w.nade) continue; ammo[k] = { mag: w.mag, reserve: w.reserve }; }
      if (!primary) current = (secondary && WEAPONS[secondary]) ? secondary : (me.team === 't' ? 'glock' : 'usp');
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
      // 3.15.7: полная очистка поля — летящие гранаты и трассеры прошлого раунда
      for (const n of nadesList) scene.remove(n.mesh);
      nadesList.length = 0;
      clearShotEffects();
      flashAlpha = 0; shake = 0;
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
      r.moving = !!d.move; r.crouched = !!d.crouched;
    });
    sock.on('cs16_shoot', (d) => {
      const r = remotes.get(d.nick);
      if (r) { r.muzzle = WEAPONS[d.weapon]?.melee ? 0 : performance.now(); }
      if (!WEAPONS[d.weapon]?.melee) spawnTracer(d.origin, d.dir, Number.isFinite(d.distance) ? Math.max(0,Math.min(200,d.distance)) : 60, true);
      sfxShot(d.weapon);
      // 3.24.0: враг, который стрелял, 2.5 сек виден на радаре всем
      if (r && r.team !== me.team) enemyBlips.set(d.nick, performance.now());
    });
    sock.on('cs16_step', (d) => { // чужие шаги — громкость по дистанции
      const dist = Math.hypot(d.pos[0] - P.x, d.pos[2] - P.z);
      if (dist < 16) sfxStep(d.surf, Math.max(0, 1 - dist / 16) * 0.8);
    });
    sock.on('cs16_hit', (d) => {
      // 3.24.3: мой урон по врагу — число над ним + красный хитмаркер ✕
      if (d.target !== myNick && d.by === myNick && d.dmg > 0) {
        const t = remotes.get(d.target);
        if (t) spawnDmgNum(t.x, t.y, t.z, d.dmg, d.head);
        ui.hitmark.style.display = 'block';
        clearTimeout(ui.hitmark._t);
        ui.hitmark._t = setTimeout(() => { ui.hitmark.style.display = 'none'; }, 90);
      }
      if (d.target === myNick) {
        me.hp = d.hp; if(Number.isFinite(d.armor))me.armor=d.armor;
        ui.dmgVin.style.opacity = '1';
        setTimeout(() => { ui.dmgVin.style.opacity = '0'; }, 220);
        if (me.hp <= 0) me.alive = false;
        // 3.24.0: стрелка направления урона (откуда стреляли) — без индикатора попадания
        const shooter = d.by && remotes.get(d.by);
        if (shooter) {
          const ang = Math.atan2(shooter.x - P.x, shooter.z - P.z); // мировой угол к стрелку
          let rel = ang - P.yaw + Math.PI; // относительный (камера смотрит в -Z при yaw=0)
          ui.dmgDir.style.transform = `translate(-50%,-50%) rotate(${rel}rad)`;
          ui.dmgDir.style.opacity = '1';
          clearTimeout(ui.dmgDir._t);
          ui.dmgDir._t = setTimeout(() => { ui.dmgDir.style.opacity = '0'; }, 900);
        }
      }
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
        // 3.15.9: ослепление по направлению взгляда — смотришь на флешку = полный белый экран
        // с любого расстояния, боком — полуослепление, спиной — почти не действует
        const eye = [P.x, P.y + eyeH(), P.z];
        if (losClear(eye[0], eye[1], eye[2], d.pos[0], d.pos[1], d.pos[2])) {
          const vx = d.pos[0] - eye[0], vy = d.pos[1] - eye[1], vz = d.pos[2] - eye[2];
          const dist = Math.hypot(vx, vy, vz) || 1;
          const look = dirFromCam();
          const dot = (vx / dist) * look[0] + (vy / dist) * look[1] + (vz / dist) * look[2];
          const dirK = Math.min(1, Math.max(0, (dot + 0.2) / 1.1)); // 0..1 по углу взгляда
          const distK = Math.max(0.55, 1 - dist / 90);              // лёгкий спад на дистанции
          const a = dirK * distK;
          if (a > 0.04) {
            flashAlpha = Math.max(flashAlpha, Math.min(1, a));
            if (a > 0.5) flashUntil = performance.now() + 3000; // 3.24.0: полное ослепление держится 3 секунды
            sfxFlash();
          }
        }
      } else if (d.kind === 'smoke') {
        spawnSmoke(d.pos);
      } else {
        const dist = Math.hypot(P.x - d.pos[0], (P.y + eyeH()) - d.pos[1], P.z - d.pos[2]);
        if (dist < 6.5 && losClear(P.x, P.y + eyeH(), P.z, d.pos[0], d.pos[1], d.pos[2]) && me.alive) {
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
      // 3.24.0: итоговая таблица K/D
      if (ui.scoreboard && d.players) {
        const pl = [...d.players].sort((a, b) => (b.kills || 0) - (a.kills || 0));
        ui.scoreboard.innerHTML = `<div style="font:bold 16px monospace; color:#ffc107; text-align:center; margin-bottom:10px;">📊 ИТОГИ МАТЧА</div>` +
          `<table style="width:100%; border-collapse:collapse;">` +
          `<tr style="color:#999;"><td style="padding:3px 8px;">Игрок</td><td style="padding:3px 8px; text-align:right;">Убийства</td><td style="padding:3px 8px; text-align:right;">Смерти</td><td style="padding:3px 8px; text-align:right;">K/D</td><td style="padding:3px 8px; text-align:right;">Уровень</td></tr>` +
          pl.map(p => `<tr style="border-top:1px solid #3a3428; color:${p.team === 't' ? '#e8c34a' : p.team === 'ct' ? '#5aa2e8' : '#aaa'};">
            <td style="padding:4px 8px;">${p.bot ? '🤖 ' : ''}${esc(p.nick)}</td>
            <td style="padding:4px 8px; text-align:right;">${p.kills || 0}</td>
            <td style="padding:4px 8px; text-align:right;">${p.deaths || 0}</td>
            <td style="padding:4px 8px; text-align:right;">${((p.kills || 0) / Math.max(1, p.deaths || 0)).toFixed(2)}</td>
            <td style="padding:4px 8px; text-align:right; color:#ffc107;">⭐${p.lvl || 1}</td></tr>`).join('') +
          `</table>`;
        ui.scoreboard.style.display = 'block';
        setTimeout(() => { ui.scoreboard.style.display = 'none'; }, 12000);
      }
      setTimeout(() => { remotesClear(); }, 1000);
    });
    sock.on('cs16_leave', (d) => { removeRemote(d.nick); });
    // 3.24.0: Gun-Game — новый ствол за убийство и респаун после смерти
    sock.on('cs16_gg_gun', (d) => {
      if (!WEAPONS[d.weapon]) return;
      current = d.weapon;
      if (PISTOLS[d.weapon]) secondary = d.weapon; else primary = d.weapon;
      ammo[d.weapon] = { mag: WEAPONS[d.weapon].mag, reserve: WEAPONS[d.weapon].reserve };
      killfeed(`🔫 GG: теперь у тебя ${WEAPONS[d.weapon].name}`);
    });
    sock.on('cs16_gg_respawn', (d) => {
      me.alive = true; me.hp = 100;
      if (d.pos) { P.x = d.pos[0]; P.y = d.pos[1]; P.z = d.pos[2]; P.vx = P.vy = P.vz = 0; }
      centerMsg('', 0); if (ui.centerMsg) ui.centerMsg.style.display = 'none';
    });
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
    // 3.15.7: если моделька уже есть — удаляем старую (иначе дубли накапливаются в сцене)
    const prev = remotes.get(nick);
    if (prev) { disposeGun(prev.gun); scene.remove(prev.group); remotes.delete(nick); }
    const g = CS16Graphics.createOperator(team);
    if (!g) throw new Error('Operator assets must load before joining a match');
    const torso = g.getObjectByName('torso'), head = g.getObjectByName('head');
    const legL = g.getObjectByName('legL'), legR = g.getObjectByName('legR');
    const armL = g.getObjectByName('armL'), armR = g.getObjectByName('armR');
    // крепление оружия в правую руку
    const gunHolder = new THREE.Group();
    gunHolder.position.set(0, -0.52, -0.15);
    armR.add(gunHolder);
    // 3.22.0: вспышка на дуле чужого стрелка (видна всем)
    const muzzleFx = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
    muzzleFx.scale.set(0.5, 0.5, 1);
    muzzleFx.position.set(0, 0, -0.85);
    muzzleFx.visible = false;
    gunHolder.add(muzzleFx);
    // 3.22.0: игроки отбрасывают тени
    g.traverse(o2 => { if (o2.isMesh) { o2.castShadow = true; } });
    // 3.15.5: табличку с ником видят только свои — ники врагов не показываем
    if (team && me.team && team === me.team) g.add(makeTag(nick, team === 't' ? '#ffd95e' : '#7ec2ff'));
    scene.add(g);
    const r = { group: g, torso, head, legL, legR, armL, armR, gunHolder, gun: null, gunWeapon: '', gunSkin: '', muzzleFx,
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
    if (r.gun) { disposeGun(r.gun); r.gunHolder.remove(r.gun); }
    r.gun = buildGun(r.weapon || 'usp', r.skin, 1);
    r.gunHolder.add(r.gun);
  }
  // Модель оружия из примитивов по мотивам CS:GO (АК с изогнутым магазином, AWP с прицелом и затвором),
  // красится скином. scale>1.5 — вид от первого лица (более детально).
  function buildGun(weapon, skin, scale) {
    const group = new THREE.Group();
    const model = glbGunClone(weapon, skin);
    if (model) group.add(model);
    if (scale > 1.5 && handsModel) {
      const hands = handsModel.clone(true);
      const left = hands.getObjectByName('leftHand');
      const pistol = ['glock','usp','deagle','fiveseven','tec9','elite'].includes(weapon);
      if (left && (pistol || weapon === 'knife' || weapon === 'smokegrenade')) left.visible = false;
      if (pistol) hands.position.z = -.055;
      group.add(hands);
      group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    }
    return group;
  }
  function disposeGun(group) {
    if (!group) return;
    group.traverse(o => {
      if (o.isMesh) for (const m of [].concat(o.material)) if (m.userData.cs16Owned) m.dispose();
    });
  }
  function removeRemote(nick) {
    const r = remotes.get(nick);
    if (r) { disposeGun(r.gun); scene.remove(r.group); remotes.delete(nick); }
  }
  function remotesClear() { for (const n of [...remotes.keys()]) removeRemote(n); for (const n of nadesList) scene.remove(n.mesh); nadesList.length = 0; }

  // ---------- ЭФФЕКТЫ ----------
  // 3.22.0: вспышка выстрела — аддитивная звезда + точечный свет, видны ВСЕМ (и на стенах)
  let muzzleTexCache = null, shotLight = null;
  const shotFlashes = [];
  function muzzleTex() {
    if (muzzleTexCache) return muzzleTexCache;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    rg.addColorStop(0, 'rgba(255,255,240,1)');
    rg.addColorStop(0.35, 'rgba(255,214,120,0.85)');
    rg.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(255,242,202,.8)';
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7, radius = i % 2 ? 19 : 29;
      g.beginPath();g.moveTo(32,32);
      g.lineTo(32+Math.cos(a-.15)*radius,32+Math.sin(a-.15)*radius);
      g.lineTo(32+Math.cos(a+.12)*radius*.75,32+Math.sin(a+.12)*radius*.75);
      g.fill();
    }
    muzzleTexCache = new THREE.CanvasTexture(c);
    return muzzleTexCache;
  }
  function flashAt(pos) {
    if (!shotLight) shotLight = new THREE.PointLight(0xffc46a, 0, 6, 2);
    if (shotLight.parent !== scene) scene.add(shotLight);
    shotLight.position.copy(pos);
    shotLight.intensity = 1.7;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
    const size = .18 + Math.random() * .12;
    sp.scale.set(size,size,1);sp.material.rotation=Math.random()*Math.PI;
    sp.position.copy(pos);
    scene.add(sp);
    shotFlashes.push({ sp, size, born:performance.now(), die: performance.now() + 65 });
  }
  // 3.22.0: пуля-трассер как в CS:GO — светящийся стержень + яркая голова
  function spawnTracer(origin, dir, len, isRemote) {
    const o = new THREE.Vector3(origin[0], origin[1], origin[2]);
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.009, 1, 5, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    core.position.copy(o);core.scale.y=.01;
    group.add(core);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    head.scale.set(0.065, 0.065, 1);
    head.position.copy(o);
    group.add(head);
    scene.add(group);
    tracers.push({ line:group,core,head,o,d,len:Math.max(.05,len),born:performance.now(),die:performance.now()+len/1.2+25 });
    // вспышка на дуле — у себя чуть ниже-правее камеры (видно и стены рядом), у врагов — на дуле
    const fo = isRemote ? o.clone() : o.clone().addScaledVector(d, 0.75).add(new THREE.Vector3(0.15, -0.17, 0));
    flashAt(fo);
  }
  function disposeShot(object) {
    object.removeFromParent();
    object.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  }
  function clearShotEffects() {
    for(const tr of tracers)disposeShot(tr.line);
    for(const sf of shotFlashes)disposeShot(sf.sp);
    tracers.length=0;shotFlashes.length=0;
    if(shotLight)shotLight.intensity=0;
    vmKick=0;vmKickVelocity=0;
  }
  // 3.24.3: летящее число урона над врагом (как в примере: белое, хедшот — жёлтое)
  function spawnDmgNum(x, y, z, dmg, head) {
    if (!scene || dmgNums.length > 24) return;
    const c = document.createElement('canvas'); c.width = 160; c.height = 80;
    const g2 = c.getContext('2d');
    const txt = '-' + dmg;
    g2.font = '900 46px "Arial Black", Arial, sans-serif';
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.lineWidth = 10; g2.strokeStyle = 'rgba(10,10,10,0.9)';
    g2.strokeText(txt, 80, 42);
    g2.fillStyle = head ? '#ffd21a' : '#ffffff';
    g2.fillText(txt, 80, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.position.set(x + (Math.random() - 0.5) * 0.5, y + 2.0, z + (Math.random() - 0.5) * 0.5);
    sp.scale.set(2.0, 1.0, 1);
    sp.renderOrder = 999;
    scene.add(sp);
    dmgNums.push({ sp, born: performance.now() });
  }
  const nadesList = [];
  const smokes = []; // дымовые завесы: {mesh, until}
  let flashUntil = 0; // флешка держит белый экран 3 сек
  let flashAlpha = 0, shake = 0;
  function spawnNade(pos, vel, kind, isMine) {
    let mesh;
    const glbN = glbCache.grenade && glbCache.grenade.model;
    if (glbN) {
      mesh = glbN.clone();
      mesh.scale.multiplyScalar(1.1);
      mesh.traverse(o => { if (o.isMesh && kind === 'flash') o.material = new THREE.MeshStandardMaterial({ color: 0xdddddd }); });
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: kind === 'flash' ? 0xeeeeee : 0x3a5f2a })
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
      // пол (уровень пола ячейки — туннели ниже уровня земли)
      const cF = cellAt(nx, nz);
      const flN = floorAt(cF);
      if (ny < flN + 0.16) { ny = flN + 0.16; n.vy = -n.vy * 0.38; n.vx *= 0.72; n.vz *= 0.72; if (Math.abs(n.vy) < 1) n.vy = 0; }
      // крышка ящика
      const cU = cF, hU = cellH(cU);
      if (hU > 0 && hU < WALL_H && ny - 0.16 < hU && n.mesh.position.y >= hU - 0.1 && n.vy <= 0) { ny = hU + 0.16; n.vy = 0; n.vx *= 0.8; n.vz *= 0.8; }
      // 3.16.0: потолок глубокого туннеля
      if (cU === 4 && ny > TUN_CEIL - 0.16) { ny = TUN_CEIL - 0.16; n.vy = -Math.abs(n.vy) * 0.38; }
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

  // 3.24.0: дымовая завеса — серое облако, сквозь которое не видно и не простреливается
  function smokeTex() {
    if (smokeTex._c) return smokeTex._c;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    rg.addColorStop(0, 'rgba(190,190,190,0.92)');
    rg.addColorStop(0.6, 'rgba(160,160,160,0.55)');
    rg.addColorStop(1, 'rgba(150,150,150,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    smokeTex._c = new THREE.CanvasTexture(c);
    return smokeTex._c;
  }
  function spawnSmoke(pos) {
    const grp = new THREE.Group();
    for (let i = 0; i < 32; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, opacity: 0.96 }));
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (Combat.SMOKE_RADIUS-1.7);
      sp.position.set(pos[0] + Math.cos(a) * r, pos[1] + 0.5 + Math.random() * 2.6, pos[2] + Math.sin(a) * r);
      sp.scale.setScalar(4.0 + Math.random() * 1.5);
      grp.add(sp);
    }
    scene.add(grp);
    smokes.push({ mesh: grp, pos, until: performance.now() + Combat.SMOKE_DURATION, born: performance.now() });
  }
  // отрезок проходит сквозь дым? (проверка сфер дыма)
  function smokeBlocks(ax, ay, az, bx, by, bz) {
    for (const s of smokes) {
      if (performance.now() > s.until) continue;
      // расстояние от центра дыма до отрезка
      const px = bx - ax, py = by - ay, pz = bz - az;
      const len2 = px * px + py * py + pz * pz;
      let t = len2 > 0 ? ((s.pos[0] - ax) * px + (s.pos[1] - ay) * py + (s.pos[2] - az) * pz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + px * t - s.pos[0], cy = ay + py * t - s.pos[1], cz = az + pz * t - s.pos[2];
      if (cx * cx + cy * cy + cz * cz < Combat.SMOKE_RADIUS * Combat.SMOKE_RADIUS) return true;
    }
    return false;
  }
  function stepSmokes() {
    const now = performance.now();
    if(!ui.smokeVeil){ui.smokeVeil=el('div','position:absolute;inset:0;pointer-events:none;background:#a5a7a5;opacity:0;',ui.hud);ui.hud.prepend(ui.smokeVeil);}
    let density=0;
    for(const s of smokes){
      const distance=Math.hypot((P.x-s.pos[0])/Combat.SMOKE_RADIUS,(P.y+eyeH()-s.pos[1]-1.6)/3,(P.z-s.pos[2])/Combat.SMOKE_RADIUS);
      density=Math.max(density,Math.min(1,Math.max(0,(1-distance)*4))*Math.min(1,(s.until-now)/3000));
    }
    ui.smokeVeil.style.opacity=String(density*.98);
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      const left = s.until - now;
      if (left <= 0) { scene.remove(s.mesh); s.mesh.children.forEach(sp=>sp.material.dispose()); smokes.splice(i, 1); continue; }
      if (left < 3000) { // растворение
        const k = left / 3000;
        s.mesh.children.forEach(sp => { sp.material.opacity = 0.96 * k; });
      }
    }
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
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
      bombMesh.add(box);
    }
    bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bombLight.position.set(0.15, 0.15, 0);
    bombMesh.add(bombLight);
    // 3.16.0: синий луч вверх — бомба видна откуда угодно
    bombBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.45, depthTest: false, side: THREE.DoubleSide })
    );
    bombBeam.position.y = 45;
    bombBeam.renderOrder = 999;
    bombMesh.add(bombBeam);
    bombMesh.position.set(pos[0], pos[1] + 0.11, pos[2]);
    scene.add(bombMesh);
  }
  function removeBombMesh() { if (bombMesh) { scene.remove(bombMesh); bombMesh = null; bombLight = null; bombBeam = null; } }

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
        if (action.type === 'plant') sock && sock.emit('cs16_plant', { site: action.site, pos: [P.x, P.y, P.z] });
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
  let vm = null, vmWeapon = '', vmSkin = '', vmGlb = false, vmKick = 0, vmKickVelocity = 0, vmSwayX = 0, vmSwayY = 0;
  function refreshViewmodelSkin() { vmSkin = ' '; } // принудительная пересборка
  function updateViewmodel(dt, t) {
    if (!camera) return;
    if (vmWeapon !== current || vmSkin !== mySkin || vmGlb !== !!(glbCache[current] && glbCache[current].model)) {
      vmWeapon = current; vmSkin = mySkin; vmGlb = !!(glbCache[current] && glbCache[current].model);
      if (vm) { disposeGun(vm); camera.remove(vm); }
      vm = buildGun(current, mySkin, 1.8);
      vmKick=0;vmKickVelocity=0;
      vm.position.set(0.24, -0.25, -0.55);
      camera.add(vm);
    }
    if (!vm) return;
    const moving = (keys.w || keys.a || keys.s || keys.d) && P.onGround;
    vm.position.y = -0.25 + (moving ? Math.abs(Math.sin(t / 110)) * 0.014 : 0);
    vm.position.x = 0.24 + (moving ? Math.sin(t / 220) * 0.008 : 0);
    // отводка за мышью (ствол чуть отстаёт от движения)
    vmSwayX *= Math.max(0, 1 - dt * 7);
    vmSwayY *= Math.max(0, 1 - dt * 7);
    vm.rotation.y = -vmSwayX * 2.2;
    if (reloading > 0 && WEAPONS[current].reload) {
      const k = 1 - reloading / WEAPONS[current].reload;
      vm.rotation.x = -0.7 * Math.sin(Math.min(1, k) * Math.PI) - vmSwayY * 1.4;
    } else vm.rotation.x = -vmSwayY * 1.4;
    // Critically damped spring: smooth recovery independent of frame rate.
    const decay=Math.exp(-22*dt), impulse=vmKickVelocity+22*vmKick;
    vmKick=(vmKick+impulse*dt)*decay;
    vmKickVelocity=(vmKickVelocity-22*impulse*dt)*decay;
    const melee=WEAPONS[current].melee;
    vm.position.z = -0.55 + vmKick * (melee ? -.25 : .16);
    vm.position.y += vmKick*.035;
    vm.rotation.x += vmKick*(melee ? -.7 : .23);
    vm.rotation.z = vmKick*(melee ? -.9 : -.06);
    if(shake>0){vm.position.x+=Math.sin(t*.071)*shake*.018;vm.position.y+=Math.cos(t*.083)*shake*.018;}
    vm.visible = me.alive && !scoped;
  }

  // ---------- СТРЕЛЬБА ----------
  const keys = {};
  // Слоты оружия и переключение (колесико/клавиши — как в CS)
  let lastWeaponSlot = '';
  let burstOn = false; // очередь Glock/FAMAS (ПКМ)
  let burstTimers = [];
  function ownedSlots() {
    const pistol = secondary && WEAPONS[secondary] ? secondary : (me.team === 't' ? 'glock' : 'usp');
    const arr = [];
    if (primary && WEAPONS[primary]) arr.push(primary);
    arr.push(pistol, 'knife');
    return arr;
  }
  function switchSlot(id) {
    if (!WEAPONS[id] || id === current) return;
    burstTimers.forEach(clearTimeout); burstTimers.length = 0;
    sprayN = 0; bloom = 0; scoped = false;
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
  // 3.24.1: механика оружия — тяжёлый удар ножа (ПКМ): дальше и больнее, но медленнее
  function heavySlash() {
    if (!me.alive || state.phase !== 'live') return;
    const now = performance.now();
    if (reloading > 0 || now - lastShot < 900) return;
    lastShot = now;
    vmKickVelocity=18;
    sfxShot('knife');
    const d = dirFromCam();
    const wall=rayWall(P.x,P.y+eyeH(),P.z,...d,2.8);
    const hit = rayPlayers(P.x, P.y + eyeH(), P.z, d, wall?wall.t:2.8);
    if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: 'knife', head: false, zone: 'body', dist: hit.t, heavy: true });
  }
  function tryShoot() {
    if (!me.alive || state.phase !== 'live') return;
    const w = WEAPONS[current];
    const now = performance.now();
    if (reloading > 0 || now - lastShot < 60000 / w.rpm) return;
    // 3.24.1: Glock/FAMAS — режим очереди (ПКМ переключает): 3 выстрела за один клик
    if (w.burst && burstOn) {
      if (burstTimers.length) return; // очередь уже идёт
      lastShot = now;
      for (let i = 0; i < 3; i++) burstTimers.push(setTimeout(() => { burstTimers.shift(); fireOne(); }, i * 75));
      return;
    }
    fireOne();
  }
  function fireOne() {
    const w = WEAPONS[current];
    if (!me.alive || state.phase !== 'live' || reloading > 0 || w.nade) return;
    const a = ammo[current];
    if (a && a.mag <= 0) { if (!burstTimers.length) startReload(); return; }
    if (!burstTimers.length) lastShot = performance.now();
    if (a) a.mag--;
    vmKickVelocity = Math.min(24,vmKickVelocity + (w.scope ? 16 : w.melee ? 18 : w.auto ? 10 : 13));
    sfxShot(current);
    if (w.melee) {
      // нож: короткая дистанция
      const d = dirFromCam();
      const wall=rayWall(P.x,P.y+eyeH(),P.z,...d,2.4);
      const hit = rayPlayers(P.x, P.y + eyeH(), P.z, d, wall?wall.t:2.4);
      if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: 'knife', head: false, zone: 'body', dist: hit.t });
      return;
    }
    // Spread is centered on the crosshair; apply this shot's bloom afterwards.
    const spreadDeg = Combat.spread(w, {scoped,moving:!!(keys.w||keys.a||keys.s||keys.d),airborne:!P.onGround,crouched:P.crouched,bloom,shots:sprayN});
    const d = Combat.direction(P.yaw,P.pitch,spreadDeg);
    sprayN = Math.min(14,sprayN+1);
    if(sprayTimer)clearTimeout(sprayTimer);
    sprayTimer=setTimeout(()=>{sprayN=0;},300);
    bloom=Math.min(bloom+(w.auto?.35:.8),2.5);
    const MAXT = 200;
    const wall = rayWall(P.x, P.y + eyeH(), P.z, d[0], d[1], d[2], MAXT);
    const wallT = wall ? wall.t : MAXT;
    let hit = rayPlayers(P.x, P.y + eyeH(), P.z, d, wallT);
    const origin=[P.x,P.y+eyeH(),P.z], distance=hit?hit.t:wallT;
    spawnTracer(origin,d,distance,false);
    sock.emit('cs16_shoot',{origin,dir:d,weapon:current,distance});
    if (hit) sock.emit('cs16_hit', { target: hit.nick, weapon: current, head: hit.head, zone: hit.zone, dist: hit.t });
    // отдача: вертикальный паттерн растёт со спреем (кликанье — точно, зажим — вверх)
    P.pitch = Math.min(1.45, P.pitch + (current === 'awp' ? 0.035 : 0.005 + sprayN * 0.0018 + Math.random() * 0.004));
    P.yaw += (Math.random() - 0.5) * (0.003 + sprayN * 0.0006);
  }
  function rayPlayers(ox, oy, oz, d, maxT) {
    let best = null;
    for (const [nick, r] of remotes) {
      if (!r.alive || (state.gm !== 'gg' && r.team === me.team)) continue;
      // Test the displayed interpolated model, not an extrapolated invisible target.
      const hit=Combat.playerHit([ox,oy,oz],d,r,maxT);
      if(hit&&(!best||hit.t<best.t))best={...hit,nick};
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
    if (kind === 'smoke' && nades.smoke <= 0) return;
    const d = dirFromCam();
    const v = 13;
    const vel = [d[0] * v + P.vx * 0.5, d[1] * v + 3.2, d[2] * v + P.vz * 0.5];
    spawnNade([P.x, P.y + eyeH(), P.z], vel, kind, true);
    sock && sock.emit('cs16_nade', { pos: [P.x, P.y + eyeH(), P.z], vel, kind });
    if (kind === 'he') nades.he--; else if (kind === 'flash') nades.flash--; else nades.smoke--;
  }
  function buyOk(id) {
    if (id === 'hegrenade') nades.he = Math.min(1, nades.he + 1);
    else if (id === 'flashbang') nades.flash = Math.min(2, nades.flash + 1);
    else if (id === 'smokegrenade') nades.smoke = Math.min(1, nades.smoke + 1);
    else if (id === 'kevlar') me.armor = 100;
    else if (id === 'defuser') me.kit = true;
    else if (WEAPONS[id]) {
      if (PISTOLS[id]) secondary = id;
      else if (!WEAPONS[id].nade) primary = id;
      current = id;
      if (!ammo[id]) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
    }
  }

  // ---------- ПОКУПКИ ----------
  function openBuy() {
    const nowSrv = Date.now() + clockOffset;
    const ok = state.phase === 'freeze' || (state.phase === 'live' && nowSrv < state.buyUntil);
    if (!ok || !me.alive) { killfeed('🛒 Сейчас купить нельзя'); return; }
    renderBuyList();
    ui.buy.style.display = 'block';
    // 3.24.1: покупка мышкой — отпускаем курсор, чтобы кликать по товарам
    unlockForShop = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function closeBuy() {
    if (!ui.buy) return;
    ui.buy.style.display = 'none';
    if (unlockForShop) {
      unlockForShop = false;
      if (state.phase !== 'lobby' && me.alive && !escOpen()) canvasEl.requestPointerLock();
    }
  }
  // 3.15.9: ESC-меню
  function isBoss() { return state.host === myNick || myNick.toLowerCase() === 'fifflaren'; }
  function escOpen() { return ui.esc && ui.esc.style.display === 'block'; }
  function openEsc() {
    if (state.phase === 'lobby' || state.phase === 'matchend' || !ui.esc) return;
    ui.escRestart.style.display = isBoss() ? 'block' : 'none';
    ui.escTomenu.style.display = isBoss() ? 'block' : 'none';
    ui.esc.style.display = 'block';
  }
  function closeEsc() { if (ui.esc) ui.esc.style.display = 'none'; }

  // ---------- ВВОД ----------
  let pointerLocked = false;
  let unlockForShop = false; // 3.24.1: мышь отпущена специально для магазина — не открывать ESC-меню
  function bindInput() {
    document.addEventListener('pointerlockerror', () => {
      centerMsg('🖱️ Не удалось захватить мышь — кликни по игре ещё раз', 2500);
    });
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === canvasEl;
      if (!pointerLocked && !unlockForShop && (state.phase === 'live' || state.phase === 'freeze' || state.phase === 'roundend')) {
        // 3.15.9: ESC (или потеря мыши) — открываем меню паузы
        openEsc();
      } else if (pointerLocked) {
        closeEsc();
        ui.centerMsg.style.display = 'none';
      }
    });
    canvasEl.addEventListener('mousedown', (e) => {
      if (state.phase === 'lobby') return;
      if (!pointerLocked) { canvasEl.requestPointerLock(); return; }
      if (e.button === 0) {
        const w = WEAPONS[current];
        if (w.auto) { keys.fire = true; tryShoot(); } else tryShoot();
      } else if (e.button === 2) {
        const w = WEAPONS[current];
        // 3.24.1: механика каждого оружия — нож: тяжёлый удар; Glock/FAMAS: очередь/авто; снайперки: прицел
        if (w.melee) heavySlash();
        else if (w.burst) { burstOn = !burstOn; killfeed(burstOn ? '🔥 Режим очереди ВКЛ' : '🔥 Режим очереди ВЫКЛ'); }
        else if (w.scope) scoped = !scoped;
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
    // 3.19.3: русская раскладка → латиница (ходьба WASD, покупка, оружие, гранаты — в любой раскладке)
    const RU2EN = { 'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p',
      'ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l',
      'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m' };
    const normK = k => RU2EN[k] || k;
    window.addEventListener('keydown', (e) => {
      if (state.phase === 'lobby' || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      keys[normK(e.key.toLowerCase())] = true;
      if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') { keys.ctrl = true; e.preventDefault(); }
      const k = normK(e.key.toLowerCase());
      // 3.15.9: ESC-меню
      if (k === 'escape') {
        if (ui.buy.style.display === 'block') { closeBuy(); return; }
        if (escOpen()) { closeEsc(); if (state.phase !== 'lobby') canvasEl.requestPointerLock(); }
        else openEsc();
        return;
      }
      if (escOpen()) return; // в меню паузы игровые клавиши не работают
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
      if (k === 't') throwNade('smoke');
      if (k === '1' && primary) switchSlot(primary);
      if (k === '2') switchSlot((secondary && WEAPONS[secondary]) ? secondary : (me.team === 't' ? 'glock' : 'usp'));
      if (k === '3') switchSlot('knife');
      if (k === '4') { const arr = ownedSlots(); const nx = arr[(arr.indexOf(current) + 1) % arr.length]; switchSlot(nx); } // 3.24.0: слот 4 — следующее оружие
      if (k === 'q' && lastWeaponSlot) switchSlot(lastWeaponSlot);
      // 3.24.0: спектр — пробел/клик переключает игрока, за которым наблюдаем
      if (!me.alive && k === ' ' && specTarget) {
        const mates = [];
        for (const [nick, r] of remotes) if (r.alive && r.team === me.team) mates.push(nick);
        if (mates.length) specTarget = mates[(mates.indexOf(specTarget) + 1) % mates.length];
      }
    });
    window.addEventListener('keyup', (e) => { keys[normK(e.key.toLowerCase())] = false; if (e.code === 'Space') keys.space = false; if (e.code === 'ControlLeft' || e.code === 'ControlRight') keys.ctrl = false; });
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
    ui.scoreT.textContent = 'T  ' + state.scores.t;
    ui.scoreCT.textContent = state.scores.ct + '  CT';
    ui.hpTxt.textContent = '+ ' + Math.max(0, me.hp);
    ui.armorTxt.textContent = 'БРОНЯ  ' + Math.max(0, me.armor);
    ui.money.textContent = '$' + me.money;
    const w = WEAPONS[current];
    const a = ammo[current];
    ui.ammo.textContent = w.melee ? '∞' : (a ? `${a.mag} / ${a.reserve}` : '');
    ui.nadeTxt.textContent = `HE  ${nades.he}    FLASH  ${nades.flash}    SMOKE  ${nades.smoke}`;
    ui.weaponName.textContent = w.name;
    ui.location.textContent = MAP_META[curMap].name.toUpperCase();
    ui.crosshair.style.display = (scoped || !me.alive) ? 'none' : 'block';
    const cone=Combat.spread(w,{scoped,moving:!!(keys.w||keys.a||keys.s||keys.d),airborne:!P.onGround,crouched:P.crouched,bloom,shots:sprayN});
    ui.crosshair.style.transform='translate(-50%,-50%) scale('+Math.min(3,1+cone*.22)+')';
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
  // 3.24.0: радар (как в CS:GO) — база рисуется один раз на карту, точки — каждый кадр
  function buildRadarBase() {
    radarBase = document.createElement('canvas');
    radarBase.width = radarBase.height = 340;
    const g = radarBase.getContext('2d');
    g.fillStyle = 'rgba(24,22,18,0.78)';
    g.beginPath(); g.arc(170, 170, 168, 0, Math.PI * 2); g.fill();
    const k = 340 / (MW * CELL);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const c = grid[y][x];
      if (c === 1 || c === 2) { g.fillStyle = c === 1 ? 'rgba(200,200,200,0.5)' : 'rgba(160,140,90,0.5)'; g.fillRect(x * CELL * k, y * CELL * k, CELL * k + 0.5, CELL * k + 0.5); }
      else if (c === 9 || c === 10) { g.fillStyle = 'rgba(140,110,70,0.6)'; g.fillRect(x * CELL * k, y * CELL * k, CELL * k + 0.5, CELL * k + 0.5); }
      else if (c === 11) { g.fillStyle = 'rgba(255,181,46,0.75)'; g.fillRect(x * CELL * k, y * CELL * k, CELL * k + 0.5, CELL * k + 0.5); } // 3.24.2: вышки на радаре
    }
    // сайты
    for (const [S, col] of [[SITE_A, '#e8c34a'], [SITE_B, '#5aa2e8']]) {
      g.strokeStyle = col; g.lineWidth = 2;
      g.strokeRect(S.x1 * CELL * k, S.y1 * CELL * k, (S.x2 - S.x1 + 1) * CELL * k, (S.y2 - S.y1 + 1) * CELL * k);
      g.fillStyle = col; g.font = 'bold 20px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(S === SITE_A ? 'A' : 'B', (S.x1 + S.x2 + 1) / 2 * CELL * k, (S.y1 + S.y2 + 1) / 2 * CELL * k);
    }
  }
  function drawRadar() {
    if (!ui.radar || !radarBase || state.phase === 'lobby') return;
    const g = ui.radar.getContext('2d');
    g.clearRect(0, 0, 340, 340);
    g.drawImage(radarBase, 0, 0);
    const k = 340 / (MW * CELL);
    const now = performance.now();
    // teammates — зелёные точки
    for (const [nick, r] of remotes) {
      if (!r.alive || r.team !== me.team) continue;
      g.fillStyle = '#4dff4d';
      g.beginPath(); g.arc(r.x * k, r.z * k, 6, 0, Math.PI * 2); g.fill();
    }
    // враги, стрелявшие <2.5с — красные
    for (const [nick, t] of enemyBlips) {
      if (now - t > 2500) { enemyBlips.delete(nick); continue; }
      const r = remotes.get(nick);
      if (!r || !r.alive) continue;
      g.fillStyle = '#ff4040';
      g.beginPath(); g.arc(r.x * k, r.z * k, 6, 0, Math.PI * 2); g.fill();
    }
    // бомба
    if (bombPlanted) {
      g.fillStyle = '#ff9500';
      g.beginPath(); g.arc(bombPlanted.pos[0] * k, bombPlanted.pos[2] * k, 7, 0, Math.PI * 2); g.fill();
    }
    // себя — стрелка по yaw
    g.save();
    g.translate(P.x * k, P.z * k);
    g.rotate(-P.yaw + Math.PI);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -10); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.restore();
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!renderer3 || !worldReady || state.phase === 'lobby' || ui.lobby.style.display === 'block') return;
    try {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    // таймеры клиента
    bloom = Math.max(0, bloom - dt * 3);
    // 3.24.0: флешка — 3 секунды полный белый экран, потом гаснет
    if (performance.now() < flashUntil) flashAlpha = Math.max(flashAlpha, 1);
    else flashAlpha = Math.max(0, flashAlpha - dt * 1.2);
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
      r.group.rotation.y = r.yaw; r.group.scale.y = r.crouched ? .72 : 1;
      setRemoteGun(r);
      if (r.muzzleFx) r.muzzleFx.visible = r.alive && (performance.now() - r.muzzle) < 55; // 3.22.0: вспышка на дуле
      if (r.alive) {
        r.group.rotation.z = 0;
        r.group.visible = true;
        if (r.moving) r.walkPhase += dt * 9;
        const sw = r.moving ? Math.sin(r.walkPhase) * 0.65 : 0;
        r.legL.rotation.x = sw;              // ноги ходят вразножку
        r.legR.rotation.x = -sw;
        r.armL.rotation.x = -sw * 0.6;
        r.armR.rotation.x = -1.15 - Math.max(0,1-(performance.now()-r.muzzle)/160)*.15;
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
    stepSmokes();
    updateAction(dt);
    updateViewmodel(dt, t);
    // мигание и писк бомбы (3.24.0: писк ускоряется к концу, громкость по дистанции)
    if (bombMesh && bombLight && bombPlanted) {
      const left = bombPlanted.explodesAt - (Date.now() + clockOffset);
      bombLight.visible = Math.floor(performance.now() / (left < 10000 ? 180 : 600)) % 2 === 0;
      if (bombBeam) bombBeam.material.opacity = 0.32 + 0.18 * Math.sin(performance.now() / 220);
      const distB = Math.hypot(P.x - bombPlanted.pos[0], P.z - bombPlanted.pos[2]);
      const vol = Math.max(0.02, Math.min(1, 1 - distB / 35));
      const nowMs = performance.now();
      const interval = left < 3000 ? 280 : left < 8000 ? 600 : 1000;
      if (nowMs - lastBeep > interval && left > 0) { lastBeep = nowMs; sfxBeep(vol); }
    }
    // 3.24.0: свои шаги — по таймеру от скорости; 3.24.1: Shift — тихая ходьба (без звука и без отправки шагов)
    if (me.alive && state.phase !== 'freeze' && P.onGround && (keys.w || keys.a || keys.s || keys.d)) {
      if (!keys.shift) {
        stepAcc += dt;
        if (stepAcc > (P.crouched ? 0.62 : 0.42)) { stepAcc = 0; const sf = cellAt(P.x, P.z); sfxStep(sf >= 4 && sf <= 8 ? 'tun' : 'sand'); sock && sock.emit('cs16_step', { pos: [P.x, P.y, P.z], surf: (sf >= 4 && sf <= 8) ? 'tun' : 'sand' }); }
      } else stepAcc = 0.2; // при отпускании Shift звук сразу, без задержки
    }
    drawRadar();
    // 3.24.3: числа урона — взлетают и гаснут
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      const dn = dmgNums[i], age = (performance.now() - dn.born) / 1000;
      if (age > 1.0) { scene.remove(dn.sp); if (dn.sp.material.map) dn.sp.material.map.dispose(); dn.sp.material.dispose(); dmgNums.splice(i, 1); continue; }
      dn.sp.position.y += dt * 1.4;
      dn.sp.material.opacity = age < 0.35 ? 1 : Math.max(0, 1 - (age - 0.35) / 0.65);
    }
    // трассеры
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr=tracers[i],now=performance.now();
      if (now > tr.die) { disposeShot(tr.line); tracers.splice(i, 1);continue; }
      const front=Math.min(tr.len,(now-tr.born)*1.2),tail=Math.max(0,front-3.6);
      tr.core.scale.y=Math.max(.01,front-tail);
      tr.core.position.copy(tr.o).addScaledVector(tr.d,(front+tail)/2);
      tr.head.position.copy(tr.o).addScaledVector(tr.d,front);
      tr.core.material.opacity=tr.head.material.opacity=Math.min(.8,Math.max(0,(tr.die-now)/25));
    }
    // 3.22.0: вспышки выстрелов гаснут + солнце с тенями следует за камерой
    for (let i = shotFlashes.length - 1; i >= 0; i--) {
      const sf=shotFlashes[i],age=(performance.now()-sf.born)/65;
      if (age>=1) { disposeShot(sf.sp); shotFlashes.splice(i, 1);continue; }
      sf.sp.material.opacity=(1-age)*.9;
      sf.sp.scale.setScalar(sf.size*(1+age*.7));
    }
    if (shotLight) shotLight.intensity = Math.max(0, shotLight.intensity - dt * 34);
    // 3.24.0: спектр — после смерти камера следует за живым teammates
    if (!me.alive) {
      const mates = [];
      for (const [nick, r] of remotes) if (r.alive && r.team === me.team) mates.push(nick);
      if (mates.length) {
        if (!specTarget || !mates.includes(specTarget)) specTarget = mates[0];
        const r = remotes.get(specTarget);
        if (r) {
          camera.position.set(r.x, r.y + 1.55, r.z);
          camera.rotation.order = 'YXZ';
          camera.rotation.y = r.yaw; camera.rotation.x = r.pitch * 0.6;
          camera.fov += (75 - camera.fov) * Math.min(1, dt * 10);
          camera.updateProjectionMatrix();
          updateHud();
          worldGraphics.update(camera, t);
          renderer3.render(scene, camera);
          return; // пропускаем собственную камеру
        }
      } else specTarget = null;
    } else specTarget = null;
    // камера
    camera.position.set(P.x, P.y + eyeH(), P.z);
    // Explosion feedback moves the viewmodel, not the crosshair's ray origin.
    camera.rotation.order = 'YXZ';
    camera.rotation.y = P.yaw;
    camera.rotation.x = P.pitch;
    camera.fov += ((scoped ? (current==='awp'?16:current==='scout'?22:40) : 75) - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
    updateHud();
    // отправка позиции 15 раз/сек
    posAcc += dt;
    if (posAcc > 1 / 15 && sock && sock.connected && me.alive) {
      posAcc = 0;
      const moving = keys.w || keys.a || keys.s || keys.d;
      sock.emit('cs16_pos', { pos: [+P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2)], yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), weapon: current, move: !!moving, crouched:!!P.crouched, skin: mySkin });
    }
    worldGraphics.update(camera, t);
    renderer3.render(scene, camera);
    } catch (err) {
      // 3.24.2: ошибка кадра не должна ронять рендер-процесс — логируем и идём дальше
      window.__cs16Err = (window.__cs16Err || 0) + 1;
      if (window.__cs16Err < 5) console.error('cs16 loop error:', err);
    }
  }

  // ---------- ВХОД ВО ВКЛАДКУ ----------
  window.__cs16Open = function (nick) {
    myNick = nick;
    if (!inited) {
      inited = true;
      buildUI();
      initScene();
      bindInput();
      loadSkins();
      requestAnimationFrame(loop);
    }
    doJoin();
  };
})();
