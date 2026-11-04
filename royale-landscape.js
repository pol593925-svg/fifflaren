/* Stone Coast terrain uses the same triangulation as feet, loot and ballistics. */
(function (global) {
  const C = global.RoyaleCore;
  async function create(T, parent, renderer) {
    const loader = new T.TextureLoader(),
      gltf = new T.GLTFLoader(),
      group = new T.Group();
    parent.add(group);
    const names = [
      'snow',
      'gravel',
      'forest-floor',
      'cobbles',
      'winter-trees',
      'daylight',
      'stone-Diffuse',
      'stone-nor_gl',
      'snow-normal',
    ];
    const jobs = await Promise.allSettled([
      ...names.map((n) => loader.loadAsync('assets/royale/' + n + (n === 'winter-trees' ? '.png' : '.jpg'))),
      gltf.loadAsync('models/royale/districts.glb'),
    ]);
    const failed = jobs.find((v) => v.status === 'rejected');
    if (failed) {
      for (const v of jobs) if (v.status === 'fulfilled') v.value.dispose?.();
      group.removeFromParent();
      throw failed.reason;
    }
    const [snow, gravel, forest, cobbles, trees, sky, stone, stoneN, snowN, kit] = jobs.map((v) => v.value);
    for (const t of [snow, gravel, forest, cobbles, trees, sky]) {
      t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    }
    for (const t of [snow, gravel, forest, cobbles]) t.wrapS = t.wrapT = T.RepeatWrapping;
    stone.colorSpace = T.SRGBColorSpace;
    for (const t of [stone, stoneN, snowN]) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
    }
    sky.mapping = T.EquirectangularReflectionMapping;
    const geo = new T.BufferGeometry(),
      positions = [],
      uv = [],
      weights = [],
      ix = [];
    function vertex(x, y, z, winter, ice) {
      positions.push(x, y, z);
      uv.push(x / 5, z / 5);
      weights.push(winter, ice, Math.min(1, Math.max(0, (y - 3) / 14)));
      return positions.length / 3 - 1;
    }
    // Index every hill strip independently so the holes for streets and metro never acquire a second floor.
    for (const id of C.vacant) {
      const base = positions.length / 3,
        x0 = (id % 20) * 100,
        z0 = Math.floor(id / 20) * 100,
        winter = C.alpine(x0 + 1, z0 + 1);
      for (let j = 0; j <= 10; j++)
        for (let i = 0; i <= 10; i++) {
          const x = x0 + i * 10,
            z = z0 + j * 10;
          const bank = Math.abs(z - C.riverZ(x));
          vertex(
            x,
            C.terrainHeight(x, z) + 0.014,
            z,
            winter ? 1 : 0,
            winter ? Math.max(0, Math.min(1, (15 - bank) / 5)) : 0,
          );
        }
      for (let j = 0; j < 10; j++)
        for (let i = 0; i < 10; i++) {
          const n = base + j * 11 + i;
          ix.push(n, n + 11, n + 1, n + 1, n + 11, n + 12);
        }
    }
    // Mountain ridges continue outside the playable perimeter into the haze.
    const count = 92,
      extent = 4600,
      min = -1300;
    const start = positions.length / 3;
    for (let j = 0; j <= count; j++)
      for (let i = 0; i <= count; i++) {
        const x = min + (i * extent) / count,
          z = min + (j * extent) / count,
          d = Math.max(0, -x, x - 2000, -z, z - 2000);
        const h =
          (1 - Math.exp(-d / 255)) *
            (78 +
              55 * Math.sin(x * 0.008 + z * 0.002) +
              47 * Math.cos(z * 0.009 - x * 0.005) +
              45 * (1 - Math.abs(Math.sin(z * 0.014 + x * 0.006)))) +
          Math.min(1, d / 500) * 85;
        vertex(x, h - 0.5, z, Math.min(1, Math.max(0, (h - 90) / 65)), 0);
      }
    for (let j = 0; j < count; j++)
      for (let i = 0; i < count; i++) {
        const x = min + ((i + 0.5) * extent) / count,
          z = min + ((j + 0.5) * extent) / count;
        if (x > 0 && x < 2000 && z > 0 && z < 2000) continue;
        const n = start + j * (count + 1) + i;
        ix.push(n, n + count + 1, n + 1, n + 1, n + count + 1, n + count + 2);
      }
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setAttribute('region', new T.Float32BufferAttribute(weights, 3));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    const material = new T.MeshStandardMaterial({
      map: forest,
      roughness: 0.91,
      normalMap: snowN,
      normalScale: new T.Vector2(0.35, 0.35),
    });
    material.onBeforeCompile = (s) => {
      s.uniforms.fieldSnow = { value: snow };
      s.uniforms.fieldRock = { value: stone };
      s.vertexShader =
        'attribute vec3 region;varying vec3 fieldRegion;varying vec3 fieldPos;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nfieldRegion=region;fieldPos=position;',
        );
      s.fragmentShader =
        'uniform sampler2D fieldSnow,fieldRock;varying vec3 fieldRegion;varying vec3 fieldPos;\n' +
        s.fragmentShader
          .replace(
            '#include <map_fragment>',
            `
      vec3 bare=texture2D(fieldRock,vMapUv*0.82).rgb;
      vec3 earth=texture2D(map,vMapUv).rgb;
      vec3 snow=texture2D(fieldSnow,vMapUv*0.76).rgb;
      float grain=bare.r+bare.g+bare.b;
      float exposure=clamp(fieldRegion.x+(.37-grain)*.4,0.,1.);
      vec3 summer=mix(earth*vec3(.78,.86,.66),bare,smoothstep(.43,.96,fieldRegion.z)*.62);
      float wind=texture2D(fieldRock,fieldPos.xz*.037).r;
      float bank=fieldRegion.y+.34*(1.-fieldRegion.z);
      float patch=smoothstep(.22,.66,wind+bank*.43+.05*sin(fieldPos.x*.12));
      vec3 frosted=mix(bare*vec3(.79,.78,.72),snow,mix(.29,.96,patch));
      float vein=abs(sin(fieldPos.x*.039+fieldPos.z*.10+bare.r*2.));
      vec3 ice=mix(vec3(.075,.14,.16),vec3(.64,.72,.72),clamp(snow.r*.38+smoothstep(.95,1.,vein)*.49+wind*.2,0.,1.));
      diffuseColor.rgb*=mix(mix(summer,frosted,fieldRegion.x),ice,fieldRegion.y);
      `,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.20,fieldRegion.y);',
          );
    };
    const earth = new T.Mesh(geo, material);
    earth.receiveShadow = true;
    group.add(earth);
    const landmarkMaterials = new Set();
    for (const l of C.landmarks) {
      const obj = kit.scene.getObjectByName(l.key);
      if (!obj) throw Error('Missing landmark ' + l.key);
      obj.position.set(l.x, C.terrainHeight(l.x, l.z), l.z);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        landmarkMaterials.add(o.material);
        if (!o.material.map) {
          o.material.map = o.material.name === 'timber' ? forest : gravel;
          o.material.needsUpdate = true;
        }
      });
      group.add(obj);
    }
    // Two photographic silhouettes crossed at each trunk; no alpha-blended sorting or per-tree draws.
    const stones = C.props.filter((p) => p.kind === 'rock'),
      rockGeom = new T.IcosahedronGeometry(0.5, 2),
      rockMat = new T.MeshStandardMaterial({
        map: stone,
        normalMap: stoneN,
        normalScale: new T.Vector2(0.72, 0.72),
        color: 0xb5b2a9,
        roughness: 0.9,
      }),
      rockMesh = new T.InstancedMesh(rockGeom, rockMat, stones.length),
      dummy = new T.Object3D();
    const rv = rockGeom.attributes.position;
    for (let i = 0; i < rv.count; i++) {
      const x = rv.getX(i),
        y = rv.getY(i),
        z = rv.getZ(i),
        w = 1 + 0.16 * Math.sin(x * 11 + z * 8) * Math.cos(y * 13 - z * 6);
      rv.setXYZ(i, x * w + 0.1 * y, Math.min(0.46, y * w), z * w);
    }
    rockGeom.computeVertexNormals();
    for (const [i, p] of stones.entries()) {
      dummy.position.set(p.x, p.y + p.h * 0.39, p.z);
      dummy.rotation.y = p.angle;
      dummy.scale.set(p.w, p.h, p.d);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(i, dummy.matrix);
    }
    rockMesh.computeBoundingSphere();
    rockMesh.receiveShadow = true;
    group.add(rockMesh);
    const treeMat = new T.MeshBasicMaterial({
      map: trees,
      side: T.DoubleSide,
      alphaTest: 0.44,
      color: 0xeaece4,
    });
    const treePoints = C.props.filter((p) => p.kind === 'tree');
    const pp = [],
      tt = [],
      ii = [];
    function treeCard(p, num, height, width) {
      const u = (num % 2) * 0.5;
      for (const angle of [p.angle, p.angle + Math.PI / 2]) {
        const dx = (Math.cos(angle) * width) / 2,
          dz = (Math.sin(angle) * width) / 2,
          n = pp.length / 3;
        pp.push(
          p.x - dx,
          p.y,
          p.z - dz,
          p.x + dx,
          p.y,
          p.z + dz,
          p.x - dx,
          p.y + height,
          p.z - dz,
          p.x + dx,
          p.y + height,
          p.z + dz,
        );
        tt.push(u, 0, u + 0.5, 0, u, 1, u + 0.5, 1);
        ii.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const rand = C.rng(79123);
    for (const p of treePoints) {
      if (C.alpine(p.x, p.z) && Math.abs(p.z - C.riverZ(p.x)) < 16) continue;
      const h = 8 + rand() * 9;
      treeCard(p, p.block + (p.color || 0), h, h * 0.7);
    }
    for (let i = 0; i < 1400; i++) {
      const x = rand() * 4400 - 1200,
        z = rand() * 4400 - 1200;
      if (x >= 0 && x <= 2000 && z >= 0 && z <= 2000) continue;
      const d = Math.max(0, -x, x - 2000, -z, z - 2000),
        h =
          (1 - Math.exp(-d / 255)) *
            (78 +
              55 * Math.sin(x * 0.008 + z * 0.002) +
              47 * Math.cos(z * 0.009 - x * 0.005) +
              45 * (1 - Math.abs(Math.sin(z * 0.014 + x * 0.006)))) +
          Math.min(1, d / 500) * 85;
      treeCard({ x, y: h - 1, z, angle: rand() * 6.28 }, i, 12 + rand() * 8, 7 + rand() * 4);
    }
    const tg = new T.BufferGeometry();
    tg.setAttribute('position', new T.Float32BufferAttribute(pp, 3));
    tg.setAttribute('uv', new T.Float32BufferAttribute(tt, 2));
    tg.setIndex(ii);
    const shadowPos = [],
      shadowUV = [],
      shadowIdx = [];
    for (const p of treePoints) {
      if (!C.alpine(p.x, p.z)) continue;
      const n = shadowPos.length / 3,
        w = 2.7 + (p.block % 7) * 0.24;
      for (let j = 0; j <= 5; j++)
        for (const side of [-1, 1]) {
          const k = j / 5,
            x = p.x + 9 * k + side * w * 0.63,
            z = p.z - 6 * k + side * w * 0.8;
          shadowPos.push(x, C.terrainHeight(x, z) + 0.065, z);
          shadowUV.push((p.block % 2) * 0.5 + (side === 1 ? 0.5 : 0), k);
        }
      for (let j = 0; j < 5; j++) {
        const m = n + j * 2;
        shadowIdx.push(m, m + 1, m + 2, m + 1, m + 3, m + 2);
      }
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.Float32BufferAttribute(shadowPos, 3));
    sg.setAttribute('uv', new T.Float32BufferAttribute(shadowUV, 2));
    sg.setIndex(shadowIdx);
    const sm = new T.MeshBasicMaterial({
      map: trees,
      transparent: true,
      color: 0x26374b,
      opacity: 0.36,
      depthWrite: false,
      side: T.DoubleSide,
    });
    group.add(new T.Mesh(sg, sm));
    const grove = new T.Mesh(tg, treeMat);
    grove.name = 'Forest belt';
    group.add(grove);
    return {
      sky,
      cobbles,
      gravel,
      dispose() {
        for (const m of landmarkMaterials) m.dispose();
        material.dispose();
        treeMat.dispose();
        rockMat.dispose();
        sm.dispose();
        stone.dispose();
        stoneN.dispose();
        snowN.dispose();
        for (const t of [snow, gravel, forest, cobbles, trees, sky]) t.dispose();
      },
    };
  }
  global.RoyaleLandscape = { create };
})(window);
