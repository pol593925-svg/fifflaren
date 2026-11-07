/* Grip locations are in the Blender weapon axes, before each game's length and centre adjustments. */
(function (g) {
  'use strict';
  // Sharing one material between rigid torsos and skinned arms makes Three.js
  // rebuild program parameters on almost every draw. Keep one arm variant per
  // source material, shared by all players and released with its source asset.
  const armMaterials = new WeakMap();
  function armMaterial(source) {
    if (Array.isArray(source)) return source.map(armMaterial);
    let material = armMaterials.get(source);
    if (!material) {
      material = source.clone();
      armMaterials.set(source, material);
      const dispose = () => {
        material.dispose();
        armMaterials.delete(source);
        source.removeEventListener('dispose', dispose);
      };
      source.addEventListener('dispose', dispose);
    }
    return material;
  }
  const pistols = new Set(['usp', 'glock', 'deagle', 'fiveseven', 'tec9', 'elite']);
  function contacts(id) {
    if (pistols.has(id)) {
      const twin = id === 'elite';
      return {
        right: [twin ? 0.09 : 0, -0.074, 0.025],
        left: [twin ? -0.09 : 0, -0.088, 0.04],
        mag: [twin ? 0.09 : 0, -0.115, 0.027],
        style: twin ? 'twin' : 'cup',
      };
    }
    switch (id) {
      case 'mp7':
        return {
          right: [0, -0.065, 0.008],
          left: [0, -0.057, -0.155],
          mag: [0, -0.15, 0.012],
          style: 'vertical',
        };
      case 'vector':
        return {
          right: [0, -0.06, 0.06],
          left: [0, -0.068, -0.138],
          mag: [0, -0.161, -0.055],
          style: 'vertical',
        };
      case 'bizon':
        return {
          right: [0, -0.083, 0.062],
          left: [0, -0.048, -0.207],
          mag: [0, -0.052, -0.205],
          style: 'tube',
        };
      case 'knife':
        return { right: [0, 0, 0.055], style: 'blade' };
      case 'grenade':
      case 'he':
      case 'flash':
      case 'hegrenade':
      case 'flashbang':
      case 'smokegrenade':
        return { right: [0, -0.012, 0.015], style: 'throw', normalized: true };
      case 'c4':
        return {
          right: [0.065, -0.035, 0.05],
          left: [-0.068, -0.036, -0.012],
          style: 'cup',
          normalized: true,
        };
      case 'rpg':
        return { right: [0, -0.079, 0.1], left: [0, 0.01, -0.23], style: 'tube', normalized: true };
      default:
        return {
          right: [0, -0.1, 0.035],
          left: [0, 0.014, id === 'p90' ? -0.19 : -0.234],
          mag: [0, id === 'p90' ? 0.095 : -0.142, ['famas', 'aug'].includes(id) ? 0.15 : -0.11],
          style: 'tube',
        };
    }
  }
  function bindGun(T, gun, basis, id) {
    const def = contacts(id);
    basis?.updateMatrix();
    const coords = (v) => {
      if (!v) return null;
      const p = new T.Vector3(...v);
      if (basis && !def.normalized) p.applyMatrix4(basis.matrix);
      return p.toArray();
    };
    const railY = pistols.has(id)
      ? 0.052
      : id === 'p90'
        ? 0.216
        : ['awp', 'scout'].includes(id)
          ? 0.19
          : id === 'bizon'
            ? 0.093
            : 0.09;
    const mountY = id === 'famas' ? 0.18 : ['awp','scout'].includes(id) ? 0.195 : id === 'rpg' ? 0.15 : railY;
    const rail = coords([id === 'elite' ? 0.09 : 0, mountY, pistols.has(id) ? 0.009 : id === 'p90' ? -0.15 : -0.045]),
      bore = coords([0, pistols.has(id) ? 0.025 : 0.035, 0]);
    const bounds = new T.Box3().setFromObject(basis || gun);
    if (!bounds.isEmpty()) bore[2] = bounds.min.z;
    gun.userData.grip = {
      rail,
      bore,
      right: coords(def.right),
      left: coords(def.left),
      mag: coords(def.mag),
      style: def.style,
      handScale: basis && !def.normalized ? Math.max(0.8, Math.min(1.2, basis.scale.x)) : 1,
    };
  }
  function fitHands(gun, source) {
    if (!source || !gun.userData.grip) return;
    const s = gun.userData.grip;
    function fit(part, as, at, mirror) {
      const template = source.getObjectByName(part);
      if (!at || !template) return;
      const glove = template.clone(true);
      glove.name = as;
      glove.position.fromArray(at);
      glove.scale.set(s.handScale * (mirror ? -1 : 1), s.handScale, s.handScale);
      gun.add(glove);
      return glove;
    }
    fit(s.style === 'blade' ? 'leftHand' : 'rightHand', 'rightHand', s.right, s.style === 'blade');
    const vertical = ['twin', 'vertical'].includes(s.style);
    const support = fit(
      vertical ? 'leftVertical' : s.style === 'cup' ? 'leftCup' : 'leftHand',
      'leftHand',
      s.left,
      false,
    );
    if (support && s.mag) support.userData.magazineContact = s.mag;
  }

  // Cache the rest geometry between identical remote operators. Each actor owns only its bone palette.
  const cache = new WeakMap();
  function armGeometry(T, node, local, upper) {
    const source = node.geometry,
      key = upper + '/' + local.elements.join(','),
      entries = cache.get(source) || new Map();
    cache.set(source, entries);
    let entry = entries.get(key);
    if (!entry) {
      const geom = source.clone().applyMatrix4(local),
        pos = geom.attributes.position;
      const indices = new Uint16Array(pos.count * 4),
        weights = new Float32Array(pos.count * 4);
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, (-pos.getY(i) - upper + 0.055) / 0.11)),
          v = t * t * (3 - 2 * t);
        indices[4 * i + 1] = 1;
        weights[4 * i] = 1 - v;
        weights[4 * i + 1] = v;
      }
      geom.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
      geom.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
      entry = { geom, refs: 0 };
      entries.set(key, entry);
    }
    entry.refs++;
    return {
      geometry: entry.geom,
      release() {
        if (--entry.refs === 0) {
          entry.geom.dispose();
          entries.delete(key);
        }
      },
    };
  }
  function rigArm(T, pivot, side, palmY) {
    if (!pivot) return null;
    // Bring the supporting shoulder forward and tuck both shoulders into a rifle stance.
    pivot.position.x -= side * (side < 0 ? 0.085 : 0.038);
    pivot.position.z += side < 0 ? -0.095 : 0.025;
    pivot.updateWorldMatrix(true, true);
    const inverse = pivot.matrixWorld.clone().invert(),
      sources = [];
    pivot.traverse((n) => {
      if (n.isMesh && !n.isSkinnedMesh) sources.push(n);
    });
    if (!sources.length) return null;
    const upper = new T.Bone(),
      elbow = new T.Bone(),
      upperRest = new T.Vector3(0, -palmY * 0.5, -0.012),
      lowerRest = new T.Vector3(0, -palmY * 0.5, palmY > 0.52 ? -0.017 : 0.012);
    elbow.position.copy(upperRest);
    upper.add(elbow);
    pivot.add(upper);
    pivot.updateWorldMatrix(true, true);
    const skeleton = new T.Skeleton([upper, elbow]),
      resources = [];
    for (const src of sources) {
      const lease = armGeometry(
        T,
        src,
        new T.Matrix4().multiplyMatrices(inverse, src.matrixWorld),
        -upperRest.y,
      );
      const sk = new T.SkinnedMesh(lease.geometry, armMaterial(src.material));
      sk.name = src.name;
      sk.castShadow = src.castShadow;
      sk.receiveShadow = src.receiveShadow;
      // The rest-pose box is too narrow to contain a raised elbow or an extended forearm.
      sk.boundingSphere = new T.Sphere(new T.Vector3(0, -0.16, -0.24), 1.12);
      src.removeFromParent();
      pivot.add(sk);
      sk.bind(skeleton, pivot.matrixWorld);
      resources.push(lease);
    }
    const aim = new T.Vector3(),
      pole = new T.Vector3(),
      joint = new T.Vector3(),
      fore = new T.Vector3(),
      inv = new T.Quaternion(),
      lenA = upperRest.length(),
      lenB = lowerRest.length();
    upperRest.normalize();
    lowerRest.normalize();
    function relax() {
      upper.quaternion.identity();
      upper.scale.setScalar(1);
      elbow.quaternion.identity();
    }
    function solve(gun, socket) {
      if (!socket) {
        relax();
        return;
      }
      aim.fromArray(socket);
      aim.x += side * 0.022;
      aim.y -= side < 0 ? 0.022 : 0;
      gun.localToWorld(aim);
      pivot.worldToLocal(aim);
      const distance = aim.length();
      if (distance < 0.001) {
        relax();
        return;
      }
      const stretch = Math.max(1, distance / (lenA + lenB - 0.004));
      upper.scale.setScalar(stretch);
      const d = distance / stretch;
      aim.normalize();
      pole
        .set(side * 0.82, -0.91, 0.25)
        .addScaledVector(aim, -pole.dot(aim))
        .normalize();
      const along = Math.min(lenA, (lenA * lenA - lenB * lenB + d * d) / (2 * d));
      joint
        .copy(aim)
        .multiplyScalar(along)
        .addScaledVector(pole, Math.sqrt(Math.max(0, lenA * lenA - along * along)));
      fore.copy(aim).multiplyScalar(d).sub(joint).normalize();
      upper.quaternion.setFromUnitVectors(upperRest, joint.normalize());
      fore.applyQuaternion(inv.copy(upper.quaternion).invert());
      elbow.quaternion.setFromUnitVectors(lowerRest, fore);
    }
    return {
      solve,
      relax,
      dispose() {
        skeleton.dispose();
        resources.forEach((r) => r.release());
      },
    };
  }
  function operator(T, body, holder, palmY) {
    const left = rigArm(T, body.getObjectByName('armL'), -1, palmY),
      right = rigArm(T, body.getObjectByName('armR'), 1, palmY);
    const offset = new T.Vector3();
    let lastGun = null, lastGrip = null, lastPitch = NaN, lastRecoil = NaN, lastBob = NaN;
    return {
      update(gun, pitch = 0, recoil = 0, bob = 0) {
        const grip = gun?.userData.grip;
        if (!grip) {
          lastGun = null;
          left?.relax();
          right?.relax();
          return;
        }
        // The gun and both shoulders have the same actor parent. Translation,
        // yaw and crouch move that parent, so an unchanged local pose needs no IK solve.
        if (lastGun === gun && lastGrip === grip && lastPitch === pitch && lastRecoil === recoil && lastBob === bob) return;
        lastGun = gun; lastGrip = grip; lastPitch = pitch; lastRecoil = recoil; lastBob = bob;
        // Keep the butt beside the firing shoulder. Move the complete weapon and drive both elbows to it.
        holder.position.set(0.115, 1.29 + bob, -0.205 + recoil * 0.018);
        holder.rotation.set(Math.max(-0.93, Math.min(0.93, pitch)) + recoil * 0.055, 0.12, 0, 'YXZ');
        gun.position.copy(offset.fromArray(grip.right).multiplyScalar(-1));
        right?.solve(gun, grip.right);
        left?.solve(gun, grip.left);
      },
      relax() {
        lastGun = null;
        left?.relax();
        right?.relax();
      },
      dispose() {
        left?.dispose();
        right?.dispose();
      },
    };
  }
  g.CS16Grip = { bindGun, fitHands, operator };
})(window);
