// Executed inside the actual CS client in the local graphics smoke harness.
module.exports = async function dustDoorCheck() {
  const plan = CS16Passages.plan(grid),
    model = await worldGraphics.ready,
    data = CS16Buildings.layout(grid, curMap);
  const streets = data.environment.doors.filter((d) => d.kind === 'street'),
    hidden = data.environment.doors.filter((d) => d.kind === 'secret');
  model.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(),
    blocked = [];
  for (const d of [...streets, ...hidden]) {
    ray.set(new THREE.Vector3(d.x + d.nx * 1.5, 1.55, d.z + d.nz * 1.5), new THREE.Vector3(-d.nx, 0, -d.nz));
    ray.near = 0.02;
    ray.far = 3;
    const h = ray.intersectObject(model, true)[0];
    if (h) blocked.push(d.id + ':' + h.object.name);
  }
  const edge = streets.find((d) => d.x <= 14 || d.z <= 14),
    central = streets.find((d) => d.x > 240 && d.x < 340 && d.z > 180 && d.z < 320),
    relocated = streets.find((d) => d.original !== d.cell);
  const slope = streets.find((d) => {
    const c = cellAt(d.x + d.nx, d.z + d.nz);
    return c >= 5 && c <= 7;
  });
  const fixtures = [edge, central, relocated, slope, hidden[0]],
    walked = [];
  state.phase = 'live';
  me.alive = true;
  me.team = 'ct';
  ui.lobby.style.display = 'none';
  ui.canvas.style.display = 'block';
  resize3();
  for (const d of fixtures) {
    P.x = d.x + d.nx * 1.5;
    P.z = d.z + d.nz * 1.5;
    P.y = Math.max(
      floorAt(cellAt(P.x, P.z), P.x, P.z),
      CS16Buildings.vertical(grid, curMap, P.x, P.z, 0).floor,
    );
    if (cellAt(P.x, P.z) === 4) P.y = 0;
    P.yaw = Math.atan2(d.nx, d.nz);
    P.pitch = 0;
    P.vx = P.vy = P.vz = 0;
    P.onGround = true;
    window.__emitted = [];
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' }));
    const sent = window.__emitted.find((x) => x.n === 'cs16_door');
    if (sent?.d !== d.id) throw Error('E did not select ' + d.id + ' (got ' + sent?.d + ')');
    const snap = CS16Environment.snapshot(data);
    window.__socket.receive('cs16_environment', {
      ...snap,
      map: curMap,
      revision: snap.revision + 1,
      opened: [...snap.opened, d.id],
    });
    for (let i = 0; i < 32; i++) stepPlayer(1 / 60, { w: true });
    const depth = -(P.x - d.x) * d.nx - (P.z - d.z) * d.nz;
    if (depth < 1 || cellAt(P.x, P.z) !== 12 || P.y < -0.1)
      throw Error('Walking failed ' + d.id + ' depth ' + depth + ' y ' + P.y);
    walked.push({ id: d.id, depth, y: P.y });
  }
  // Photograph a real entrance from its street, looking into the room.
  const d = central;
  P.x = d.x + d.nx * 4;
  P.z = d.z + d.nz * 4;
  P.y = 0;
  camera.position.set(P.x, 1.62, P.z);
  camera.lookAt(d.x - d.nx * 1.5, 1.45, d.z - d.nz * 1.5);
  environmentView.update(1, performance.now(), camera);
  state.phase = 'lobby';
  ui.hud.style.display = 'none';
  if (vm) vm.visible = false;
  worldGraphics.update(camera, performance.now());
  renderer3.render(scene, camera);
  return { gaps: streets.length + hidden.length, blocked, walked, routes: plan.routes.length };
};
