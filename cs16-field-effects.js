(function (global) {
  'use strict';
  function create(T, scene, grid, getQuality, supportFloor, camera) {
    const root = new T.Group();
    root.name = 'Battlefield effects';
    scene.add(root);
    const dummy = new T.Object3D(), color = new T.Color();
    let disposed = false;
    const random = (a, b) => a + Math.random() * (b - a);
    const floor = supportFloor || ((x, z) => global.CS16Terrain.walkHeight(grid, x, z));
    function pool(name, geometry, material, capacity, colored = false) {
      const mesh = new T.InstancedMesh(geometry, material, capacity);
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      // Establish the instancing shader variant before the loading-screen warm-up.
      if (colored) {
        for (let i = 0; i < capacity; i++) mesh.setColorAt(i, color.setHex(0xffffff));
        mesh.instanceColor.setUsage(T.DynamicDrawUsage);
      }
      root.add(mesh);
      return { mesh, capacity, items: [] };
    }
    const fragmentGeometry = new T.IcosahedronGeometry(1, 0), fragmentVertices = fragmentGeometry.attributes.position;
    for (let i = 0; i < fragmentVertices.count; i++) {
      const x = fragmentVertices.getX(i), y = fragmentVertices.getY(i), z = fragmentVertices.getZ(i),
        radius = .8 + Math.sin(x * 3.7 + y * 5.3 + z * 4.1) * .2;
      fragmentVertices.setXYZ(i, x * radius, y * radius, z * radius);
    }
    fragmentGeometry.computeVertexNormals();
    const fragments = pool(
      'Surface fragments',
      fragmentGeometry,
      new T.MeshStandardMaterial({ roughness: 0.88, flatShading: true }),
      112, true,
    );
    const brass = pool(
      'Ejected brass',
      new T.CylinderGeometry(0.014, 0.014, 0.06, 6),
      new T.MeshStandardMaterial({ color: 0xc6a462, metalness: 0.65, roughness: 0.34 }),
      48,
    );
    const dustCanvas = document.createElement('canvas');
    dustCanvas.width = dustCanvas.height = 64;
    const dustContext = dustCanvas.getContext('2d'), dustPixels = dustContext.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const dx = (x + .5 - 32) / 31, dy = (y + .5 - 32) / 31,
        edge = Math.max(0, 1 - dx * dx - dy * dy),
        wisps = .76 + .24 * Math.sin(x * .29 + Math.sin(y * .19)) * Math.sin(y * .24 - x * .08),
        index = (y * 64 + x) * 4;
      dustPixels.data[index] = dustPixels.data[index + 1] = dustPixels.data[index + 2] = 255;
      dustPixels.data[index + 3] = Math.round(255 * edge * edge * wisps);
    }
    dustContext.putImageData(dustPixels, 0, 0);
    const dustTexture = new T.CanvasTexture(dustCanvas);
    dustTexture.generateMipmaps = false;dustTexture.minFilter = T.LinearFilter;
    const dustGeometry = new T.PlaneGeometry(1, 1), dustFade = new T.InstancedBufferAttribute(new Float32Array(48), 1);
    dustFade.setUsage(T.DynamicDrawUsage);dustGeometry.setAttribute('instanceFade', dustFade);
    const dustMaterial = new T.MeshBasicMaterial({ map: dustTexture, transparent: true, opacity: .22, depthTest: true, depthWrite: false, toneMapped: false });
    dustMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float instanceFade;\nvarying float vDustFade;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDustFade = instanceFade;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDustFade;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vDustFade;');
    };
    dustMaterial.customProgramCacheKey = () => 'cs16-field-dust-fade-v1';
    const dust = pool(
      'Vehicle dust',
      dustGeometry,
      dustMaterial,
      48, true,
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
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      96,
    );
    const pools = [marks, brass, fragments, dust], up = new T.Vector3(0, 0, 1), tmp = new T.Vector3();
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
        const speed = random(0.65, 2.2),
          size = random(0.018, 0.047);
        add(fragments, {
          pos: position.slice(),
          v: [
            normal[0] * speed + random(-0.8, 0.8),
            normal[1] * speed + random(0.5, 2),
            normal[2] * speed + random(-0.8, 0.8),
          ],
          size,
          sx: kind === 'wood' ? .24 : kind === 'glass' ? .85 : random(.6, 1),
          sy: kind === 'glass' ? .1 : kind === 'wood' ? .3 : random(.45, .8),
          sz: kind === 'wood' ? 2.1 : kind === 'glass' ? 1.3 : random(.7, 1.2),
          life: random(0.25, 0.55),
          age: 0,
          spin: random(-9, 9),
          color: surfaceColors[kind] || surfaceColors.stone,
        });
      }
    }
    function impact(position, normal, kind, dynamic = false) {
      if (disposed) return;
      spray(position, normal, kind, getQuality() === 'low' ? 3 : 7);
      if (kind === 'stone' || kind === 'earth' || kind === 'wood') {
        const count = getQuality() === 'low' ? 1 : 2;
        for (let i = 0; i < count; i++) add(dust, {
          pos: position.map((v, axis) => v + normal[axis] * .045),
          v: [normal[0] * .3 + random(-.07, .07), normal[1] * .3 + random(.06, .16), normal[2] * .3 + random(-.07, .07)],
          age: 0, life: random(.32, .46), size: random(.17, .26), spin: random(-Math.PI, Math.PI),
          color: kind === 'wood' ? 0xb39a76 : kind === 'earth' ? 0xb3a086 : 0xc7bbaa, strength: .85,
        });
      }
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
      if (disposed) return;
      spray(position, [0, 0.3, 0], 'glass', getQuality() === 'low' ? 8 : 18);
    }
    function eject(origin, direction, port=null) {
      if (disposed) return;
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
      if (disposed) return;
      add(dust, {
        pos: [x, y + 0.15, z],
        v: [random(-0.3, 0.3), random(0.3, 0.9), random(-0.3, 0.3)],
        age: 0,
        life: random(0.55, 0.95),
        size: random(0.35, 0.76),
        spin: random(-Math.PI, Math.PI), color: 0xcbb58d, strength: .9,
      });
    }
    function update(dt) {
      if (disposed) return;
      for (const pool of pools) {
        const cap = getQuality() === 'low' ? Math.ceil(pool.capacity * .45) : pool.capacity;
        if (pool.items.length > cap) pool.items.splice(0, pool.items.length - cap);
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
          } else if (pool === dust) {
            const t = item.age / item.life;
            if (camera) dummy.quaternion.copy(camera.quaternion);
            dummy.rotateZ(item.spin + t * .2);
            dummy.scale.setScalar(item.size * (.7 + t));
            dustFade.setX(index, Math.min(1, item.age / .045) * Math.pow(1 - t, 1.6) * item.strength);
            pool.mesh.setColorAt(index, color.setHex(item.color));
          } else {
            dummy.rotation.set(item.age * item.spin, item.age * 4, 0);
            if (pool === fragments) {
              const shrink = 1 - Math.pow(item.age / item.life, 3);
              dummy.scale.set(item.size * item.sx * shrink, item.size * item.sy * shrink, item.size * item.sz * shrink);
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
        if (pool === dust) dustFade.needsUpdate = true;
      }
    }
    async function warm(renderer) {
      if (disposed || !camera) return;
      try {
        for (const pool of pools) pool.mesh.count = Math.max(1, pool.items.length);
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera);else renderer.compile(scene, camera);
        if (!disposed) renderer.render(scene, camera);
      } finally {
        for (const pool of pools) pool.mesh.count = disposed ? 0 : pool.items.length;
      }
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      for (const p of pools) {
        p.items.length = 0;
        p.mesh.count = 0;
        p.mesh.dispose();
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      }
      texture.dispose();dustTexture.dispose();
    }
    return { impact, shatter, eject, plume, update, warm, dispose };
  }
  global.CS16FieldEffects = { create };
})(window);
