// One batch per finish for the street doors, handles and concealed masonry panels.
(function (global) {
  'use strict';
  function create(T, root, box, wood, steel, state) {
    const doors = state.doors.filter((d) => d.kind),
      secret = new T.MeshStandardMaterial({ color: 0xaca08b, roughness: 0.92 });
    const dummy = new T.Object3D(),
      entries = [],
      materials = { wood, steel, secret },
      pools = {};
    for (const [kind, mat] of Object.entries(materials)) {
      const count = doors.filter((d) =>
        kind === 'secret' ? d.kind === 'secret' : d.kind === 'street',
      ).length;
      if (!count) continue;
      const mesh = new T.InstancedMesh(box, mat, count * 2);
      mesh.name = 'Dust2 entry ' + kind;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      pools[kind] = mesh;
    }
    let street = 0,
      hidden = 0;
    for (const d of doors)
      entries.push({ d, index: d.kind === 'secret' ? hidden++ : street++, angle: d.open ? Math.PI / 2 : 0 });
    function paint(entry) {
      const { d, index, angle } = entry,
        kind = d.kind === 'secret' ? 'secret' : 'wood';
      for (const side of [-1, 1]) {
        const p = global.CS16Passages.pose(d, side, angle),
          slot = index * 2 + (side === 1 ? 1 : 0);
        dummy.position.set(p.x, d.height / 2, p.z);
        dummy.rotation.set(0, -Math.atan2(p.dz, p.dx), 0);
        dummy.scale.set(p.w - 0.006, d.height, 0.12);
        dummy.updateMatrix();
        pools[kind].setMatrixAt(slot, dummy.matrix);
        pools[kind].instanceMatrix.needsUpdate = true;
        if (d.kind === 'street') {
          dummy.position.set(p.x + p.dx * (p.w / 2 - 0.16), 1.18, p.z + p.dz * (p.w / 2 - 0.16));
          dummy.scale.set(0.18, 0.07, 0.25);
          dummy.updateMatrix();
          pools.steel.setMatrixAt(slot, dummy.matrix);
          pools.steel.instanceMatrix.needsUpdate = true;
        }
      }
    }
    entries.forEach(paint);
    let lastRevision = -1,
      active = [];
    return {
      update(dt) {
        if (lastRevision !== state.revision) {
          lastRevision = state.revision;
          active = entries.filter((e) => Math.abs(e.angle - (e.d.open ? Math.PI / 2 : 0)) > 0.001);
        }
        for (let i = active.length - 1; i >= 0; i--) {
          const e = active[i],
            goal = e.d.open ? Math.PI / 2 : 0;
          e.angle += (goal - e.angle) * (1 - Math.exp(-dt * 14));
          if (Math.abs(goal - e.angle) < 0.002) {
            e.angle = goal;
            active.splice(i, 1);
          }
          paint(e);
        }
      },
      apply(find) {
        const base = find('limestone');
        if (base) {
          secret.map = base.map;
          secret.normalMap = base.normalMap;
          secret.needsUpdate = true;
        }
      },
      dispose() {
        Object.values(pools).forEach((m) => m.dispose());
        secret.dispose();
      },
    };
  }
  global.CS16PassageView = { create };
})(window);
