(function (g) {
  'use strict';
  function sculpt(T, model, grid) {
    const patches = g.CS16Terrain.layout(grid);
    model.traverse((mesh) => {
      if (!mesh.isMesh || mesh.material?.name !== 'ground') return;
      const src = mesh.geometry,
        pos = src.attributes.position,
        uv = src.attributes.uv,
        co = src.attributes.color,
        idx = src.index?.array;
      if (!idx) return;
      src.computeBoundingBox();
      const box = src.boundingBox,
        local = patches.filter(
          (p) => p.x > box.min.x && p.x < box.max.x && p.z > box.min.z && p.z < box.max.z,
        );
      if (!local.length) return;
      const positions = [],
        normals = [],
        uvs = [],
        colors = co ? [] : null,
        indices = [],
        n = src.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        uvs.push(uv.getX(i), uv.getY(i));
        if (co) {
          colors.push(co.getX(i), co.getY(i), co.getZ(i));
          if (co.itemSize === 4) colors.push(co.getW(i));
        }
      }
      for (let i = 0; i < idx.length; i += 3) {
        const x = (pos.getX(idx[i]) + pos.getX(idx[i + 1]) + pos.getX(idx[i + 2])) / 3,
          z = (pos.getZ(idx[i]) + pos.getZ(idx[i + 1]) + pos.getZ(idx[i + 2])) / 3;
        if (!local.some((p) => Math.abs(x - p.x) < 12 && Math.abs(z - p.z) < 12))
          indices.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      for (const p of local) {
        const base = positions.length / 3;
        for (let z = 0; z <= 24; z++)
          for (let x = 0; x <= 24; x++) {
            const wx = p.x - 12 + x,
              wz = p.z - 12 + z;
            positions.push(wx, g.CS16Terrain.height(grid, wx, wz), wz);
            normals.push(...g.CS16Terrain.normal(grid, wx, wz));
            uvs.push(wx / 4, wz / 4);
            if (colors) for (let k = 0; k < co.itemSize; k++) colors.push(1);
          }
        for (let z = 0; z < 24; z++)
          for (let x = 0; x < 24; x++) {
            const a = base + z * 25 + x;
            indices.push(a, a + 25, a + 1, a + 1, a + 25, a + 26);
          }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      if (colors) geo.setAttribute('color', new T.Float32BufferAttribute(colors, co.itemSize));
      geo.setIndex(indices);
      geo.computeBoundingSphere();
      mesh.geometry = geo;
      src.dispose();
    });
  }
  function create({ T, scene, grid, map, hud, getPlayer, getActive, getQuality }) {
    const data = g.CS16Buildings.layout(grid, map),
      state = data.environment,
      root = new T.Group();
    root.name = 'Interactive interiors';
    scene.add(root);
    const box = new T.BoxGeometry(1, 1, 1),
      wood = new T.MeshStandardMaterial({ color: 0x806147, roughness: 0.8 }),
      glass = new T.MeshStandardMaterial({
        color: 0xa2c8d5,
        transparent: true,
        opacity: 0.25,
        roughness: 0.12,
        metalness: 0.4,
        side: T.DoubleSide,
        depthWrite: false,
      }),
      steel = new T.MeshStandardMaterial({ color: 0x505958, roughness: 0.5, metalness: 0.65 }),
      lamp = new T.MeshBasicMaterial({ color: 0xffd797 }),
      doors = new Map();
    function part(parent, mat, x, y, z, w, h, d) {
      const m = new T.Mesh(box, mat);
      m.position.set(x, y, z);
      m.scale.set(w, h, d);
      m.castShadow = mat !== glass && mat !== lamp;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    for (const d of state.doors) {
      const pivots = [];
      for (const side of [-1, 1]) {
        const pivot = new T.Group();
        pivot.position.set(d.x + side * 1.5, 0, d.z);
        part(pivot, wood, -side * 0.75, 1.3, 0, 1.49, 2.58, 0.1);
        part(pivot, steel, -side * 1.36, 1.27, -0.09, 0.06, 0.25, 0.1);
        for (const y of [0.6, 1.8]) part(pivot, steel, -side * 0.75, y, -0.06, 1.22, 0.045, 0.025);
        pivot.rotation.y = d.open ? (side * Math.PI) / 2 : 0;
        root.add(pivot);
        pivots.push({ pivot, side });
      }
      doors.set(d.id, pivots);
    }
    const panes = new T.InstancedMesh(box, glass, state.windows.length),
      transform = new T.Object3D();
    panes.name = 'Breakable glazing';
    panes.frustumCulled = false;
    root.add(panes);
    let glassRevision = -1;
    const lampPlaces = [];
    for (const b of data.buildings)
      for (const y of [2.85, 6.45]) {
        part(root, steel, b.x + 5, y + 0.06, b.z + 6, 0.55, 0.08, 0.55);
        part(root, lamp, b.x + 5, y, b.z + 6, 0.45, 0.035, 0.45);
        lampPlaces.push(new T.Vector3(b.x + 5, y - 0.12, b.z + 6));
      }
    const lights = Array.from({ length: 2 }, () => {
      const l = new T.PointLight(0xffd9a4, 0, 9, 2);
      root.add(l);
      return l;
    });
    const hint = document.createElement('div');
    hint.className = 'cs16-world-hint';
    hint.style.cssText =
      'position:absolute;bottom:158px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:8px;background:#142029cc;color:#fce4bb;font:14px Segoe UI;pointer-events:none;display:none';
    hud.append(hint);
    let last = 0;
    return {
      update(dt, t, camera) {
        for (const d of state.doors)
          for (const { pivot, side } of doors.get(d.id)) {
            const target = d.open ? (side * Math.PI) / 2 : 0;
            pivot.rotation.y += (target - pivot.rotation.y) * (1 - Math.exp(-dt * 12));
          }
        if (glassRevision !== state.revision) {
          glassRevision = state.revision;
          let i = 0;
          for (const w of state.windows) {
            if (w.broken) continue;
            transform.position.fromArray(w.min.map((v, j) => (v + w.max[j]) / 2));
            transform.scale.fromArray(w.min.map((v, j) => w.max[j] - v));
            transform.updateMatrix();
            panes.setMatrixAt(i++, transform.matrix);
          }
          panes.count = i;
          panes.instanceMatrix.needsUpdate = true;
        }
        if (t - last > 180) {
          last = t;
          const p = getPlayer(),
            near = g.CS16Environment.nearest(data, p);
          hint.style.display = getActive() && near ? 'block' : 'none';
          if (near) hint.textContent = 'E · ' + (near.open ? 'Закрыть дверь' : 'Открыть дверь');
          const indoor = g.CS16Buildings.contains(grid, map, p.x, p.z) && p.y < 7.2,
            limit = getQuality() === 'low' ? 0 : getQuality() === 'high' ? 2 : 1;
          const closest = lampPlaces
            .slice()
            .sort((a, b) => a.distanceToSquared(camera.position) - b.distanceToSquared(camera.position));
          lights.forEach((l, i) => {
            l.intensity = indoor && i < limit ? 9 : 0;
            if (closest[i]) l.position.copy(closest[i]);
          });
        }
      },
      applyMaterials(find) {
        const base = find('wood');
        if (base) {
          wood.map = base.map;
          wood.normalMap = base.normalMap;
          wood.roughnessMap = base.roughnessMap;
          wood.needsUpdate = true;
        }
      },
      dispose() {
        hint.remove();
        root.removeFromParent();
        panes.dispose();
        box.dispose();
        [wood, glass, steel, lamp].forEach((m) => m.dispose());
      },
    };
  }
  g.CS16EnvironmentView = { sculpt, create };
})(window);
