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
    const cube = new T.BoxGeometry(1, 1, 1);
    function batches(records, parent, shadow = true) {
      const groups = new Map();
      for (const b of records) {
        const baseMat = b.mat || 'base';
        for (let f = 0; f < 6; f++) {
          const top = f === 2,
            mat = baseMat.startsWith('facade') && top ? 'roof' : baseMat;
          const owner = C.buildings[b.owner],
            facadeBase = baseMat === 'base' && owner && b.d < 0.5 && b.w > 4 && (f === 4 || f === 5);
          const faceMaterial = facadeBase ? (owner.kind === 2 ? 'shutter' : 'shop') : mat;
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
      for (const off of [11, 89]) {
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
        roads.push({ x, y: 0.005, z, w: 78, h: 0.1, d: 78, mat: 'sidewalk' });
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
    const streetShapes = new Set(['vehicleBody', 'vehicleCab', 'trunk', 'chimney']);
    batches(
      C.boxes.filter((b) => !streetShapes.has(b.mat)),
      root,
    );
    batches(roads, root, false);
    batches(floors, root, false);
    // Distant ridges and a layered atmospheric sky frame the city during the flight.
    // Fill the entire horizon outside the combat boundary without covering metro openings.
    const terrainPts = [],
      terrainUV = [],
      terrainIx = [];
    for (let z = -1100; z < 3100; z += 100)
      for (let x = -1100; x < 3100; x += 100) {
        if (x >= 0 && x < 2000 && z >= 0 && z < 2000) continue;
        const start = terrainPts.length / 3;
        for (const [xx, zz] of [
          [x, z],
          [x, z + 100],
          [x + 100, z + 100],
          [x + 100, z],
        ]) {
          const dist = Math.max(0, -xx, xx - 2000, -zz, zz - 2000),
            h =
              -0.28 +
              Math.min(1, dist / 550) *
                (20 + 18 * Math.sin(xx * 0.008) * Math.cos(zz * 0.006) + 12 * Math.sin((xx + zz) * 0.004));
          terrainPts.push(xx, h, zz);
          terrainUV.push(xx / 28, zz / 28);
        }
        terrainIx.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    material('outskirts', { map: concrete, color: 0x7c8469, roughness: 1 });
    root.add(new T.Mesh(geom(terrainPts, terrainUV, terrainIx), mats.outskirts));
    const hillside = [],
      hidx = [];
    for (let band = 0; band < 4; band++)
      for (let i = 0; i <= 100; i++) {
        const a = (i / 100) * Math.PI * 2,
          r = 1610 + band * 145,
          h = band === 0 ? -8 : band === 3 ? 30 : 65 + 50 * Math.sin(a * 7 + 0.4) + 25 * Math.cos(a * 13);
        hillside.push(1000 + Math.cos(a) * r, h, 1000 + Math.sin(a) * r);
        if (i && band) {
          const n = band * 101 + i;
          hidx.push(n - 102, n - 101, n, n - 102, n, n - 1);
        }
      }
    const ridgeGeo = new T.BufferGeometry();
    ridgeGeo.setAttribute('position', new T.Float32BufferAttribute(hillside, 3));
    ridgeGeo.setIndex(hidx);
    ridgeGeo.computeVertexNormals();
    const ridgeMat = new T.MeshStandardMaterial({ color: 0x727b75, side: T.DoubleSide, roughness: 1 });
    resources.add(ridgeMat);
    root.add(new T.Mesh(ridgeGeo, ridgeMat));
    const skyMat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader:
        'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=clamp(d.y*1.5,0.,1.);vec3 sky=mix(vec3(.65,.68,.68),vec3(.20,.36,.52),pow(h,.55));float cloud=sin(d.x*18.+d.z*9.)*.5+sin(d.z*29.-d.x*7.)*.3+sin(d.x*51.+d.z*37.)*.2;sky=mix(sky,vec3(.82,.82,.79),smoothstep(.15,.80,cloud)*.32*h);float sun=max(0.,dot(d,normalize(vec3(-.65,.48,.38))));sky+=vec3(.57,.43,.25)*pow(sun,40.)+vec3(.8,.7,.55)*pow(sun,1200.);gl_FragColor=vec4(sky,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`,
    });
    resources.add(skyMat);
    const sky = new T.Mesh(new T.SphereGeometry(4400, 32, 16), skyMat);
    sky.frustumCulled = false;
    root.add(sky);
    // A small baked sky probe supplies reflections for windows, painted metal and the first-person weapon.
    const probe = new T.PMREMGenerator(renderer),
      probeScene = new T.Scene(),
      probeSky = new T.Mesh(new T.SphereGeometry(4, 24, 12), skyMat);
    probeScene.add(probeSky);
    const env = probe.fromScene(probeScene, 0, 0.1, 12);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.65;
    probeSky.geometry.dispose();
    probe.dispose();
    scene.fog = new T.FogExp2(0xaab7b8, 0.00066);
    scene.add(new T.HemisphereLight(0xe5eff7, 0x7c7770, 1.2));
    const sun = new T.DirectionalLight(0xffe8c5, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 350 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.06;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);
    const metroLight = new T.PointLight(0xffddac, 0, 26, 2);
    scene.add(metroLight);
    // Batch street furniture city-wide. Visible silhouettes use the same positions as the authoritative cover.
    const props = C.props,
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
      foliage = material('leaves', { color: 0xffffff, flatShading: true, roughness: 0.97 }),
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
    propShape('bark', new T.CylinderGeometry(0.35, 0.5, 1, 8), mats.crate);
    propShape('leaf', new T.IcosahedronGeometry(0.55, 1), foliage);
    const palette = [0x526b77, 0x7c483b, 0xa6a89f, 0x5c6557, 0x494e53],
      greens = [0x647b4e, 0x536b43, 0x839155, 0x48644c];
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
      if (p.kind === 'tree') {
        addShape(p, 'bark', 0, 2.1, 0, 0.48, 4.2, 0.48);
        const r = C.rng(p.block + 81);
        for (let i = 0; i < 6; i++) {
          const a = i * 2.4,
            x = Math.cos(a) * (i ? 1.03 : 0),
            z = Math.sin(a) * (i ? 1.03 : 0);
          addShape(
            p,
            'leaf',
            x,
            4.1 + r() * 1.2 + (i === 0 ? 0.8 : 0),
            z,
            2.7 + r(),
            3.0 + r(),
            2.7 + r(),
            greens[(p.block + i) % 4],
          );
        }
      } else if (p.kind === 'stack') {
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
      for (let i = 0; i < instances.length; i++) {
        mesh.setMatrixAt(i, instances[i][0]);
        mesh.setColorAt(i, new T.Color(instances[i][1]));
      }
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    function blockDetail(cx, cz) {
      const records = [];
      for (const b of C.buildings) {
        if (Math.floor(b.x / 100) !== cx || Math.floor(b.z / 100) !== cz) continue;
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
    let last = -Infinity;
    return {
      root,
      update(cam, t, quality) {
        sky.position.copy(cam.position);
        sun.target.position.set(
          cam.position.x,
          Math.max(0, cam.position.y < 80 ? cam.position.y : 0),
          cam.position.z,
        );
        sun.position.copy(sun.target.position).add(new T.Vector3(-110, 115, 75));
        sun.castShadow = quality !== 'low' && cam.position.y < 95;
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
              want.add(key);
              if (!detail.has(key)) detail.set(key, blockDetail(x, z));
            }
        for (const [k, v] of detail)
          if (!want.has(k)) {
            free(v);
            detail.delete(k);
          }
      },
      dispose() {
        free(root);
        env.dispose();
        scene.environment = null;
        cube.dispose();
        for (const m of Object.values(mats)) m.dispose();
        textures.forEach((t) => t.dispose());
        resources.forEach((m) => m.dispose());
        sun.shadow.map?.dispose();
        sun.removeFromParent();
        sun.target.removeFromParent();
        metroLight.removeFromParent();
      },
    };
  }
  global.RoyaleCity = { create };
})(window);
