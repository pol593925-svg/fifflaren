/* Shared illustrated lighting for authored map and first-person assets. */
(function (g) {
  'use strict';
  function apply(T, root, options={}) {
    const ramp = new T.DataTexture(new Uint8Array([
      58, 64, 91, 255, 113, 117, 145, 255, 179, 180, 192, 255,
      228, 224, 214, 255, 255, 247, 229, 255
    ]), 5, 1, T.RGBAFormat);
    ramp.minFilter = ramp.magFilter = T.LinearFilter;
    ramp.needsUpdate = true;
    const converted = new Map();
    function convert(m) {
      if (!m || /glass/i.test(m.name) || m.transparent && m.opacity < .5) return m;
      if (converted.has(m)) return converted.get(m);
      const next = new (options.soft?T.MeshStandardMaterial:T.MeshToonMaterial)({
        name: m.name, map: m.map, color: m.color, ...(options.soft?{roughness:/textile|ripstop|leather/i.test(m.name)?.88:.52,normalMap:m.normalMap,normalScale:m.normalScale,metalness:/steel|edges|brass|receiver/i.test(m.name)?.22:0,envMapIntensity:.28}:{gradientMap:ramp}),
        vertexColors: m.vertexColors, side: m.side, alphaTest: m.alphaTest,
        emissive: m.emissive, emissiveMap: m.emissiveMap,
        emissiveIntensity: m.emissiveIntensity, transparent: m.transparent,
        opacity: m.opacity, depthWrite: m.depthWrite, dithering: true
      });
      next.userData = {...m.userData};
      converted.set(m, next);
      return next;
    }
    root.traverse(o => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    });
    for (const old of converted.keys()) old.dispose();
    if (!converted.size||options.soft) ramp.dispose();
    return root;
  }
  g.CS16AnimeMaterials = {apply};
})(window);
