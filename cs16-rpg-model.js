/* Original procedural RPG launcher. Shared PBR resources, no external model licence. */
(function (g) {
  'use strict';
  const cache = new WeakMap();

  function texture(T, kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    let seed = kind === 'wood' ? 7411 : 1933;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const image = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const grain = kind === 'wood'
        ? 142 + Math.sin(x * .19 + Math.sin(y * .025) * 2.8) * 25 + random() * 22
        : 150 + random() * 70;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = grain;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    if (kind === 'metal') {
      for (let i = 0; i < 95; i++) {
        const x = random() * 256, y = random() * 256;
        ctx.strokeStyle = `rgba(235,235,225,${.08 + random() * .20})`;
        ctx.lineWidth = .35 + random();
        ctx.beginPath();ctx.moveTo(x, y);ctx.lineTo(x + 3 + random() * 20, y + random() * 2 - 1);ctx.stroke();
      }
    }
    const map = new T.CanvasTexture(canvas);
    map.name = 'RPG ' + kind + ' microstructure';
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(kind === 'wood' ? 2 : 5, kind === 'wood' ? 5 : 2);
    map.anisotropy = 8;
    return map;
  }

  function source(T) {
    const basis = new T.Group();basis.name = 'weaponBasis';
    const metalMap = texture(T, 'metal'), woodMap = texture(T, 'wood');
    const standard = (name, color, metalness, roughness, map) => {
      const material = new T.MeshStandardMaterial({ name, color, metalness, roughness, map: map || null });
      if (map) { material.bumpMap = map;material.bumpScale = map === woodMap ? .0018 : .00065; }
      material.envMapIntensity = .85;material.dithering = true;
      return material;
    };
    const paint = standard('Worn olive enamel over steel', 0x58604c, .68, .46, metalMap);
    const dark = standard('Phosphated steel', 0x242a27, .82, .32, metalMap);
    const edge = standard('Polished edges and fasteners', 0x90978b, .92, .23);
    const rocketPaint = standard('Rocket olive drab', 0x62684d, .58, .40, metalMap);
    const wood = standard('Oiled laminated wood', 0x8a5a32, .03, .69, woodMap);
    const cloth = standard('Canvas sling', 0x34382c, .02, .96);
    const lens = new T.MeshPhysicalMaterial({ name: 'Coated optical glass', color: 0x6ea6a0, metalness: .18, roughness: .09, clearcoat: 1, clearcoatRoughness: .06, emissive: 0x102d31, emissiveIntensity: .15, side: T.DoubleSide });
    const marking = standard('Warm stencil paint', 0xc6c3a2, .08, .72);

    function mesh(geometry, material, name, position, rotation) {
      const m = new T.Mesh(geometry, material);m.name = name;
      if (position) m.position.set(...position);
      if (rotation) m.rotation.set(...rotation);
      basis.add(m);return m;
    }
    function tube(radius, length, z, material, name, rBack = radius, segments = 48) {
      return mesh(new T.CylinderGeometry(radius, rBack, length, segments, 2).rotateX(Math.PI / 2), material, name, [0, 0, z]);
    }
    function ring(radius, thickness, z, material, name) {
      return mesh(new T.TorusGeometry(radius, thickness, 10, 48), material, name, [0, 0, z]);
    }

    tube(.043, .90, .05, paint, 'Rolled steel launch tube');
    tube(.0455, .055, -.365, dark, 'Reinforced muzzle collar');
    tube(.046, .06, .435, dark, 'Breech reinforcement');
    tube(.042, .205, -.13, wood, 'Forward wooden heat shield');
    tube(.044, .19, .27, wood, 'Rear wooden heat shield');
    for (const center of [-.13, .27]) for (let i = -2; i <= 2; i++) ring(.0445, .0017, center + i * .036, dark, 'Heat shield binding');
    for (const z of [-.39, -.26, .02, .36, .48]) ring(.044, .004, z, edge, 'Machined tube seam');

    // A shaped charge with a real conical silhouette; the whole assembly moves during reload.
    const rocket = new T.Group();rocket.name = 'magazine';basis.add(rocket);
    const cone = new T.Mesh(new T.ConeGeometry(.073, .30, 48, 3).rotateX(-Math.PI / 2), rocketPaint);
    cone.name = 'Shaped charge cone';cone.position.z = -.55;rocket.add(cone);
    const neck = new T.Mesh(new T.CylinderGeometry(.031, .031, .12, 32).rotateX(Math.PI / 2), dark);
    neck.name = 'Rocket motor neck';neck.position.z = -.365;rocket.add(neck);
    const tip = new T.Mesh(new T.SphereGeometry(.009, 16, 10), edge);tip.position.z = -.704;rocket.add(tip);
    for (const z of [-.405, -.49]) {
      const band = new T.Mesh(new T.TorusGeometry(z === -.405 ? .069 : .064, .0025, 8, 48), marking);
      band.position.z = z;rocket.add(band);
    }

    const venturi = new T.Mesh(new T.CylinderGeometry(.090, .044, .18, 48, 2, true).rotateX(Math.PI / 2), dark);
    venturi.name = 'Flared rear venturi';venturi.position.z = .59;basis.add(venturi);
    ring(.090, .004, .68, edge, 'Venturi lip');
    const exhaust = new T.Mesh(new T.CircleGeometry(.083, 48), new T.MeshStandardMaterial({ name: 'Sooted exhaust interior', color: 0x090b0a, roughness: .97, side: T.DoubleSide }));
    exhaust.position.z = .681;basis.add(exhaust);

    const grip = mesh(new T.CapsuleGeometry(.022, .082, 6, 16), dark, 'Pistol grip', [0, -.105, .13], [-.16, 0, 0]);
    grip.scale.set(1, 1, .82);
    mesh(new T.BoxGeometry(.052, .021, .09), dark, 'Trigger housing', [0, -.056, .12]);
    mesh(new T.TorusGeometry(.032, .0035, 8, 28), edge, 'Trigger guard', [0, -.090, .078]);
    const trigger = mesh(new T.BoxGeometry(.006, .035, .008), edge, 'trigger', [0, -.076, .091], [.24, 0, 0]);
    mesh(new T.BoxGeometry(.038, .025, .11), dark, 'Secondary support grip', [0, -.061, -.205], [.12, 0, 0]);

    // Offset optical sight: rail, tube, coated lens and three adjustment drums.
    mesh(new T.BoxGeometry(.035, .022, .32), dark, 'Dovetail sight rail', [-.063, .048, -.045]);
    mesh(new T.BoxGeometry(.018, .065, .045), edge, 'Optic riser', [-.080, .079, -.06]);
    const optic = new T.Group();optic.name = 'Optical sight';optic.position.set(-.091, .123, -.055);basis.add(optic);
    const opticBody = new T.Mesh(new T.CylinderGeometry(.025, .025, .235, 32).rotateX(Math.PI / 2), dark);optic.add(opticBody);
    for (const z of [-.117, .117]) {
      const rim = new T.Mesh(new T.TorusGeometry(.025, .0035, 8, 32), edge);rim.position.z = z;optic.add(rim);
    }
    const glass = new T.Mesh(new T.CircleGeometry(.021, 32), lens);glass.position.z = -.120;glass.rotation.y = Math.PI;optic.add(glass);
    const eyepiece = new T.Mesh(new T.CircleGeometry(.021, 32), lens);eyepiece.name = 'Rear optical lens';eyepiece.position.z = .1205;optic.add(eyepiece);
    const reticleMaterial = new T.MeshBasicMaterial({ name: 'Etched optic reticle', color: 0x172320, transparent: true, opacity: .72, side: T.DoubleSide });
    for (const [w, h] of [[.034, .0008], [.0008, .034]]) {
      const line = new T.Mesh(new T.PlaneGeometry(w, h), reticleMaterial);line.position.z = .121;optic.add(line);
    }
    for (const [x, y, z, rz] of [[0, .032, 0, 0], [-.032, 0, .018, Math.PI / 2]]) {
      const drum = new T.Mesh(new T.CylinderGeometry(.013, .013, .022, 20), dark);drum.position.set(x, y, z);drum.rotation.z = rz;optic.add(drum);
    }
    mesh(new T.BoxGeometry(.012, .071, .009), edge, 'Front folding sight', [0, .078, -.335]);
    mesh(new T.BoxGeometry(.016, .052, .012), dark, 'Rear folding sight', [0, .068, .39]);

    for (const z of [-.31, -.02, .31]) for (const side of [-1, 1]) {
      mesh(new T.CylinderGeometry(.006, .006, .006, 12).rotateZ(Math.PI / 2), edge, 'Slotted receiver screw', [side * .046, 0, z]);
    }
    const slingCurve = new T.CatmullRomCurve3([
      new T.Vector3(.047, -.015, .39), new T.Vector3(.115, -.24, .27),
      new T.Vector3(.13, -.29, -.08), new T.Vector3(.047, -.02, -.32),
    ]);
    mesh(new T.TubeGeometry(slingCurve, 36, .0045, 6, false), cloth, 'Canvas carrying sling');

    basis.userData.cs16Grip = {
      normalized: true, right: [0, -.09, .13], left: [0, -.045, -.205], mag: [0, 0, -.55],
      rail: [-.091, .123, -.055], bore: [0, 0, -.71], style: 'tube',
    };
    basis.traverse(o => { if (o.isMesh) { o.castShadow = true;o.receiveShadow = true; } });
    const wrap = new T.Group();wrap.name = 'RPG detailed PBR';wrap.add(basis);
    return wrap;
  }

  function create(T, world = false) {
    let model = cache.get(T);if (!model) { model = source(T);cache.set(T, model); }
    const clone = model.clone(true);
    clone.traverse(o => { if (o.isMesh) { o.castShadow = !!world;o.receiveShadow = !!world; } });
    return clone;
  }
  g.CS16RpgModel = { create };
})(window);
