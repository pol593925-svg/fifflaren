const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const T = require('../cs16-terrain'),
  B = require('../cs16-buildings'),
  E = require('../cs16-environment'),
  Q = require('../cs16-adaptive-quality'),
  A = require('../cs16-weapon-animation');
const server = path.resolve(__dirname, '../../support-hub-server'),
  Field = require(path.join(server, 'cs16-environment-server'));
const source = fs.readFileSync(path.join(__dirname, '../cs16.js'), 'utf8'),
  rows = vm.runInNewContext('(' + source.match(/const MAP_ROWS = (\{[\s\S]*?\n  \});/)[1] + ')');
const cells = { '#': 1, '.': 0, D: 2, C: 3, 4: 4, 5: 5, 6: 6, 7: 7, V: 8, B: 9, S: 10, T: 11 };
for (const name of ['cs16-terrain.js', 'cs16-buildings.js', 'cs16-environment.js', 'cs16-props.js'])
  assert(
    fs.readFileSync(path.join(__dirname, '..', name)).equals(fs.readFileSync(path.join(server, name))),
    name + ' mismatch',
  );
for (const [map, lines] of Object.entries(rows)) {
  const grid = lines.map((row) => Array.from(row, (c) => cells[c])),
    replica = () =>
      B.layout(
        grid.map((r) => r.slice()),
        map,
      );
  const data = B.layout(grid, map),
    a = replica(),
    b = replica(),
    features = T.layout(grid);
  console.log(map, features.map((p) => p.kind + '@' + p.x + ',' + p.z).join(' '));
  if(require('../cs16-tactical-map').identify(grid)){
    assert.equal(features.length,0,'authored round arenas use explicit tunnels, not legacy random gullies');
    for(const team of ['t','ct']){const pos=require('../cs16-tactical-map').spawn(map,team);assert.equal(T.walkHeight(grid,pos[0],pos[2]),0);}
  }else{
    assert(features.length >= 3);
    assert(features.some((p) => p.kind === 'gully'));
  }
  for (const p of features) {
    assert(Math.abs(T.height(grid, p.x, p.z) - p.amplitude) < 1e-6);
    assert.equal(T.height(grid, p.x + p.r, p.z), 0);
    if (p.kind === 'gully') {
      assert.equal(T.walkHeight(grid, p.x, p.z), 0);
      assert.equal(B.vertical(grid, map, p.x, p.z, 0).floor, 0);
    } else assert(Math.abs(T.ray(grid, [p.x, 5, p.z], [0, -1, 0], 10) - (5 - p.amplitude)) < 0.003);
  }
  const door = data.environment.doors[0],
    house = data.buildings[0],
    player = { alive: true, team: 'ct', lx: door.x, ly: 0, lz: door.z - 2 },
    other = { alive: true, team: 't', lx: door.x + 9, ly: 0, lz: door.z + 14 };
  const state = {
    map,
    phase: 'live',
    players: new Map([
      ['1', player],
      ['2', other],
    ]),
  };
  let clock = 10000,
    events = [];
  const service = Field.create({
    state,
    grid: () => grid,
    now: () => clock,
    emit: (event, d) => {
      assert.equal(event, 'cs16_environment');
      events.push(d);
      E.apply(a, d);
      E.apply(b, d);
    },
  });
  assert(!service.door(other, door.id));
  other.lx = door.x;
  other.lz = door.z;
  assert(!service.door(player, door.id), 'occupied threshold');
  other.lz += 9;
  assert(service.door(player, door.id));
  assert.deepEqual(E.snapshot(a), E.snapshot(b));
  assert(E.snapshot(b).closed.includes(door.id));
  assert.equal(
    require(path.join(server, 'cs16-buildings')).hit(grid, map, [door.x, 1.4, door.z - 2], [0, 0, 1], 4).id,
    door.id,
  );
  assert(!service.door(player, door.id));
  clock += 600;
  assert(service.door(player, door.id));
  const z = house.z + 2.75;
  player.lx = house.x + 14;
  player.lz = z;
  const shot = { weapon: 'ak47', origin: [player.lx, 1.56, z], dir: [-1, 0, 0], distance: 2.02 };
  assert(!service.shoot(player, { ...shot, origin: [player.lx + 9, 1.56, z] }));
  assert(service.shoot(player, shot));
  assert(events.at(-1).shatter);
  assert.equal(E.snapshot(b).broken.length, 1);
  assert.deepEqual(E.snapshot(a), E.snapshot(b));
  const late = replica();
  assert(E.apply(late, service.snapshot()));
  assert.deepEqual(E.snapshot(late), E.snapshot(a));
  const stale = service.snapshot();
  service.reset();
  assert.equal(E.snapshot(b).broken.length, 0);
  assert(!E.apply(b, stale));
  assert.equal(E.snapshot(b).broken.length, 0);
  console.log(
    'PASS',
    map,
    'terrain support, bridges, two players, door obstruction, glass shot, late join, round reset',
  );
}
const changes = [],
  q = Q.create({ apply: (v) => changes.push(v) });
for (let i = 0; i < 500; i++) q.sample(40);
assert.equal(q.quality, 'low');
assert.deepEqual(changes, ['low']);
for (let i = 0; i < 3000; i++) q.sample(16);
assert(q.quality !== 'low');
q.setMode('high');
for (let i = 0; i < 1000; i++) q.sample(50);
assert.equal(q.quality, 'high');
const emergencyChanges=[];
const emergency=Q.create({apply:v=>emergencyChanges.push(v),quality:'high'});
for(let i=0;i<170;i++)emergency.sample(50);
assert.equal(emergency.quality,'balanced');
for(let i=0;i<90;i++)emergency.sample(50);
assert.equal(emergency.quality,'low','Severe overload must bypass the upgrade cooldown');
assert.deepEqual(emergencyChanges,['balanced','low']);
const pause = Q.create({
  apply: () => {
    throw Error('Paused or loading window changed quality');
  },
});
for (let i = 0; i < 2000; i++) pause.sample(500, false);
assert(A.pose('p90', 0.4, 100).magY > 0);
assert(A.pose('ak47', 0.4, 100).magY < 0);
assert(A.pose('usp', -1, 0.01).slideZ > 0);
assert(A.pose('awp', -1, 0.32).boltZ > 0.05);
console.log('PASS adaptive hysteresis, manual override and distinct reload/bolt paths');
