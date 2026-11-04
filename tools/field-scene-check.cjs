// Injected into the isolated local graphics harness, beside the running game state.
module.exports = async function fieldScene(mode) {
  state.phase = 'lobby';
  ui.lobby.style.display = 'none';
  ui.canvas.style.display = 'block';
  ui.hud.style.display = 'none';
  resize3();
  const model = await worldGraphics.ready,
    data = CS16Buildings.layout(grid, curMap),
    house = data.buildings[0];
  const features = CS16Terrain.layout(grid),
    ray = new THREE.Raycaster(),
    heights = [];
  model.updateMatrixWorld(true);
  for (const p of features) {
    const x = p.x + 2,
      z = p.z + 3;
    ray.set(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
    ray.far = 12;
    const found = ray.intersectObject(model, true).find((h) => h.object.material?.name === 'ground');
    heights.push([CS16Terrain.height(grid, x, z), found?.point.y]);
  }
  if (mode === 'room') {
    P.x = house.x + 5.7;
    P.y = 0;
    P.z = house.z + 1.2;
    camera.position.set(P.x, 1.62, P.z);
    camera.lookAt(house.x + 3.8, 1.56, house.z + 9);
  } else {
    const p = features.find((f) => f.kind === 'gully');
    P.x = p.x - 9;
    P.z = p.z - 10;
    P.y = CS16Terrain.height(grid, P.x, P.z);
    camera.position.set(P.x, P.y + 1.62, P.z);
    camera.lookAt(p.x, 0, p.z + 2);
  }
  current = 'ak47';
  scoped = false;
  me.alive = true;
  me.team = 'ct';
  P.yaw = Math.atan2(
    -camera.getWorldDirection(new THREE.Vector3()).x,
    -camera.getWorldDirection(new THREE.Vector3()).z,
  );
  updateViewmodel(0.016, performance.now());
  ammo[current] = { mag: 1, reserve: 50 };
  startReload();
  reloading = WEAPONS[current].reload * 0.57;
  updateViewmodel(0.016, performance.now());
  const mag = vm.userData.animation.magazine,
    travel = mag ? mag.n.position.y - mag.pos.y : 0;
  reloading = 0;
  state.phase = 'live';
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i' }));
  const inspecting = Number.isFinite(inspectStart);
  updateViewmodel(0.016, performance.now() + 900);
  state.phase = 'lobby';
  const now = performance.now();
  state.players = [{ nick: myNick, alive: true, team: 'ct', petId: 'fox', characterId: 'zephyr' }];
  magicView.update(0.016, now);
  magicView.fx({ slot: 'pet', id: 'fox', by: myNick, pos: [P.x, P.y, P.z], origin: [P.x, P.y, P.z] });
  magicView.update(0.016, now + 350);
  const fox = scene.getObjectByName('pet_fox')?.parent,
    abilityPose = fox ? Math.abs(fox.rotation.y - P.yaw) : 0;
  magicView.update(0.016, now + 1400);
  environmentView.update(1, now, camera);
  worldGraphics.update(camera, now);
  fieldProps.update(0.05, camera);
  fieldEffects.eject([P.x, P.y + 1.6, P.z], [0, 0, -1]);
  fieldEffects.shatter([P.x + 1, P.y + 0.8, P.z - 2]);
  fieldEffects.update(0.016);
  renderer3.render(scene, camera);
  const sample = async (muffled) => {
    const ctx = new OfflineAudioContext(2, 22050, 22050);
    const sound = CS16BattleAudio.create(ctx, {
      listener: () => ({ x: 0, y: 1.6, z: 0, yaw: 0 }),
      blocked: () => muffled,
      indoor: () => muffled,
    });
    sound.shot('ak47', [3, 1.6, -4]);
    const buffer = await ctx.startRendering();
    sound.dispose();
    const power = (c) => buffer.getChannelData(c).reduce((sum, v) => sum + v * v, 0);
    return [power(0), power(1)];
  };
  const direct = await sample(false),
    behind = await sample(true);
  return {
    heights,
    travel,
    inspecting,
    abilityPose,
    direct,
    behind,
    panes: scene.getObjectByName('Breakable glazing').count,
    fragments: scene.getObjectByName('Surface fragments').count,
  };
};
