// Two authenticated players, a spectator and an independent solo lobby on real sockets.
const assert = require('node:assert/strict'),
  http = require('node:http'),
  path = require('node:path');
const deps = process.env.VOXEL_TEST_DEPS || path.resolve(__dirname, '../../servertest/node_modules');
const { Server } = require(path.join(deps, 'socket.io')),
  { io: connect } = require(path.join(deps, 'socket.io-client'));
const httpServer = http.createServer(),
  server = new Server(httpServer),
  sockets = [];
const service = require('../../support-hub-server/royale-service')({
  io: server,
  authenticate: async (token) =>
    ['Host', 'Mate', 'Solo', 'Guest'].includes(token) ? { username: token } : null,
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const legacy = require('../../support-hub-server/royale-service')({
  io: server, protocol: 1, authenticate: async token => token === 'Host' ? {username: token} : null,
});
function open(origin, name, protocol = 2) {
  const s = connect(origin + (protocol === 1 ? '/royale' : '/royale-v2'), {
    forceNew: true,
    reconnection: false,
    autoConnect: false,
    transports: ['websocket'],
    auth: { protocol, token: name },
  });
  sockets.push(s);
  return s;
}
function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, got);
      reject(Error('Timeout: ' + event));
    }, 4000);
    function got(data) {
      clearTimeout(timer);
      resolve(data);
    }
    socket.once(event, got);
  });
}
const ack = (s, n, d) => s.timeout(3500).emitWithAck(n, d);
async function run() {
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + httpServer.address().port;
  const bad = open(origin, 'wrong'),
    denied = once(bad, 'connect_error');
  bad.connect();
  assert.match((await denied).message, /Войдите/);
  async function login(name) {
    const s = open(origin, name),
      ready = once(s, 'connect');
    s.connect();
    await ready;
    return s;
  }
  const host = await login('Host'),
    mate = await login('Mate'),
    other = await login('Solo');
  assert((await ack(host, 'join', 'duo')).ok);
  assert((await ack(mate, 'join', 'duo')).ok);
  assert((await ack(other, 'join', 'solo')).ok);
  const old = open(origin, 'Host', 1), connected = once(old, 'connect');
  old.connect(); await connected;
  assert((await ack(old, 'join', 'solo')).ok);
  assert((await ack(old, 'start', {})).ok);
  assert.equal((await once(old, 'state')).actors.length,24);
  assert.equal(service.rooms.get('solo').phase,'lobby');
  let leaked = 0;
  other.on('start', () => leaked++);
  other.on('shot', () => leaked++);
  assert((await ack(host, 'pair', 'Mate')).ok && (await ack(mate, 'pair', 'Host')).ok);
  assert.equal((await ack(mate, 'start', {})).ok, false);
  assert((await ack(host, 'start', {})).ok);
  const state = await once(host, 'state'),
    r = service.rooms.get('duo'),
    p = r.members.get('Host');
  assert.equal(state.actors.length, 24);
  assert.equal(p.team, r.members.get('Mate').team);
  host.emit('input', { id: 'Mate', x: -9999, z: -9999, yaw: 0.4, pitch: 0 });
  await pause(80);
  assert(p.x > 0 && p.x < 2000);
  assert.notEqual(r.members.get('Mate').yaw, 0.4);
  assert((await ack(host, 'action', { kind: 'jump' })).ok);
  host.disconnect();
  const re = await login('Host'),
    restored = await ack(re, 'join', 'duo');
  assert.equal(restored.state.self.s, 'fall');
  assert.equal(restored.state.self.team, p.team);
  const guest = await login('Guest'),
    late = await ack(guest, 'join', 'duo');
  assert.equal(late.state.self.s, 'watch');
  assert.equal((await ack(guest, 'action', { kind: 'jump' })).ok, false);
  for (const q of r.members.values()) if (q.team !== p.team) q.status = 'out';
  const end = await once(re, 'end');
  assert.equal(end.winner, p.team);
  r.match.finished -= 23000;
  const lobby = await once(re, 'lobby');
  assert.equal(lobby.phase, 'lobby');
  assert.equal(leaked, 0);
  assert.equal(service.rooms.get('solo').phase, 'lobby');
  console.log(
    'PASS authenticated sockets, mutual pairing, host authority, isolation, reconnect, spectating and round reset',
  );
}
run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const s of sockets) s.disconnect();
    service.dispose();
    legacy.dispose();
    await new Promise((r) => server.close(r));
  });
