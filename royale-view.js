(function (global) {
  'use strict';
  const C = global.RoyaleCore;
  async function assets(T) {
    const loader = new T.GLTFLoader(),
      models = new Map(),
      items = [
        ['transport', 'models/royale/transport.glb'],
        ['canopy', 'models/royale/canopy.glb'],
        ['ct', 'models/csgo/operator-ct.glb'],
        ['t', 'models/csgo/operator-t.glb'],
        ['hands', 'models/csgo/hands.glb'],
        ...Object.keys(C.weapons).map((id) => [
          id,
          'models/' + (['mp7', 'vector', 'bizon'].includes(id) ? 'royale' : 'csgo') + '/' + id + '.glb',
        ]),
      ];
    let next = 0;
    const workers = await Promise.allSettled(
      Array.from({ length: 3 }, async () => {
        while (next < items.length) {
          const [id, url] = items[next++],
            scene = (await loader.loadAsync(url)).scene;
          models.set(id, scene);
        }
      }),
    );
    const failed = workers.find((w) => w.status === 'rejected');
    if (failed) {
      freeModels(models);
      throw failed.reason;
    }
    return models;
  }
  function freeModels(models) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    for (const root of models.values())
      root.traverse((m) => {
        if (m.geometry) geometries.add(m.geometry);
        for (const v of [].concat(m.material || [])) materials.add(v);
      });
    for (const m of materials) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      m.dispose();
    }
    textures.forEach((t) => t.dispose());
    geometries.forEach((g) => g.dispose());
  }
  async function create(T, renderer, quality) {
    const scene = new T.Scene(),
      second = new T.Scene(),
      camera = new T.PerspectiveCamera(75, 1, 0.07, 4600);
    const result = await Promise.allSettled([global.RoyaleCity.create(T, scene, renderer), assets(T)]);
    if (result.some((r) => r.status === 'rejected')) {
      if (result[0].status === 'fulfilled') result[0].value.dispose();
      if (result[1].status === 'fulfilled') freeModels(result[1].value);
      throw result.find((r) => r.status === 'rejected').reason;
    }
    const city = result[0].value,
      models = result[1].value,
      ownedG = new Set(),
      ownedM = new Set(),
      operators = new Map(),
      guns = new Map(),
      tracers = [],
      markers = new Map(),
      temp = new T.Object3D(),
      look = new T.Vector3(),
      target = new T.Vector3();
    const geo = (g) => (ownedG.add(g), g),
      mat = (m) => (ownedM.add(m), m),
      cube = geo(new T.BoxGeometry(1, 1, 1)),
      steel = mat(new T.MeshStandardMaterial({ color: 0x343c40, roughness: 0.4, metalness: 0.64 })),
      glass = mat(new T.MeshStandardMaterial({ color: 0x395f70, roughness: 0.12, metalness: 0.5 })),
      cylinder = geo(new T.CylinderGeometry(1, 1, 1, 16).rotateX(Math.PI / 2));
    function part(parent, g, m, x, y, z, w, h, d) {
      const mesh = new T.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      parent.add(mesh);
      return mesh;
    }
    function gun(id, tier) {
      const key = id + '/' + tier;
      if (!guns.has(key)) {
        const root = new T.Group(),
          asset = models.get(id).clone(true),
          bounds = new T.Box3().setFromObject(asset),
          size = bounds.getSize(new T.Vector3());
        asset.scale.setScalar(C.profile(id, tier).length / (Math.max(size.x, size.y, size.z) || 1));
        asset.updateMatrixWorld(true);
        asset.position.sub(new T.Box3().setFromObject(asset).getCenter(new T.Vector3()));
        root.add(asset);
        if (tier >= 1) {
          part(root, cube, steel, 0, 0.105, -0.02, 0.065, 0.045, 0.095);
          part(root, cube, glass, 0, 0.139, -0.04, 0.052, 0.042, 0.01);
        }
        if (tier >= 2) part(root, cube, steel, 0, -0.16, -0.038, 0.045, 0.065, 0.068);
        if (tier >= 3) part(root, cylinder, steel, 0, -0.085, -0.2, 0.022, 0.046, 0.05);
        if (tier >= 4)
          part(root, cylinder, steel, 0, 0.035, -C.profile(id, tier).length * 0.51, 0.026, 0.026, 0.14);
        guns.set(key, root);
      }
      return guns.get(key).clone(true);
    }
    const plane = models.get('transport').clone(true);
    scene.add(plane);
    const caseMat = mat(new T.MeshStandardMaterial({ color: 0x475345, roughness: 0.69, metalness: 0.27 })),
      signal = mat(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.4 })),
      cases = new T.InstancedMesh(cube, caseMat, 400),
      bands = new T.InstancedMesh(cube, signal, 400),
      lids = new T.InstancedMesh(cube, steel, 400);
    cases.count = bands.count = lids.count = 0;
    const caseGroup = new T.Group();
    caseGroup.add(cases, bands, lids);
    scene.add(caseGroup);
    let worldLoot = { boxes: [], drops: [], rev: 0 },
      vm = null,
      vmKey = '',
      animation = null,
      shotAt = -Infinity,
      latest = null,
      focusID = '';
    const lineMat = mat(new T.LineBasicMaterial({ color: 0xffda8b, transparent: true, opacity: 0.78 }));
    const zoneMat = mat(
      new T.MeshBasicMaterial({
        color: 0x9ba652,
        transparent: true,
        opacity: 0.11,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    const zoneWall = new T.Mesh(geo(new T.CylinderGeometry(1, 1, 85, 100, 1, true)), zoneMat);
    scene.add(zoneWall);
    const arenaMat = mat(new T.MeshStandardMaterial({ color: 0x929998, roughness: 0.86 })),
      floorMat = mat(new T.MeshStandardMaterial({ color: 0x545c5a, roughness: 0.82 })),
      hazard = mat(new T.MeshStandardMaterial({ color: 0xcbab68, roughness: 0.7 }));
    second.background = new T.Color(0x48535d);
    second.add(new T.HemisphereLight(0xe6f0f5, 0x5b6364, 1.3));
    const arenaSun = new T.DirectionalLight(0xfce1b9, 2);
    arenaSun.position.set(-25, 45, 18);
    second.add(arenaSun);
    part(second, cube, floorMat, 26, -0.1, 24, 52, 0.2, 48);
    for (const [x, z, w, d] of [
      [0, 24, 0.6, 48],
      [52, 24, 0.6, 48],
      [26, 0, 52, 0.6],
      [26, 48, 52, 0.6],
    ]) {
      part(second, cube, arenaMat, x, 4, z, w, 8, d);
      part(second, cube, hazard, x, 1.3, z, w + 0.03, 0.22, d + 0.03);
    }
    for (const b of C.arenaBoxes) part(second, cube, arenaMat, b.x, b.h / 2, b.z, b.w, b.h, b.d);
    for (let x = 4; x < 50; x += 6) part(second, cube, hazard, x, 0.009, 24, 3, 0.018, 0.12);
    function setMatrix(mesh, i, x, y, z, w, h, d, angle = 0) {
      temp.position.set(x, y, z);
      temp.rotation.set(angle, 0, 0);
      temp.scale.set(w, h, d);
      temp.updateMatrix();
      mesh.setMatrixAt(i, temp.matrix);
    }
    function setLoot(d) {
      if (!d) return;
      worldLoot = d;
      const list = d.boxes || [];
      cases.count = bands.count = lids.count = list.length;
      list.forEach((b, i) => {
        setMatrix(cases, i, b.x, b.y + 0.34, b.z, 1.22, 0.64, 0.76);
        setMatrix(bands, i, b.x, b.y + 0.48, b.z, 1.235, 0.105, 0.775);
        bands.setColorAt(i, new T.Color(C.colors[b.tier]));
        setMatrix(
          lids,
          i,
          b.x,
          b.y + (b.open ? 0.96 : 0.71),
          b.z + (b.open ? 0.32 : 0),
          1.25,
          0.11,
          0.8,
          b.open ? 1.25 : 0,
        );
      });
      for (const m of [cases, bands, lids]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
      }
    }
    function updateDrops(p, t) {
      const visible = new Set();
      for (const d of worldLoot.drops || []) {
        if (Math.hypot(d.x - p.x, d.z - p.z) > 45 || visible.size >= 20) continue;
        visible.add(d.uid);
        let o = markers.get(d.uid);
        if (!o) {
          o = gun(d.gun.id, d.gun.tier);
          scene.add(o);
          markers.set(d.uid, o);
        }
        o.position.set(d.x, d.y + 0.55 + Math.sin(t * 0.002 + d.uid) * 0.06, d.z);
        o.rotation.set(0.12, t * 0.00055, 0.12);
      }
      for (const [uid, o] of markers)
        if (!visible.has(uid)) {
          o.removeFromParent();
          markers.delete(uid);
        }
    }
    function operator(actor, parent) {
      let a = operators.get(actor.id);
      if (!a) {
        const mesh = models.get(actor.team % 2 ? 't' : 'ct').clone(true),
          chute = models.get('canopy').clone(true),
          root = new T.Group();
        root.add(mesh, chute);
        parent.add(root);
        a = {
          root,
          mesh,
          chute,
          gun: null,
          gunID: '',
          legL: mesh.getObjectByName('legL'),
          legR: mesh.getObjectByName('legR'),
          arm: mesh.getObjectByName('armR'),
          first: true,
          phase: 0,
        };
        operators.set(actor.id, a);
      }
      if (a.root.parent !== parent) {
        parent.add(a.root);
        a.first = true;
      }
      return a;
    }
    function muzzle(data, t) {
      if (!latest || !!latest.self?.duel !== !!data.arena || (data.arena && data.arena !== latest.self?.duel))
        return;
      if (data.by === latest.self?.id) shotAt = t;
      const g = new T.BufferGeometry().setFromPoints([
          new T.Vector3(...data.o),
          new T.Vector3(...data.o.map((v, i) => v + data.d[i] * data.len)),
        ]),
        line = new T.Line(g, lineMat);
      (data.arena ? second : scene).add(line);
      tracers.push({ line, t });
      while (tracers.length > 28) {
        const r = tracers.shift();
        r.line.removeFromParent();
        r.line.geometry.dispose();
      }
    }
    function update(state, view, t, dt) {
      latest = state;
      const me = state?.self,
        actors = state?.actors || [],
        mine = actors.find((a) => a.id === me?.id),
        playing = !!me && !['out', 'watch', 'queue', 'lobby'].includes(me.s),
        duel = !!me?.duel,
        parent = duel ? second : scene;
      if (camera.parent !== parent) parent.add(camera);
      const focus = playing
        ? mine
        : actors.find(
            (a) => a.id === view.spectator && ['ground', 'chute', 'down', 'plane', 'duel'].includes(a.s),
          ) ||
          actors.find((a) => a.team === me?.team && a.s === 'ground') ||
          actors.find((a) => a.s === 'ground');
      if (state) {
        const zone = state.zone;
        zoneWall.position.set(zone.x, 37, zone.z);
        zoneWall.scale.set(zone.r, 1, zone.r);
        zoneWall.visible = zone.stage >= 1 || state.age > 50;
        const a = state.path[0],
          b = state.path[1],
          f = C.planeAt(
            state.path,
            C.clamp((state.age + (performance.now() - view.snapshotAt) / 1000) / 44, 0, 1),
          );
        plane.position.fromArray(f);
        plane.rotation.y = Math.atan2(a[0] - b[0], a[1] - b[1]);
        plane.visible = state.age < 48;
      }
      const keep = new Set();
      if (focus) {
        const first =
            focusID !== focus.id ||
            Math.abs(look.y - focus.y) > 5 ||
            Math.hypot(look.x - focus.x, look.z - focus.z) > 25,
          alpha = first ? 1 : 1 - Math.exp(-dt * 21);
        focusID = focus.id;
        look.lerp(target.set(focus.x, focus.y, focus.z), alpha);
        const yaw = view.yaw,
          pitch = view.pitch;
        if (focus.s === 'plane') {
          const a = state.path[0],
            b = state.path[1],
            n = Math.hypot(b[0] - a[0], b[1] - a[1]),
            dx = (b[0] - a[0]) / n,
            dz = (b[1] - a[1]) / n;
          camera.position.set(
            plane.position.x - dx * 21 + dz * 6,
            plane.position.y + 7,
            plane.position.z - dz * 21 - dx * 6,
          );
          camera.lookAt(plane.position.x + dx * 24, plane.position.y - 8, plane.position.z + dz * 24);
        } else if (['fall', 'chute'].includes(focus.s) || !playing) {
          camera.position.set(look.x + Math.sin(yaw) * 6, look.y + 4.8, look.z + Math.cos(yaw) * 6);
          camera.lookAt(
            look.x - Math.sin(yaw) * 12,
            look.y - 2 + Math.sin(pitch) * 7,
            look.z - Math.cos(yaw) * 12,
          );
        } else {
          camera.position.copy(look);
          camera.position.y += focus.s === 'down' ? 0.55 : 1.55;
          camera.rotation.order = 'YXZ';
          camera.rotation.set(pitch, yaw, 0, 'YXZ');
        }
        updateDrops(focus, t);
        for (const a of actors) {
          if (
            a.s === 'plane' ||
            !['ground', 'duel', 'down', 'fall', 'chute'].includes(a.s) ||
            (a.id === focus.id && playing && !['chute', 'fall'].includes(a.s)) ||
            Math.hypot(a.x - look.x, a.z - look.z) > (a.s === 'chute' ? 700 : 260)
          )
            continue;
          keep.add(a.id);
          const model = operator(a, parent),
            x = model.root.position.x,
            z = model.root.position.z;
          model.root.position.lerp(target.set(a.x, a.y, a.z), model.first ? 1 : 1 - Math.exp(-dt * 15));
          model.first = false;
          model.root.rotation.y = a.yaw;
          model.root.rotation.z = a.s === 'down' ? 1.18 : 0;
          model.chute.visible = a.s === 'chute';
          const travel = Math.hypot(model.root.position.x - x, model.root.position.z - z);
          model.phase += Math.min(0.5, travel) * 4.2;
          const stride = travel > 0.005 ? Math.sin(model.phase) * 0.48 : 0;
          if (model.legL) model.legL.rotation.x = stride;
          if (model.legR) model.legR.rotation.x = -stride;
          if (model.gunID !== a.gun && a.gun && C.weapons[a.gun]) {
            model.gun?.removeFromParent();
            model.gun = gun(a.gun, 0);
            model.gun.position.set(0.24, 1.24, -0.3);
            model.root.add(model.gun);
            model.gunID = a.gun;
          }
        }
      } else {
        focusID = '';
        const a = t * 0.000045;
        camera.position.set(1000 + Math.cos(a) * 700, 305, 950 + Math.sin(a) * 700);
        camera.lookAt(1000, 12, 980);
        plane.visible = !!state && state.age < 45;
      }
      for (const [id, a] of operators)
        if (!keep.has(id)) {
          a.root.removeFromParent();
          operators.delete(id);
        }
      const held = me?.gear?.[me.slot],
        key = held ? held.id + '/' + held.tier : '';
      if (key !== vmKey) {
        vm?.removeFromParent();
        vm = null;
        vmKey = key;
        if (held) {
          vm = gun(held.id, held.tier);
          const hands = models.get('hands').clone(true);
          vm.add(hands);
          camera.add(vm);
          animation = global.CS16WeaponAnimation.bind(vm);
        }
      }
      if (vm) {
        vm.visible = playing && ['ground', 'duel'].includes(focus?.s);
        vm.rotation.set(0, 0, 0);
        const recoil = Math.max(0, 1 - (t - shotAt) / 140);
        vm.position.set(view.aim ? 0.04 : 0.235, -0.23, -0.56 + recoil * 0.055);
        vm.rotation.x = recoil * 0.09;
        const spec = C.profile(held.id, held.tier);
        global.CS16WeaponAnimation.update(
          animation,
          vm,
          held.id,
          me.reload ? 1 - me.reload / (spec.reload * 1000) : -1,
          (t - shotAt) / 1000,
          0,
        );
      }
      const fov = view.aim && playing ? (held?.id === 'awp' ? 29 : held?.tier >= 1 ? 47 : 59) : 75;
      if (Math.abs(camera.fov - fov) > 0.1) {
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 13);
        camera.updateProjectionMatrix();
      }
      for (let i = tracers.length - 1; i >= 0; i--)
        if (t - tracers[i].t > 90) {
          const r = tracers.splice(i, 1)[0];
          r.line.removeFromParent();
          r.line.geometry.dispose();
        }
      if (!duel) city.update(camera, t, quality());
      renderer.render(parent, camera);
    }
    return {
      update,
      setLoot,
      muzzle,
      camera,
      scene,
      resize(w, h) {
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      dispose() {
        for (const r of tracers) {
          r.line.geometry.dispose();
          r.line.removeFromParent();
        }
        city.dispose();
        cases.dispose();
        bands.dispose();
        lids.dispose();
        ownedG.forEach((g) => g.dispose());
        ownedM.forEach((m) => m.dispose());
        freeModels(models);
        scene.clear();
        second.clear();
        operators.clear();
        markers.clear();
        guns.clear();
      },
    };
  }
  global.RoyaleView = { create };
})(window);
