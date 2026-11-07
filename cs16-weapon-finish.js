/* Paint belongs to the receiver/furniture, never to optics or working metal. */
(function (global) {
  'use strict';
  function apply(model, map, skin, id) {
    if (!skin || !map) return model;
    const copies = new Map();
    function finish(original) {
      if (!original || !original.name.startsWith('Weapon finish /')) return original;
      if (copies.has(original)) return copies.get(original);
      const material = original.clone();
      material.map = map;
      material.color.setHex(0xffffff);
      if (original.name === 'Weapon finish / world') material.vertexColors = false;
      // Retain the source normal/roughness maps and the substrate's response.
      material.roughness = id === 'gold' ? .36 : Math.max(.55, original.roughness);
      material.metalness = id === 'gold' ? .85 : original.metalness;
      material.emissive.setHex(0x000000);
      material.emissiveMap = null;
      material.emissiveIntensity = 0;
      material.userData.cs16Owned = true;
      copies.set(original, material);
      return material;
    }
    model.traverse(o => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
    });
    return model;
  }
  const api = { apply };
  global.CS16WeaponFinish = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
