// Support2 — мини-МОБА в стиле Доты (3 линии, крипы, вышки, трон, магазин, курьер, боты)
// Этап 1: офлайн-матч с ботами 5v5 (архитектура готова под сетевой режим)
(function () {
  'use strict';
  if (window.__s2loaded) return;
  window.__s2loaded = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const d2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const lerp = (a, b, t) => a + (b - a) * t;
  let UID = 1;

  // ---------- ЗВУК (WebAudio-синтез) ----------
  let AC = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function sfx(freq, dur, gain, type) {
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.value = gain || 0.08; g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  const sfxCast = () => sfx(520, 0.18, 0.07, 'triangle');
  const sfxHit = () => sfx(160, 0.07, 0.05, 'square');
  const sfxKill = () => { sfx(300, 0.12, 0.08); setTimeout(() => sfx(450, 0.15, 0.08), 90); };
  const sfxGold = () => sfx(880, 0.09, 0.05, 'sine');
  const sfxTower = () => sfx(90, 0.5, 0.15, 'sawtooth');
  const sfxWin = () => [392, 494, 587, 784].forEach((f, i) => setTimeout(() => sfx(f, 0.35, 0.1, 'triangle'), i * 160));
  const sfxLose = () => [330, 262, 196].forEach((f, i) => setTimeout(() => sfx(f, 0.4, 0.1, 'sawtooth'), i * 200));

  // ---------- ПРЕДМЕТЫ (магазин у фонтана, доставка курьером) ----------
  // mods: статы · slowOnHit/slowDur — замедление с атак · armorRed/armorRedDur — срез брони с атак
  // active: активное действие (блинк) — клик по слоту в инвентаре или клавиша B
  const ITEMS = [
    { id: 'boots',  name: 'Сапоги ветра',       cost: 500,  desc: '+45 к скорости передвижения',            mods: { ms: 45 } },
    { id: 'blade',  name: 'Клинок ярости',      cost: 1400, desc: '+32 к урону',                            mods: { dmg: 32 } },
    { id: 'bow',    name: 'Ветвистый лук',      cost: 900,  desc: '+25 к скорости атаки',                   mods: { aspd: 25 } },
    { id: 'dagger', name: 'Быстрый клинок',     cost: 1000, desc: '+15 к урону, +10 к скорости атаки',      mods: { dmg: 15, aspd: 10 } },
    { id: 'armor',  name: 'Доспех Стража',      cost: 1200, desc: '+10 к броне',                            mods: { armor: 10 } },
    { id: 'ring',   name: 'Кольцо маны',        cost: 700,  desc: '+250 маны, +3 восстановления маны',      mods: { mana: 250, mpregen: 3 } },
    { id: 'mantle', name: 'Мантия Архимага',    cost: 1300, desc: '+30 к урону способностей',               mods: { spower: 30 } },
    { id: 'fang',   name: 'Кровавый кристалл',  cost: 1600, desc: '+18% вампиризма',                        mods: { lifesteal: 0.18 } },
    { id: 'shield', name: 'Щит Бессмертного',   cost: 1500, desc: 'Блокирует 25 урона от каждой атаки',     mods: { block: 25 } },
    { id: 'heart',  name: 'Сердце титана',      cost: 2500, desc: '+450 к здоровью, +4 регенерации',        mods: { hp: 450, hpregen: 4 } },
    { id: 'blink',  name: 'Блинк Даггер',       cost: 2150, desc: 'Актив (B): мгновенный телепорт к курсору (до 15 м). КД 14 сек', mods: {}, active: { type: 'blink', range: 15, cd: 14 } },
    { id: 'frost',  name: 'Морозный клинок',    cost: 1900, desc: '+20 к урону, атаки замедляют врага на 25% на 1.5 сек', mods: { dmg: 20, slowOnHit: 0.25, slowDur: 1.5 } },
    { id: 'crusher',name: 'Молот крушителя',    cost: 2100, desc: '+28 к урону, атаки СНИЖАЮТ БРОНЮ врага на 7 на 4 сек', mods: { dmg: 28, armorRed: 7, armorRedDur: 4 } },
    { id: 'hyper',  name: 'Гиперстоун',         cost: 2000, desc: '+55 к скорости атаки',                   mods: { aspd: 55 } },
    { id: 'plate',  name: 'Латный доспех',      cost: 1400, desc: '+12 к броне',                            mods: { armor: 12 } },
  ];
  const itemById = id => ITEMS.find(i => i.id === id);

  // ---------- ГЕРОИ ----------
  // Типы прицеливания: 'unit' (во врага), 'point' (в точку), 'self'
  const HEROES = [
    {
      id: 'varg', name: 'Варг Разрядник', role: 'Маг молнии', color: 0x9fd8ff, cloth: 0x274b8f,
      hp: 520, mana: 340, dmg: 50, aspd: 0, atkRange: 15, atkCd: 1.7, ms: 9.8,
      combo: 'W замедлил → Q по цепочке → R добил',
      abilities: [
        { key: 'Q', name: 'Цепная молния', mana: 60, cd: 7,  type: 'unit', range: 26, desc: 'Урон цели, перескакивает на 2 врагов рядом', exec(h, t, s) { chain(h, t, 2, s.dmg); } },
        { key: 'W', name: 'Грозовое поле', mana: 70, cd: 12, type: 'point', range: 24, desc: 'Зона: урон каждые 0.5 сек и замедление 40%', exec(h, t, s) { zone(h, t.x, t.z, 7, 4, { dps: s.dmg / 4, slow: 0.4, color: 0x6fc4ff }); } },
        { key: 'E', name: 'Статический заряд', mana: 0, cd: 0, type: 'passive', desc: 'Каждая 3-я атака бьёт молнией на 60 урона', },
        { key: 'R', name: 'Грозовой разряд', mana: 120, cd: 45, type: 'point', range: 28, ult: true, desc: 'Мощный удар по области + стан 1.5 сек', exec(h, t, s) { aoe(h, t.x, t.z, 7, s.dmg, { stun: 1.5, color: 0xaee4ff }); } },
      ],
      scale: dmg => ({ q: [90, 150, 210, 270], w: [160, 240, 320, 400], r: [340, 480, 620] }),
    },
    {
      id: 'mord', name: 'Морд Тюремщик', role: 'Танк', color: 0xffb066, cloth: 0x6b3a1f,
      hp: 780, mana: 260, dmg: 56, aspd: 0, atkRange: 4, atkCd: 1.6, ms: 9.2,
      combo: 'Q притянул → W оглушил → E вернул урон',
      abilities: [
        { key: 'Q', name: 'Цепь-крюк', mana: 50, cd: 10, type: 'unit', range: 24, desc: 'Притягивает врага к себе', exec(h, t) { pull(h, t); } },
        { key: 'W', name: 'Дубина судьи', mana: 55, cd: 9, type: 'unit', range: 5, desc: 'Удар с оглушением на 1.2 сек', exec(h, t, s) { aoe(h, t.x, t.z, 4, s.dmg, { stun: 1.2, color: 0xffcf8a }); } },
        { key: 'E', name: 'Шипы', mana: 0, cd: 0, type: 'passive', desc: 'Возвращает 15% полученного урона' },
        { key: 'R', name: 'Не сломать', mana: 100, cd: 50, type: 'self', ult: true, desc: 'Неуязвимость 5 секунд', exec(h) { buff(h, { invuln: 1, dur: 5, color: 0xffd9a0 }); } },
      ],
      scale: () => ({ q: [0, 0, 0, 0], w: [110, 170, 230, 290], r: [0, 0, 0] }),
    },
    {
      id: 'silva', name: 'Сильва Лучница', role: 'Кэрри', color: 0xa8e6a1, cloth: 0x2e6b34,
      hp: 540, mana: 280, dmg: 54, aspd: 10, atkRange: 22, atkCd: 1.5, ms: 10.2,
      combo: 'W ускорилась → Q залп → R снайп с дистанции',
      abilities: [
        { key: 'Q', name: 'Залп стрел', mana: 45, cd: 8, type: 'point', range: 26, desc: 'Веер стрел: урон всем на линии', exec(h, t, s) { lineShot(h, t, 6, s.dmg, 0xcfffb0); } },
        { key: 'W', name: 'Порыв ветра', mana: 40, cd: 11, type: 'self', desc: '+45% скорости на 4 сек', exec(h) { buff(h, { msPct: 0.45, dur: 4, color: 0xd8ffd0 }); } },
        { key: 'E', name: 'Смертельный выстрел', mana: 0, cd: 0, type: 'passive', desc: '20% шанс крита ×2 урона' },
        { key: 'R', name: 'Снайперский выстрел', mana: 110, cd: 40, type: 'unit', range: 999, ult: true, desc: 'Выстрел по ЛЮБОМУ врагу на карте', exec(h, t, s) { snipe(h, t, s.dmg); } },
      ],
      scale: () => ({ q: [120, 190, 260, 330], w: [0, 0, 0, 0], r: [380, 540, 700] }),
    },
    {
      id: 'ksul', name: 'Ксул Некромант', role: 'Существа', color: 0xb9a0e6, cloth: 0x3d2a63,
      hp: 560, mana: 340, dmg: 48, aspd: 0, atkRange: 15, atkCd: 1.7, ms: 9.4,
      combo: 'W скелет из трупа → Q волна → R жатва = хил',
      abilities: [
        { key: 'Q', name: 'Волна смерти', mana: 60, cd: 9, type: 'point', range: 24, desc: 'Волна урона по площади', exec(h, t, s) { aoe(h, t.x, t.z, 6.5, s.dmg, { color: 0x9a7fd4 }); } },
        { key: 'W', name: 'Поднять скелета', mana: 65, cd: 14, type: 'point', range: 20, desc: 'Призыв скелета-воина из ближайшего трупа', exec(h, t) { raiseSkeleton(h, t); } },
        { key: 'E', name: 'Пожиратель', mana: 0, cd: 0, type: 'passive', desc: 'Восстанавливает 40 хп за каждое убийство' },
        { key: 'R', name: 'Жатва душ', mana: 120, cd: 45, type: 'point', range: 26, ult: true, desc: 'AoE урон, себе лечение 50% нанесённого', exec(h, t, s) { const dealt = aoe(h, t.x, t.z, 8, s.dmg, { color: 0xc9b3ff }); heal(h, h, dealt * 0.5); } },
      ],
      scale: () => ({ q: [110, 170, 230, 290], w: [0, 0, 0, 0], r: [300, 430, 560] }),
    },
    {
      id: 'jin', name: 'Джин Монах', role: 'Саппорт', color: 0xffe9a0, cloth: 0x8f7a2a,
      hp: 600, mana: 360, dmg: 46, aspd: 0, atkRange: 14, atkCd: 1.6, ms: 9.8,
      combo: 'W стан → Q хил союзника → R воскрешение',
      abilities: [
        { key: 'Q', name: 'Исцеление', mana: 55, cd: 8, type: 'unit', range: 22, desc: 'Лечит союзника (или себя)', exec(h, t, s) { heal(h, t, s.dmg); } },
        { key: 'W', name: 'Световая кара', mana: 60, cd: 10, type: 'point', range: 22, desc: 'Стан 1.4 сек в зоне', exec(h, t) { aoe(h, t.x, t.z, 5, 60, { stun: 1.4, color: 0xfff2b8 }); } },
        { key: 'E', name: 'Аура жизни', mana: 0, cd: 0, type: 'passive', desc: 'Союзники рядом восстанавливают 2 хп/сек' },
        { key: 'R', name: 'Воскрешение', mana: 140, cd: 60, type: 'unit', range: 14, ult: true, desc: 'Возвращает павшего союзника на месте смерти', exec(h, t) { revive(h, t); } },
      ],
      scale: () => ({ q: [140, 220, 300, 380], w: [60, 60, 60, 60], r: [0, 0, 0] }),
    },
    {
      id: 'kris', name: 'Крис Разбойник', role: 'Ассасин', color: 0xe6a0b5, cloth: 0x632a3d,
      hp: 560, mana: 300, dmg: 58, aspd: 15, atkRange: 4, atkCd: 1.4, ms: 10.6,
      combo: 'W невидимость → удар в спину (E ×1.5) → R казнь',
      abilities: [
        { key: 'Q', name: 'Бросок кинжалов', mana: 45, cd: 7, type: 'point', range: 18, desc: 'Конус кинжалов по врагам', exec(h, t, s) { coneShot(h, t, 5, s.dmg, 0xffc2d4); } },
        { key: 'W', name: 'Тень', mana: 50, cd: 14, type: 'self', desc: 'Невидимость 4 секунды', exec(h) { buff(h, { stealth: 1, dur: 4, color: 0xd4a0bb }); } },
        { key: 'E', name: 'В спину', mana: 0, cd: 0, type: 'passive', desc: 'Урон со спины ×1.5' },
        { key: 'R', name: 'Казнь', mana: 100, cd: 35, type: 'unit', range: 8, ult: true, desc: 'Добивание: если у врага <25% хп — мгновенный убий', exec(h, t) { execute(h, t); } },
      ],
      scale: () => ({ q: [130, 200, 270, 340], w: [0, 0, 0, 0], r: [0, 0, 0] }),
    },
    {
      id: 'freya', name: 'Фрея Ледяная', role: 'Контроль', color: 0xa0d4ff, cloth: 0x2a4d6b,
      hp: 540, mana: 360, dmg: 48, aspd: 0, atkRange: 16, atkCd: 1.6, ms: 9.6,
      combo: 'Q замедлила → W стена отрезала → R метель',
      abilities: [
        { key: 'Q', name: 'Ледяной осколок', mana: 50, cd: 7, type: 'unit', range: 24, desc: 'Урон + замедление 50% на 2 сек', exec(h, t, s) { proj(h, t, { speed: 34, dmg: s.dmg, slow: 0.5, color: 0xbfe4ff }); } },
        { key: 'W', name: 'Стена льда', mana: 70, cd: 13, type: 'point', range: 20, desc: 'Стена блокирует путь на 4 секунды', exec(h, t) { iceWall(h, t); } },
        { key: 'E', name: 'Ледяное прикосновение', mana: 0, cd: 0, type: 'passive', desc: 'Атаки замедляют врага на 20% на 1 сек' },
        { key: 'R', name: 'Метель', mana: 130, cd: 50, type: 'point', range: 26, ult: true, desc: 'Большая зона: урон + стан 2 сек', exec(h, t, s) { aoe(h, t.x, t.z, 9, s.dmg, { stun: 2, color: 0xe0f2ff }); } },
      ],
      scale: () => ({ q: [100, 160, 220, 280], w: [0, 0, 0, 0], r: [320, 460, 600] }),
    },
    {
      id: 'torg', name: 'Торг Огр', role: 'Бruiser', color: 0xd4c28f, cloth: 0x4d6b2a,
      hp: 820, mana: 240, dmg: 60, aspd: 0, atkRange: 4, atkCd: 1.5, ms: 9.4,
      combo: 'Q прыжок в толпу → W разбросал → R ярость',
      abilities: [
        { key: 'Q', name: 'Прыжок', mana: 55, cd: 10, type: 'point', range: 18, desc: 'Прыжок в точку: урон + стан 1 сек', exec(h, t, s) { leap(h, t, s.dmg); } },
        { key: 'W', name: 'Отброс', mana: 50, cd: 9, type: 'unit', range: 5, desc: 'Сильный удар, отбрасывает врага', exec(h, t, s) { knockback(h, t, s.dmg); } },
        { key: 'E', name: 'Живучий', mana: 0, cd: 0, type: 'passive', desc: 'Каждые 10% потерянного хп дают +2 брони' },
        { key: 'R', name: 'Ярость огра', mana: 100, cd: 45, type: 'self', ult: true, desc: '+60% скорости атаки и +40 урона на 6 сек', exec(h) { buff(h, { aspdPct: 0.6, dmgFlat: 40, dur: 6, color: 0xffe08a }); } },
      ],
      scale: () => ({ q: [120, 190, 260, 330], w: [110, 170, 230, 290], r: [0, 0, 0] }),
    },
    {
      id: 'zik', name: 'Зик Часовщик', role: 'Хроно', color: 0xc9b388, cloth: 0x63512a,
      hp: 580, mana: 340, dmg: 50, aspd: 0, atkRange: 15, atkCd: 1.6, ms: 9.8,
      combo: 'Q замедлил врагов → W ускорился → R откат назад',
      abilities: [
        { key: 'Q', name: 'Ловушка времени', mana: 60, cd: 11, type: 'point', range: 22, desc: 'Зона: враги замедлены на 60% 3 сек', exec(h, t) { zone(h, t.x, t.z, 6, 3, { slow: 0.6, dps: 0, color: 0xd4c08a }); } },
        { key: 'W', name: 'Ускорение', mana: 45, cd: 10, type: 'self', desc: '+50% скорости на 3 секунды', exec(h) { buff(h, { msPct: 0.5, dur: 3, color: 0xffe9b8 }); } },
        { key: 'E', name: 'Предвидение', mana: 0, cd: 0, type: 'passive', desc: 'Каждые 6 сек уклоняется от одной атаки' },
        { key: 'R', name: 'Откат', mana: 110, cd: 40, type: 'self', ult: true, desc: 'Возвращает здоровье и позицию 4 секунды назад', exec(h) { backtrack(h); } },
      ],
      scale: () => ({ q: [0, 0, 0, 0], w: [0, 0, 0, 0], r: [0, 0, 0] }),
    },
    {
      id: 'gnil', name: 'Гнил Падальщик', role: 'Яд', color: 0xa8cc66, cloth: 0x3d4d1f,
      hp: 760, mana: 280, dmg: 54, aspd: 0, atkRange: 5, atkCd: 1.6, ms: 9.0,
      combo: 'Q яд → W облако промахов → R взрыв в толпе',
      abilities: [
        { key: 'Q', name: 'Плевок ядом', mana: 45, cd: 8, type: 'unit', range: 18, desc: 'Урон + яд (30/сек, 4 сек)', exec(h, t, s) { proj(h, t, { speed: 28, dmg: s.dmg, dot: { dps: 30, dur: 4 }, color: 0xb8e066 }); } },
        { key: 'W', name: 'Вонючее облако', mana: 60, cd: 13, type: 'point', range: 18, desc: 'Враги в зоне промахиваются 40% атак', exec(h, t) { zone(h, t.x, t.z, 6, 4, { blind: 0.4, dps: 0, color: 0x9cbb55 }); } },
        { key: 'E', name: 'Разложение', mana: 0, cd: 0, type: 'passive', desc: '+3 хп/сек регенерации' },
        { key: 'R', name: 'Взрыв гнили', mana: 110, cd: 45, type: 'self', ult: true, desc: 'AoE вокруг себя: большой урон + яд', exec(h, s2, s) { aoe(h, h.x, h.z, 8, s.dmg, { dot: { dps: 40, dur: 3 }, color: 0xc9e67a }); } },
      ],
      scale: () => ({ q: [90, 140, 190, 240], w: [0, 0, 0, 0], r: [340, 480, 620] }),
    },
    {
      id: 'astra', name: 'Астра Странница', role: 'Бёрст-маг', color: 0xffc2e6, cloth: 0x6b2a4d,
      hp: 540, mana: 380, dmg: 52, aspd: 0, atkRange: 16, atkCd: 1.7, ms: 9.6,
      combo: 'W блинк → Q звезда → R метеорит',
      abilities: [
        { key: 'Q', name: 'Звёздный снаряд', mana: 50, cd: 6, type: 'unit', range: 26, desc: 'Быстрый снаряд с уроном', exec(h, t, s) { proj(h, t, { speed: 44, dmg: s.dmg, color: 0xffc2e6 }); } },
        { key: 'W', name: 'Звёздный шаг', mana: 55, cd: 12, type: 'point', range: 20, desc: 'Мгновенный телепорт в точку', exec(h, t) { blinkFx(h, t.x, t.z); h.x = t.x; h.z = t.z; syncMesh(h); } },
        { key: 'E', name: 'Космический поток', mana: 0, cd: 0, type: 'passive', desc: '+4 маны за каждое применение способности' },
        { key: 'R', name: 'Метеорит', mana: 130, cd: 50, type: 'point', range: 30, ult: true, desc: 'Метеорит падает через 1.5 сек: огромный урон', exec(h, t, s) { meteor(h, t, s.dmg); } },
      ],
      scale: () => ({ q: [120, 190, 260, 330], w: [0, 0, 0, 0], r: [400, 560, 720] }),
    },
    {
      id: 'undina', name: 'Ундина Морская', role: 'Маг воды', color: 0x8fd4e6, cloth: 0x1f4d5c,
      hp: 580, mana: 350, dmg: 50, aspd: 0, atkRange: 15, atkCd: 1.6, ms: 9.6,
      combo: 'W щит на себя → Q волна по линии → R Кракен',
      abilities: [
        { key: 'Q', name: 'Волна', mana: 55, cd: 8, type: 'point', range: 24, desc: 'Волна: урон всем на линии', exec(h, t, s) { lineShot(h, t, 6.5, s.dmg, 0x9fe0f2); } },
        { key: 'W', name: 'Водяной щит', mana: 60, cd: 12, type: 'unit', range: 20, desc: 'Щит поглощает 200 урона союзнику', exec(h, t, s) { shield(h, t, s.dmg); } },
        { key: 'E', name: 'Дитя реки', mana: 0, cd: 0, type: 'passive', desc: 'В реке движение на 30% быстрее' },
        { key: 'R', name: 'Призыв Кракена', mana: 130, cd: 55, type: 'point', range: 20, ult: true, desc: 'Кракен-спутник дерётся за тебя 20 сек', exec(h, t) { summonKraken(h, t); } },
      ],
      scale: () => ({ q: [110, 180, 250, 320], w: [200, 300, 400, 500], r: [0, 0, 0] }),
    },
  ];
  const heroById = id => HEROES.find(h => h.id === id);

  // ---------- 3D-МОДЕЛИ ИЗ ИНТЕРНЕТА (открытые лицензии: Mixamo, CC0) ----------
  const S2_SERVER = 'https://support-hub-server-v3.onrender.com';
  const S2_HERO_MODEL = {
    varg:   { model: 'xbot',    scale: 1.0 },   // маг молнии — робот-зачарованный
    mord:   { model: 'soldier', scale: 1.2 },   // тюремщик — бронированный солдат
    silva:  { model: 'soldier', scale: 0.95 },  // лучница
    ksul:   { model: 'robot',   scale: 0.95 },  // некромант — голем
    jin:    { model: 'soldier', scale: 1.02 },  // монах
    kris:   { model: 'xbot',    scale: 0.9 },   // разбойник
    freya:  { model: 'xbot',    scale: 1.0 },   // ледяная
    torg:   { model: 'robot',   scale: 1.6 },   // огр — большой голем
    zik:    { model: 'robot',   scale: 1.0 },   // часовщик — механический голем
    gnil:   { model: 'robot',   scale: 1.12 },  // падальщик — гнилой голем
    astra:  { model: 'xbot',    scale: 1.0 },   // странница
    undina: { model: 'soldier', scale: 1.0 },   // морская
  };
  const S2_MODELS = {
    soldier: { url: 'models/s2/soldier.glb', height: 2.1, anims: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
    xbot:    { url: 'models/s2/xbot.glb',    height: 2.3, anims: { idle: 'idle', walk: 'walk', run: 'run' } },
    robot:   { url: 'models/s2/robot.glb',   height: 2.1, anims: { idle: 'Idle', walk: 'Walking', run: 'Running', attack: 'Punch', death: 'Death' } },
    fox:     { url: 'models/s2/fox.glb',     height: 1.5, anims: { idle: 'Survey', walk: 'Walk', run: 'Run' } },
    parrot:  { url: 'models/s2/parrot.glb',  height: 0.8, anims: { idle: 'parrot_A_', walk: 'parrot_A_', run: 'parrot_A_' } },
  };
  const s2Models = {};   // id -> {scene, animations, norm, yOff}
  let s2ModelsReady = false;
  const s2ModelWaiters = [];
  function onS2ModelsReady(fn) { if (s2ModelsReady) fn(); else s2ModelWaiters.push(fn); }

  // реальный размер модели В ПОЗЕ (скелетные модели в bind-позе лежат/кривые —
  // меряем по вершинам после прокрутки idle-анимации)
  function posedBox(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    root.traverse(o => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (o.isSkinnedMesh && o.getVertexPosition && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        const pos = o.geometry.attributes.position;
        const step = Math.max(1, Math.floor((pos.count || 0) / 150));
        for (let i = 0; i < pos.count; i += step) {
          o.getVertexPosition(i, v);       // локальная позиция со скиннингом
          o.localToWorld(v);
          box.expandByPoint(v);
        }
      } else {
        box.expandByObject(o);
      }
    });
    return box;
  }

  function loadS2Models() {
    if (typeof THREE.GLTFLoader !== 'function') { s2ModelsReady = true; s2ModelWaiters.splice(0).forEach(f => f()); return; }
    const loader = new THREE.GLTFLoader();
    const ids = Object.keys(S2_MODELS);
    let left = ids.length;
    const done = () => { if (--left <= 0) { s2ModelsReady = true; makePortraits(); s2ModelWaiters.splice(0).forEach(f => f()); } };
    for (const id of ids) {
      loader.load(S2_MODELS[id].url, (g) => {
        try {
          g.scene.traverse(o => { if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; });
          // зонд: клон, idle-кадр, замер реальной высоты в позе
          const probe = THREE.SkeletonUtils.clone(g.scene);
          const pm = new THREE.AnimationMixer(probe);
          const clips = g.animations;
          const anims = S2_MODELS[id].anims || {};
          const idleClip = anims.idle && clips ? THREE.AnimationClip.findByName(clips, anims.idle) : null;
          if (idleClip) { const a = pm.clipAction(idleClip); a.play(); pm.update(0.05); }
          const bb = posedBox(probe);
          const h = Math.max(bb.max.y - bb.min.y, 0.01);
          const norm = (S2_MODELS[id].height || 2) / h;
          s2Models[id] = { scene: g.scene, animations: g.animations, norm, yOff: -bb.min.y * norm };
        } catch (e) { /* останется процедурная модель */ }
        done();
      }, undefined, done);
    }
  }

  // клон скелетной модели + анимации + перекраска
  function instantiateS2Model(id, tint, scale) {
    const rec = s2Models[id];
    if (!rec) return null;
    const model = THREE.SkeletonUtils.clone(rec.scene);
    const s = rec.norm * (scale || 1);
    model.scale.setScalar(s);
    model.position.y = rec.yOff;
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        if (o.material) {
          o.material = o.material.clone();
          if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
          if (tint) o.material.color = new THREE.Color(tint);
        }
      }
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const k in (S2_MODELS[id].anims || {})) {
      const clip = THREE.AnimationClip.findByName(rec.animations, S2_MODELS[id].anims[k]);
      if (clip) actions[k] = mixer.clipAction(clip);
    }
    return { model, mixer, actions, current: null, modelId: id };
  }
  function playAnim(u, name, fade) {
    const rig = u.rig;
    if (!rig || !rig.actions[name] || rig.current === name) return;
    const next = rig.actions[name];
    const prev = rig.current ? rig.actions[rig.current] : null;
    next.reset();
    if (name === 'death') { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
    if (prev && prev !== next) next.crossFadeFrom(prev, fade != null ? fade : 0.18, false);
    next.play();
    rig.current = name;
  }
  function tickRig(u, dt) {
    if (!u.rig) return;
    let st = 'idle';
    if (!u.alive) st = 'death';
    else if (u.atkAnimT > 0) st = 'attack';
    else if (u.moving) st = 'run';
    playAnim(u, st, 0.15);
    u.rig.mixer.update(dt);
  }

  // ---------- ПОРТРЕТЫ ГЕРОЕВ (рендер 3D-модели в картинку) ----------
  function makePortraits() {
    let r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return; }
    try {
      r.setSize(200, 230);
      const sc = new THREE.Scene();
      sc.background = new THREE.Color(0x18223a);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x3a4a66, 1.5));
      const dl = new THREE.DirectionalLight(0xfff2d8, 1.5);
      dl.position.set(2, 5, 3);
      sc.add(dl);
      const cam = new THREE.PerspectiveCamera(34, 200 / 230, 0.1, 60);
      for (const h of HEROES) {
        const hm = S2_HERO_MODEL[h.id] || { model: 'soldier', scale: 1 };
        const inst = instantiateS2Model(hm.model, h.color, (hm.scale || 1) * 1.05);
        if (!inst) continue;
        inst.model.rotation.y = 0.5;
        sc.add(inst.model);
        const bb = posedBox(inst.model);
        const hgt = Math.max(bb.max.y - bb.min.y, 0.5);
        const cy = (bb.max.y + bb.min.y) / 2;
        // 3.19.0: камера стояла в точке x=cy — модель была крошечной точкой на фоне
        cam.position.set(hgt * 0.62, cy + hgt * 0.22, hgt * 1.35);
        cam.lookAt(0, cy, 0);
        r.render(sc, cam);
        h.portrait = r.domElement.toDataURL('image/png');
        sc.remove(inst.model);
      }
    } catch (e) { /* портреты необязательны */ }
    try { r.dispose(); } catch (e) {}
  }

  // ---------- КАРТА ----------
  const MAP = 170;                 // размер карты (метры)
  const BASE_R = { x: -64, z: -64 };  // база Radiant (юго-запад)
  const BASE_D = { x: 64, z: 64 };    // база Dire (северо-восток)
  const LANES = {
    top: [[-60, -60], [-60, -52], [52, -52], [52, 52], [60, 60]],
    mid: [[-58, -58], [58, 58]],
    bot: [[-60, -60], [-52, -60], [-52, 52], [52, 60], [60, 60]],
  };
  const riverDist = (x, z) => Math.abs(x + z) / Math.SQRT2; // расстояние до реки (диагональ)
  const inRiver = (x, z) => riverDist(x, z) < 5;

  const obstacles = []; // {x, z, r} деревья/вышки для столкновений
  const trees = [];

  function lanePoint(lane, t) { // t: 0 (наша база) → 1 (вражеская база)
    const pts = lane === 'top' ? LANES.top : lane === 'mid' ? LANES.mid : LANES.bot;
    const lens = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = d2(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); lens.push(l); total += l; }
    let need = t * total;
    for (let i = 0; i < lens.length; i++) {
      if (need <= lens[i] || i === lens.length - 1) {
        const k = clamp(need / lens[i], 0, 1);
        return { x: lerp(pts[i][0], pts[i + 1][0], k), z: lerp(pts[i][1], pts[i + 1][1], k) };
      }
      need -= lens[i];
    }
  }
  function distToLane(lane, x, z) {
    const pts = lane === 'top' ? LANES.top : lane === 'mid' ? LANES.mid : LANES.bot;
    let m = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const k = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      m = Math.min(m, d2(x, z, ax + dx * k, az + dz * k));
    }
    return m;
  }

  // ---------- МИР / СЦЕНА ----------
  let scene = null, camera = null, renderer = null, sunLight = null;
  let waterMesh = null, waterGeo = null;
  const units = [], projectiles = [], zones = [], effects = [], corpses = [], couriers = [];
  let clockT = 0;

  function makeCanvas(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc7e8);
    scene.fog = new THREE.Fog(0x9fc7e8, 120, 260);
    camera = new THREE.PerspectiveCamera(46, 1.6, 0.5, 500);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rootWrap.insertBefore(renderer.domElement, rootWrap.firstChild);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';

    scene.add(new THREE.HemisphereLight(0xd8ecff, 0x5a7a4a, 0.85));
    sunLight = new THREE.DirectionalLight(0xfff2d8, 1.15);
    sunLight.position.set(60, 110, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc = sunLight.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.far = 320;
    scene.add(sunLight);

    // --- земля: рисуем траву, тропы по линиям, берега реки ---
    const groundTex = makeCanvas(1024, 1024, (g, w, h) => {
      const px = v => (v + MAP / 2) / MAP * w;
      g.fillStyle = '#5d8a45'; g.fillRect(0, 0, w, h);
      // пятна травы
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${110 + Math.random() * 40 | 0},${50 + Math.random() * 30 | 0},0.25)`;
        const r = 4 + Math.random() * 18;
        g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 7); g.fill();
      }
      // тропы по линиям
      g.strokeStyle = '#9a7f52'; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const key of ['top', 'mid', 'bot']) {
        const pts = LANES[key];
        g.lineWidth = 26; g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(px(pts[0][0]), px(pts[0][1]));
        for (let i = 1; i < pts.length; i++) g.lineTo(px(pts[i][0]), px(pts[i][1]));
        g.stroke();
      }
      g.globalAlpha = 1;
      // река: диагональная полоса
      g.save();
      g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
      const rw = 5 * Math.SQRT2 / MAP * w;
      const grad = g.createLinearGradient(0, -rw, 0, rw);
      grad.addColorStop(0, 'rgba(70,120,160,0)');
      grad.addColorStop(0.5, 'rgba(70,130,175,0.95)');
      grad.addColorStop(1, 'rgba(70,120,160,0)');
      g.fillStyle = grad;
      g.fillRect(-w, -rw, w * 2, rw * 2);
      g.restore();
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP + 60, MAP + 60),
      new THREE.MeshLambertMaterial({ map: groundTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- река: живой водный слой поверх нарисованной ---
    waterGeo = new THREE.PlaneGeometry(MAP * 1.6, 11, 60, 4);
    waterMesh = new THREE.Mesh(waterGeo, new THREE.MeshPhongMaterial({
      color: 0x4a90c8, transparent: true, opacity: 0.78, shininess: 120, specular: 0xbfe8ff,
    }));
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.rotation.z = Math.PI / 4;
    waterMesh.position.y = 0.12;
    scene.add(waterMesh);

    // --- деревья: инстансированные сосны в лесных массивах ---
    const treePos = [];
    let guard = 0;
    while (treePos.length < 260 && guard++ < 4000) {
      const x = rand(-MAP / 2 + 6, MAP / 2 - 6), z = rand(-MAP / 2 + 6, MAP / 2 - 6);
      if (distToLane('top', x, z) < 9 || distToLane('mid', x, z) < 8 || distToLane('bot', x, z) < 9) continue;
      if (riverDist(x, z) < 9) continue;
      if (d2(x, z, BASE_R.x, BASE_R.z) < 26 || d2(x, z, BASE_D.x, BASE_D.z) < 26) continue;
      if (treePos.some(p => d2(x, z, p[0], p[1]) < 3.4)) continue;
      treePos.push([x, z]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.4, 6);
    const crownGeo = new THREE.ConeGeometry(2.1, 5.4, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f7034 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePos.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treePos.length);
    trunks.castShadow = crowns.castShadow = true;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3();
    treePos.forEach((p, i) => {
      const s = rand(0.8, 1.35);
      Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
      S.set(s, s, s);
      M.compose(Pv.set(p[0], 1.2 * s, p[1]), Q, S); trunks.setMatrixAt(i, M);
      M.compose(Pv.set(p[0], (2.4 + 2.4) * s * 0.9, p[1]), Q, S); crowns.setMatrixAt(i, M);
      obstacles.push({ x: p[0], z: p[1], r: 0.9 * s });
      trees.push({ x: p[0], z: p[1], hp: 1 });
    });
    scene.add(trunks); scene.add(crowns);

    // --- декор: камни ---
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8a85 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 40);
    for (let i = 0; i < 40; i++) {
      const x = rand(-MAP / 2 + 4, MAP / 2 - 4), z = rand(-MAP / 2 + 4, MAP / 2 - 4);
      const s = rand(0.5, 1.6);
      Q.setFromAxisAngle(new THREE.Vector3(rand(0, 1), 1, rand(0, 1)).normalize(), rand(0, 6));
      M.compose(Pv.set(x, s * 0.4, z), Q, S.set(s, s * 0.7, s));
      rocks.setMatrixAt(i, M);
    }
    rocks.castShadow = true;
    scene.add(rocks);

    // --- базы: фонтан + трон ---
    buildBase('r', BASE_R.x, BASE_R.z, 0x3f9fe0);
    buildBase('d', BASE_D.x, BASE_D.z, 0xe04a3f);

    // --- вышки ---
    for (const side of ['r', 'd']) {
      const enemy = side === 'r' ? 'd' : 'r';
      for (const lane of ['top', 'mid', 'bot']) {
        makeTower(side, lanePoint(lane, side === 'r' ? 0.36 : 0.64), lane, 1);
        makeTower(side, lanePoint(lane, side === 'r' ? 0.18 : 0.82), lane, 2);
      }
    }
    resizeS2();
  }

  function buildBase(team, bx, bz, color) {
    // платформа
    const plat = new THREE.Mesh(
      new THREE.CylinderGeometry(17, 19, 1.6, 24),
      new THREE.MeshLambertMaterial({ color: 0x9a958a })
    );
    plat.position.set(bx, 0.8, bz);
    plat.receiveShadow = true;
    scene.add(plat);
    // трон (древний)
    const anc = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.4, 0),
      new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.25, shininess: 80 })
    );
    anc.position.set(bx, 5.2, bz);
    anc.castShadow = true;
    scene.add(anc);
    effects.push({ mesh: anc, ttl: Infinity, update(e, dt) { e.mesh.rotation.y += dt * 0.4; } });
    const aUnit = makeUnit({ team, x: bx, z: bz, name: team === 'r' ? 'Трон Radiant' : 'Трон Dire', isAncient: true });
    aUnit.mesh = new THREE.Group(); // хп-бар рисуем отдельно
    aUnit.ancMesh = anc;
    aUnit.maxHp = 3200; aUnit.hp = 3200; aUnit.radius = 4; aUnit.bounty = 0;
    obstacles.push({ x: bx, z: bz, r: 4 });
    // фонтан (лечилка + магазин) — за троном
    const fx = bx + (bx < 0 ? -8 : 8), fz = bz + (bz < 0 ? -8 : 8);
    const fount = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5, 1, 16),
      new THREE.MeshPhongMaterial({ color: 0xbfe8ff, emissive: 0x7fbfff, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 })
    );
    fount.position.set(fx, 0.5, fz);
    scene.add(fount);
    const base = team === 'r' ? BASE_R : BASE_D;
    base.fountain = { x: fx, z: fz };
    base.shopZone = { x: bx, z: bz, r: 20 };
  }

  function makeTower(team, pos, lane, tier) {
    const color = team === 'r' ? 0x3f9fe0 : 0xe04a3f;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 2.3, 8.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a8578 })
    );
    body.position.y = 4.25; body.castShadow = true;
    g.add(body);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 1.9, 1.4, 8),
      new THREE.MeshLambertMaterial({ color: 0x6b665c })
    );
    top.position.y = 9.2; g.add(top);
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.7 })
    );
    crystal.position.y = 10.8; g.add(crystal);
    g.position.set(pos.x, 0, pos.z);
    scene.add(g);
    const u = makeUnit({ team, x: pos.x, z: pos.z, name: `Вышка ${lane.toUpperCase()}-T${tier}`, isTower: true, tier, lane });
    u.mesh = g; u.maxHp = tier === 1 ? 900 : 1300; u.hp = u.maxHp;
    u.dmg = 115; u.atkRange = 24; u.atkCd = 1.1; u.radius = 2.4; u.bounty = tier === 1 ? 220 : 320;
    obstacles.push({ x: pos.x, z: pos.z, r: 2.4 });
    effects.push({ mesh: crystal, ttl: Infinity, update(e, dt) { e.mesh.rotation.y += dt * (u.alive ? 1.2 : 0); e.mesh.visible = u.alive; } });
    return u;
  }

  // ---------- ЮНИТЫ ----------
  function heroMesh(def, team) {
    const g = new THREE.Group();
    const cloth = new THREE.MeshLambertMaterial({ color: def.cloth });
    const skin = new THREE.MeshLambertMaterial({ color: def.color });
    const teamMat = new THREE.MeshLambertMaterial({ color: team === 'r' ? 0x3f9fe0 : 0xe04a3f });
    // тело
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.7, 8), cloth);
    body.position.y = 1.15; body.castShadow = true; g.add(body);
    // плащ (цвет команды)
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.6, 8, 1, true), teamMat);
    cape.position.y = 1.0; g.add(cape);
    // голова
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), skin);
    head.position.y = 2.35; head.castShadow = true; g.add(head);
    // наплечники
    for (const sx of [-0.62, 0.62]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), teamMat);
      pad.position.set(sx, 1.95, 0); g.add(pad);
    }
    // оружие по роли
    if (def.atkRange > 10) { // посох/лук
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
      staff.position.set(0.7, 1.6, 0); staff.rotation.z = 0.2; g.add(staff);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshPhongMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.6 }));
      orb.position.set(0.95, 2.9, 0); g.add(orb);
    } else { // клинок
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.3), new THREE.MeshPhongMaterial({ color: 0xc8ccd4, shininess: 90 }));
      blade.position.set(0.72, 1.5, 0.1); blade.rotation.z = -0.25; g.add(blade);
    }
    return g;
  }

  function creepMesh(team, ranged) {
    const g = new THREE.Group();
    const teamMat = new THREE.MeshLambertMaterial({ color: team === 'r' ? 0x3f9fe0 : 0xe04a3f });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, ranged ? 1.3 : 1.1, 6), teamMat);
    body.position.y = ranged ? 0.85 : 0.7; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd8c8a8 }));
    head.position.y = ranged ? 1.7 : 1.4; g.add(head);
    return g;
  }

  // обёртка: GLB-модель (или процедурная заглушка) + командный диск под ногами
  function attachModel(u, modelId, tint, scale, fallbackFn, barY) {
    const g = new THREE.Group();
    let inst = null;
    if (modelId) inst = instantiateS2Model(modelId, tint, scale);
    if (inst) {
      u.rig = inst;
      g.add(inst.model);
    } else {
      const fb = fallbackFn();
      if (fb) g.add(fb);
    }
    // командный диск
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 24),
      new THREE.MeshBasicMaterial({ color: u.team === 'r' ? 0x3f9fe0 : 0xe04a3f, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.06;
    g.add(disc);
    u.teamDisc = disc;
    u.mesh = g;
    addHpBar(u, barY);
    g.position.set(u.x, 0, u.z);
    scene.add(g);
  }

  // 3.19.1: оружие по типу героя — прикрепляем к кости руки скелетной модели
  const HERO_WEAPON = {
    varg: 'staff', mord: 'maul', silva: 'bow', ksul: 'staff', jin: 'staff', kris: 'dagger',
    freya: 'staff', torg: 'maul', zik: 'staff', gnil: 'cleaver', astra: 'staff', undina: 'trident',
  };
  function buildWeapon(type, color) {
    const g = new THREE.Group();
    const metal = new THREE.MeshPhongMaterial({ color: 0xd0d4dc, shininess: 110 });
    const glow = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.55 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    if (type === 'bow') {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 6, 14, Math.PI), wood);
      arc.rotation.z = Math.PI / 2; g.add(arc);
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.06, 0.02), glow); g.add(str);
    } else if (type === 'staff') {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.7, 6), wood));
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), glow); orb.position.y = 0.95; g.add(orb);
    } else if (type === 'maul') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 1.2, 6), wood); g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.26), metal); head.position.y = 0.62; g.add(head);
    } else if (type === 'dagger') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.16), metal); blade.position.y = 0.42; g.add(blade);
      const hilt = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), glow); g.add(hilt);
    } else if (type === 'cleaver') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.06), metal); blade.position.y = 0.5; g.add(blade);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), wood); g.add(handle);
    } else if (type === 'trident') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.8, 6), metal); g.add(pole);
      for (const dx of [-0.12, 0, 0.12]) {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 5), glow);
        prong.position.set(dx, 1.0, 0); g.add(prong);
      }
    } else { // sword
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.2), metal); blade.position.y = 0.62; g.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.1), glow); guard.position.y = 0.1; g.add(guard);
    }
    return g;
  }
  function attachWeapon(u) {
    if (!u.rig || !u.heroDef) return;
    const w = buildWeapon(HERO_WEAPON[u.heroDef.id] || 'sword', u.heroDef.color);
    let hand = null;
    u.rig.model.traverse(o => { if (!hand && o.isBone && /right.*hand/i.test(o.name)) hand = o; });
    if (hand) {
      try {
        u.rig.model.updateMatrixWorld(true);
        const ws = new THREE.Vector3();
        hand.getWorldScale(ws);
        w.scale.setScalar(1 / Math.max(Math.abs(ws.x) || 1, 1e-6)); // мировый размер оружия ~1 м
        w.rotation.set(Math.PI / 2, 0, 0);
        hand.add(w);
        return;
      } catch (e) { /* fallback ниже */ }
    }
    w.position.set(0.42, 1.15, 0.15);
    if (u.mesh) u.mesh.add(w);
  }
  // табличка с ником над героем (цвет команды)
  function addNameplate(u) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 56;
    const g = c.getContext('2d');
    g.font = 'bold 30px Arial'; g.textAlign = 'center';
    g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 6; g.strokeText(u.name, 128, 38);
    g.fillStyle = u.team === 'r' ? '#8fd4ff' : '#ff9a8a'; g.fillText(u.name, 128, 38);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(5.4, 1.18, 1); sp.position.y = 3.55; sp.renderOrder = 92;
    if (u.mesh) u.mesh.add(sp);
  }

  function makeUnit(opts) {
    const u = {
      id: UID++, team: opts.team, x: opts.x, z: opts.z, y: 0,
      name: opts.name || 'Юнит',
      isHero: !!opts.heroDef, heroDef: opts.heroDef || null,
      isCreep: !!opts.isCreep, isTower: !!opts.isTower, isAncient: !!opts.isAncient,
      isSummon: !!opts.isSummon, isCourier: !!opts.isCourier,
      alive: true, deadT: 0,
      hp: 100, maxHp: 100, mana: 0, maxMana: 0,
      dmg: 20, aspd: 0, armor: 0, atkRange: 4, atkCd: 1.5, atkT: 0,
      baseMs: 8, radius: opts.isHero ? 0.9 : 0.7,
      lvl: 1, xp: 0, gold: 0, lh: 0, kills: 0, deaths: 0, assists: 0,
      inventory: [], stash: [],
      abilities: [], buffs: [], shieldHp: 0,
      target: null, moveTarget: null, attackMove: false,
      waypointT: 0, lane: opts.lane || 'mid', respawnT: 0,
      lastAttacker: null, atkCount: 0, evadeT: 0, backtrack: null, aggroT: 0,
      bounty: opts.bounty != null ? opts.bounty : 40,
      xpBounty: opts.xpBounty != null ? opts.xpBounty : 40,
      brainT: 0, bot: !!opts.bot, ai: { state: 'push', retreatT: 0 },
      itemCd: {}, // 3.19.0: кулдауны активных предметов (блинк)
      mesh: null, hpBg: null, hpFg: null,
    };
    u.netId = u.id; // 3.19.0: сетевой идентификатор для снапшотов
    if (opts.heroDef) {
      u.maxHp = opts.heroDef.hp; u.hp = u.maxHp;
      u.maxMana = opts.heroDef.mana; u.mana = u.maxMana;
      u.dmg = opts.heroDef.dmg; u.aspd = opts.heroDef.aspd;
      u.atkRange = opts.heroDef.atkRange; u.atkCd = opts.heroDef.atkCd;
      u.baseMs = opts.heroDef.ms;
      u.abilities = opts.heroDef.abilities.map(a => ({ def: a, lvl: a.type === 'passive' ? 1 : 0, cdT: 0 }));
      u.skillPts = 1; // 3.19.1: первая очка прокачки — игрок решает сам
      const hm = S2_HERO_MODEL[opts.heroDef.id] || { model: 'soldier', scale: 1 };
      attachModel(u, hm.model, opts.heroDef.color, hm.scale, () => heroMesh(opts.heroDef, opts.team), 2.9);
      attachWeapon(u);   // 3.19.1: оружие в руке
      addNameplate(u);   // 3.19.1: ник над героем
    } else if (opts.isCreep) {
      u.maxHp = opts.ranged ? 320 : 480; u.hp = u.maxHp;
      u.dmg = opts.ranged ? 42 : 34; u.atkRange = opts.ranged ? 16 : 2.2; u.atkCd = opts.ranged ? 1.3 : 1.2;
      u.baseMs = 7.6; u.bounty = opts.ranged ? 46 : 40; u.xpBounty = opts.ranged ? 60 : 55;
      const teamTint = opts.team === 'r' ? 0x9fd0ff : 0xffb09a;
      attachModel(u, opts.ranged ? 'xbot' : 'soldier', teamTint, opts.ranged ? 0.52 : 0.55,
        () => creepMesh(opts.team, opts.ranged), opts.ranged ? 2.1 : 1.9);
    } else if (opts.isSummon) {
      u.maxHp = opts.hp || 350; u.hp = u.maxHp;
      u.dmg = opts.dmg || 40; u.atkRange = 2.5; u.atkCd = 1.2; u.baseMs = 9;
      u.bounty = 20; u.xpBounty = 20; u.summonT = opts.life || 25;
      const isKraken = /Кракен/.test(opts.name || '');
      attachModel(u, isKraken ? 'fox' : 'robot', isKraken ? 0x3f8fbf : 0xd8d0c0, isKraken ? 2.3 : 0.5,
        () => { const m = creepMesh(opts.team, false); m.scale.setScalar(1.3); return m; }, isKraken ? 2.6 : 2.2);
    }
    if (!u.mesh && opts.isTower !== true && !opts.isAncient) {
      u.mesh = new THREE.Group();
      u.mesh.position.set(u.x, 0, u.z);
      scene.add(u.mesh);
    }
    if (u.mesh && !u.teamDisc && !opts.isTower && !opts.isAncient && !opts.isCourier) {
      u.mesh.position.set(u.x, 0, u.z);
      scene.add(u.mesh);
    }
    units.push(u);
    return u;
  }

  function addHpBar(u, y) {
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a1a1a, depthTest: false }));
    bg.scale.set(2.0, 0.26, 1); bg.position.y = y; bg.renderOrder = 90;
    const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: u.team === 'r' ? 0x4fc84f : 0xe04a3f, depthTest: false }));
    fg.scale.set(1.9, 0.18, 1); fg.position.y = y; fg.renderOrder = 91;
    u.mesh.add(bg); u.mesh.add(fg);
    u.hpBg = bg; u.hpFg = fg;
  }

  function syncMesh(u) {
    if (!u.mesh) return;
    u.mesh.position.set(u.x, u.y || 0, u.z);
  }
  function updateHpBar(u) {
    if (!u.hpFg) return;
    const k = clamp(u.hp / u.maxHp, 0, 1);
    u.hpFg.scale.x = 1.9 * k;
    u.hpFg.position.x = -(1.9 - u.hpFg.scale.x) / 2;
    u.hpFg.material.color.setHex(u.team === 'r' ? 0x4fc84f : 0xe04a3f);
  }

  // ---------- РАСЧЁТ ХАРАКТЕРИСТИК ----------
  function recalcStats(u) {
    if (!u.isHero) return;
    const m = { ms: 0, dmg: 0, aspd: 0, armor: 0, mana: 0, hpregen: 0, mpregen: 0, spower: 0, lifesteal: 0, block: 0 };
    for (const it of u.inventory) { const mm = itemById(it).mods; for (const k in mm) m[k] = (m[k] || 0) + mm[k]; }
    const lvlHp = (u.lvl - 1) * 55, lvlDmg = (u.lvl - 1) * 4.2;
    const oldMax = u.maxHp;
    u.maxHp = u.heroDef.hp + lvlHp + (m.hp || 0);
    // предметы/уровень дают +максХП — текущее хп растёт на ту же дельту (как в Доте)
    if (u.hp > 0 && u.maxHp > oldMax) u.hp = Math.min(u.maxHp, u.hp + (u.maxHp - oldMax));
    u.hp = Math.min(u.hp, u.maxHp);
    u.maxMana = u.heroDef.mana + (u.lvl - 1) * 22 + (m.mana || 0);
    u.dmg = u.heroDef.dmg + lvlDmg + (m.dmg || 0);
    u.aspd = u.heroDef.aspd + (m.aspd || 0);
    u.armor = (m.armor || 0);
    u.mods = m;
  }
  function moveSpeed(u) {
    let ms = u.baseMs + ((u.mods && u.mods.ms) || 0);
    for (const b of u.buffs) {
      if (b.mods && b.mods.msPct) ms *= 1 + b.mods.msPct;
      if (b.slowPct) ms *= 1 - b.slowPct; // 3.19.0: замедления теперь реально работают
    }
    if (u.isHero && u.heroDef.id === 'undina' && inRiver(u.x, u.z)) ms *= 1.3;
    for (const z of zones) {
      if (z.slow && z.team !== u.team && d2(u.x, u.z, z.x, z.z) < z.r) ms *= 1 - z.slow;
    }
    return ms;
  }
  function spellPower(u) { return ((u.mods && u.mods.spower) || 0); }
  function abilityLvl(u, idx) { return u.abilities[idx] ? u.abilities[idx].lvl : 0; }
  function abilityDmg(u, idx) {
    const a = u.abilities[idx]; if (!a || a.def.type === 'passive') return 0;
    const s = u.heroDef.scale();
    const arr = a.def.key === 'Q' ? s.q : a.def.key === 'W' ? (s.w && s.w.length ? s.w : s.q) : (s.r && s.r.length ? s.r : s.q);
    const v = arr[clamp(a.lvl - 1, 0, arr.length - 1)];
    return (v || 0) + (a.def.key !== 'W' || u.heroDef.id === 'undina' ? spellPower(u) : 0);
  }

  const XP_LEVELS = [0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400, 6500, 7700, 9000, 10400, 12000];
  function giveXp(u, amount) {
    if (!u.isHero) return;
    u.xp += amount;
    if (u === myHero && amount >= 25) floatText(u.x, u.z, '+' + amount + ' XP', 0xd4c26a); // 3.19.1: видно, сколько опыта дают
    let ups = 0;
    while (u.lvl < 15 && u.xp >= XP_LEVELS[u.lvl]) {
      u.lvl++;
      ups++;
      recalcStats(u);
      u.hp = u.maxHp; u.mana = u.maxMana;
      ringFx(u.x, u.z, 0xffe08a, 3);
      feed(`${u.name} достиг ${u.lvl} уровня!`);
      if (u === myHero) sfxGold();
    }
    if (ups > 0) {
      if (u.bot) { for (let i = 0; i < ups; i++) botLevelUp(u); } // боты качают сами
      else u.skillPts = (u.skillPts || 0) + ups; // игрок качает сам (кнопка + на скиле)
    }
  }
  // требования к прокачке: обычные скилы 1/3/5/7 уровень, ульт 6/9/12
  function canLevelAbility(u, idx) {
    const a = u.abilities[idx];
    if (!a || a.def.type === 'passive' || (u.skillPts || 0) <= 0) return false;
    const maxLvl = a.def.ult ? 3 : 4;
    if (a.lvl >= maxLvl) return false;
    if (a.def.ult) return u.lvl >= 6 + a.lvl * 3;
    return u.lvl >= a.lvl * 2 + 1;
  }
  function levelUpAbility(u, idx) {
    if (!canLevelAbility(u, idx)) return false;
    u.abilities[idx].lvl++;
    u.skillPts--;
    if (u === myHero) { feed('⬆️ ' + u.abilities[idx].def.name + ' — уровень ' + u.abilities[idx].lvl); sfxGold(); }
    return true;
  }
  function botLevelUp(u) {
    // приоритет: R > Q > W > E
    const order = [3, 0, 1, 2];
    for (const i of order) {
      const a = u.abilities[i];
      const maxLvl = a.def.ult ? 3 : 4;
      const needLvl = a.def.ult ? 6 : 1;
      if (a.def.type !== 'passive' && a.lvl < maxLvl && u.lvl >= needLvl + (a.def.ult ? a.lvl * 3 : 0)) {
        // обычные: не больше уровня героя-1; ульт: 6/9/12... упрощённо
        a.lvl++; return;
      }
    }
  }

  // ---------- УРОН / СМЕРТЬ ----------
  function dealDamage(src, victim, amount, opts) {
    if (!victim.alive) return 0;
    if (net.mode === 'client') return 0; // 3.19.0: клиент матча — только визуал, урон считает хост
    opts = opts || {};
    if (victim.buffs && victim.buffs.some(b => b.mods && b.mods.invuln)) return 0;
    if (victim.isHero && victim.heroDef.id === 'zik' && victim.evadeT <= 0 && !opts.dot && !opts.spell) {
      victim.evadeT = 6; // Предвидение: уклонение
      floatText(victim.x, victim.z, 'УКЛОНЕНИЕ', 0xffe9b8);
      return 0;
    }
    let dmg = amount;
    if (!opts.spell) {
      // шанс промаха от облака Гнила
      for (const z of zones) if (z.blind && z.team !== victim.team && d2(victim.x, victim.z, z.x, z.z) < z.r && Math.random() < z.blind) {
        floatText(victim.x, victim.z, 'ПРОМАХ', 0x9cbb55); return 0;
      }
      // крит Сильвы (любая автоатака)
      if (src && src.isHero && src.heroDef.id === 'silva' && !opts.dot && Math.random() < 0.2) {
        dmg *= 2; floatText(victim.x, victim.z, 'КРИТ!', 0xcfffb0);
      }
      // замедление Фреи автоатаками
      if (src && src.isHero && src.heroDef.id === 'freya' && !opts.dot) slow(victim, 0.2, 1);
      // 3.19.0: модификаторы атаки с предметов — замедление и срез брони
      if (src && src.mods && !opts.dot) {
        if (src.mods.slowOnHit) slow(victim, src.mods.slowOnHit, src.mods.slowDur || 1.5);
        if (src.mods.armorRed) victim.buffs.push({ mods: {}, armorRed: src.mods.armorRed, dur: src.mods.armorRedDur || 4, color: 0xd4a04a });
      }
      // броня с учётом среза (срез может уйти в минус — тогда урон растёт)
      const armorRed = victim.buffs.reduce((s, b) => s + (b.armorRed || 0), 0);
      dmg = Math.max(1, Math.round(amount - ((victim.armor || 0) - armorRed)));
      if (victim.mods && victim.mods.block) dmg = Math.max(1, dmg - victim.mods.block);
    }
    // щит
    if (victim.shieldHp > 0) {
      const absorbed = Math.min(victim.shieldHp, dmg);
      victim.shieldHp -= absorbed; dmg -= absorbed;
    }
    victim.hp -= dmg;
    victim.lastAttacker = src;
    // 3.19.1: лог урона для ассистов (кто бил врага перед смертью)
    if (victim.isHero && src && src.isHero) {
      victim.dmgLog = victim.dmgLog || [];
      victim.dmgLog.push({ src, t: match.time });
      if (victim.dmgLog.length > 24) victim.dmgLog.shift();
    }
    // спина Криса
    if (src && src.isHero && src.heroDef.id === 'kris' && !opts.spell && victim.lastFacing != null) {
      // упрощённо: если цель замершая (стан/замедление) — считаем "в спину"
      if (victim.buffs && victim.buffs.some(b => b.mods && (b.mods.stun || b.mods.msPct && b.mods.msPct < 0))) dmg *= 1.5;
    }
    // вампиризм
    if (src && src.isHero && src.mods && src.mods.lifesteal && !opts.spell) heal(src, src, dmg * src.mods.lifesteal);
    // шипы Морда
    if (victim.isHero && victim.heroDef.id === 'mord' && src && src.alive && d2(src.x, src.z, victim.x, victim.z) < 8) {
      dealDamage(victim, src, amount * 0.15, { spell: true, dot: true });
    }
    if (victim.hp <= 0) killUnit(victim, src);
    return dmg;
  }

  function killUnit(v, killer) {
    v.alive = false;
    v.hp = 0;
    v.deadT = 0;
    // скелетные модели: сначала анимация смерти, скрытие через hideAt
    if (v.rig && v.rig.actions.death) { v.hideAt = clockT + 1.5; playAnim(v, 'death', 0.1); }
    else if (v.mesh) v.mesh.visible = false;
    if (!v.isTower && !v.isAncient && !v.isCourier) corpses.push({ x: v.x, z: v.z, team: v.team, t: 12 });
    if (v.isTower) {
      feed(`💥 ${v.name} разрушена!`);
      sfxTower();
      if (v.mesh) v.mesh.rotation.z = 0.5, v.mesh.position.y = -2;
    }
    if (v.isAncient) {
      endMatch(v.team === 'r' ? 'd' : 'r');
      return;
    }
    // награды
    if (killer && killer.isHero) {
      const g = v.bounty + (v.isHero ? 150 + v.lvl * 12 : 0);
      killer.gold += g;
      if (v.isCreep) { killer.lh++; if (killer === myHero) { sfxGold(); } }
      if (v.isHero) { killer.kills++; v.deaths++; feed(`⚔️ ${killer.name} убил ${v.name}`); sfxKill(); }
      giveXp(killer, v.xpBounty + (v.isHero ? 160 + v.lvl * 25 : 0)); // 3.19.1: опыт увеличен
      // Пожиратель Ксула
      if (killer.heroDef && killer.heroDef.id === 'ksul') heal(killer, killer, 40);
    }
    if (v.isHero) {
      v.deaths++;
      v._deathX = v.x; v._deathZ = v.z;
      v.respawnT = 5 + v.lvl * 1.2;
      if (v.bot) { v.ai.state = 'dead'; }
      dropBacktrack(v);
      // ассисты: союзники героя, наносившие урон за последние 15 сек
      const lg = v.dmgLog || [];
      if (killer && killer.isHero) {
        for (const e of lg) {
          if (e.src && e.src.isHero && e.src !== killer && e.src.team === killer.team && match.time - e.t < 15 && !e._a) {
            e._a = true;
            e.src.assists = (e.src.assists || 0) + 1;
          }
        }
      }
      v.dmgLog = [];
    }
    if (v === myHero) feed('☠️ Ты погиб! Возрождение через ' + v.respawnT.toFixed(0) + ' сек', true);
  }

  function heal(src, target, amount) {
    if (!target.alive) return;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    floatText(target.x, target.z, '+' + Math.round(amount), 0x7fe08a);
    sparkleFx(target.x, target.z, 0x7fe08a);
  }
  function shield(src, target, amount) {
    if (!target.alive) return;
    target.shieldHp = amount;
    floatText(target.x, target.z, 'ЩИТ ' + amount, 0x9fe0f2);
    sparkleFx(target.x, target.z, 0x9fe0f2);
  }
  function revive(src, target) {
    // target — объект {x, z, ref} павшего
    if (!target || !target.ref) return;
    const v = target.ref;
    v.alive = true; v.hp = v.maxHp * 0.6; v.mana = v.maxMana * 0.6;
    v.x = target.x; v.z = target.z;
    if (v.mesh) v.mesh.visible = true;
    syncMesh(v);
    ringFx(v.x, v.z, 0xffe9a0, 4);
    feed(`✨ ${src.name} воскресил ${v.name}!`);
  }
  function execute(src, t) {
    if (!t.alive) return;
    if (t.hp / t.maxHp < 0.25) {
      bloodFx(t.x, t.z);
      feed(`🗡️ ${src.name} казнил ${t.name}!`);
      killUnit(t, src);
    } else {
      dealDamage(src, t, 200 + spellPower(src), { spell: true });
    }
  }
  function pull(src, t) {
    if (!t.alive) return;
    t.x = src.x + rand(-1, 1); t.z = src.z + rand(-1, 1);
    t.moveTarget = null;
    syncMesh(t);
    beamFx(src.x, src.z, t.x, t.z, 0xffcf8a);
    dealDamage(src, t, 60, { spell: true });
  }
  function knockback(src, t, dmg) {
    if (!t.alive) return;
    const dx = t.x - src.x, dz = t.z - src.z, l = Math.hypot(dx, dz) || 1;
    t.x += dx / l * 9; t.z += dz / l * 9;
    collideObstacles(t);
    syncMesh(t);
    dealDamage(src, t, dmg, { spell: true });
  }
  function leap(h, t, dmg) {
    const fx0 = h.x, fz0 = h.z;
    h.x = t.x; h.z = t.z;
    collideObstacles(h);
    beamFx(fx0, fz0, h.x, h.z, 0xd4c28f);
    ringFx(h.x, h.z, 0xd4c28f, 6);
    aoe(h, h.x, h.z, 5, dmg, { stun: 1, color: 0xd4c28f });
    syncMesh(h);
  }
  function blinkFx(x0, z0, x1, z1) { sparkleFx(x0, z0, 0xffc2e6); sparkleFx(x1, z1, 0xffc2e6); }
  function backtrack(h) {
    if (!h.backtrack) return;
    const b = h.backtrack;
    h.x = b.x; h.z = b.z; h.hp = Math.max(h.hp, b.hp); h.mana = Math.max(h.mana, b.mana);
    syncMesh(h);
    ringFx(h.x, h.z, 0xd4c08a, 3);
    floatText(h.x, h.z, 'ОТКАТ', 0xffe9b8);
  }
  function dropBacktrack(h) { h.backtrack = null; }
  function snipe(h, t, dmg) {
    beamFx(h.x, h.z, t.x, t.z, 0xcfffb0);
    dealDamage(h, t, dmg, { spell: true });
  }
  function meteor(h, t, dmg) {
    const ring = ringFx(t.x, t.z, 0xffa070, 9);
    setTimeout(() => {
      if (match.phase !== 'live') return;
      explodeFx(t.x, t.z, 0xff8a50, 9);
      aoe(h, t.x, t.z, 8, dmg, { color: 0xff8a50 });
      sfxTower();
    }, 1500);
  }
  function iceWall(h, t) {
    // стена из 3 ледяных блоков между героем и точкой
    const dx = t.x - h.x, dz = t.z - h.z, l = Math.hypot(dx, dz) || 1;
    const px = -dz / l, pz = dx / l; // перпендикуляр
    for (const off of [-2.6, 0, 2.6]) {
      const wx = t.x + px * off, wz = t.z + pz * off;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 4, 1.2),
        new THREE.MeshPhongMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.85 })
      );
      block.position.set(wx, 2, wz);
      block.lookAt(h.x, 2, h.z);
      scene.add(block);
      obstacles.push({ x: wx, z: wz, r: 1.4, temp: 4 });
      effects.push({ mesh: block, ttl: 4, fade: true });
    }
  }
  function raiseSkeleton(h, t) {
    let c = corpses.find(k => k.team !== h.team && d2(k.x, k.z, t.x, t.z) < 10);
    const sx = c ? c.x : t.x, sz = c ? c.z : t.z;
    if (c) corpses.splice(corpses.indexOf(c), 1);
    ringFx(sx, sz, 0x9a7fd4, 3);
    if (net.mode === 'client') return; // юнит придёт в снапшоте
    const s = makeUnit({ team: h.team, x: sx, z: sz, isSummon: true, name: 'Скелет Ксула', hp: 300 + abilityLvl(h, 1) * 120, dmg: 38 + abilityLvl(h, 1) * 14, life: 24 });
    s.owner = h;
    feed(`💀 ${h.name} поднял скелета!`);
  }
  function summonKraken(h, t) {
    ringFx(t.x, t.z, 0x4a90c8, 8);
    if (net.mode === 'client') { sfxTower(); return; } // юнит придёт в снапшоте
    const k = makeUnit({ team: h.team, x: t.x, z: t.z, isSummon: true, name: 'Кракен', hp: 900, dmg: 65, life: 20 });
    k.owner = h; k.radius = 1.6;
    if (k.mesh) k.mesh.scale.setScalar(2.2);
    feed(`🌊 ${h.name} призвал Кракена!`);
    sfxTower();
  }
  function buff(h, opts) {
    h.buffs.push({ mods: opts, dur: opts.dur || 3, color: opts.color });
    sparkleFx(h.x, h.z, opts.color || 0xffffff);
  }
  function chain(h, first, jumps, dmg) {
    let cur = first, from = h, hitList = [first];
    beamFx(h.x, h.z, first.x, first.z, 0x9fd8ff);
    dealDamage(h, first, dmg, { spell: true });
    for (let j = 0; j < jumps; j++) {
      const next = units.filter(u => u.alive && u.team !== h.team && !hitList.includes(u) && d2(u.x, u.z, cur.x, cur.z) < 10)
        .sort((a, b) => d2(a.x, a.z, cur.x, cur.z) - d2(b.x, b.z, cur.x, cur.z))[0];
      if (!next) break;
      beamFx(cur.x, cur.z, next.x, next.z, 0x9fd8ff);
      dealDamage(h, next, dmg * 0.75, { spell: true });
      hitList.push(next); cur = next;
    }
  }
  function proj(h, target, opts) {
    // opts: {speed, dmg, color, slow, dot, aoe, onHit}
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: opts.color || 0xffffff })
    );
    mesh.position.set(h.x, 1.6, h.z);
    scene.add(mesh);
    projectiles.push({
      mesh, owner: h, target, dmg: opts.dmg || 0,
      speed: opts.speed || 30, slow: opts.slow || 0, dot: opts.dot || null,
      aoe: opts.aoe || 0, color: opts.color || 0xffffff, tx: target.x, tz: target.z,
      kind: 'unit',
    });
  }
  function lineShot(h, t, width, dmg, color) {
    const dx = t.x - h.x, dz = t.z - h.z, l = Math.hypot(dx, dz) || 1;
    beamFx(h.x, h.z, h.x + dx / l * 24, h.z + dz / l * 24, color);
    for (const u of units) {
      if (!u.alive || u.team === h.team) continue;
      // расстояние от прямой
      const cross = Math.abs(dx * (u.z - h.z) - dz * (u.x - h.x)) / l;
      const along = ((u.x - h.x) * dx + (u.z - h.z) * dz) / l;
      if (cross < width && along > 0 && along < 24) dealDamage(h, u, dmg, { spell: true });
    }
  }
  function coneShot(h, t, width, dmg, color) {
    lineShot(h, t, width + 2.5, dmg, color);
  }
  function aoe(h, x, z, r, dmg, opts) {
    opts = opts || {};
    ringFx(x, z, opts.color || 0xffffff, r);
    let total = 0;
    for (const u of units) {
      if (!u.alive || u.team === h.team) continue;
      if (d2(u.x, u.z, x, z) < r + u.radius) {
        total += dealDamage(h, u, dmg, { spell: true });
        if (opts.stun) stun(u, opts.stun);
        if (opts.slow) slow(u, opts.slow, 2);
        if (opts.dot) dot(u, opts.dot, h);
      }
    }
    return total;
  }
  function stun(u, dur) { u.buffs.push({ mods: { stun: 1 }, dur, color: 0xffe08a }); }
  function slow(u, pct, dur) { u.buffs.push({ mods: {}, slowPct: pct, dur, color: 0xbfe4ff }); }
  function dot(u, dotOpts, src) { u.buffs.push({ mods: {}, dot: dotOpts, dur: dotOpts.dur, color: 0xb8e066, src }); }
  function zone(h, x, z, r, dur, opts) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.25, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: opts.color || 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    mesh.position.set(x, 0.3, z);
    scene.add(mesh);
    zones.push({ x, z, r, dur, tick: 0, dps: opts.dps || 0, slow: opts.slow || 0, blind: opts.blind || 0, team: h.team, owner: h, mesh, color: opts.color });
  }

  // ---------- ЭФФЕКТЫ ----------
  function ringFx(x, z, color, r) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.55, r, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.25, z);
    scene.add(mesh);
    effects.push({ mesh, ttl: 0.55, update(e, dt, k) { e.mesh.scale.setScalar(1 + (1 - k) * 0.6); e.mesh.material.opacity = 0.85 * k; } });
    return mesh;
  }
  function beamFx(x0, z0, x1, z1, color) {
    const l = d2(x0, z0, x1, z1);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, l),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    mesh.position.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2);
    mesh.lookAt(x1, 1.5, z1);
    scene.add(mesh);
    effects.push({ mesh, ttl: 0.3, update(e, dt, k) { e.mesh.material.opacity = 0.9 * k; } });
  }
  function sparkleFx(x, z, color) {
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.set(x + rand(-0.8, 0.8), rand(0.5, 2.4), z + rand(-0.8, 0.8));
      scene.add(m);
      const vx = rand(-1.5, 1.5), vy = rand(1, 3), vz = rand(-1.5, 1.5);
      effects.push({ mesh: m, ttl: rand(0.4, 0.8), update(e, dt, k) { m.position.x += vx * dt; m.position.y += vy * dt; m.position.z += vz * dt; m.material.opacity = k; } });
    }
  }
  function explodeFx(x, z, color, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    m.position.set(x, 1, z);
    scene.add(m);
    effects.push({ mesh: m, ttl: 0.5, update(e, dt, k) { e.mesh.scale.setScalar(r * (1 - k) + 0.5); e.mesh.material.opacity = 0.85 * k; } });
    ringFx(x, z, color, r);
  }
  function bloodFx(x, z) { explodeFx(x, z, 0xc02030, 2.2); }
  function floatText(x, z, txt, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px Arial'; g.textAlign = 'center';
    g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeText(txt, 128, 42);
    g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillText(txt, 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(4.5, 1.1, 1);
    sp.position.set(x, 3.2, z);
    sp.renderOrder = 95;
    scene.add(sp);
    effects.push({ mesh: sp, ttl: 0.9, update(e, dt, k) { e.mesh.position.y += dt * 2.2; e.mesh.material.opacity = k; } });
  }

  // ---------- ВЫДЕЛЕНИЕ ЮНИТОВ (клик) ----------
  let selUnit = null;
  let selRing = null;
  function rippleFx(x, z) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.12, z);
    scene.add(m);
    effects.push({ mesh: m, ttl: 0.4, update(e, dt, k) { e.mesh.scale.setScalar(1 + (1 - k) * 3); e.mesh.material.opacity = 0.8 * k; } });
  }
  function selectUnit(u) {
    selUnit = u || null;
    if (selUnit && !selRing) {
      selRing = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.4, 28),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })
      );
      selRing.rotation.x = -Math.PI / 2;
      selRing.renderOrder = 80;
      scene.add(selRing);
    }
    if (selRing) selRing.visible = !!selUnit;
    if (ui.selPanel) ui.selPanel.style.display = selUnit ? 'block' : 'none';
  }
  function updateSelPanel() {
    if (!selRing) return;
    if (selUnit && selUnit.alive) {
      selRing.visible = true;
      selRing.position.set(selUnit.x, 0.1, selUnit.z);
      selRing.material.color.setHex(selUnit.team === 'r' ? 0x5fd0ff : 0xff7a6a);
      const s = Math.max(selUnit.radius * 1.6, 1);
      selRing.scale.setScalar(s);
    } else selRing.visible = false;
    if (ui.selPanel) {
      if (selUnit && selUnit.alive) {
        ui.selPanel.style.display = 'block';
        ui.selPanel.innerHTML = `<b style="color:${selUnit.team === 'r' ? '#7fc4f0' : '#f08a7a'}">${selUnit.name}</b>` +
          (selUnit.isHero ? ` · Ур. ${selUnit.lvl} ${selUnit.heroDef.name}` : '') +
          `<div style="height:8px;background:#26120f;border-radius:4px;margin-top:5px;overflow:hidden;"><div style="height:100%;width:${clamp(selUnit.hp / selUnit.maxHp * 100, 0, 100)}%;background:#4fc84f;"></div></div>` +
          `<div style="font-size:11px;color:#cfc8b8;margin-top:3px;">${Math.ceil(selUnit.hp)} / ${selUnit.maxHp} HP` +
          (selUnit.isHero ? ` · Урон ${Math.round(effDmg(selUnit))}` : '') + '</div>';
      } else ui.selPanel.style.display = 'none';
    }
  }

  // ---------- СОСТОЯНИЕ МАТЧА ----------
  let user = null, rootWrap = null, ui = {};
  let myHero = null;
  let ipcR = null, fsActive = false;
  try { ipcR = require('electron').ipcRenderer; } catch (e) { ipcR = null; }
  const myNick = () => (user && (user.nickname || user.nick)) || 'Игрок';
  let match = { phase: 'menu', time: 0, waveT: 20, waveNum: 0 };
  let lastComp = null; // 3.19.1: состав последнего матча — для рестарта
  let camX = 0, camZ = 0, camZoom = 42;
  let mouseGX = 0, mouseGZ = 0;
  let attackMoveMode = false;
  let rafId = null, lastTs = 0;
  let minimapCtx = null;
  const deadAllies = []; // {x, z, ref, t} для воскрешения

  function el(tag, css, parent, txt) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  function feed(msg, important) {
    if (!ui.feed) return;
    const line = el('div', 'padding:2px 8px;font-size:12px;color:' + (important ? '#ffd34a' : '#cfc8b8') + ';', ui.feed, msg);
    ui.feed.insertBefore(line, ui.feed.firstChild);
    while (ui.feed.children.length > 6) ui.feed.removeChild(ui.feed.lastChild);
    // 3.19.0: хост дублирует фид клиентам матча
    if (net.mode === 'host' && s2net.sock && s2net.connected) {
      try { s2net.sock.emit('s2_ev', { k: 'f', m: String(msg).slice(0, 140), i: !!important }); } catch (e) {}
    }
  }

  // ---------- СОЗДАНИЕ МАТЧА ----------
  // compOrHeroId: строка heroId (соло с ботами) ИЛИ массив [{nick, team:'r'|'d', hero}] из лобби
  // onlineHost: true — мы хост (считаем мир), false — клиент (рисуем по снапшотам)
  function setupMatch(compOrHeroId, onlineHost) {
    net.mode = Array.isArray(compOrHeroId) ? (onlineHost ? 'host' : 'client') : 'off';
    net.snapT = 0;
    lastComp = compOrHeroId;
    // очистка: убираем героев/крипов/призывов/курьеров/снаряды, ВЫШКИ И ТРОНЫ СОХРАНЯЕМ и сбрасываем
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.isTower || u.isAncient) {
        u.alive = true; u.hp = u.maxHp; u.target = null; u.atkT = 0;
        if (u.mesh) { u.mesh.visible = true; u.mesh.rotation.z = 0; u.mesh.position.y = 0; }
        continue;
      }
      if (u.mesh) scene.remove(u.mesh);
      units.splice(i, 1);
    }
    for (const p of projectiles) scene.remove(p.mesh);
    projectiles.length = 0; couriers.length = 0; corpses.length = 0; deadAllies.length = 0;
    for (const z of zones) scene.remove(z.mesh);
    zones.length = 0;
    const keepObst = obstacles.filter(o => !o.temp);
    obstacles.length = 0;
    obstacles.push(...keepObst); // временные стены ледяной стены убраны
    match = { phase: 'live', time: 0, waveT: 8, waveNum: 0 };
    myHero = null;
    selectUnit(null);

    // состав: соло (строка) или лобби (массив)
    let comp;
    if (Array.isArray(compOrHeroId)) {
      comp = compOrHeroId.filter(c => c && c.hero && heroById(c.hero) && (c.team === 'r' || c.team === 'd'))
        .map(c => ({ nick: String(c.nick || 'Игрок').slice(0, 24), team: c.team, hero: c.hero }));
      if (!comp.length) comp = [{ nick: myNick(), team: 'r', hero: 'silva' }];
    } else {
      comp = [{ nick: myNick(), team: 'r', hero: String(compOrHeroId || 'silva') }];
    }
    const mineNick = myNick().toLowerCase();
    let mine = comp.find(c => c.nick.toLowerCase() === mineNick);
    if (!mine && !Array.isArray(compOrHeroId)) { mine = comp[0]; comp = comp.slice(1); }
    // если mine не найден в онлайн-составе — ты зритель: героя нет, свободная камера
    // до 5 на сторону, недостающих добирают боты со случайными героями
    const lanesFor = (n) => n >= 5 ? ['top', 'top', 'mid', 'bot', 'bot'] : ['top', 'mid', 'bot', 'top'];
    for (const team of ['r', 'd']) {
      const have = comp.filter(c => c.team === team);
      while (have.length < 5) {
        const hd = pick(HEROES);
        have.push({ nick: hd.name.split(' ')[0], team, hero: hd.id, _bot: true });
        comp.push(have[have.length - 1]);
      }
    }
    const mkHero = (c, isPlayer, laneIdx, lane) => {
      const base = c.team === 'r' ? BASE_R : BASE_D;
      const def = heroById(c.hero);
      const online = Array.isArray(compOrHeroId);
      const b = makeUnit({
        team: c.team, x: base.x + rand(-5, 7), z: base.z + rand(-5, 7),
        heroDef: def, name: c.nick, bot: !isPlayer && (!online || !!c._bot), lane,
      });
      // живой игрок на хосте: героя ведёт удалённый ввод, а не ИИ
      if (!isPlayer && online && !c._bot) b.remote = true;
      recalcStats(b);
      b.gold = 600;
      if (isPlayer) { b.isPlayer = true; myHero = b; }
      return b;
    };
    // мой герой — мид своей команды (зрителю — не создаём)
    if (mine) mkHero(mine, true, 2, 'mid');
    // остальные: линии по порядку
    for (const team of ['r', 'd']) {
      const members = comp.filter(c => c.team === team && c !== mine);
      const lanes = lanesFor(members.length + 1);
      let li = 0;
      for (const c of members) {
        if (c === mine) continue;
        mkHero(c, false, li, lanes[li + 1] || 'bot');
        li++;
      }
    }
    camX = myHero ? myHero.x : 0; camZ = myHero ? myHero.z : 0;
    buildHud();
    feed(myHero ? 'Матч начался! Добивай крипов — получай золото. Уничтожь вражеский трон!' : '👁 Ты зритель — свободная камера, наслаждайся матчем');
  }

  function spawnWave() {
    match.waveNum++;
    for (const team of ['r', 'd']) {
      const base = team === 'r' ? BASE_R : BASE_D;
      const enemyBase = team === 'r' ? BASE_D : BASE_R;
      for (const lane of ['top', 'mid', 'bot']) {
        for (let i = 0; i < 4; i++) {
          const c = makeUnit({ team, x: base.x + rand(-4, 4), z: base.z + rand(-4, 4), isCreep: true, lane, ranged: false });
          c.waypointT = 0.002;
        }
        const r = makeUnit({ team, x: base.x + rand(-4, 4), z: base.z + rand(-4, 4), isCreep: true, lane, ranged: true });
        r.waypointT = 0.002;
      }
    }
  }

  function endMatch(winner) {
    match.phase = 'over';
    // 3.19.0: хост сообщает клиентам итог
    if (net.mode === 'host' && s2net.sock && s2net.connected) {
      try { s2net.sock.emit('s2_end', winner); } catch (e) {}
    }
    const win = winner === (myHero ? myHero.team : 'r');
    if (win) sfxWin(); else sfxLose();
    const ov = el('div', 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(8,10,16,0.82);z-index:60;', rootWrap);
    el('div', 'font-size:52px;font-weight:900;color:' + (win ? '#7fe08a' : '#e06a5a') + ';text-shadow:0 4px 18px rgba(0,0,0,0.7);', ov,
      myHero ? (win ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ') : '🏁 МАТЧ ЗАВЕРШЁН');
    if (myHero) el('div', 'margin-top:14px;font-size:16px;color:#cfc8b8;', ov,
      `Убийств: ${myHero.kills} · Смертей: ${myHero.deaths} · Добито крипов: ${myHero.lh} · Золото: ${myHero.gold}`);
    const btn = el('button', 'margin-top:26px;padding:12px 34px;font-size:16px;font-weight:700;background:#2a6b3f;color:#fff;border:none;border-radius:10px;cursor:pointer;', ov, 'В меню');
    btn.onclick = () => { ov.remove(); net.mode = 'off'; showLobby(); };
    // 3.19.1: таблица результатов K/D/A
    const rows = units.filter(u => u.isHero).sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));
    const tbl = el('div', 'margin-top:20px;background:rgba(12,16,26,0.92);border:1px solid #3a4358;border-radius:10px;padding:10px 14px;min-width:460px;max-height:260px;overflow:auto;', ov);
    el('div', 'font-size:13px;font-weight:800;color:#ffd34a;text-align:center;margin-bottom:6px;', tbl, '📊 ИТОГИ МАТЧА · K / D / A');
    const head = el('div', 'display:flex;justify-content:space-between;font-size:11px;color:#8a94a8;padding:2px 6px;', tbl);
    head.innerHTML = '<span>ИГРОК</span><span>КИЛЛЫ / СМЕРТИ / АССИСТЫ</span>';
    for (const r of rows) {
      const mine2 = myHero && r === myHero;
      const row = el('div', 'display:flex;justify-content:space-between;gap:18px;font-size:12.5px;padding:3px 6px;border-radius:6px;color:' + (r.team === 'r' ? '#8fd4ff' : '#ff9a8a') + (mine2 ? ';background:rgba(111,224,160,0.14);' : ''), tbl);
      row.innerHTML = `<span>${r.name} — ${r.heroDef.name} · Ур.${r.lvl}</span><b style="color:#e8dfc8">${r.kills} / ${r.deaths} / ${r.assists || 0}</b>`;
    }
  }

  // ---------- 3.19.1: ESC-МЕНЮ (игра продолжается) ----------
  let escMenu = null;
  function toggleEscMenu() {
    if (match.phase !== 'live') return;
    if (escMenu) { escMenu.remove(); escMenu = null; return; }
    escMenu = el('div', 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,0.62);z-index:55;', rootWrap);
    const box = el('div', 'background:rgba(14,18,28,0.97);border:1px solid #4a5468;border-radius:14px;padding:22px 30px;text-align:center;min-width:300px;', escMenu);
    el('div', 'font-size:22px;font-weight:900;color:#e8dfc8;margin-bottom:4px;', box, '⏸ МЕНЮ');
    el('div', 'font-size:11.5px;color:#8a94a8;margin-bottom:16px;', box, 'Игра продолжается!');
    const b1 = el('button', 'display:block;width:100%;margin-bottom:10px;padding:11px;background:#1f2a4a;color:#a0c0ff;border:1px solid #3a5a8a;border-radius:9px;cursor:pointer;font-weight:800;font-size:14px;', box, '▶ Продолжить (ESC)');
    b1.onclick = () => toggleEscMenu();
    if (net.mode !== 'client') {
      const b2 = el('button', 'display:block;width:100%;margin-bottom:10px;padding:11px;background:#3a2f14;color:#ffd34a;border:1px solid #8a6b3a;border-radius:9px;cursor:pointer;font-weight:800;font-size:14px;', box, '🔁 Начать заново');
      b2.onclick = () => { escMenu.remove(); escMenu = null; restartMatch(); };
    } else {
      el('div', 'font-size:11px;color:#8a94a8;margin-bottom:10px;', box, '«Начать заново» доступно только хосту');
    }
    const b3 = el('button', 'display:block;width:100%;padding:11px;background:#4a1f1f;color:#ffb0a0;border:1px solid #8a3a3a;border-radius:9px;cursor:pointer;font-weight:800;font-size:14px;', box, '✖ Выйти в лобби');
    b3.onclick = () => {
      escMenu.remove(); escMenu = null;
      if (net.mode !== 'off' && s2net.sock) { try { s2net.sock.emit('s2_leave'); } catch (e) {} }
      net.mode = 'off';
      showLobby();
    };
  }
  function restartMatch() {
    if (lastComp == null) return;
    if (net.mode === 'host' && s2net.sock && s2net.connected) {
      try { s2net.sock.emit('s2_ev', { k: 'rs' }); } catch (e) {} // клиенты пересоздадут мир тем же составом
    }
    setupMatch(lastComp, net.mode === 'host');
    feed('🔁 Новый матч — тот же состав!');
  }

  // ---------- ТИК ИГРЫ ----------
  function collideObstacles(u) {
    for (const o of obstacles) {
      const dd = d2(u.x, u.z, o.x, o.z), min = o.r + u.radius;
      if (dd < min && dd > 0.001) {
        const push = (min - dd);
        u.x += (u.x - o.x) / dd * push;
        u.z += (u.z - o.z) / dd * push;
      }
    }
    const B = MAP / 2 - 2;
    u.x = clamp(u.x, -B, B); u.z = clamp(u.z, -B, B);
  }

  function findTarget(u, range) {
    let best = null, bd = range;
    for (const e of units) {
      if (!e.alive || e.team === u.team) continue;
      const dd = d2(u.x, u.z, e.x, e.z) - e.radius;
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }

  function tryAttack(u, dt) {
    if (u.atkT > 0) return;
    const t = u.target;
    if (!t || !t.alive) { u.target = null; return; }
    const dd = d2(u.x, u.z, t.x, t.z) - t.radius;
    if (dd <= u.atkRange) {
      u.atkT = u.atkCd * (100 / (100 + effAspd(u)));
      u.atkCount++;
      u.atkAnimT = u.rig && u.rig.actions.attack ? 0.55 : 0.3; // анимация атаки
      // поворот к цели
      if (u.mesh) u.mesh.rotation.y = Math.atan2(t.x - u.x, t.z - u.z);
      // заряд Варга (работает и в ближнем, и в дальнем бою)
      if (u.isHero && u.heroDef.id === 'varg' && u.atkCount % 3 === 0) {
        dealDamage(u, t, 60 + spellPower(u), { spell: true });
        beamFx(u.x, u.z, t.x, t.z, 0x9fd8ff);
      }
      const isRanged = u.atkRange > 6;
      if (isRanged) {
        proj(u, t, { speed: 32, dmg: 0, color: u.team === 'r' ? 0x9fd0ff : 0xff9f8a, spell: false });
        // помечаем снаряд как автоатаку
        projectiles[projectiles.length - 1].autoattack = true;
      } else {
        dealDamage(u, t, effDmg(u), {});
        if (u === myHero || d2(u.x, u.z, camX, camZ) < 50) sfxHit();
      }
    } else if (!u.isTower && !u.isAncient) {
      // подойти ближе
      moveToward(u, t.x, t.z, dt);
    } else u.target = null;
  }

  function effDmg(u) {
    let d = u.dmg;
    for (const b of u.buffs) if (b.mods && b.mods.dmgFlat) d += b.mods.dmgFlat;
    return d;
  }
  function effAspd(u) {
    let a = u.aspd + ((u.mods && u.mods.aspd) || 0);
    for (const b of u.buffs) if (b.mods && b.mods.aspdPct) a *= 1 + b.mods.aspdPct;
    return a;
  }
  function isStunned(u) { return u.buffs.some(b => b.mods && b.mods.stun); }
  function isStealthed(u) { return u.buffs.some(b => b.mods && b.mods.stealth); }

  function moveToward(u, tx, tz, dt) {
    const dd = d2(u.x, u.z, tx, tz);
    if (dd < 0.4) return true;
    const ms = moveSpeed(u) * (isStunned(u) ? 0 : 1);
    u.x += (tx - u.x) / dd * ms * dt;
    u.z += (tz - u.z) / dd * ms * dt;
    u.moving = true;
    if (u.mesh && !u.target) u.mesh.rotation.y = Math.atan2(tx - u.x, tz - u.z);
    collideObstacles(u);
    return d2(u.x, u.z, tx, tz) < 0.5;
  }

  function tickUnit(u, dt) {
    if (!u.alive) {
      if (u.rig) {
        playAnim(u, 'death', 0.1);
        u.rig.mixer.update(dt);
        if (u.hideAt && clockT > u.hideAt && u.mesh) u.mesh.visible = false;
      }
      if (u.isHero && match.phase === 'live') {
        u.respawnT -= dt;
        if (u.respawnT <= 0) {
          const base = u.team === 'r' ? BASE_R : BASE_D;
          u.alive = true;
          u.x = base.x + rand(-4, 4); u.z = base.z + rand(-4, 4);
          u.hp = u.maxHp; u.mana = u.maxMana;
          u.buffs.length = 0; u.shieldHp = 0;
          if (u.mesh) u.mesh.visible = true;
          if (u.bot) u.ai.state = 'push';
          syncMesh(u);
        }
      }
      return;
    }
    // баффы
    for (let i = u.buffs.length - 1; i >= 0; i--) {
      const b = u.buffs[i];
      b.dur -= dt;
      if (b.dot) { b.tickT = (b.tickT || 0) + dt; if (b.tickT >= 1) { b.tickT -= 1; dealDamage(b.src || u, u, b.dot.dps, { spell: true, dot: true }); if (!u.alive) return; } }
      if (b.dur <= 0) u.buffs.splice(i, 1);
    }
    if (u.evadeT > 0) u.evadeT -= dt;
    if (u.atkT > 0) u.atkT -= dt;
    u.moving = false;
    u.atkAnimT = Math.max(0, (u.atkAnimT || 0) - dt);
    if (u.shieldHp > 0 && u.shieldT != null) { u.shieldT -= dt; if (u.shieldT <= 0) u.shieldHp = 0; }
    for (const a of u.abilities) if (a.cdT > 0) a.cdT -= dt;
    if (u.isHero) for (const k in u.itemCd) if (u.itemCd[k] > 0) u.itemCd[k] -= dt;

    // реген
    if (u.isHero) {
      let hpregen = 0.6 + ((u.mods && u.mods.hpregen) || 0) + (u.heroDef.id === 'gnil' ? 3 : 0);
      let mpregen = 0.9 + ((u.mods && u.mods.mpregen) || 0);
      const base = u.team === 'r' ? BASE_R : BASE_D;
      if (base.fountain && d2(u.x, u.z, base.fountain.x, base.fountain.z) < 8) { hpregen += u.maxHp * 0.06; mpregen += u.maxMana * 0.06; }
      u.hp = Math.min(u.maxHp, u.hp + hpregen * dt);
      u.mana = Math.min(u.maxMana, u.mana + mpregen * dt);
      // аура Джина
      if (u.heroDef.id === 'jin') {
        for (const a of units) if (a.alive && a.team === u.team && d2(a.x, a.z, u.x, u.z) < 10) a.hp = Math.min(a.maxHp, a.hp + 2 * dt);
      }
      // снапшот для Зика
      if (u.heroDef.id === 'zik') {
        u.btT = (u.btT || 0) + dt;
        if (u.btT >= 4) { u.btT = 0; u.backtrack = { x: u.x, z: u.z, hp: u.hp, mana: u.mana }; }
      }
    }

    if (isStunned(u)) { syncMesh(u); updateHpBar(u); tickRig(u, dt); return; }

    if (u.isTower) {
      // вышка: сначала крипы, потом герои
      let best = null, bd = u.atkRange;
      for (const e of units) {
        if (!e.alive || e.team === u.team || e.isAncient) continue;
        const dd = d2(u.x, u.z, e.x, e.z) - e.radius;
        if (dd < bd) {
          const prio = e.isCreep || e.isSummon ? 0 : 1;
          if (!best || prio < best._prio || (prio === best._prio && dd < bd)) { best = e; bd = dd; best._prio = prio; }
        }
      }
      if (best) {
        if (u.atkT <= 0) {
          u.atkT = u.atkCd;
          proj(u, best, { speed: 40, dmg: 0, color: u.team === 'r' ? 0x6fc4ff : 0xff6a5a });
          projectiles[projectiles.length - 1].autoattack = true;
          projectiles[projectiles.length - 1].tower = true;
        }
      }
      return;
    }
    if (u.isAncient) { updateHpBar(u); return; }

    if (u.isCourier) { tickCourier(u, dt); return; }

    // призыв: следует за хозяином и дерётся
    if (u.isSummon) {
      u.summonT -= dt;
      if (u.summonT <= 0) { killUnit(u, null); return; }
      const t = findTarget(u, 14);
      if (t) { u.target = t; tryAttack(u, dt); }
      else if (u.owner && u.owner.alive && d2(u.x, u.z, u.owner.x, u.owner.z) > 5) moveToward(u, u.owner.x, u.owner.z, dt);
      syncMesh(u); updateHpBar(u); tickRig(u, dt);
      return;
    }

    if (u.isCreep) {
      if (!u.target || !u.target.alive || u.aggroT <= 0) {
        // ищем цель рядом
        const t = findTarget(u, 11);
        if (t) { u.target = t; u.aggroT = 3; }
        else {
          // движение по вейпоинтам линии
          u.waypointT = Math.min(1, u.waypointT + dt * moveSpeed(u) / 160);
          if (u.waypointT >= 0.999) {
            // дошли до вражеской базы — бьём трон
            const eb = u.team === 'r' ? BASE_D : BASE_R;
            const anc = units.find(a => a.isAncient && a.team !== u.team);
            if (anc && d2(u.x, u.z, anc.x, anc.z) < 30) u.target = anc;
          } else {
            const wp = lanePoint(u.lane, u.team === 'r' ? u.waypointT : 1 - u.waypointT);
            if (wp) moveToward(u, wp.x + (u.id % 5 - 2), wp.z + (u.id % 3 - 1), dt);
          }
        }
      } else {
        u.aggroT -= dt;
        tryAttack(u, dt);
      }
      syncMesh(u); updateHpBar(u); tickRig(u, dt);
      return;
    }

    if (u.isHero) {
      if (u.bot) tickBot(u, dt);
      // игрок: движение к цели
      if (!u.bot && u.moveTarget && !u.target) {
        if (moveToward(u, u.moveTarget.x, u.moveTarget.z, dt)) u.moveTarget = null;
      }
      if (u.target) {
        if (!u.target.alive) u.target = null;
        else tryAttack(u, dt);
      }
      syncMesh(u); updateHpBar(u); tickRig(u, dt);
      // невидимость: полупрозрачный
      if (u.mesh) {
        const st = isStealthed(u);
        u.mesh.traverse(o => { if (o.material && o.material.transparent !== undefined) { /* пропускаем */ } });
        u.mesh.visible = u.alive && (!st || u === myHero);
        if (st && u === myHero) u.mesh.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.45; } });
        else if (u._wasStealth) u.mesh.traverse(o => { if (o.material) { o.material.opacity = 1; if (o.material.transparent && !o.isSprite) o.material.transparent = false; } });
        u._wasStealth = st;
      }
    }
  }

  // ---------- БОТЫ ----------
  function tickBot(u, dt) {
    u.brainT -= dt;
    const base = u.team === 'r' ? BASE_R : BASE_D;
    const fountain = base.fountain;
    const lowHp = u.hp / u.maxHp < 0.3;

    // покупки
    const build = ['boots', 'blade', 'bow', 'armor', 'heart', 'fang', 'frost', 'crusher', 'hyper', 'plate'];
    if (u.gold > 900 && u.inventory.length < 6) {
      const it = build.find(id => !u.inventory.includes(id) && itemById(id).cost <= u.gold);
      if (it) { u.gold -= itemById(it).cost; u.inventory.push(it); recalcStats(u); }
    }

    if (lowHp && u.ai.state !== 'retreat') { u.ai.state = 'retreat'; u.target = null; }
    if (u.ai.state === 'retreat') {
      if (d2(u.x, u.z, fountain.x, fountain.z) < 7) {
        if (u.hp / u.maxHp > 0.85) u.ai.state = 'push';
      } else { moveToward(u, fountain.x, fountain.z, dt); return; }
    }

    // враг рядом?
    const enemyHero = units.find(e => e.alive && e.isHero && e.team !== u.team && !isStealthed(e) && d2(e.x, e.z, u.x, u.z) < 16);
    if (enemyHero && u.hp / u.maxHp > 0.45) {
      u.target = enemyHero;
      // кастуем способность
      if (u.brainT <= 0) {
        u.brainT = 1.2;
        const ready = u.abilities.filter(a => a.def.type !== 'passive' && a.lvl > 0 && a.cdT <= 0 && a.def.mana <= u.mana);
        if (ready.length) {
          const a = pick(ready);
          castAbility(u, a, enemyHero);
        }
      }
      tryAttack(u, dt);
      return;
    }

    // добивание крипов
    const creep = units.find(e => e.alive && e.isCreep && e.team !== u.team && d2(e.x, e.z, u.x, u.z) < u.atkRange + 1 && e.hp < effDmg(u) * 1.2);
    if (creep && Math.random() < 0.75) { u.target = creep; tryAttack(u, dt); return; }

    // иначе идём по линии к врагу, рядом с своими крипами
    const t = clamp(0.35 + match.time / 900, 0.35, 0.95);
    const wp = lanePoint(u.lane, u.team === 'r' ? t : 1 - t);
    if (wp && d2(u.x, u.z, wp.x, wp.z) > 4) moveToward(u, wp.x, wp.z, dt);
    else {
      const near = findTarget(u, u.atkRange + 4);
      if (near) { u.target = near; tryAttack(u, dt); }
    }
  }

  // ---------- СПОСОБНОСТИ ----------
  function castAbility(u, a, target) {
    if (!u.alive || isStunned(u) || a.lvl <= 0) return false;
    // на клиенте матча кд/мана не проверяются — повторяем каст визуально по событию хоста
    if (net.mode !== 'client' && (a.cdT > 0 || u.mana < a.def.mana)) return false;
    if (net.mode !== 'client') {
      u.mana -= a.def.mana;
      a.cdT = a.def.cd;
    }
    const s = { dmg: abilityDmg(u, u.abilities.indexOf(a)) };
    const pt = target && target.x != null ? { x: target.x, z: target.z } : { x: u.x, z: u.z };
    a.def.exec(u, target && target.alive !== undefined ? target : pt, s);
    // 3.19.1: анимация каста — герой «взмахивает» (если у модели есть анимация атаки) + вспышка
    u.atkAnimT = 0.55;
    const castFlash = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.5, 24),
      new THREE.MeshBasicMaterial({ color: u.heroDef ? u.heroDef.color : 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    castFlash.rotation.x = -Math.PI / 2;
    castFlash.position.set(u.x, 0.15, u.z);
    scene.add(castFlash);
    effects.push({ mesh: castFlash, ttl: 0.45, update(e, dt2, k) { e.mesh.scale.setScalar(1 + (1 - k) * 1.6); e.mesh.material.opacity = 0.9 * k; } });
    // Космический поток Астры
    if (u.heroDef.id === 'astra') u.mana = Math.min(u.maxMana, u.mana + 4);
    if (u === myHero || d2(u.x, u.z, camX, camZ) < 55) sfxCast();
    sparkleFx(u.x, u.z, 0xffffff);
    // 3.19.0: хост рассылает событие каста — клиенты повторяют визуал
    if (net.mode === 'host' && s2net.sock && s2net.connected) {
      try {
        s2net.sock.emit('s2_ev', {
          k: 'c', nm: u.name, i: u.abilities.indexOf(a),
          tid: target && target.alive !== undefined ? (target.name || '') : '',
          tx: Math.round(pt.x * 10) / 10, tz: Math.round(pt.z * 10) / 10,
        });
      } catch (e) {}
    }
    return true;
  }

  // ---------- СНАРЯДЫ / ЗОНЫ / ЭФФЕКТЫ ----------
  function tickProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      let tx = p.kind === 'unit' && p.target && p.target.alive ? p.target.x : p.tx;
      let tz = p.kind === 'unit' && p.target && p.target.alive ? p.target.z : p.tz;
      const dd = d2(p.mesh.position.x, p.mesh.position.z, tx, tz);
      if (dd < 0.8) {
        // попадание
        if (p.autoattack) {
          if (net.mode !== 'client' && p.target && p.target.alive) dealDamage(p.owner, p.target, p.tower ? p.owner.dmg : effDmg(p.owner), {});
        } else {
          const victims = units.filter(u2 => u2.alive && u2.team !== p.owner.team && d2(u2.x, u2.z, tx, tz) < (p.aoe ? p.aoe : 1.6) + u2.radius);
          if (net.mode !== 'client') {
            for (const v of victims) {
              dealDamage(p.owner, v, p.dmg, { spell: true });
              if (p.slow) slow(v, p.slow, 2);
              if (p.dot) dot(v, p.dot, p.owner);
            }
          }
          if (!victims.length && p.dmg > 0) {
            // урон по точке
            floatText(tx, tz, '•', 0x888888);
          }
          explodeFx(tx, tz, p.color, p.aoe || 1.4);
        }
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += (tx - p.mesh.position.x) / dd * p.speed * dt;
      p.mesh.position.z += (tz - p.mesh.position.z) / dd * p.speed * dt;
    }
  }
  function tickZones(dt) {
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.dur -= dt; z.tick += dt;
      z.mesh.material.opacity = 0.22 + 0.1 * Math.sin(clockT * 5);
      if (z.tick >= 0.5) {
        z.tick -= 0.5;
        if (z.dps > 0 && net.mode !== 'client') for (const u2 of units) if (u2.alive && u2.team !== z.team && d2(u2.x, u2.z, z.x, z.z) < z.r) dealDamage(z.owner, u2, z.dps * 0.5, { spell: true });
      }
      if (z.dur <= 0) { scene.remove(z.mesh); zones.splice(i, 1); }
    }
  }
  function tickEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      if (e.ttl !== Infinity) {
        e.ttl -= dt;
        if (e.ttl <= 0) {
          if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
          effects.splice(i, 1);
          continue;
        }
      }
      if (e.update) e.update(e, dt, e.ttl === Infinity ? 1 : clamp(e.ttl / 0.55, 0, 1));
    }
  }
  function tickCorpses(dt) {
    for (let i = corpses.length - 1; i >= 0; i--) { corpses[i].t -= dt; if (corpses[i].t <= 0) corpses.splice(i, 1); }
    for (let i = deadAllies.length - 1; i >= 0; i--) { deadAllies[i].t -= dt; if (deadAllies[i].t <= 0) deadAllies.splice(i, 1); }
    // трупы героев доступны для воскрешения
    if (myHero && myHero.heroDef.id === 'jin') {
      // обновляем список павших союзников
      deadAllies.length = 0;
      for (const u2 of units) if (u2.isHero && !u2.alive && u2.team === myHero.team && u2 !== myHero) deadAllies.push({ x: u2._deathX || u2.x, z: u2._deathZ || u2.z, ref: u2, t: 1 });
    }
  }

  // ---------- КУРЬЕР ----------
  function myBase() { return (myHero && myHero.team === 'd') ? BASE_D : BASE_R; }
  function buyItem(itemId) {
    if (net.mode === 'client') { // 3.19.0: заказ уходит хосту, тот списывает золото и запускает курьера
      s2Send({ k: 'buy', id: itemId });
      feed('🛒 Заказ отправлен — курьер летит (хост подтвердит)');
      return;
    }
    heroBuyItem(myHero, itemId);
  }
  // 3.19.0: активные предметы — блинк даггер и далее
  function useItemSlot(i, hero, px, pz) {
    if (net.mode === 'client' && !hero) { // мой активный предмет — команда хосту
      s2Send({ k: 'item', i, x: px != null ? px : Math.round(mouseGX * 10) / 10, z: pz != null ? pz : Math.round(mouseGZ * 10) / 10 });
      return;
    }
    const h = hero || myHero;
    if (!h || !h.alive || match.phase !== 'live') return;
    const id = h.inventory[i];
    if (!id) return;
    const it = itemById(id);
    if (!it || !it.active) return;
    if ((h.itemCd[id] || 0) > 0) { if (h === myHero) feed('Предмет на перезарядке: ' + Math.ceil(h.itemCd[id]) + ' сек', true); return; }
    if (it.active.type === 'blink') {
      const tx = px != null ? px : mouseGX, tz = pz != null ? pz : mouseGZ;
      const dx = tx - h.x, dz = tz - h.z;
      const l = Math.hypot(dx, dz) || 1;
      const r = Math.min(l, it.active.range);
      const nx = clamp(h.x + dx / l * r, -MAP / 2 + 2, MAP / 2 - 2);
      const nz = clamp(h.z + dz / l * r, -MAP / 2 + 2, MAP / 2 - 2);
      blinkFx(h.x, h.z, nx, nz);
      h.x = nx; h.z = nz;
      collideObstacles(h);
      syncMesh(h);
      h.itemCd[id] = it.active.cd;
      if (h === myHero) { feed('⚡ Блинк!'); sfxCast(); }
    }
  }
  function useFirstActive() {
    if (!myHero) return;
    for (let i = 0; i < myHero.inventory.length; i++) {
      const it = itemById(myHero.inventory[i]);
      if (it && it.active) { useItemSlot(i); return; }
    }
    feed('Нет активных предметов (Блинк Даггер — в магазине)', true);
  }

  // покупка любым героем (себя — myHero, сетевого игрока — по событию хосту)
  function heroBuyItem(h, itemId) {
    const it = itemById(itemId);
    if (!it || !h || !h.alive) return;
    if (h.gold < it.cost) { if (h === myHero) feed('Не хватает золота: ' + it.name, true); return; }
    if (h.inventory.length >= 6) { if (h === myHero) feed('Инвентарь полон!', true); return; }
    h.gold -= it.cost;
    const base = h.team === 'd' ? BASE_D : BASE_R;
    const c = makeUnit({ team: h.team, x: base.fountain.x, z: base.fountain.z, isCourier: true, name: 'Курьер' });
    c.carry = itemId;
    c.dest = h;
    c.homeBase = base;
    makeCourierMesh(c);
    couriers.push(c);
    feed(`🦅 Курьер везёт: ${it.name} (${h.name})`);
    if (h === myHero) sfxGold();
  }

  function makeCourierMesh(c) {
    c.mesh = new THREE.Group();
    const inst = instantiateS2Model('parrot', null, 1);
    if (inst) { c.rig = inst; c.mesh.add(inst.model); }
    else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd8b24a }));
      body.position.y = 2.6; body.castShadow = true;
      const wings = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0xf0e0b0 }));
      wings.position.y = 2.8;
      c.mesh.add(body); c.mesh.add(wings);
      c.wings = wings;
    }
    c.mesh.position.set(c.x, 0, c.z);
    scene.add(c.mesh);
  }

  function tickCourier(c, dt) {
    c.fly = (c.fly || 0) + dt * 9;
    const home = c.homeBase || BASE_R;
    const d = c.dest && c.dest.alive ? c.dest : null;
    if (!d) { // герой умер — ждём у базы
      c.x = home.fountain.x; c.z = home.fountain.z; c.y = Math.sin(c.fly) * 0.4 + 2.6;
      syncMesh(c); return;
    }
    const dd = d2(c.x, c.z, d.x, d.z);
    if (dd > 1.6) {
      const ms = 16;
      c.x += (d.x - c.x) / dd * ms * dt;
      c.z += (d.z - c.z) / dd * ms * dt;
      c.y = Math.sin(c.fly) * 0.5 + 2.4;
      if (c.mesh) { c.mesh.rotation.y = Math.atan2(d.x - c.x, d.z - c.z); if (c.wings) c.wings.rotation.z = Math.sin(c.fly * 3) * 0.4; }
    } else {
      // доставил
      if (c.carry) {
        if (d.inventory.length < 6) {
          d.inventory.push(c.carry);
          recalcStats(d);
          feed(`📦 ${itemById(c.carry).name} доставлено!`);
          if (d === myHero) sfxGold();
        } else {
          d.gold += itemById(c.carry).cost; // возврат если инвентарь заполнился
          feed('Инвентарь был полон — золото возвращено', true);
        }
        c.carry = null;
      }
      // возвращаемся на базу
      const bx = home.fountain.x, bz = home.fountain.z;
      const db = d2(c.x, c.z, bx, bz);
      if (db > 2) {
        c.x += (bx - c.x) / db * 16 * dt;
        c.z += (bz - c.z) / db * 16 * dt;
        c.y = Math.sin(c.fly) * 0.5 + 2.4;
      } else {
        if (c.mesh) scene.remove(c.mesh);
        c.alive = false;
        units.splice(units.indexOf(c), 1);
        couriers.splice(couriers.indexOf(c), 1);
      }
    }
    if (c.rig) c.rig.mixer.update(dt);
    syncMesh(c);
  }

  // ---------- HUD ----------
  function buildHud() {
    if (ui.hud) ui.hud.remove();
    rootWrap.querySelectorAll('[data-s2top]').forEach(e => e.remove()); // старые кнопки/панели верха
    const hud = el('div', 'position:absolute;left:0;right:0;bottom:0;height:158px;display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:0 10px 8px;background:linear-gradient(transparent,rgba(10,12,18,0.92) 30%);z-index:20;pointer-events:none;', rootWrap);
    ui.hud = hud;
    // панель героя
    const left = el('div', 'width:280px;pointer-events:auto;background:rgba(16,20,30,0.9);border:1px solid #3a4358;border-radius:10px;padding:8px;', hud);
    ui.heroName = el('div', 'font-size:13px;font-weight:700;color:#e8dfc8;', left);
    ui.hpBar = el('div', 'height:14px;background:#26120f;border-radius:6px;margin-top:5px;overflow:hidden;', left);
    ui.hpFill = el('div', 'height:100%;width:100%;background:linear-gradient(#6fe07a,#3fa84f);', ui.hpBar);
    ui.hpText = el('div', 'font-size:11px;color:#cfc8b8;margin-top:2px;', left);
    ui.mpBar = el('div', 'height:9px;background:#0f1420;border-radius:5px;margin-top:4px;overflow:hidden;', left);
    ui.mpFill = el('div', 'height:100%;width:100%;background:linear-gradient(#6fa8ff,#3f6fd4);', ui.mpBar);
    ui.xpText = el('div', 'font-size:11px;color:#b8a86a;margin-top:3px;', left);
    ui.goldText = el('div', 'font-size:13px;font-weight:700;color:#ffd34a;margin-top:2px;', left);
    // способности
    ui.abils = [];
    const mid = el('div', 'display:flex;gap:6px;pointer-events:auto;', hud);
    for (let i = 0; i < 4; i++) {
      const b = el('div', 'position:relative;width:62px;height:62px;background:#141a28;border:1px solid #3a4358;border-radius:8px;cursor:pointer;user-select:none;', mid);
      const key = el('div', 'position:absolute;top:2px;left:5px;font-size:12px;font-weight:900;color:#ffd34a;', b);
      const nm = el('div', 'position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:8.5px;color:#cfc8b8;line-height:1.1;', b);
      const cd = el('div', 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);border-radius:8px;font-size:17px;font-weight:900;color:#fff;', b);
      const lvl = el('div', 'position:absolute;top:2px;right:5px;font-size:9px;color:#7fe08a;', b);
      // 3.19.1: кнопка прокачки «+» — сам решаешь, что качать
      const up = el('div', 'position:absolute;top:-9px;right:-7px;width:20px;height:20px;display:none;align-items:center;justify-content:center;background:#2a6b3f;border:1px solid #6fe0a0;border-radius:50%;font-size:14px;font-weight:900;color:#fff;cursor:pointer;z-index:5;', b, '+');
      up.onclick = (ev) => {
        ev.stopPropagation();
        if (net.mode === 'client') { if (myHero && canLevelAbility(myHero, i)) s2Send({ k: 'lv', i }); }
        else if (myHero) levelUpAbility(myHero, i);
      };
      b.onclick = () => playerCast(i);
      b.onmouseenter = () => showTip(myHero && myHero.abilities[i] ? myHero.abilities[i].def : null);
      b.onmouseleave = hideTip;
      ui.abils.push({ b, key, nm, cd, lvl, up });
    }
    // инвентарь (клик по активному предмету = использовать)
    const right = el('div', 'display:grid;grid-template-columns:repeat(3,44px);gap:5px;pointer-events:auto;', hud);
    ui.inv = [];
    for (let i = 0; i < 6; i++) {
      const s = el('div', 'position:relative;width:44px;height:44px;background:#141a28;border:1px solid #3a4358;border-radius:7px;font-size:8.5px;color:#cfc8b8;display:flex;align-items:center;justify-content:center;text-align:center;padding:2px;cursor:pointer;', right);
      s.onclick = () => useItemSlot(i);
      s.onmouseenter = () => {
        const id = myHero && myHero.inventory[i];
        if (!id || !ui.tip) return;
        const it = itemById(id);
        ui.tip.style.display = 'block';
        ui.tip.innerHTML = `<b style="color:#ffd34a">${it.name}</b>${it.active ? ' <span style="color:#6fc4ff">[АКТИВ — клик или B]</span>' : ''}<br><span style="color:#9fb0c8">${it.desc}</span>`;
      };
      s.onmouseleave = hideTip;
      ui.inv.push(s);
    }
    const shopBtn = el('button', 'grid-column:span 3;padding:6px;background:#3a2f14;color:#ffd34a;border:1px solid #8a6b3a;border-radius:7px;cursor:pointer;font-weight:700;', right, '🛒 Магазин (P)');
    shopBtn.onclick = toggleShop;
    // тултип
    ui.tip = el('div', 'position:absolute;bottom:170px;left:50%;transform:translateX(-50%);max-width:420px;display:none;background:rgba(10,14,22,0.95);border:1px solid #4a5468;border-radius:8px;padding:8px 12px;font-size:12px;color:#e8dfc8;z-index:40;pointer-events:none;', rootWrap);
    ui.tip.dataset.s2top = '1';
    // фид
    ui.feed = el('div', 'position:absolute;top:8px;left:10px;width:330px;z-index:20;pointer-events:none;background:rgba(10,12,18,0.55);border-radius:8px;padding:4px 0;', rootWrap);
    ui.feed.dataset.s2top = '1';
    // таймер
    ui.timer = el('div', 'position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:15px;font-weight:700;color:#e8dfc8;background:rgba(10,12,18,0.6);padding:4px 14px;border-radius:8px;z-index:20;', rootWrap);
    ui.timer.dataset.s2top = '1';
    // счёт
    ui.score = el('div', 'position:absolute;top:8px;right:190px;font-size:13px;font-weight:700;color:#e8dfc8;background:rgba(10,12,18,0.6);padding:4px 12px;border-radius:8px;z-index:20;', rootWrap);
    ui.score.dataset.s2top = '1';
    // панель выделенного юнита
    ui.selPanel = el('div', 'position:absolute;top:44px;right:10px;width:210px;display:none;background:rgba(12,16,26,0.92);border:1px solid #4a5468;border-radius:9px;padding:8px 10px;font-size:12px;color:#e8dfc8;z-index:24;', rootWrap);
    ui.selPanel.dataset.s2top = '1';
    // кнопка выхода
    const exitBtn = el('button', 'position:absolute;top:8px;right:10px;z-index:30;padding:5px 12px;background:#4a1f1f;color:#ffb0a0;border:1px solid #8a3a3a;border-radius:7px;cursor:pointer;', rootWrap, '✖ Выйти');
    exitBtn.dataset.s2top = '1';
    exitBtn.onclick = () => {
      if (net.mode !== 'off' && s2net.sock) { try { s2net.sock.emit('s2_leave'); } catch (e) {} }
      net.mode = 'off';
      showLobby();
    };
    const keysBtn = el('button', 'position:absolute;top:8px;right:96px;z-index:30;padding:5px 12px;background:#1f2a4a;color:#a0c0ff;border:1px solid #3a5a8a;border-radius:7px;cursor:pointer;', rootWrap, '⚙ Клавиши');
    keysBtn.dataset.s2top = '1';
    keysBtn.onclick = () => toggleKeysPanel();
    // миникарта
    const mm = el('canvas', 'position:absolute;right:10px;bottom:166px;width:170px;height:170px;border:1px solid #3a4358;border-radius:8px;background:#0a0e14;z-index:25;cursor:crosshair;', rootWrap);
    mm.dataset.s2top = '1';
    mm.width = 170; mm.height = 170;
    minimapCtx = mm.getContext('2d');
    mm.onclick = (ev) => {
      const r = mm.getBoundingClientRect();
      const k = MAP / r.width;
      camX = (ev.clientX - r.left - r.width / 2) * k;
      camZ = (ev.clientY - r.top - r.height / 2) * k;
    };
    buildShop();
  }

  function showTip(def) {
    if (!def || !ui.tip) return;
    ui.tip.style.display = 'block';
    ui.tip.innerHTML = `<b style="color:#ffd34a">${def.key}. ${def.name}</b> ${def.ult ? '<span style="color:#c9a0ff">[УЛЬТ]</span>' : ''}<br>` +
      `<span style="color:#9fb0c8">${def.desc || ''}</span><br>` +
      `<span style="color:#8a94a8">${def.mana ? 'Мана: ' + def.mana + ' · ' : ''}${def.cd ? 'КД: ' + def.cd + ' сек' : 'Пассивка'}</span>`;
  }
  function hideTip() { if (ui.tip) ui.tip.style.display = 'none'; }

  function buildShop() {
    const sh = el('div', 'position:absolute;right:10px;top:44px;width:290px;max-height:calc(100% - 230px);overflow:auto;display:none;background:rgba(12,16,26,0.96);border:1px solid #4a5468;border-radius:10px;padding:10px;z-index:35;', rootWrap);
    ui.shop = sh;
    sh.dataset.s2top = '1';
    el('div', 'font-size:14px;font-weight:800;color:#ffd34a;margin-bottom:8px;', sh, '🛒 Магазин (у фонтана зона лечения)');
    for (const it of ITEMS) {
      const row = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:6px;background:#141a28;border-radius:7px;margin-bottom:5px;cursor:pointer;', sh);
      row.onmouseenter = () => { ui.tip.style.display = 'block'; ui.tip.innerHTML = `<b style="color:#ffd34a">${it.name}</b><br><span style="color:#9fb0c8">${it.desc}</span>`; };
      row.onmouseleave = hideTip;
      el('div', '', row).innerHTML = `<div style="font-size:12px;font-weight:700;color:#e8dfc8">${it.name}</div><div style="font-size:10px;color:#8a94a8">${it.desc}</div>`;
      el('div', 'font-size:12px;font-weight:800;color:#ffd34a;', row, '💰' + it.cost);
      row.onclick = () => buyItem(it.id);
    }
    el('div', 'font-size:10px;color:#8a94a8;margin-top:6px;line-height:1.4;', sh, 'Покупка доступна в любом месте — курьер привезёт предмет к герою. Зона магазина у фонтана лечит.');
  }
  function toggleShop() { if (ui.shop) ui.shop.style.display = ui.shop.style.display === 'none' ? 'block' : 'none'; }

  // ---------- ПАНЕЛЬ НАСТРОЕК КЛАВИШ ----------
  function buildKeyPanel() {
    if (ui.keysPanel) ui.keysPanel.remove();
    const p = el('div', 'position:absolute;top:44px;left:50%;transform:translateX(-50%);width:330px;display:none;background:rgba(12,16,26,0.97);border:1px solid #4a5468;border-radius:10px;padding:12px;z-index:45;', rootWrap);
    ui.keysPanel = p;
    el('div', 'font-size:14px;font-weight:800;color:#ffd34a;margin-bottom:4px;', p, '⚙ Клавиши способностей');
    el('div', 'font-size:10.5px;color:#8a94a8;margin-bottom:8px;', p, 'Кликни по слоту и нажми новую клавишу. Escape — отмена.');
    ui.keyRows = [];
    ui.keyNames = [];
    for (let i = 0; i < 4; i++) {
      const row = el('div', 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 6px;background:#141a28;border-radius:7px;margin-bottom:5px;', p);
      ui.keyNames[i] = el('div', 'flex:1;font-size:12px;color:#e8dfc8;', row, '');
      ui.keyRows[i] = el('button', 'min-width:64px;padding:5px 10px;background:#2a3550;color:#fff;border:1px solid #5a6a8f;border-radius:6px;cursor:pointer;font-weight:800;font-size:13px;', row, '');
      ui.keyRows[i].onclick = () => { bindingIdx = i; refreshKeyPanel(); };
    }
    const def = el('button', 'width:100%;margin-top:4px;padding:5px;background:#3a2f14;color:#ffd34a;border:1px solid #8a6b3a;border-radius:6px;cursor:pointer;', p, 'Сбросить (Q W E R)');
    def.onclick = () => { keybinds = ['q', 'w', 'e', 'r']; saveKeys(); bindingIdx = null; refreshKeyPanel(); if (ui.hud) buildHud(); };
    refreshKeyPanel();
    return p;
  }
  function refreshKeyPanel() {
    if (!ui.keyRows) return;
    for (let i = 0; i < 4; i++) {
      const label = bindingIdx === i ? '… клавиша' : keybinds[i].toUpperCase();
      let name = 'Способность ' + (i + 1);
      if (myHero && myHero.abilities[i]) name = myHero.abilities[i].def.key + '. ' + myHero.abilities[i].def.name;
      ui.keyRows[i].textContent = label;
      ui.keyNames[i].textContent = name;
      ui.keyRows[i].style.background = bindingIdx === i ? '#5a4a1f' : '#2a3550';
    }
  }
  function toggleKeysPanel() {
    if (!ui.keysPanel) buildKeyPanel();
    ui.keysPanel.style.display = ui.keysPanel.style.display === 'none' ? 'block' : 'none';
    refreshKeyPanel();
  }

  function playerCast(i) {
    if (!myHero || !myHero.alive || match.phase !== 'live') return;
    const a = myHero.abilities[i];
    if (!a || a.lvl <= 0) { feed('Способность ещё не изучена', true); return; }
    // 3.19.0: клиент матча — отправляем команду хосту, тот кастует и вернёт визуал событием
    if (net.mode === 'client') {
      const t = a.def.type;
      if (t === 'passive') { feed('Пассивная способность — работает сама', true); return; }
      if (t === 'self') { s2Send({ k: 'ab', i }); return; }
      if (myHero.heroDef.id === 'jin' && i === 3) { // воскрешение — цель труп союзника
        const dead = units.find(x => x.isHero && !x.alive && x.team === myHero.team && x !== myHero &&
          d2(x._deathX != null ? x._deathX : x.x, x._deathZ != null ? x._deathZ : x.z, myHero.x, myHero.z) < a.def.range);
        if (!dead) { feed('Некого воскрешать рядом', true); return; }
        s2Send({ k: 'ab', i, tid: dead.name });
        return;
      }
      if (t === 'unit') {
        const e = units.filter(u2 => u2.alive && u2.team !== myHero.team && d2(u2.x, u2.z, mouseGX, mouseGZ) < 4)
          .sort((x, y) => d2(x.x, x.z, mouseGX, mouseGZ) - d2(y.x, y.z, mouseGX, mouseGZ))[0];
        if (!e) { feed('Нет врага под курсором', true); return; }
        if (d2(e.x, e.z, myHero.x, myHero.z) > a.def.range) { feed('Вне радиуса действия', true); return; }
        s2Send({ k: 'ab', i, tid: e.name });
        return;
      }
      if (d2(mouseGX, mouseGZ, myHero.x, myHero.z) > a.def.range + 2) { feed('Вне радиуса действия', true); return; }
      s2Send({ k: 'ab', i, tx: Math.round(mouseGX * 10) / 10, tz: Math.round(mouseGZ * 10) / 10 });
      return;
    }
    if (a.cdT > 0 || myHero.mana < a.def.mana) return;
    const t = a.def.type;
    if (t === 'self') castAbility(myHero, a, null);
    else if (t === 'passive') { feed('Пассивная способность — работает сама', true); return; }
    else if (t === 'unit') {
      // ближайший враг к курсору; для Джина R — ближайший павший союзник
      if (myHero.heroDef.id === 'jin' && i === 3) {
        if (!deadAllies.length) { feed('Некого воскрешать', true); return; }
        const d = deadAllies.sort((a, b) => d2(a.x, a.z, myHero.x, myHero.z) - d2(b.x, b.z, myHero.x, myHero.z))[0];
        if (d2(d.x, d.z, myHero.x, myHero.z) > a.def.range) { feed('Слишком далеко от тела союзника', true); return; }
        castAbility(myHero, a, d);
        return;
      }
      const e = units.filter(u2 => u2.alive && u2.team !== myHero.team && d2(u2.x, u2.z, mouseGX, mouseGZ) < 4)
        .sort((x, y) => d2(x.x, x.z, mouseGX, mouseGZ) - d2(y.x, y.z, mouseGX, mouseGZ))[0];
      if (!e) { feed('Нет врага под курсором', true); return; }
      if (d2(e.x, e.z, myHero.x, myHero.z) > a.def.range) { feed('Вне радиуса действия', true); return; }
      castAbility(myHero, a, e);
    }
    else if (t === 'point') {
      if (d2(mouseGX, mouseGZ, myHero.x, myHero.z) > a.def.range + 2) { feed('Вне радиуса действия', true); return; }
      castAbility(myHero, a, { x: mouseGX, z: mouseGZ });
    }
  }

  // ---------- КЛАВИШИ СПОСОБНОСТЕЙ (настраиваются, хранятся локально) ----------
  let keybinds = ['q', 'w', 'e', 'r'];
  try {
    const saved = JSON.parse(localStorage.getItem('s2keys') || 'null');
    if (Array.isArray(saved) && saved.length === 4) keybinds = saved.map(x => String(x || 'q').toLowerCase().slice(0, 1));
  } catch (e) {}
  let bindingIdx = null; // индекс слота, ожидающего нажатия клавиши
  function saveKeys() { try { localStorage.setItem('s2keys', JSON.stringify(keybinds)); } catch (e) {} }

  // ---------- КАМЕРА / ВВОД ----------
  const keys = {};
  let mouseSX = -999, mouseSY = -999; // экранные координаты мыши (для краевого скролла)
  function updateCamera(dt) {
    const pan = 30 * (camZoom / 42);
    if (keys.arrowleft || keys.a2) camX -= pan * dt;
    if (keys.arrowright || keys.d2) camX += pan * dt;
    if (keys.arrowup) camZ -= pan * dt;
    if (keys.arrowdown) camZ += pan * dt;
    // 3.18.0: краевой скролл мышью — подвёл к краю экрана, камера поехала
    if (renderer && rootWrap && rootWrap.offsetParent) {
      const r = renderer.domElement.getBoundingClientRect();
      const EDGE = 22;
      const pan2 = 68 * (camZoom / 42); // 3.19.1: заметно быстрее, как просили
      if (mouseSX >= r.left && mouseSX <= r.right && mouseSY >= r.top && mouseSY <= r.bottom) {
        if (mouseSX < r.left + EDGE) camX -= pan2 * dt;
        if (mouseSX > r.right - EDGE) camX += pan2 * dt;
        if (mouseSY < r.top + EDGE) camZ -= pan2 * dt;
        if (mouseSY > r.bottom - EDGE) camZ += pan2 * dt;
      }
    }
    if (myHero && keys.space) { camX = myHero.x; camZ = myHero.z; }
    camX = clamp(camX, -MAP / 2, MAP / 2);
    camZ = clamp(camZ, -MAP / 2, MAP / 2);
    camera.position.set(camX, camZoom, camZ + camZoom * 0.55);
    camera.lookAt(camX, 0, camZ);
    if (sunLight) { sunLight.position.set(camX + 60, 110, camZ + 40); sunLight.target.position.set(camX, 0, camZ); sunLight.target.updateMatrixWorld(); }
  }
  function groundPoint(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: mx, y: my }, camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (t < 0) return null;
    return { x: ray.ray.origin.x + ray.ray.direction.x * t, z: ray.ray.origin.z + ray.ray.direction.z * t };
  }
  function bindInput() {
    const cv = renderer.domElement;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mousemove', e => { mouseSX = e.clientX; mouseSY = e.clientY; });
    cv.addEventListener('mousemove', e => { const p = groundPoint(e); if (p) { mouseGX = p.x; mouseGZ = p.z; } });
    cv.addEventListener('mousedown', e => {
      if (!myHero || !myHero.alive || match.phase !== 'live') return;
      const p = groundPoint(e);
      if (!p) return;
      if (e.button === 0 && !attackMoveMode) {
        // 3.18.0: клик по юниту — выделение (реально «жмётся»)
        const clicked = units.filter(u2 => u2.alive && d2(u2.x, u2.z, p.x, p.z) < u2.radius + 1.4)
          .sort((a, b) => d2(a.x, a.z, p.x, p.z) - d2(b.x, b.z, p.x, p.z))[0];
        if (clicked) { selectUnit(clicked); sfx(700, 0.05, 0.04, 'sine'); }
        else { selectUnit(null); }
        rippleFx(p.x, p.z);
        return;
      }
      if (e.button === 2) { // правая — движение/атака
        const enemy = units.filter(u2 => u2.alive && u2.team !== myHero.team && d2(u2.x, u2.z, p.x, p.z) < u2.radius + 1.5)
          .sort((a, b) => d2(a.x, a.z, p.x, p.z) - d2(b.x, b.z, p.x, p.z))[0];
        if (net.mode === 'client') { // 3.19.0: команда уходит хосту
          if (attackMoveMode) { s2Send({ k: 'am', x: p.x, z: p.z }); attackMoveMode = false; cv.style.cursor = 'default'; }
          else if (enemy) s2Send({ k: 'at', id: unitRef(enemy) });
          else s2Send({ k: 'mv', x: p.x, z: p.z });
          return;
        }
        if (enemy) myHero.target = enemy;
        else { myHero.target = null; myHero.moveTarget = { x: p.x, z: p.z }; }
        if (attackMoveMode) { myHero.target = null; myHero.moveTarget = { x: p.x, z: p.z }; myHero.attackMove = true; attackMoveMode = false; cv.style.cursor = 'default'; }
      } else if (e.button === 0 && attackMoveMode) {
        if (net.mode === 'client') s2Send({ k: 'am', x: p.x, z: p.z });
        myHero.target = null; myHero.moveTarget = { x: p.x, z: p.z }; myHero.attackMove = true;
        attackMoveMode = false; cv.style.cursor = 'default';
      }
    });
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      // захват клавиши для переназначения
      if (bindingIdx != null) {
        e.preventDefault();
        if (k === 'escape') { bindingIdx = null; refreshKeyPanel(); return; }
        if (k.length === 1) {
          const prev = keybinds.indexOf(k);
          if (prev >= 0 && prev !== bindingIdx) keybinds[prev] = keybinds[bindingIdx]; // меняем местами
          keybinds[bindingIdx] = k;
          saveKeys();
        }
        bindingIdx = null;
        refreshKeyPanel();
        if (ui.hud) buildHud(); // перерисовать кнопки с новыми клавишами
        return;
      }
      if (k === 'escape') { toggleEscMenu(); return; } // 3.19.1: меню по ESC
      keys[k] = true;
      if (e.key === ' ') { keys.space = true; e.preventDefault(); }
      if (match.phase !== 'live') return;
      for (let i = 0; i < 4; i++) if (k === keybinds[i]) playerCast(i);
      if (k === 'p') toggleShop();
      if (k === 'b') useFirstActive(); // 3.19.0: активный предмет (блинк)
      if (k === 'a') { attackMoveMode = true; if (renderer) renderer.domElement.style.cursor = 'crosshair'; }
      if (k === 's') { // стоп
        if (net.mode === 'client') s2Send({ k: 'stop' });
        if (myHero) { myHero.moveTarget = null; myHero.target = null; }
      }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key === ' ') keys.space = false; });
    cv.addEventListener('wheel', e => { camZoom = clamp(camZoom + (e.deltaY > 0 ? 4 : -4), 26, 64); }, { passive: true });
  }

  // ---------- МИНИКАРТА ----------
  function drawMinimap() {
    if (!minimapCtx) return;
    const g = minimapCtx, W = 170, k = W / MAP;
    const px = v => (v + MAP / 2) * k;
    g.fillStyle = '#22301c'; g.fillRect(0, 0, W, W);
    // река
    g.strokeStyle = '#3f6f9f'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(px(MAP / 2), 0); g.lineTo(0, px(MAP / 2)); g.stroke(); // диагональ x+z=0
    // линии
    g.strokeStyle = '#6b5a3f'; g.lineWidth = 3;
    for (const key of ['top', 'mid', 'bot']) {
      const pts = LANES[key];
      g.beginPath(); g.moveTo(px(pts[0][0]), px(pts[0][1]));
      for (let i = 1; i < pts.length; i++) g.lineTo(px(pts[i][0]), px(pts[i][1]));
      g.stroke();
    }
    // базы
    g.fillStyle = '#3f9fe0'; g.beginPath(); g.arc(px(BASE_R.x), px(BASE_R.z), 7, 0, 7); g.fill();
    g.fillStyle = '#e04a3f'; g.beginPath(); g.arc(px(BASE_D.x), px(BASE_D.z), 7, 0, 7); g.fill();
    // вышки
    for (const u of units) {
      if (!u.alive) continue;
      if (u.isTower) { g.fillStyle = u.team === 'r' ? '#7fc4f0' : '#f08a7a'; g.fillRect(px(u.x) - 2.5, px(u.z) - 2.5, 5, 5); }
      else if (u.isAncient) { g.fillStyle = u.team === 'r' ? '#bfe4ff' : '#ffc8b8'; g.beginPath(); g.arc(px(u.x), px(u.z), 4, 0, 7); g.fill(); }
    }
    // юниты
    for (const u of units) {
      if (!u.alive || u.isTower || u.isAncient || u.isCourier) continue;
      if (u.isHero) g.fillStyle = u.team === 'r' ? '#3fd0ff' : '#ff5a4a';
      else g.fillStyle = u.team === 'r' ? '#3f8fd0' : '#d05a4a';
      g.beginPath(); g.arc(px(u.x), px(u.z), u.isHero ? 3 : 1.6, 0, 7); g.fill();
    }
    // камера
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1;
    g.strokeRect(px(camX) - 14, px(camZ) - 10, 28, 20);
  }

  // ---------- ОБНОВЛЕНИЕ HUD ----------
  function updateHud() {
    if (!ui.hud) return;
    const t = Math.floor(match.time);
    ui.timer.textContent = `${Math.floor(t / 60)}:${('0' + t % 60).slice(-2)}`;
    const kr = units.filter(u => u.isHero && u.team === 'r').reduce((s, u) => s + u.kills, 0);
    const kd = units.filter(u => u.isHero && u.team === 'd').reduce((s, u) => s + u.kills, 0);
    ui.score.textContent = `Radiant ${kr} : ${kd} Dire`;
    if (!myHero) { // 3.19.1: зритель — свободная камера, панели героя нет
      if (ui.heroName && !ui.heroName.dataset.spec) { ui.heroName.dataset.spec = '1'; ui.heroName.textContent = '👁 ЗРИТЕЛЬ · свободная камера (стрелки / край экрана)'; ui.hpText.textContent = ''; ui.goldText.textContent = ''; ui.xpText.textContent = ''; }
      return;
    }
    ui.heroName.textContent = `${myHero.name} — ${myHero.heroDef.name} · Ур. ${myHero.lvl}` + ((myHero.skillPts || 0) > 0 ? ` · ⬆ очков: ${myHero.skillPts}` : '');
    ui.hpFill.style.width = clamp(myHero.hp / myHero.maxHp * 100, 0, 100) + '%';
    ui.hpText.textContent = `${Math.ceil(myHero.hp)} / ${myHero.maxHp}` + (myHero.shieldHp > 0 ? ` (+${Math.ceil(myHero.shieldHp)} щит)` : '');
    ui.mpFill.style.width = clamp(myHero.mana / myHero.maxMana * 100, 0, 100) + '%';
    const nextXp = myHero.lvl < 15 ? XP_LEVELS[myHero.lvl] : null;
    ui.xpText.textContent = `Опыт: ${myHero.xp}` + (nextXp != null ? ` / ${nextXp} (до уровня ${myHero.lvl + 1})` : ' (МАКС)') +
      ` · Добито: ${myHero.lh} · K/D/A: ${myHero.kills}/${myHero.deaths}/${myHero.assists || 0}`;
    ui.goldText.textContent = `💰 ${Math.floor(myHero.gold)}`;
    for (let i = 0; i < 4; i++) {
      const A = ui.abils[i], a = myHero.abilities[i];
      if (!a) continue;
      A.key.textContent = keybinds[i].toUpperCase();
      A.nm.textContent = a.def.name.split(' ')[0];
      A.lvl.textContent = a.def.type === 'passive' ? 'П' : (a.lvl > 0 ? 'Ур.' + a.lvl : '—');
      if (A.up) A.up.style.display = canLevelAbility(myHero, i) ? 'flex' : 'none';
      if (a.cdT > 0) { A.cd.style.display = 'flex'; A.cd.textContent = Math.ceil(a.cdT); }
      else A.cd.style.display = 'none';
      A.b.style.borderColor = a.lvl > 0 ? (a.def.mana <= myHero.mana ? '#5a8f5a' : '#8a5a3a') : '#3a4358';
    }
    for (let i = 0; i < 6; i++) {
      const it = myHero.inventory[i];
      const slot = ui.inv[i];
      slot.textContent = it ? itemById(it).name : '';
      slot.style.borderColor = it && itemById(it).active ? '#4a7ab0' : '#3a4358';
      const cd = it && myHero.itemCd[it] > 0 ? Math.ceil(myHero.itemCd[it]) : 0;
      slot.style.color = cd ? '#ffb060' : '#cfc8b8';
      if (cd) slot.textContent = itemById(it).name + ' · ' + cd + 'с';
    }
  }

  // ---------- ЛОББИ (сетевое: места, стороны Свет/Тьма, выбор героя, старт хостом) ----------
  const s2net = { sock: null, state: null, connected: false, myHero: (function () { try { return localStorage.getItem('s2hero'); } catch (e) { return null; } })() || 'silva', inLobbyUi: false };
  function s2Connect() {
    if (typeof io !== 'function') return;
    if (!s2net.sock) {
      const sock = io(S2_SERVER, { reconnectionAttempts: Infinity });
      s2net.sock = sock;
      sock.on('connect', () => { s2net.connected = true; sock.emit('s2_join', myNick()); if (s2net.inLobbyUi) renderLobby(); });
      sock.on('disconnect', () => { s2net.connected = false; if (s2net.inLobbyUi) renderLobby(); });
      sock.on('s2_lobby', (st) => { s2net.state = st; if (s2net.inLobbyUi) renderLobby(); });
      sock.on('s2_start', ({ comp }) => {
        s2net.inLobbyUi = false;
        const old = rootWrap.querySelector('[data-lobby]'); if (old) old.remove();
        setupMatch(comp, isHost()); // 3.19.0: хост считает мир, клиенты рисуют по снапшотам
      });
      // --- 3.19.0: синхронизация матча ---
      sock.on('s2_in', ({ nick, data }) => { if (net.mode === 'host') hostApplyInput(nick, data); });
      sock.on('s2_st', (snap) => { if (net.mode === 'client') applySnapshot(snap); });
      sock.on('s2_ev', (ev) => {
        if (net.mode !== 'client' || !ev) return;
        if (ev.k === 'f') feed(ev.m, ev.i);
        else if (ev.k === 'c') clientReplayCast(ev);
        else if (ev.k === 'rs') { // хост перезапустил матч
          if (lastComp != null) { setupMatch(lastComp, false); feed('🔁 Хост начал матч заново!'); }
        }
      });
      sock.on('s2_end', (winner) => {
        if (net.mode !== 'client' || match.phase === 'over') return;
        endMatch(winner);
      });
      sock.on('s2_abort', () => {
        if (net.mode === 'off') return;
        net.mode = 'off';
        match.phase = 'menu';
        feed('Матч прерван — хост вышел', true);
        showLobby();
      });
      sock.on('s2_left', ({ nick }) => { // игрок вышел — хост отдаёт героя боту
        if (net.mode !== 'host') return;
        const h = units.find(x => x.isHero && x.name.toLowerCase() === String(nick || '').toLowerCase());
        if (h && !h.bot) { h.bot = true; h.remote = false; feed('🤖 ' + h.name + ' вышел — героя ведёт бот'); }
      });
    }
    if (s2net.connected) s2net.sock.emit('s2_join', myNick());
  }
  function myLobbyEntry() {
    if (!s2net.state) return null;
    return s2net.state.players.find(p => p.nick.toLowerCase() === myNick().toLowerCase()) || null;
  }
  function isHost() {
    const me = myLobbyEntry();
    return !!(me && s2net.state && s2net.state.host === me.id);
  }

  // ---------- 3.19.0: СЕТЕВАЯ СИНХРОНИЗАЦИЯ МАТЧА (хост — источник правды) ----------
  // mode: 'off' соло · 'host' мы считаем мир и шлём снапшоты · 'client' рисуем чужой мир и шлём ввод
  const net = { mode: 'off', snapT: 0 };
  const s2Send = (o) => { if (s2net.sock && s2net.connected) { try { s2net.sock.emit('s2_in', o); } catch (e) {} } };

  function packSnapshot() {
    const u = [];
    for (const x of units) {
      const px = Math.round(x.x * 10) / 10, pz = Math.round(x.z * 10) / 10;
      const hp = Math.round(x.hp), al = x.alive ? 1 : 0;
      const atk = x.atkAnimT > 0 ? 1 : 0;
      if (x.isHero) {
        u.push([0, x.name, x.team, px, pz, hp, al, x.lvl, Math.floor(x.gold), Math.round(x.mana),
          x.kills, x.deaths, x.lh, x.xp, x.inventory.join('.'),
          x.abilities.map(a => Math.round(a.cdT * 10) / 10), atk,
          x.abilities.map(a => a.lvl), x.assists || 0, x.skillPts || 0]);
      } else if (x.isTower) {
        u.push([1, x.team + ':' + x.lane + ':' + x.tier, x.team, px, pz, hp, al]);
      } else if (x.isAncient) {
        u.push([2, x.team, x.team, px, pz, hp, al]);
      } else if (x.isCreep) {
        u.push([3, x.id, x.team, px, pz, hp, al, x.atkRange > 6 ? 1 : 0, atk]);
      } else if (x.isSummon) {
        u.push([4, x.id, x.team, px, pz, hp, al, 0, atk, x.name]);
      } else if (x.isCourier) {
        u.push([5, x.id, x.team, px, pz, 1, 1, Math.round((x.y || 2.4) * 10) / 10]);
      }
    }
    return { t: Math.round(match.time * 10) / 10, w: Math.round(match.waveT * 10) / 10, u };
  }

  function applyBasicSnap(x, e) {
    // возрождение/респаун — телепорт, а не бег от места смерти
    if (e[6] && !x.alive) { x.x = e[3]; x.z = e[4]; }
    x.netTX = e[3]; x.netTZ = e[4];
    x.hp = e[5];
    x.alive = !!e[6];
    if (e[8]) x.atkAnimT = 0.35;
  }

  function createClientUnit(e) {
    let x = null;
    if (e[0] === 3) {
      x = makeUnit({ team: e[2], x: e[3], z: e[4], isCreep: true, ranged: !!e[7] });
    } else if (e[0] === 4) {
      x = makeUnit({ team: e[2], x: e[3], z: e[4], isSummon: true, name: e[9] || 'Призыв' });
    } else if (e[0] === 5) {
      x = makeUnit({ team: e[2], x: e[3], z: e[4], isCourier: true, name: 'Курьер' });
      makeCourierMesh(x);
    }
    if (x) x.netId = e[1];
    return x;
  }

  function applySnapshot(snap) {
    if (!snap || !Array.isArray(snap.u)) return;
    match.time = snap.t; match.waveT = snap.w;
    const seen = {};
    for (const e of snap.u) {
      if (e[0] === 0) {
        const h = units.find(x => x.isHero && x.name === e[1]);
        if (!h) continue;
        applyBasicSnap(h, e);
        h.lvl = e[7]; h.gold = e[8]; h.mana = e[9];
        h.kills = e[10]; h.deaths = e[11]; h.lh = e[12]; h.xp = e[13];
        h.assists = e[18] || 0;
        h.skillPts = e[19] || 0;
        const inv = String(e[14] || '').split('.').filter(Boolean);
        if (inv.join('.') !== h.inventory.join('.')) { h.inventory = inv; recalcStats(h); }
        const cds = e[15] || [];
        for (let i = 0; i < 4; i++) {
          if (!h.abilities[i]) continue;
          h.abilities[i].cdT = cds[i] || 0;
          if (e[17] && e[17][i] != null) h.abilities[i].lvl = e[17][i];
        }
        seen[h.id] = 1;
      } else if (e[0] === 1) {
        const t = units.find(x => x.isTower && (x.team + ':' + x.lane + ':' + x.tier) === e[1]);
        if (t) { applyBasicSnap(t, e); seen[t.id] = 1; }
      } else if (e[0] === 2) {
        const a = units.find(x => x.isAncient && x.team === e[1]);
        if (a) { applyBasicSnap(a, e); seen[a.id] = 1; }
      } else {
        let x = units.find(u2 => u2.netId === e[1]);
        if (!x) x = createClientUnit(e);
        if (!x) continue;
        applyBasicSnap(x, e);
        if (e[0] === 5) x.y = e[7] || 2.4;
        seen[x.id] = 1;
      }
    }
    // пропавшие из мира хоста (сдохшие крипы/призывы/курьеры) — убрать
    for (const x of units.slice()) {
      if (x.isHero || x.isTower || x.isAncient) continue;
      if (!seen[x.id]) {
        if (x.mesh) scene.remove(x.mesh);
        units.splice(units.indexOf(x), 1);
        const ci = couriers.indexOf(x);
        if (ci >= 0) couriers.splice(ci, 1);
      }
    }
  }

  // лёгкий тик клиента: интерполяция к снапшоту + анимации, без игровой логики
  function clientTick(dt) {
    for (const x of units.slice()) {
      if (!x.alive) {
        if (x._wasAlive !== false) {
          x._wasAlive = false;
          if (x.rig && x.rig.actions.death) { x.hideAt = clockT + 1.5; playAnim(x, 'death', 0.1); }
          else if (x.mesh) x.mesh.visible = false;
        }
        if (x.rig) {
          x.rig.mixer.update(dt);
          if (x.hideAt && clockT > x.hideAt && x.mesh) x.mesh.visible = false;
        }
        updateHpBar(x);
        continue;
      }
      if (x._wasAlive === false) { // возродился
        x._wasAlive = true;
        x.x = x.netTX != null ? x.netTX : x.x;
        x.z = x.netTZ != null ? x.netTZ : x.z;
        if (x.mesh) x.mesh.visible = true;
        if (x.rig) playAnim(x, 'idle', 0);
      }
      x.atkAnimT = Math.max(0, (x.atkAnimT || 0) - dt);
      if (x.netTX != null) {
        const k = Math.min(1, dt * 9);
        const ox = x.x, oz = x.z;
        x.x += (x.netTX - x.x) * k;
        x.z += (x.netTZ - x.z) * k;
        x.moving = d2(ox, oz, x.x, x.z) > 0.03;
        if (x.moving && x.mesh) x.mesh.rotation.y = Math.atan2(x.x - ox, x.z - oz);
      }
      tickRig(x, dt);
      updateHpBar(x);
      syncMesh(x);
    }
  }

  // хост применяет ввод удалённого игрока к его герою
  function hostApplyInput(nick, d) {
    if (!d || typeof d.k !== 'string') return;
    const h = units.find(x => x.isHero && x.name.toLowerCase() === String(nick || '').toLowerCase());
    if (!h) return;
    if (h.bot) { h.bot = false; feed('🎮 ' + h.name + ' вернулся в матч'); }
    h.remote = true;
    if (d.k === 'mv') { h.target = null; h.attackMove = false; h.moveTarget = { x: +d.x || 0, z: +d.z || 0 }; }
    else if (d.k === 'am') { h.target = null; h.attackMove = true; h.moveTarget = { x: +d.x || 0, z: +d.z || 0 }; }
    else if (d.k === 'at') {
      let t = null;
      if (typeof d.id === 'string') { // 'A:r' — древний; иначе имя юнита/героя
        if (d.id.charAt(0) === 'A') t = units.find(x => x.isAncient && x.team === d.id.slice(2));
        else t = units.find(x => x.name === d.id);
      } else t = units.find(x => x.id === d.id);
      if (t && t.alive) { h.target = t; h.moveTarget = null; }
    }
    else if (d.k === 'stop') { h.target = null; h.moveTarget = null; }
    else if (d.k === 'ab') {
      const a = h.abilities[+d.i];
      if (!a) return;
      let tgt = null;
      if (d.tid) {
        tgt = units.find(x => x.name === d.tid);
        // труп союзника (воскрешение) — упаковать ссылку как ожидает revive()
        if (tgt && !tgt.alive && tgt.isHero) tgt = { x: tgt._deathX != null ? tgt._deathX : tgt.x, z: tgt._deathZ != null ? tgt._deathZ : tgt.z, ref: units.find(x => x.name === d.tid) };
      } else if (d.tx != null) {
        tgt = { x: +d.tx || 0, z: +d.tz || 0 };
      }
      if (a.def.type === 'self') castAbility(h, a, null);
      else if (tgt) castAbility(h, a, tgt);
    }
    else if (d.k === 'buy') heroBuyItem(h, String(d.id || '').slice(0, 24));
    else if (d.k === 'item') useItemSlot(+d.i, h, d.x != null ? +d.x : null, d.z != null ? +d.z : null);
    else if (d.k === 'lv') levelUpAbility(h, +d.i); // 3.19.1: игрок сам качает скилы
  }

  // ссылка на юнита для отправки хосту: динамика — netId, структуры — ключ
  function unitRef(x) {
    if (x.isAncient) return 'A:' + x.team;
    if (x.isTower) return 'T:' + x.team + ':' + x.lane + ':' + x.tier;
    if (x.isHero) return x.name;
    return x.netId != null ? x.netId : x.id;
  }

  // повтор каста на клиенте (только визуал — урон выключен dealDamage)
  function clientReplayCast(ev) {
    const h = units.find(x => x.isHero && x.name === ev.nm);
    if (!h || !h.abilities[ev.i]) return;
    let tgt = null;
    if (ev.tid) tgt = units.find(x => x.name === ev.tid) || { x: ev.tx, z: ev.tz };
    else if (ev.tx != null) tgt = { x: ev.tx, z: ev.tz };
    if (h.abilities[ev.i].def.type === 'self') castAbility(h, h.abilities[ev.i], null);
    else if (tgt) castAbility(h, h.abilities[ev.i], tgt);
  }

  function showLobby() {
    match.phase = 'menu';
    net.mode = 'off';
    rootWrap.querySelectorAll('[data-s2top]').forEach(e => e.remove());
    const old = rootWrap.querySelector('[data-lobby]'); if (old) old.remove();
    const wrap = el('div', 'position:absolute;inset:0;overflow:auto;background:linear-gradient(160deg,#101826,#0a0e16);z-index:50;padding:16px;', rootWrap);
    wrap.dataset.lobby = '1';
    s2net.inLobbyUi = true;
    ui.lobbyWrap = wrap;
    if (!s2net.connected && typeof io === 'function') s2Connect();
    renderLobby();
  }

  function heroCard(h, onPick, small) {
    const card = el('div', 'position:relative;background:#141c2c;border:1px solid #3a4358;border-radius:10px;padding:8px;cursor:pointer;text-align:center;' + (small ? 'width:86px;' : ''), null);
    if (h.portrait) {
      const img = el('img', 'width:100%;border-radius:8px;display:block;background:#18223a;', card);
      img.src = h.portrait;
      img.draggable = false;
    } else {
      el('div', 'height:64px;border-radius:8px;background:linear-gradient(160deg,#22304a,#141c2c);display:flex;align-items:center;justify-content:center;font-size:26px;', card, h.name.split(' ').map(w => w[0]).join(''));
    }
    el('div', 'font-size:' + (small ? '10px' : '12px') + ';font-weight:800;color:#e8dfc8;margin-top:5px;', card, h.name);
    if (!small) el('div', 'font-size:10px;color:#7f9fc8;', card, h.role);
    card.onmouseenter = () => { card.style.borderColor = '#6fe0a0'; card.style.transform = 'scale(1.05)'; };
    card.onmouseleave = () => { card.style.borderColor = s2net.myHero === h.id ? '#6fe0a0' : '#3a4358'; card.style.transform = ''; };
    if (s2net.myHero === h.id) card.style.borderColor = '#6fe0a0';
    card.onclick = () => onPick(h.id);
    return card;
  }

  function renderLobby() {
    const wrap = ui.lobbyWrap;
    if (!wrap || !wrap.isConnected && !wrap.parentNode) return;
    wrap.innerHTML = '';
    el('div', 'font-size:28px;font-weight:900;color:#e8dfc8;text-align:center;text-shadow:0 3px 12px rgba(0,0,0,0.6);', wrap, '🛡 SUPPORT 2 — ЛОББИ');
    const status = s2net.connected
      ? (s2net.state ? `На сервере: ${s2net.state.players.length}` : 'Соединено')
      : (typeof io === 'function' ? 'Подключение к серверу…' : 'Нет подключения (соло-режим)');
    el('div', 'font-size:12px;color:' + (s2net.connected ? '#7fe08a' : '#e0a05a') + ';text-align:center;margin:2px 0 10px;', wrap, '● ' + status);

    const me = myLobbyEntry();
    const players = (s2net.state && s2net.state.players) || [];

    // --- две стороны: СВЕТ и ТЬМА ---
    const sides = el('div', 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap;', wrap);
    for (const side of [{ team: 'r', title: '☀️ СВЕТ (Radiant)', color: '#7fc4f0' }, { team: 'd', title: '🌑 ТЬМА (Dire)', color: '#f08a7a' }]) {
      const col = el('div', 'width:300px;background:#101624;border:1px solid #2a3550;border-radius:12px;padding:10px;', sides);
      el('div', 'font-size:15px;font-weight:900;text-align:center;color:' + side.color + ';margin-bottom:8px;', col, side.title);
      const members = players.filter(p => p.team === side.team);
      for (let i = 0; i < 5; i++) {
        const p = members[i];
        const seat = el('div', 'display:flex;align-items:center;gap:8px;background:#141c2c;border:1px solid #2a3550;border-radius:8px;padding:6px 8px;margin-bottom:6px;min-height:40px;', col);
        if (p) {
          const hd = heroById(p.hero);
          if (hd && hd.portrait) { const im = el('img', 'width:30px;height:34px;border-radius:5px;background:#18223a;', seat); im.src = hd.portrait; im.draggable = false; }
          const isMe2 = p.nick.toLowerCase() === myNick().toLowerCase();
          el('div', 'flex:1;font-size:12.5px;font-weight:700;color:' + (isMe2 ? '#6fe0a0' : '#e8dfc8') + ';', seat, p.nick + (isMe2 ? ' (ты)' : ''));
          el('div', 'font-size:10.5px;color:#8a94a8;', seat, hd ? hd.name.split(' ')[0] : '—');
        } else {
          el('div', 'flex:1;font-size:11.5px;color:#4a5468;', seat, 'Свободное место…');
          const take = el('button', 'padding:4px 10px;background:#1f2a44;color:#a0c0ff;border:1px solid #3a5a8a;border-radius:6px;cursor:pointer;font-size:11px;', seat, 'Сесть');
          take.onclick = () => { if (s2net.sock) s2net.sock.emit('s2_seat', { team: side.team }); };
        }
      }
    }

    // --- зрители без стороны ---
    const noTeam = players.filter(p => !p.team);
    if (noTeam.length) {
      const row = el('div', 'margin:8px auto 0;max-width:640px;background:#101624;border:1px solid #2a3550;border-radius:10px;padding:8px 12px;text-align:center;', wrap);
      el('span', 'font-size:12px;color:#8a94a8;', row, 'Без стороны: ');
      noTeam.forEach((p, i) => el('span', 'font-size:12px;color:' + (p.nick.toLowerCase() === myNick().toLowerCase() ? '#6fe0a0' : '#e8dfc8') + ';', row, (i ? ', ' : '') + p.nick));
    }

    // --- мои кнопки ---
    const btns = el('div', 'display:flex;gap:10px;justify-content:center;margin:12px 0;flex-wrap:wrap;', wrap);
    if (me && me.team) {
      const leave = el('button', 'padding:8px 18px;background:#3a2f14;color:#ffd34a;border:1px solid #8a6b3a;border-radius:8px;cursor:pointer;font-weight:700;', btns, 'Встать с места');
      leave.onclick = () => { if (s2net.sock) s2net.sock.emit('s2_seat', { team: null }); };
    }
    const solo = el('button', 'padding:8px 18px;background:#14203a;color:#a0c0ff;border:1px solid #3a5a8a;border-radius:8px;cursor:pointer;font-weight:700;', btns, '🤖 Соло с ботами');
    solo.onclick = () => { s2net.inLobbyUi = false; wrap.remove(); showPick(); };

    // --- кнопка старта (только хост) ---
    const readyCnt = players.filter(p => p.team && p.hero).length;
    if (isHost()) {
      const start = el('button', 'padding:12px 40px;background:#2a6b3f;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:900;font-size:16px;display:block;margin:0 auto;', wrap, `▶ НАЧАТЬ МАТЧ (${readyCnt} готовы)`);
      start.onclick = () => { if (s2net.sock) s2net.sock.emit('s2_start'); };
    } else if (s2net.connected) {
      el('div', 'font-size:12.5px;color:#8a94a8;text-align:center;margin:4px 0;', wrap, s2net.state && s2net.state.host ? 'Ожидание хоста… (начинает Fifflaren или первый зашедший)' : 'Ожидание игроков…');
    }

    // --- выбор героя с портретами ---
    el('div', 'font-size:14px;font-weight:800;color:#e8dfc8;text-align:center;margin:10px 0 6px;', wrap, 'Твой герой (клик — выбрать, в матче играешь за него):');
    const grid = el('div', 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;max-width:900px;margin:0 auto;', wrap);
    for (const h of HEROES) grid.appendChild(heroCard(h, (id) => {
      s2net.myHero = id;
      try { localStorage.setItem('s2hero', id); } catch (e) {}
      if (s2net.sock && s2net.connected) s2net.sock.emit('s2_pick', id);
      renderLobby();
    }, true));
  }

  // ---------- ЭКРАН ВЫБОРА ГЕРОЯ (соло) ----------
  function showPick() {
    match.phase = 'menu';
    net.mode = 'off';
    rootWrap.querySelectorAll('[data-s2top]').forEach(e => e.remove());
    ui.hud = null; ui.shop = null; ui.feed = null; ui.timer = null; ui.score = null; ui.tip = null; minimapCtx = null;
    rootWrap.querySelectorAll('canvas').forEach(c => { if (c !== renderer.domElement) c.remove(); });
    const old = rootWrap.querySelector('[data-pick]'); if (old) old.remove();
    const oldOv = rootWrap.querySelectorAll('div'); // чистим оверлеи по необходимости
    const wrap = el('div', 'position:absolute;inset:0;overflow:auto;background:linear-gradient(160deg,#101826,#0a0e16);z-index:50;padding:18px;display:flex;flex-direction:column;align-items:center;', rootWrap);
    wrap.dataset.pick = '1';
    el('div', 'font-size:30px;font-weight:900;color:#e8dfc8;text-shadow:0 3px 12px rgba(0,0,0,0.6);', wrap, '🛡 SUPPORT 2');
    el('div', 'font-size:13px;color:#8a94a8;margin:4px 0 14px;', wrap, 'Выбери героя · 3 линии · крипы каждые 30 сек · добивай крипов для золота · сломай трон врага');
    const grid = el('div', 'display:grid;grid-template-columns:repeat(6,120px);gap:10px;justify-content:center;max-width:900px;', wrap);
    for (const h of HEROES) {
      const card = heroCard(h, () => { wrap.remove(); setupMatch(h.id); });
      el('div', 'font-size:10px;color:#8a94a8;margin-top:6px;line-height:1.45;', card,
        h.role + ' · HP ' + h.hp + ' · Урон ' + h.dmg + '\n' + h.abilities.map(a => `${a.key}: ${a.name}`).join(' · ') + '\nКомбо: ' + h.combo).style.whiteSpace = 'pre-line';
      grid.appendChild(card);
    }
    const backBtn = el('button', 'position:absolute;top:12px;left:14px;padding:7px 14px;background:#1f2a4a;color:#a0c0ff;border:1px solid #3a5a8a;border-radius:8px;cursor:pointer;font-weight:700;z-index:55;', wrap, '← В лобби');
    backBtn.onclick = (ev) => { ev.stopPropagation(); wrap.remove(); showLobby(); };
    const keysBtn = el('button', 'position:absolute;top:12px;right:14px;padding:7px 14px;background:#1f2a4a;color:#a0c0ff;border:1px solid #3a5a8a;border-radius:8px;cursor:pointer;font-weight:700;z-index:55;', wrap, '⚙ Клавиши');
    keysBtn.onclick = (ev) => { ev.stopPropagation(); toggleKeysPanel(); };
    el('div', 'font-size:11px;color:#5a6478;margin-top:14px;', wrap,
      `Правая кнопка — движение/атака · Способности: ${keybinds.map(k => k.toUpperCase()).join(' ')} (ульт с 6 ур., меняется в ⚙ Клавиши) · A — атака-движение · P — магазин · Колесо — зум · Пробел — к герою · Стрелки — камера`);
  }

  // ---------- ГЛАВНЫЙ ЦИКЛ ----------
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (!rootWrap || !rootWrap.offsetParent) { lastTs = ts; return; } // вкладка скрыта — пауза
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    clockT += dt;
    if (match.phase === 'live') {
      if (net.mode === 'client') {
        // 3.19.0: клиент матча — интерполяция снапшотов + визуальные снаряды/зоны (без урона)
        clientTick(dt);
        tickProjectiles(dt);
        tickZones(dt);
      } else {
        match.time += dt;
        match.waveT -= dt;
        if (match.waveT <= 0) { match.waveT = 30; spawnWave(); feed('⚔️ Новая волна крипов!'); }
        for (const u of units.slice()) tickUnit(u, dt);
        tickProjectiles(dt);
        tickZones(dt);
        tickCorpses(dt);
        // 3.19.0: хост шлёт снапшот мира клиентам ~10 раз/сек
        if (net.mode === 'host' && s2net.sock && s2net.connected) {
          net.snapT -= dt;
          if (net.snapT <= 0) { net.snapT = 0.1; try { s2net.sock.emit('s2_st', packSnapshot()); } catch (e) {} }
        }
      }
    }
    tickEffects(dt);
    // вода
    if (waterGeo) {
      const pos = waterGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, Math.sin(clockT * 1.6 + pos.getX(i) * 0.35) * 0.22);
      }
      pos.needsUpdate = true;
    }
    updateCamera(dt);
    updateHud();
    updateSelPanel();
    // полный экран пока вкладка игры открыта
    const vis = rootWrap.offsetParent != null;
    if (vis !== fsActive) { fsActive = vis; if (ipcR) ipcR.send('s2-fullscreen', vis); }
    if (Math.floor(clockT * 5) !== Math.floor((clockT - dt) * 5)) drawMinimap();
    renderer.render(scene, camera);
  }

  function resizeS2() {
    if (!renderer || !rootWrap) return;
    const w = rootWrap.clientWidth || 900, h = rootWrap.clientHeight || 560;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------- ТОЧКА ВХОДА ----------
  function open(u) {
    user = u || { nickname: 'Игрок' };
    if (!rootWrap) {
      const tab = document.getElementById('tab-support2');
      if (!tab) return;
      tab.innerHTML = '';
      rootWrap = el('div', 'position:relative;width:100%;height:calc(100vh - 210px);min-height:480px;overflow:hidden;background:#0a0e14;', tab);
      buildScene();
      bindInput();
      loadS2Models();
      window.addEventListener('resize', resizeS2);
    }
    resizeS2();
    if (match.phase !== 'live') showLobby();
    if (!rafId) { lastTs = performance.now(); rafId = requestAnimationFrame(loop); }
  }
  window.__s2Open = open;
})();
