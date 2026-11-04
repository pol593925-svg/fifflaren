/* The city envelope is always visible from the aircraft. Street-scale details stream by block. */
(function (global) {
  'use strict';
  const C = global.RoyaleCore;
  async function create(T, scene, renderer) {
    const mats = {},
      textures = new Set(),
      resources = new Set(),
      root = new T.Group(),
      detail = new Map(),
      textureLoader = new T.TextureLoader();
    scene.add(root);
    const tex = (image, color = true) => {
      image.wrapS = image.wrapT = T.RepeatWrapping;
      if (color) image.colorSpace = T.SRGBColorSpace;
      image.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.add(image);
      return image;
    };
    const material = (name, params) => (mats[name] = new T.MeshStandardMaterial(params));
    const [atlas, surfaces, normal, concrete, rough, timber] = await Promise.all(
      [
        'city-facades.png',
        'street-surfaces.png',
        'wall-normal.jpg',
        'concrete.jpg',
        'pavement-rough.jpg',
        'timber.jpg',
      ].map((n) => textureLoader.loadAsync('assets/royale/' + n)),
    );
    tex(normal, false);
    tex(concrete);
    tex(rough, false);
    tex(timber);
    const image = atlas.image;
    for (let i = 0; i < 4; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 640;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        ((i % 2) * image.width) / 2 + 3,
        (Math.floor(i / 2) * image.height) / 2 + 3,
        image.width / 2 - 6,
        image.height / 2 - 6,
        0,
        0,
        640,
        640,
      );
      material('facade' + i, {
        map: tex(new T.CanvasTexture(canvas)),
        normalMap: normal,
        normalScale: new T.Vector2(0.17, 0.17),
        roughness: i === 1 ? 0.37 : 0.82,
        metalness: i === 1 ? 0.29 : 0.04,
      });
    }
    atlas.dispose();
    material('base', {
      map: concrete,
      normalMap: normal,
      normalScale: new T.Vector2(0.38, 0.38),
      color: 0xc9c5b8,
      roughness: 0.86,
    });
    material('coping', { map: concrete, color: 0xb7ada1, roughness: 0.89 });
    material('roof', { map: concrete, color: 0x686d69, roughness: 0.87 });
    material('vent', { color: 0x687576, roughness: 0.5, metalness: 0.55 });
    material('crate', { map: timber, color: 0xb6a48b, roughness: 0.82 });
    material('rail', { color: 0x51625f, roughness: 0.47, metalness: 0.65 });
    material('trim', { color: 0xa49e88, roughness: 0.77 });
    material('line', { color: 0xb6ac87, roughness: 0.9 });
    material('metro', { map: concrete, normalMap: normal, color: 0x89938e, roughness: 0.68 });
    material('lamp', { color: 0xf6e1ad, emissive: 0xffd398, emissiveIntensity: 0.64, roughness: 0.55 });
    const streetNames = ['road', 'sidewalk', 'shop', 'shutter'];
    for (let i = 0; i < 4; i++) {
      const img = surfaces.image,
        c = document.createElement('canvas');
      c.width = c.height = 512;
      c.getContext('2d').drawImage(
        img,
        ((i % 2) * img.width) / 2 + 2,
        (Math.floor(i / 2) * img.height) / 2 + 2,
        img.width / 2 - 4,
        img.height / 2 - 4,
        0,
        0,
        512,
        512,
      );
      material(streetNames[i], {
        map: tex(new T.CanvasTexture(c)),
        roughnessMap: rough,
        roughness: i === 2 ? 0.52 : 0.88,
        metalness: i === 2 ? 0.19 : 0.03,
      });
    }
    surfaces.dispose();
    const plate = document.createElement('canvas');
    plate.width = 512;
    plate.height = 96;
    const brush = plate.getContext('2d');
    brush.fillStyle = '#233e42';
    brush.fillRect(0, 0, 512, 96);
    brush.fillStyle = '#dbbe7a';
    brush.fillRect(0, 0, 12, 96);
    brush.font = 'bold 44px Arial';
    brush.fillText('КРЫША', 29, 64);
    brush.font = '19px Arial';
    brush.fillStyle = '#e1e6df';
    brush.fillText('ВОСТОЧНАЯ СТЕНА', 218, 59);
    material('roofSign', { map: tex(new T.CanvasTexture(plate)), roughness: 0.75 });
    const geom = (positions, uvs, indices, normals) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      if (normals) g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      else g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    };
    const landscape = await global.RoyaleLandscape.create(T, root, renderer);
    scene.background = scene.environment = landscape.sky;
    material('pavers', { map: landscape.cobbles, roughness: 0.88 });
    material('yard', { map: landscape.gravel, roughness: 0.91 });
    const [wall, wallN, tile, tileN] = await Promise.all(
      ['plaster-Diffuse', 'plaster-nor_gl', 'tile-Diffuse', 'tile-nor_gl'].map((n, i) =>
        textureLoader.loadAsync('assets/royale/' + n + '.jpg').then((t) => tex(t, i % 2 === 0)),
      ),
    );
    material('painted', {
      map: wall,
      color: 0x879d94,
      roughness: 0.93,
      normalMap: wallN,
      normalScale: new T.Vector2(0.59, 0.59),
    });
    material('tile', {
      map: tile,
      color: 0xb4b8ac,
      roughness: 0.63,
      normalMap: tileN,
      normalScale: new T.Vector2(0.46, 0.46),
    });
    material('stair', { map: concrete, color: 0x787775, roughness: 0.95 });
    const cube = new T.BoxGeometry(1, 1, 1);
    function batches(records, parent, shadow = true) {
      const groups = new Map();
      for (const b of records) {
        const baseMat = b.mat || 'base';
        for (let f = 0; f < 6; f++) {
          if ((baseMat === 'line' || ['sidewalk', 'pavers', 'yard', 'tile'].includes(baseMat)) && f !== 2)
            continue;
          const owner = C.buildings[b.owner],
            facadeBase =
              baseMat === 'base' &&
              owner &&
              b.d < 0.5 &&
              b.w > 4 &&
              ((f === 4 && b.z === owner.back) || (f === 5 && b.z === owner.front));
          let faceMaterial = baseMat;
          if (
            owner &&
            baseMat === 'base' &&
            ((b.z === owner.back && f === 5) ||
              (b.z === owner.front && f === 4) ||
              (b.x === owner.left && f === 0) ||
              (b.x === owner.right && f === 1))
          )
            faceMaterial = 'painted';
          if (owner?.cabin && baseMat.startsWith('facade')) faceMaterial = 'crate';
          if (facadeBase) faceMaterial = owner.kind === 2 ? 'shutter' : 'shop';
          if (baseMat.startsWith('facade') && f === 2) faceMaterial = 'roof';
          if (baseMat.startsWith('facade') && f === 3) faceMaterial = 'painted';
          if (owner && b.d < 0.5 && ((b.z === owner.back && f === 5) || (b.z === owner.front && f === 4)))
            faceMaterial = 'painted';
          if (owner && b.w < 0.5 && ((b.x === owner.left && f === 0) || (b.x === owner.right && f === 1)))
            faceMaterial = 'painted';
          if (!groups.has(faceMaterial)) groups.set(faceMaterial, { pos: [], norm: [], uv: [], idx: [] });
          const a = groups.get(faceMaterial),
            base = a.pos.length / 3;
          for (let k = 0; k < 4; k++) {
            const j = f * 4 + k,
              px = cube.attributes.position.getX(j) * b.w + b.x,
              py = (cube.attributes.position.getY(j) + 0.5) * b.h + b.y,
              pz = cube.attributes.position.getZ(j) * b.d + b.z;
            const nx = cube.attributes.normal.getX(j),
              ny = cube.attributes.normal.getY(j),
              nz = cube.attributes.normal.getZ(j);
            a.pos.push(px, py, pz);
            a.norm.push(nx, ny, nz);
            if (baseMat === 'roofSign') {
              a.uv.push(cube.attributes.uv.getX(j), cube.attributes.uv.getY(j));
              continue;
            }
            if (facadeBase) {
              a.uv.push(((px - b.x + b.w / 2) * Math.max(1, Math.round(b.w / 6))) / b.w, py / 3.8);
              continue;
            }
            const span = baseMat.startsWith('facade') ? 12 : 4;
            a.uv.push(
              (Math.abs(nx) > 0.5 ? pz : px) / span,
              (Math.abs(ny) > 0.5 ? pz : py) / (baseMat.startsWith('facade') ? 10 : span),
            );
          }
          a.idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
        }
      }
      for (const [name, a] of groups) {
        const m = new T.Mesh(geom(a.pos, a.uv, a.idx, a.norm), mats[name]);
        m.name = 'BR ' + name;
        m.castShadow = shadow;
        m.receiveShadow = true;
        parent.add(m);
      }
    }
    const roads = [],
      floors = [],
      edgesX = new Set([0, 2000]),
      edgesZ = new Set([0, 2000]);
    for (let i = 0; i < 20; i++)
      for (const off of [0, 11, 89, 100]) {
        edgesX.add(i * 100 + off);
        edgesZ.add(i * 100 + off);
      }
    for (const r of C.ramps) {
      const x2 = r.x + 32 * r.dx,
        z2 = r.z + 32 * r.dz;
      for (const x of [Math.min(r.x, x2) - Math.abs(r.dz) * 5.6, Math.max(r.x, x2) + Math.abs(r.dz) * 5.6])
        edgesX.add(x);
      for (const z of [Math.min(r.z, z2) - Math.abs(r.dx) * 5.6, Math.max(r.z, z2) + Math.abs(r.dx) * 5.6])
        edgesZ.add(z);
    }
    const xs = [...edgesX].sort((a, b) => a - b),
      zs = [...edgesZ].sort((a, b) => a - b),
      pos = [],
      uv = [],
      idx = [];
    function quad(points) {
      const i = pos.length / 3;
      for (const [x, y, z] of points) {
        pos.push(x, y, z);
        uv.push(x / 7, z / 7);
      }
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
    for (let x = 1; x < xs.length; x++)
      for (let z = 1; z < zs.length; z++) {
        const a = xs[x - 1],
          b = xs[x],
          c = zs[z - 1],
          d = zs[z];
        const midX = (a + b) / 2,
          midZ = (c + d) / 2;
        if (
          C.rampAt(midX, midZ) !== null ||
          C.vacant.has(Math.floor(midZ / 100) * 20 + Math.floor(midX / 100)) ||
          (midX % 100 > 11 && midX % 100 < 89 && midZ % 100 > 11 && midZ % 100 < 89)
        )
          continue;
        quad([
          [a, 0, c],
          [a, 0, d],
          [b, 0, d],
          [b, 0, c],
        ]);
      }
    for (const r of C.ramps) {
      const sideX = r.dz * 5.6,
        sideZ = -r.dx * 5.6,
        ex = r.x + r.dx * 32,
        ez = r.z + r.dz * 32;
      let points = [
        [r.x - sideX, -8, r.z - sideZ],
        [r.x + sideX, -8, r.z + sideZ],
        [ex + sideX, 0, ez + sideZ],
        [ex - sideX, 0, ez - sideZ],
      ];
      quad(points);
      quad([...points].reverse());
      for (let j = 1; j < 15; j++) {
        const t = j * 2;
        roads.push({
          x: r.x + t * r.dx,
          y: -8 + t * 0.25 + 0.025,
          z: r.z + t * r.dz,
          w: r.dx ? 0.14 : 11,
          d: r.dz ? 0.14 : 11,
          h: 0.035,
          mat: 'line',
        });
      }
      for (const sign of [-1, 1])
        for (let t = 0; t < 32; t += 2) {
          roads.push({
            x: r.x + r.dx * (t + 1) + sideX * sign,
            y: -8 + t * 0.25,
            z: r.z + r.dz * (t + 1) + sideZ * sign,
            w: r.dx ? 2 : 0.2,
            d: r.dz ? 2 : 0.2,
            h: 8 - t * 0.25 + 0.22,
            mat: 'metro',
          });
        }
    }
    const pavement = new T.Mesh(geom(pos, uv, idx), mats.road);
    pavement.receiveShadow = true;
    root.add(pavement);
    for (let i = 0; i < 20; i++)
      for (let j = 0; j < 20; j++) {
        const x = i * 100 + 50,
          z = j * 100 + 50;
        if (!C.vacant.has(j * 20 + i))
          roads.push({
            x,
            y: 0.005,
            z,
            w: 78,
            h: 0.1,
            d: 78,
            mat: i >= 14 ? 'yard' : j > 9 ? 'pavers' : 'sidewalk',
          });
        if (C.alpine(x, z)) continue;
        for (let k = 0; k < 6; k++) {
          const px = i * 100 + 8 + k * 15,
            pz = j * 100 + 8 + k * 15;
          if (C.rampAt(px, j * 100) === null)
            roads.push({ x: px, y: 0.015, z: j * 100, w: 6, h: 0.014, d: 0.14, mat: 'line' });
          if (C.rampAt(i * 100, pz) === null)
            roads.push({ x: i * 100, y: 0.018, z: pz, w: 0.14, h: 0.014, d: 6, mat: 'line' });
        }
      }
    for (const r of C.metro) {
      const x = (r.x1 + r.x2) / 2,
        z = (r.z1 + r.z2) / 2,
        w = r.x2 - r.x1,
        d = r.z2 - r.z1;
      floors.push(
        { x, y: -8.18, z, w, d, h: 0.18, mat: 'metro' },
        { x, y: -0.36, z, w, d, h: 0.34, mat: 'metro' },
      );
      const longX = w > d,
        length = Math.max(w, d);
      for (let i = 0; i < length; i += 4)
        for (const side of [-1, 1]) {
          const wx = longX ? r.x1 + i + 2 : x + (side * w) / 2,
            wz = longX ? z + (side * d) / 2 : r.z1 + i + 2,
            ox = wx + (longX ? 0 : side * 0.22),
            oz = wz + (longX ? side * 0.22 : 0);
          if (C.underground(ox, oz) || C.rampAt(ox, oz) !== null) continue;
          floors.push({
            x: wx,
            y: -8,
            z: wz,
            w: longX ? 4 : 0.18,
            d: longX ? 0.18 : 4,
            h: 7.65,
            mat: 'metro',
          });
          if (i % 20 === 0)
            floors.push({
              x: wx - (longX ? 0 : side * 0.18),
              y: -3.4,
              z: wz - (longX ? side * 0.18 : 0),
              w: longX ? 1.6 : 0.15,
              d: longX ? 0.15 : 1.6,
              h: 0.18,
              mat: 'lamp',
            });
        }
    }
    const shellRecords = [],
      interiorRecords = new Map();
    function enqueue(map, key, value) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(value);
    }
    for (const rec of C.boxes) {
      if (rec.owner < 0) continue;
      const h = C.buildings[rec.owner],
        shell =
          rec.mat.startsWith('facade') ||
          (rec.mat === 'base' &&
            (rec.x === h.left || rec.x === h.right || rec.z === h.front || rec.z === h.back));
      if (shell) shellRecords.push(rec);
      else enqueue(interiorRecords, Math.floor(h.z / 100) * 20 + Math.floor(h.x / 100), rec);
    }
    batches(shellRecords, root);
    batches(roads, root, false);
    const skyline = new T.Group();
    const shells = C.buildings.map((h) => ({
      x: h.x,
      y: 0,
      z: h.z,
      w: h.w,
      h: h.h,
      d: h.d,
      mat: 'facade' + h.kind,
    }));
    batches(shells, skyline, false);
    batches(
      roads.filter((r) => ['sidewalk', 'pavers', 'yard'].includes(r.mat)),
      skyline,
      false,
    );
    skyline.traverse((o) => {
      if (!o.isMesh) return;
      const old = o.material,
        m = new T.MeshLambertMaterial({ map: old.map, color: old.color });
      resources.add(m);
      o.material = m;
    });
    root.add(skyline);
    const cityShells = root.children.filter((o) => o.isMesh && o.name.startsWith('BR '));
    const metroGroup = new T.Group();
    batches(floors, metroGroup, false);
    root.add(metroGroup);
    scene.fog = new T.FogExp2(0xa3b4c2, 0.00086);
    scene.add(new T.HemisphereLight(0xdce8f6, 0x696250, 1.04));
    const sun = new T.DirectionalLight(0xffe8c5, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 350 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.06;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);
    const landingLamp = new T.PointLight(0xffcb8a, 0, 12, 2);
    scene.add(landingLamp);
    const metroLight = new T.PointLight(0xffddac, 0, 26, 2);
    scene.add(metroLight);
    // Batch street furniture city-wide. Visible silhouettes use the same positions as the authoritative cover.
    const streetMeshes = [],
      props = C.props,
      dummy = new T.Object3D(),
      propGroups = new Map(),
      shapes = new Map();
    function propShape(key, geometry, material) {
      shapes.set(key, { geometry, material });
    }
    const dark = material('rubber', { color: 0x252b2b, roughness: 0.9 }),
      metal = material('carTrim', { color: 0x88928d, metalness: 0.65, roughness: 0.36 }),
      paint = material('carPaint', { color: 0xffffff, metalness: 0.42, roughness: 0.32 }),
      glass = material('autoGlass', { color: 0x3d555b, metalness: 0.6, roughness: 0.19 }),
      brick = material('stackBrick', { map: concrete, color: 0xa4816d, roughness: 0.9 });
    const cab = new T.BoxGeometry(1, 1, 1),
      v = cab.attributes.position;
    for (let n = 0; n < v.count; n++)
      if (v.getY(n) > 0) {
        v.setX(n, v.getX(n) * 0.84);
        v.setZ(n, v.getZ(n) * 0.7);
      }
    cab.computeVertexNormals();
    propShape('body', new T.BoxGeometry(1, 1, 1), paint);
    propShape('glass', cab, glass);
    propShape('wheel', new T.CylinderGeometry(0.5, 0.5, 1, 10).rotateZ(Math.PI / 2), dark);
    propShape('trim', new T.BoxGeometry(1, 1, 1), metal);
    propShape('lights', new T.BoxGeometry(1, 1, 1), mats.lamp);
    propShape('stack', new T.CylinderGeometry(0.4, 0.5, 1, 14), brick);
    propShape('band', new T.CylinderGeometry(0.5, 0.5, 1, 14), metal);
    const palette = [0x526b77, 0x7c483b, 0xa6a89f, 0x5c6557, 0x494e53];
    function addShape(p, key, dx, y, dz, w, h, d, color = 0xffffff, roll = 0) {
      const cs = Math.cos(p.angle),
        sn = Math.sin(p.angle);
      dummy.position.set(p.x + cs * dx + sn * dz, p.y + y, p.z - sn * dx + cs * dz);
      dummy.rotation.set(0, p.angle, roll, 'YXZ');
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      if (!propGroups.has(key)) propGroups.set(key, []);
      propGroups.get(key).push([dummy.matrix.clone(), color]);
    }
    for (const p of props) {
      if (p.kind === 'tree' || p.kind === 'rock') continue;
      if (p.kind === 'stack') {
        addShape(p, 'stack', 0, 9, 0, 1.65, 18, 1.65);
        for (const y of [1, 8.5, 15.2, 17.8])
          addShape(p, 'band', 0, y, 0, y < 12 ? 1.6 : 1.4, 0.28, y < 12 ? 1.6 : 1.4);
      } else {
        const van = p.kind === 'van',
          color = palette[p.color];
        addShape(p, 'body', 0, 0.56, 0, 1.86, 0.51, 4.45, color);
        addShape(p, 'glass', 0, van ? 1.37 : 1.09, 0.1, 1.68, van ? 1.2 : 0.64, van ? 3.55 : 2.65);
        addShape(p, 'body', 0, van ? 1.97 : 1.41, 0.1, 1.45, 0.09, van ? 2.64 : 1.93, color);
        if (van) addShape(p, 'body', 0, 1.32, 1.04, 1.65, 1.1, 1.69, color);
        for (const side of [-1, 1]) {
          for (const end of [-1, 1]) addShape(p, 'wheel', side * 0.88, 0.34, end * 1.39, 0.22, 0.68, 0.68);
          addShape(p, 'lights', side * 0.64, 0.64, -2.24, 0.42, 0.14, 0.035);
          addShape(p, 'trim', side * 0.836, 1.09, 0.02, 0.055, 0.5, 0.14);
        }
        for (const end of [-1, 1]) addShape(p, 'trim', 0, 0.37, end * 2.22, 1.84, 0.12, 0.1);
      }
    }
    for (const [key, instances] of propGroups) {
      const { geometry, material } = shapes.get(key),
        mesh = new T.InstancedMesh(geometry, material, instances.length);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      root.add(mesh);
      streetMeshes.push({ mesh, instances });
    }
    const tint = new T.Color();
    let propsX = Infinity,
      propsZ = Infinity,
      propsAir = null;
    function refreshProps(cam, fly) {
      if (propsAir === fly && Math.hypot(cam.position.x - propsX, cam.position.z - propsZ) < 28) return;
      propsAir = fly;
      propsX = cam.position.x;
      propsZ = cam.position.z;
      for (const { mesh, instances } of streetMeshes) {
        mesh.visible = !fly;
        if (fly) continue;
        let count = 0;
        for (const [matrix, color] of instances) {
          const e = matrix.elements;
          if ((e[12] - propsX) ** 2 + (e[14] - propsZ) ** 2 > 350 ** 2) continue;
          mesh.setMatrixAt(count, matrix);
          mesh.setColorAt(count++, tint.setHex(color));
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    function blockDetail(cx, cz) {
      const records = [...(interiorRecords.get(cz * 20 + cx) || [])];
      for (const b of C.buildings) {
        if (Math.floor(b.x / 100) !== cx || Math.floor(b.z / 100) !== cz) continue;
        records.push({ x: b.x, y: 0.106, z: b.z, w: b.w - 0.35, h: 0.006, d: b.d - 0.35, mat: 'tile' });
        if (b.cabin) {
          for (let y = 0.48; y < b.h; y += 0.55)
            for (const side of [-1, 1]) {
              const zz = side < 0 ? b.front - 0.21 : b.back + 0.21;
              for (const dir of [-1, 1])
                records.push({
                  x: b.x + dir * (b.w / 4 + 0.9),
                  y,
                  z: zz,
                  w: (b.w - 3.6) / 2,
                  h: 0.08,
                  d: 0.16,
                  mat: 'crate',
                });
            }
        }
        if (b.hasStairs) {
          const sx = b.stairX,
            rail = sx + 1.46;
          for (let i = 0; i < 20; i++) {
            const z = b.z - 4 + (i + 0.5) * 0.4,
              y = (i + 1) * 0.19;
            records.push({ x: rail, y: y + 0.98, z, w: 0.09, h: 0.09, d: 0.42, mat: 'crate' });
            if (i % 3 === 0) records.push({ x: rail, y, z, w: 0.045, h: 1.02, d: 0.045, mat: 'rail' });
          }
          // The boarded service door is on the side wall, outside the two street entrances.
          const zz = b.z + 8,
            xx = b.left + 0.25;
          records.push({ x: xx, y: 0.11, z: zz, w: 0.12, h: 2.48, d: 1.55, mat: 'crate' });
          for (const side of [-1, 1])
            records.push({
              x: xx + 0.1,
              y: 0.11,
              z: zz + side * 0.79,
              w: 0.11,
              h: 2.55,
              d: 0.1,
              mat: 'trim',
            });
          for (const y of [0.72, 1.56])
            records.push({ x: xx + 0.14, y, z: zz, w: 0.12, h: 0.13, d: 1.83, mat: 'crate' });
          records.push(
            { x: xx + 0.12, y: 2.59, z: zz, w: 0.13, h: 0.12, d: 1.67, mat: 'trim' },
            { x: sx, y: 6.5, z: b.z + 6, w: 0.36, h: 0.15, d: 0.36, mat: 'lamp' },
          );
        }
        for (const sign of [-1, 1]) {
          // Residential cornices and projecting tiled awnings give the street a readable silhouette.
          const zz = sign < 0 ? b.front - 0.4 : b.back + 0.4;
          if (b.kind === 0 || b.kind === 3)
            for (let xx = b.left + 4; xx < b.right - 2; xx += 8) {
              records.push({ x: xx, y: 3.32, z: zz, w: 3.7, h: 0.22, d: 1.45, mat: 'crate' });
              for (const side of [-1, 1])
                records.push({ x: xx + side * 1.5, y: 2.9, z: zz, w: 0.11, h: 0.53, d: 0.65, mat: 'rail' });
            }
        }
        for (const z of [b.z - 0.48, b.z + 0.48])
          records.push({ x: b.ladder.x, y: 0.1, z, w: 0.07, h: b.h + 0.85, d: 0.07, mat: 'rail' });
        for (let y = 0.35; y < b.h + 0.6; y += 0.39)
          records.push({ x: b.ladder.x, y, z: b.z, w: 0.09, h: 0.065, d: 1.03, mat: 'trim' });
        for (const z of [b.front - 0.19, b.back + 0.19]) {
          records.push({ x: b.x, y: 2.92, z, w: 4.4, h: 0.12, d: 1.2, mat: 'rail' });
          for (let y = 7; y < b.h - 0.7; y += 6.5) {
            records.push({ x: b.x, y, z, w: b.w + 0.32, h: 0.13, d: 0.5, mat: 'coping' });
            if (b.kind !== 1)
              for (let x = b.left + 5; x < b.right - 2; x += 8)
                records.push({ x, y: y - 0.66, z, w: 1.15, h: 0.58, d: 0.47, mat: 'vent' });
          }
        }
        for (const zz of [b.front - 0.27, b.back + 0.27])
          for (const side of [-1, 1]) {
            const x = b.x + side * 2.01;
            records.push(
              { x, y: 0.14, z: zz, w: 0.19, h: 2.8, d: 0.24, mat: 'rail' },
              { x: x + side * 0.6, y: 2.43, z: zz, w: 0.36, h: 0.15, d: 0.27, mat: 'lamp' },
            );
          }
        for (const zz of [b.front - 0.25, b.back + 0.25])
          records.push({ x: b.x, y: 3.26, z: zz, w: 3.1, h: 0.49, d: 0.07, mat: 'roofSign' });
        for (const side of [-1, 1]) {
          records.push({
            x: b.x + b.w * 0.18,
            y: 3.64,
            z: b.z + side * b.d * 0.22,
            w: 2.3,
            h: 0.06,
            d: 0.28,
            mat: 'lamp',
          });
          records.push({
            x: b.x + b.w * 0.25,
            y: 0.94,
            z: b.z + side * 0.9,
            w: 0.73,
            h: 0.32,
            d: 0.38,
            mat: 'vent',
          });
        }
        for (const k of [-1, 1])
          records.push({ x: b.x + k * b.w * 0.26, y: b.h, z: b.z, w: 0.8, h: 2.2, d: 0.9, mat: 'vent' });
      }
      for (const side of [-1, 1]) {
        const x = cx * 100 + 50 + side * 39,
          z = cz * 100 + 36;
        records.push(
          { x, y: 0.12, z, w: 0.15, h: 5.8, d: 0.15, mat: 'rail' },
          { x: x + side * 0.65, y: 5.78, z, w: 1.45, h: 0.13, d: 0.18, mat: 'rail' },
          { x: x + side * 1.25, y: 5.65, z, w: 0.58, h: 0.15, d: 0.33, mat: 'lamp' },
        );
      }
      const group = new T.Group();
      group.name = 'Street detail ' + cx + ',' + cz;
      batches(records, group);
      root.add(group);
      return group;
    }
    function free(group) {
      group.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
      });
      group.removeFromParent();
    }
    let last = -Infinity,
      shadowX = Infinity,
      shadowZ = Infinity,
      shadowY = Infinity;
    sun.shadow.autoUpdate = false;
    return {
      root,
      update(cam, t, quality) {
        const flying = cam.position.y > 105;
        skyline.visible = flying;
        for (const m of cityShells) m.visible = !flying;
        const room = C.buildingAt(cam.position.x, cam.position.z);
        const inside = !!room && cam.position.y < room.h;
        landingLamp.intensity = inside ? 38 : 0;
        if (inside)
          landingLamp.position.set(
            room.hasStairs ? room.stairX : room.x,
            room.hasStairs ? 6.25 : 3.4,
            room.z + (room.hasStairs ? 6 : 0),
          );
        metroGroup.visible =
          cam.position.y < 0 ||
          C.ramps.some((r) => Math.hypot(cam.position.x - r.x, cam.position.z - r.z) < 70);
        refreshProps(cam, flying);
        sun.target.position.set(
          cam.position.x,
          Math.max(0, cam.position.y < 80 ? cam.position.y : 0),
          cam.position.z,
        );
        sun.position.set(
          sun.target.position.x - 100,
          sun.target.position.y + 135,
          sun.target.position.z + 80,
        );
        sun.castShadow = quality !== 'low' && cam.position.y < 95;
        if (
          sun.castShadow &&
          (Math.hypot(cam.position.x - shadowX, cam.position.z - shadowZ) > 2 ||
            Math.abs(cam.position.y - shadowY) > 1)
        ) {
          sun.shadow.needsUpdate = true;
          shadowX = cam.position.x;
          shadowZ = cam.position.z;
          shadowY = cam.position.y;
        }
        metroLight.position.copy(cam.position);
        metroLight.position.y += 1;
        metroLight.intensity = cam.position.y < -0.3 ? 19 : 0;
        if (t - last < 450) return;
        last = t;
        const want = new Set(),
          radius = quality === 'high' ? 2 : 1,
          cx = Math.floor(cam.position.x / 100),
          cz = Math.floor(cam.position.z / 100);
        if (cam.position.y < 120)
          for (let z = cz - radius; z <= cz + radius; z++)
            for (let x = cx - radius; x <= cx + radius; x++) {
              if (x < 0 || x >= 20 || z < 0 || z >= 20) continue;
              const key = x + ',' + z;
              // Only nearby street dressing needs full geometry; long-range shells remain visible.
              if (
                Math.hypot(cam.position.x - (x * 100 + 50), cam.position.z - (z * 100 + 50)) >
                  (quality === 'high' ? 145 : 100) &&
                !(x === cx && z === cz)
              )
                continue;
              want.add(key);
              if (!detail.has(key) && Math.abs(x - cx) + Math.abs(z - cz) < 2)
                detail.set(key, blockDetail(x, z));
            }
        const pending = [...want].filter((k) => !detail.has(k));
        if (pending.length) {
          const [x, z] = pending[0].split(',').map(Number);
          detail.set(pending[0], blockDetail(x, z));
        }
        for (const [k, v] of detail)
          if (!want.has(k)) {
            free(v);
            detail.delete(k);
          }
      },
      dispose() {
        free(root);
        landscape.dispose();
        scene.environment = scene.background = null;
        cube.dispose();
        for (const m of Object.values(mats)) m.dispose();
        textures.forEach((t) => t.dispose());
        resources.forEach((m) => m.dispose());
        sun.shadow.map?.dispose();
        sun.removeFromParent();
        sun.target.removeFromParent();
        metroLight.removeFromParent();
        landingLamp.removeFromParent();
      },
    };
  }
  global.RoyaleCity = { create };
})(window);
