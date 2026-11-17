/* Shared illustrated lighting for authored map and first-person assets. */
(function (g) {
  'use strict';
  function apply(T, root, options={}) {
    const ramp = new T.DataTexture(new Uint8Array([
      62, 62, 62, 255, 108, 108, 108, 255, 166, 166, 166, 255,
      221, 221, 221, 255, 255, 255, 255, 255
    ]), 5, 1, T.RGBAFormat);
    ramp.minFilter = ramp.magFilter = T.LinearFilter;
    ramp.needsUpdate = true;
    const converted = new Map();
    function convert(m) {
      if (!m || /glass/i.test(m.name) || m.transparent && m.opacity < .5) return m;
      if (converted.has(m)) return converted.get(m);
      const next = new (options.soft?T.MeshStandardMaterial:T.MeshToonMaterial)({
        name: m.name, map: m.map, color: m.color, ...(options.soft?{roughness:/textile|ripstop|leather/i.test(m.name)?.84:/finger|nail/i.test(m.name)?.67:/enamel|ceramic/i.test(m.name)?.32:.38,normalMap:m.normalMap,normalScale:m.normalScale?.clone().multiplyScalar(/textile|ripstop/i.test(m.name)?.22:1),metalness:/steel|edges|brass|receiver|alloy/i.test(m.name)?.38:0,envMapIntensity:.58}:{gradientMap:ramp}),
        ...(!options.soft && m.normalMap ? {normalMap:m.normalMap,normalScale:m.normalScale?.clone()} : {}),
        vertexColors: m.vertexColors, side: m.side, alphaTest: m.alphaTest,
        emissive: m.emissive, emissiveMap: m.emissiveMap,
        emissiveIntensity: m.emissiveIntensity, transparent: m.transparent,
        opacity: m.opacity, depthWrite: m.depthWrite, dithering: true
      });
      next.userData = {...m.userData};
      // Surface colour and a broad grazing highlight keep sculpted edges readable.
      // This stays in the existing material pass: no extra lights or screen buffers.
      if (options.environment || options.soft) {
        const plaster=options.environment && /^plaster/.test(m.name);
        next.onBeforeCompile=shader=>{
          if(plaster){
            shader.vertexShader='varying float paintedHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>',
              '#include <begin_vertex>\npaintedHeight=(modelMatrix*vec4(transformed,1.)).y;');
            shader.fragmentShader='varying float paintedHeight;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
              float paintedBand=smoothstep(.94,1.01,paintedHeight);
              diffuseColor.rgb*=mix(vec3(.49,.73,.69),vec3(1.),paintedBand);
            `);
          }
          shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',
            '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=vec3(.86,.94,1.12);');
          if(options.soft)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float paintedRim=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
            outgoingLight+=diffuseColor.rgb*paintedRim*.15;
            #include <opaque_fragment>`);
        };
        next.customProgramCacheKey=()=> 'anime-surface-2-'+(plaster?'plaster':options.soft?'soft':'world');
      }
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
