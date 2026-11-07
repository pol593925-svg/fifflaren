// Blender consumes the same openings, walls and stairs used for multiplayer collision.
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../cs16.js'), 'utf8');
const rows = vm.runInNewContext('(' + source.match(/const MAP_ROWS = (\{[\s\S]*?\n  \});/)[1] + ')').dust2;
const codes = { '#': 1, '.': 0, D: 2, C: 3, 4: 4, 5: 5, 6: 6, 7: 7, V: 8, B: 9, S: 10, T: 11 };
const grid = rows.map((r) => Array.from(r, (c) => codes[c]));
const plan = require('../cs16-passages').plan(grid);
if (!require('../cs16-tactical-map').identify(grid) && (!plan.cells.length || !plan.routes.length)) throw Error('Dust2 interior generation failed');
if (require.main === module) process.stdout.write(JSON.stringify(plan));
module.exports = { plan, grid };
