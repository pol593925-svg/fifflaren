/* Painted albedo with continuous physical lighting, shared by world and viewmodels. */
(function (g) {
  'use strict';
  function apply(T, root, options={}) {
    const physical=!!(options.soft||options.environment);
    const ramp = physical?null:new T.DataTexture(new Uint8Array([
      62,62,62,255,108,108,108,255,166,166,166,255,221,221,221,255,255,255,255,255
    ]),5,1,T.RGBAFormat);
    if(ramp){ramp.minFilter=ramp.magFilter=T.LinearFilter;ramp.needsUpdate=true;}
    const converted=new Map();
    function convert(m){
      // Imported licensed PBR assets carry their authored maps and measured
      // roughness. Do not recolour them with the legacy illustrated palette.
      if(m&&(m.userData.cs16Realistic||root.userData.cs16Realistic)){
        m.userData.cs16Realistic=true;m.userData.cs16WorldSurface=!!options.environment;
        m.userData.cs16EnvironmentIntensity=m.envMapIntensity??.65;
        m.dithering=true;return m;
      }
      if(!m||/glass/i.test(m.name)||m.transparent&&m.opacity<.5)return m;
      if(converted.has(m))return converted.get(m);
      const world=!!options.environment,name=m.name||'',
        cloth=/textile|ripstop|leather|binding|cord|glove|sleeve|stitch/i.test(name),
        skin=/exposed fingers|fingernail|finger crease|nails/i.test(name),
        brass=/brass|copper/i.test(name),
        metal=/steel|edges|receiver|alloy|graphite|mechanism|duct/i.test(name)&&!cloth,
        enamel=/enamel|ceramic|ivory/i.test(name),
        rubber=/rubber|grip|polymer/i.test(name)&&!enamel,
        timber=/wood|shutter|bark/i.test(name),
        foliage=/leaf|foliage|flower|petal|grass/i.test(name),
        stone=/ground|limestone|stone|tunnel/i.test(name),
        plaster=/^plaster/.test(name);
      const roughness=cloth?.94:skin?.61:brass?.30:metal?.35:rubber?.83:enamel?.36:timber?.77:foliage?.89:stone?.88:plaster?.94:.72;
      const metalness=brass?.82:metal?.77:0;
      const normalStrength=world?(name==='ground'?1.32:stone?1.18:plaster?1.10:timber?1.2:1):cloth?.48:skin?.48:1;
      const normalScale=(m.normalScale?.clone()||new T.Vector2(1,1)).multiplyScalar(normalStrength);
      const next=new (physical?T.MeshStandardMaterial:T.MeshToonMaterial)({
        name,map:m.map,color:m.color,
        ...(physical?{roughness,metalness,envMapIntensity:metal||brass?.78:world?.24:.43,
          normalMap:m.normalMap,normalScale,roughnessMap:m.roughnessMap||null,
          metalnessMap:m.metalnessMap||null,aoMap:m.aoMap||null,aoMapIntensity:m.aoMapIntensity??1
        }:{gradientMap:ramp,normalMap:m.normalMap,normalScale}),
        vertexColors:m.vertexColors,side:m.side,alphaTest:m.alphaTest,
        emissive:m.emissive,emissiveMap:m.emissiveMap,emissiveIntensity:m.emissiveIntensity,
        transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,dithering:true
      });
      next.userData={...m.userData,cs16PaintedPhysical:physical,cs16WorldSurface:world,
        cs16EnvironmentIntensity:next.envMapIntensity};
      if(world&&foliage)next.color.multiplyScalar(.95);
      if(physical){
        next.onBeforeCompile=shader=>{
          if(world&&plaster){
            shader.vertexShader='varying float paintedHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>',
              '#include <begin_vertex>\npaintedHeight=(modelMatrix*vec4(transformed,1.)).y;');
            shader.fragmentShader='varying float paintedHeight;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
              float paintedBand=smoothstep(.94,1.01,paintedHeight);
              diffuseColor.rgb*=mix(vec3(.49,.73,.69),vec3(1.),paintedBand);
            `);
          }
          shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',
            '#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=vec3(.94,.98,1.065);');
          if(options.soft)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
            float paintedRim=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
            outgoingLight+=diffuseColor.rgb*paintedRim*${cloth?'.035':skin?'.065':'.07'};
            #include <opaque_fragment>`);
          if(world&&foliage)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
            outgoingLight+=diffuseColor.rgb*max(0.,normal.y)*.035;
            #include <opaque_fragment>`);
        };
        next.customProgramCacheKey=()=> 'painted-physical-preview-1-'+(world?(plaster?'plaster':foliage?'foliage':'world'):cloth?'cloth':skin?'skin':'soft');
      }
      converted.set(m,next);return next;
    }
    root.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);});
    for(const old of converted.keys())old.dispose();
    if(!converted.size&&ramp)ramp.dispose();
    return root;
  }
  g.CS16AnimeMaterials={apply};
})(window);
