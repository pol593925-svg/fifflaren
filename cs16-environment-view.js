(function (g) {
  'use strict';
  // Author one leaf per hinge direction, then instance it across every house.
  // Keeping all instance scales positive also preserves Three's normals/shadows.
  function doorGeometry(T, side, hardware) {
    const pieces = [], x = -side * .75;
    function rounded(w, h, r) {
      const s = new T.Shape(), a = -w / 2, b = -h / 2;
      s.moveTo(a + r, b); s.lineTo(a + w - r, b);
      s.quadraticCurveTo(a + w, b, a + w, b + r);
      s.lineTo(a + w, b + h - r); s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
      s.lineTo(a + r, b + h); s.quadraticCurveTo(a, b + h, a, b + h - r);
      s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b);
      return s;
    }
    function plate(w, h, depth, y, z, frame) {
      const shape = rounded(w, h, Math.min(.16, w * .12, h * .12));
      if (frame) {
        const hole = new T.Path(rounded(w - .10, h - .10, .10).getPoints(5).reverse());
        shape.holes.push(hole);
      }
      const bevel = frame ? .006 : .016;
      const geo = new T.ExtrudeGeometry(shape, {depth:depth - bevel * 2, steps:1,
        curveSegments:5, bevelEnabled:true, bevelSize:bevel, bevelThickness:bevel, bevelSegments:2});
      geo.translate(x, y, z - depth / 2 + bevel);
      pieces.push(geo);
    }
    if (!hardware) {
      plate(1.458, 2.548, .1, 1.3, 0, false);
      for (const face of [-1, 1]) {
        plate(1.19, 1.18, .028, 1.86, face * .059, true);
        plate(1.19, .88, .028, .68, face * .059, true);
      }
    } else {
      for (const face of [-1, 1]) {
        const handle = new T.TorusGeometry(.066, .010, 6, 16);
        handle.translate(-side * 1.30, 1.27, face * .094); pieces.push(handle);
        const boss = new T.SphereGeometry(.026, 10, 6);
        boss.translate(-side * 1.30, 1.335, face * .077); pieces.push(boss);
        // A small diamond at the centre of the upper moulded panel.
        const crest = new T.OctahedronGeometry(.080);
        crest.scale(.75, 1, .13); crest.translate(x, 1.86, face * .061); pieces.push(crest);
      }
    }
    const attributes = {position:[], normal:[], uv:[]};
    for (const geo of pieces) {
      const flat = geo.index ? geo.toNonIndexed() : geo;
      for (const key of Object.keys(attributes)) {
        const values = flat.attributes[key].array;
        for (let i = 0; i < values.length; i++) attributes[key].push(values[i]);
      }
      if (flat !== geo) flat.dispose();
      geo.dispose();
    }
    const merged = new T.BufferGeometry();
    for (const key of Object.keys(attributes))
      merged.setAttribute(key, new T.Float32BufferAttribute(attributes[key], key === 'uv' ? 2 : 3));
    merged.computeBoundingSphere();
    return merged;
  }
  function sculpt(T, model, grid) {
    const patches = g.CS16Terrain.layout(grid);
    const pavingScale = g.CS16TacticalMap?.identify(grid) ? 2.6 : 4;
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
            uvs.push(wx / pavingScale, wz / pavingScale);
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
        forceSinglePass: true,
        depthWrite: false,
      }),
      steel = new T.MeshStandardMaterial({ color: 0xb49a64, roughness: 0.5, metalness: 0.65 }),
      lampFrame = steel.clone(),
      lamp = new T.MeshBasicMaterial({ color: 0xffd797 }),
      doorBatches = [];
    function part(parent, mat, x, y, z, w, h, d) {
      const m = new T.Mesh(box, mat);
      m.position.set(x, y, z);
      m.scale.set(w, h, d);
      m.castShadow = mat !== glass && mat !== lamp;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    const legacyDoors = state.doors.filter((d) => !d.kind),
      streetView = g.CS16PassageView.create(T, root, box, wood, steel, state);
    const doorTransform = new T.Object3D();
    for (const side of [-1, 1]) {
      const meshes = [false, true].map(hardware => {
        const mesh = new T.InstancedMesh(doorGeometry(T, side, hardware), hardware ? steel : wood, legacyDoors.length);
        mesh.name = 'Painted house doors ' + (hardware ? 'brass ' : 'wood ') + side;
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(mesh);
        return mesh;
      });
      const angles = legacyDoors.map(d => d.open ? side * Math.PI / 2 : 0);
      doorBatches.push({side, meshes, angles});
    }
    function poseDoor(batch, d, index) {
      doorTransform.position.set(d.x + batch.side * 1.5, 0, d.z);
      doorTransform.rotation.y = batch.angles[index]; doorTransform.updateMatrix();
      for (const mesh of batch.meshes) mesh.setMatrixAt(index, doorTransform.matrix);
    }
    for (const batch of doorBatches) legacyDoors.forEach((d, i) => poseDoor(batch, d, i));
    const panes = new T.InstancedMesh(box, glass, state.windows.length),
      transform = new T.Object3D();
    panes.name = 'Breakable glazing';
    panes.frustumCulled = false;
    root.add(panes);
    let glassRevision = -1;
    const lampPlaces = [];
    for (const b of data.buildings)
      for (const y of [2.85, 6.45]) {
        part(root, lampFrame, b.x + 5, y + 0.06, b.z + 6, 0.55, 0.08, 0.55);
        part(root, lamp, b.x + 5, y, b.z + 6, 0.45, 0.035, 0.45);
        lampPlaces.push(new T.Vector3(b.x + 5, y - 0.12, b.z + 6));
      }
    for (const cell of data.passages?.cells || []) {
      const x = cell % 126,
        z = Math.floor(cell / 126);
      if ((x + z) % 4 === 0) lampPlaces.push(new T.Vector3(x * 4 + 2, 3.25, z * 4 + 2));
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
        streetView.update(dt);
        for (const batch of doorBatches) {
          let changed = false;
          for (let i = 0; i < legacyDoors.length; i++) {
            const d = legacyDoors[i], target = d.open ? batch.side * Math.PI / 2 : 0;
            if (batch.angles[i] === target) continue;
            const diff = target - batch.angles[i];
            batch.angles[i] = Math.abs(diff) < .001 ? target : batch.angles[i] + diff * (1 - Math.exp(-dt * 12));
            poseDoor(batch, d, i); changed = true;
          }
          if (changed) for (const mesh of batch.meshes) mesh.instanceMatrix.needsUpdate = true;
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
          if (near)
            hint.textContent =
              near.kind === 'secret'
                ? near.open
                  ? 'E · Закрыть тайник'
                  : 'E · Осмотреть кладку'
                : 'E · ' + (near.open ? 'Закрыть дверь' : 'Открыть дверь');
          const indoor =
              (g.CS16Buildings.contains(grid, map, p.x, p.z) && p.y < 7.2) ||
              (grid[Math.floor(p.z / 4)]?.[Math.floor(p.x / 4)] === 12 && p.y < 3.58),
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
        streetView.apply(find);
        const base = find('wood');
        if (base) {
          wood.color.copy(base.color);
          wood.map = base.map;
          wood.normalMap = base.normalMap;
          wood.roughnessMap = base.roughnessMap;
          wood.needsUpdate = true;
        }
      },
      dispose() {
        hint.remove();
        root.removeFromParent();
        streetView.dispose();
        for (const batch of doorBatches) for (const mesh of batch.meshes) {
          mesh.dispose(); mesh.geometry.dispose();
        }
        panes.dispose();
        box.dispose();
        [wood, glass, steel, lampFrame, lamp].forEach((m) => m.dispose());
      },
    };
  }
  g.CS16EnvironmentView = { sculpt, create };
})(window);
