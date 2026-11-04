const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { grid: original, plan } = require('./export-dust-passages.cjs'),
  B = require('../cs16-buildings'),
  E = require('../cs16-environment'),
  Passages = require('../cs16-passages');
const server = path.resolve(__dirname, '../../support-hub-server'),
  serverB = require(path.join(server, 'cs16-buildings')),
  service = require(path.join(server, 'cs16-environment-server'));
const grid = original.map((r) => Array.from(r)),
  other = original.map((r) => Array.from(r)),
  data = B.layout(grid, 'dust2'),
  players = new Map(),
  state = { map: 'dust2', phase: 'live', players };
let tick = 10000;
const byId = new Map(data.environment.doors.map((d) => [d.id, d])),
  player = { alive: true, team: 'ct' },
  remote = B.layout(other, 'dust2');
players.set('p', player);
const field = service.create({
  state,
  grid: () => grid,
  now: () => tick,
  emit: (event, packet) => {
    if (event === 'cs16_environment') {
      E.apply(data, packet);
      E.apply(remote, packet);
    }
  },
});
for (const name of ['cs16-buildings.js', 'cs16-environment.js', 'cs16-passages.js'])
  assert(fs.readFileSync(path.join(__dirname, '..', name)).equals(fs.readFileSync(path.join(server, name))));
const originalFaces = [];
for (let z = 0; z < 126; z++)
  for (let x = 0; x < 126; x++)
    if (original[z][x] === 1)
      for (const [dx, dz] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        const n = original[z + dz]?.[x + dx];
        if (n !== undefined && n !== 1 && (x * 7 + z * 11 + dx + dz) % 4 === 2)
          originalFaces.push([x, z, dx, dz, n]);
      }
const streets = data.environment.doors.filter((d) => d.kind === 'street');
assert.equal(streets.length, originalFaces.length);
assert.equal(new Set(streets.map((d) => d.id)).size, streets.length);
for (const [x, z, dx, dz, n] of originalFaces)
  if (![2, 3, 11].includes(n))
    assert(
      streets.some((d) => d.cell === z * 126 + x && d.nx === dx && d.nz === dz),
      'missing original facade',
    );
assert.equal(
  streets.filter((d) => d.cell !== d.original).length,
  originalFaces.filter((f) => [2, 3, 11].includes(f[4])).length,
);
function toggle(d, side) {
  player.lx = d.x + side * d.nx * 1.55;
  player.lz = d.z + side * d.nz * 1.55;
  player.ly = 0;
  tick += 500;
  assert(field.door(player, d.id), 'unreachable handle ' + d.id + ' side ' + side);
}
function walk(x, z, dx, dz, length, id) {
  let y = 0;
  for (let j = 0; j <= Math.ceil(length * 10); j++) {
    const t = Math.min(length, j / 10),
      px = x + dx * t,
      pz = z + dz * t;
    const at = B.collide(grid, 'dust2', px, pz, y, 1.8, 0.7);
    assert(Math.hypot(at[0] - px, at[1] - pz) < 0.015, id + ' blocked floor at ' + px + ',' + pz);
    const v = B.vertical(grid, 'dust2', px, pz, y, 1.8);
    if (Number.isFinite(v.floor)) y = v.floor;
    assert(v.ceiling - y >= 1.8, id + ' headroom');
  }
}
for (const d of streets) {
  const from = [d.x + 1.55 * d.nx, 1.52, d.z + 1.55 * d.nz],
    dir = [-d.nx, 0, -d.nz];
  assert.equal(B.hit(grid, 'dust2', from, dir, 3)?.id, d.id, 'closed street door');
  toggle(d, 1);
  assert.equal(B.hit(grid, 'dust2', from, dir, 3), null, 'gap ' + d.id);
  walk(from[0], from[2], dir[0], dir[2], 3.1, d.id);
  toggle(d, -1);
  assert.equal(B.hit(grid, 'dust2', from, dir, 3)?.id, d.id);
}
for (const route of plan.routes) {
  const a = byId.get(route.from),
    b = byId.get(route.to),
    gate = byId.get(route.gate);
  assert(a && b && gate && a.cell !== b.cell);
  toggle(a, 1);
  toggle(b, 1);
  toggle(gate, 1);
  const lateGrid = original.map((r) => Array.from(r)),
    late = B.layout(lateGrid, 'dust2');
  assert(E.apply(late, field.snapshot()));
  assert(late.environment.doors.find((d) => d.id === gate.id).open);
  const center = (i) => [(i % 126) * 4 + 2, Math.floor(i / 126) * 4 + 2];
  for (const cells of [route.path, [...route.path].reverse()])
    for (let i = 1; i < cells.length; i++) {
      const [x, z] = center(cells[i - 1]),
        [cx, cz] = center(cells[i]);
      walk(x, z, (cx - x) / 4, (cz - z) / 4, 4, gate.id);
    }
  toggle(gate, -1);
  toggle(a, -1);
  toggle(b, -1);
}
for (const i of plan.cells) {
  const x = i % 126,
    z = Math.floor(i / 126);
  for (const [dx, dz] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ])
    if (x + dx < 0 || x + dx >= 126 || z + dz < 0 || z + dz >= 126)
      assert(B.ray(grid, 'dust2', [x * 4 + 2, 1.6, z * 4 + 2], [dx, 0, dz], 3) !== null, 'map boundary');
}
field.reset();
assert.deepEqual(field.snapshot().opened, []);
const fixture = Array.from({ length: 100 }, () => Array(100).fill(0));
assert.equal(Passages.install(fixture).doors.length, 0);
console.log(
  'PASS',
  streets.length,
  'facade doors open from outside and inside; full body passes all;',
  plan.routes.length,
  'two-way hidden routes, late snapshots, resets and sealed boundary.',
);
