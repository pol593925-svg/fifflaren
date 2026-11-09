(function (global) {
  'use strict';
  function create(T, scene, grid, getQuality, supportFloor) {
    const root = new T.Group();
    root.name = 'Battlefield effects';
    scene.add(root);
    const dummy = new T.Object3D();
    const random = (a, b) => a + Math.random() * (b - a);
    const floor = supportFloor || ((x, z) => global.CS16Terrain.walkHeight(grid, x, z));
    function pool(name, geometry, material, capacity) {
      const mesh = new T.InstancedMesh(geometry, material, capacity);
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      root.add(mesh);
      return { mesh, capacity, items: [] };
    }
    const fragments = pool(
      'Surface fragments',
      new T.BoxGeometry(1, 1, 1),
      new T.MeshStandardMaterial({ roughness: 0.74 }),
      112,
    );
    const brass = pool(
      'Ejected brass',
      new T.CylinderGeometry(0.014, 0.014, 0.06, 6),
      new T.MeshStandardMaterial({ color: 0xc6a462, metalness: 0.65, roughness: 0.34 }),
      48,
    );
    const dust = pool(
      'Vehicle dust',
      new T.IcosahedronGeometry(1, 0),
      new T.MeshBasicMaterial({ color: 0xcbb58d, transparent: true, opacity: 0.16, depthWrite: false }),
      48,
    );
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext('2d'),
      gradient = ctx.createRadialGradient(24, 24, 1, 24, 24, 22);
    gradient.addColorStop(0, '#171717');
    gradient.addColorStop(0.56, '#322b25');
    gradient.addColorStop(0.82, '#756354aa');
    gradient.addColorStop(1, '#99867100');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 48, 48);
    const texture = new T.CanvasTexture(canvas);
    const marks = pool(
      'Bullet marks',
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      96,
    );
    const up = new T.Vector3(0, 0, 1),
      tmp = new T.Vector3(),
      color = new T.Color();
    const surfaceColors = {
      glass: 0xbdeeff,
      rail: 0xffbd49,
      steel: 0xffb341,
      wood: 0x94714b,
      earth: 0x907754,
      stone: 0xab9e84,
    };
    function add(pool, item) {
      const cap = getQuality() === 'low' ? Math.ceil(pool.capacity * 0.45) : pool.capacity;
      if (pool.items.length >= cap) pool.items.splice(0, pool.items.length - cap + 1);
      pool.items.push(item);
    }
    function spray(position, normal, kind, count) {
      for (let i = 0; i < count; i++) {
        const speed = random(0.7, 3.5),
          size = random(0.025, 0.085);
        add(fragments, {
          pos: position.slice(),
          v: [
            normal[0] * speed + random(-0.8, 0.8),
            normal[1] * speed + random(0.5, 2),
            normal[2] * speed + random(-0.8, 0.8),
          ],
          size,
          life: random(0.25, 0.75),
          age: 0,
          spin: random(-9, 9),
          color: surfaceColors[kind] || surfaceColors.stone,
        });
      }
    }
    function impact(position, normal, kind, dynamic = false) {
      spray(position, normal, kind, getQuality() === 'low' ? 3 : 7);
      if (kind === 'glass' || dynamic) return;
      add(marks, {
        pos: position.map((v, i) => v + normal[i] * 0.018),
        normal,
        size: random(0.08, 0.15),
        age: 0,
        life: 22,
      });
    }
    function shatter(position) {
      spray(position, [0, 0.3, 0], 'glass', getQuality() === 'low' ? 8 : 18);
    }
    function eject(origin, direction, port=null) {
      const right = [-direction[2], 0, direction[0]];
      add(brass, {
        pos: port ? [port[0]+right[0]*.045,port[1]+.012,port[2]+right[2]*.045] : [
          origin[0] + direction[0] * 0.4 + right[0] * 0.25,
          origin[1] - 0.18,
          origin[2] + direction[2] * 0.4 + right[2] * 0.25,
        ],
        v: [right[0] * 2.4 + random(-0.3, 0.3), random(1.1, 2.4), right[2] * 2.4 + random(-0.3, 0.3)],
        age: 0,
        life: 1.4,
        spin: random(5, 15),
      });
    }
    function plume(x, y, z) {
      add(dust, {
        pos: [x, y + 0.15, z],
        v: [random(-0.3, 0.3), random(0.3, 0.9), random(-0.3, 0.3)],
        age: 0,
        life: random(0.55, 0.95),
        size: random(0.35, 0.76),
      });
    }
    function update(dt) {
      for (const pool of [marks, brass, fragments, dust]) {
        let index = 0;
        for (const item of pool.items) {
          item.age += dt;
          if (item.age >= item.life) continue;
          if (item.v) {
            if (pool !== dust) item.v[1] -= 9 * dt;
            for (let i = 0; i < 3; i++) item.pos[i] += item.v[i] * dt;
            const support = pool === brass ? floor(item.pos[0], item.pos[2], item.pos[1]) + 0.015 : -Infinity;
            if (pool === brass && item.pos[1] < support) {
              item.pos[1] = support;
              item.v[1] = Math.max(0, -item.v[1] * 0.2);
              item.v[0] *= 0.8;
              item.v[2] *= 0.8;
            }
          }
          dummy.position.fromArray(item.pos);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          if (pool === marks) {
            dummy.quaternion.setFromUnitVectors(up, tmp.fromArray(item.normal).normalize());
            dummy.scale.setScalar(item.size);
          } else if (pool === dust)
            dummy.scale.setScalar(item.size * Math.sin((Math.PI * item.age) / item.life));
          else {
            dummy.rotation.set(item.age * item.spin, item.age * 4, 0);
            if (pool === fragments) {
              dummy.scale.set(item.size, item.size * 0.36, item.size * 1.6);
              pool.mesh.setColorAt(index, color.setHex(item.color));
            }
          }
          dummy.updateMatrix();
          pool.mesh.setMatrixAt(index, dummy.matrix);
          pool.items[index++] = item;
        }
        pool.items.length = index;
        pool.mesh.count = index;
        pool.mesh.instanceMatrix.needsUpdate = true;
        if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
      }
    }
    function dispose() {
      root.removeFromParent();
      for (const p of [marks, brass, fragments, dust]) {
        p.items.length = 0;
        p.mesh.dispose();
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
      texture.dispose();
    }
    return { impact, shatter, eject, plume, update, dispose };
  }
  global.CS16FieldEffects = { create };
})(window);
