/* Support Hub: Blender-authored maps and operators, Three.js r160 PBR renderer. */
(function (global) {
  'use strict';

  const QUALITY = Object.freeze({
    low: { dpr: 0.78, shadow: 512, anisotropy: 2, lamps: 1 },
    balanced: { dpr: 1, shadow: 1024, anisotropy: 4, lamps: 3 },
    high: { dpr: 1.5, shadow: 2048, anisotropy: 8, lamps: 4 },
  });
  const ASSETS = 'models/csgo/';
  let operatorPromise = null;
  let operatorEpoch = 0;
  const operators = new Map();

  function freezeStatic(root) {
    root.updateWorldMatrix(true, true);
    root.traverse(o => {
      o.matrixAutoUpdate = false;
      o.matrixWorldAutoUpdate = false;
    });
  }

  // Painted lower wall band and grime at skirting height; reuse the existing plaster albedo.
  function finishPlaster(material,storey){
    material.onBeforeCompile=shader=>{
      shader.uniforms.storeyHeight={value:storey};
      shader.vertexShader='varying vec3 plasterPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nplasterPos=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='uniform float storeyHeight;varying vec3 plasterPos;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float wallY=mod(plasterPos.y+.008,storeyHeight);
        float wear=dot(diffuseColor.rgb,vec3(.27,.55,.18));
        float seam=smoothstep(1.04,1.065,wallY+clamp(wear-.29,-.11,.11)*.16);
        float base=smoothstep(.025,.30,wallY);
        diffuseColor.rgb*=mix(vec3(.65,.76,.72),vec3(1.),seam)*mix(.78,1.,base);`);
    };
    material.customProgramCacheKey=()=> 'painted-plaster-band';material.needsUpdate=true;
  }

  function qualityOf(name) { return QUALITY[name] || QUALITY.high; }

  function configureRenderer(renderer, options) {
    const T = global.THREE;
    const name = options && options.quality || 'high';
    const quality = qualityOf(name);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, quality.dpr));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = name !== 'low';
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.userData = renderer.userData || {};
    renderer.userData.cs16Quality = name;
    return quality;
  }

  // Textures/geometries can be referenced by multiple nodes of a GLB. Dispose once.
  function disposeTree(root) {
    if (!root) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(object => {
      if(object.isInstancedMesh)object.dispose();
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach(material => {
        if (!material || materials.has(material)) return;
        materials.add(material);
        Object.keys(material).forEach(key => {
          const value = material[key];
          if (value && value.isTexture) textures.add(value);
        });
      });
    });
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
    if (root.parent) root.parent.remove(root);
  }

  function loadGLTF(T, path, onProgress) {
    if (!T.GLTFLoader) return Promise.reject(new Error('GLTFLoader is not loaded'));
    return new Promise((resolve, reject) => {
      new T.GLTFLoader().load(path, resolve, onProgress, error => {
        const reason = error && error.message || 'asset unavailable';
        reject(new Error('Cannot load ' + path + ': ' + reason));
      });
    });
  }

  function prepareMeshes(T, root, renderer, quality) {
    const anisotropy = Math.min(renderer ? renderer.capabilities.getMaxAnisotropy() : 4, quality.anisotropy);
    const materials = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = !object.userData.backdrop;
      object.receiveShadow = true;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach(material => {
        if (!material || materials.has(material)) return;
        materials.add(material);
        // Low quality keeps the painted albedo but skips the extra normal-map
        // sample/derivatives. Retain the texture on the material so disposeTree
        // still owns it, and changing quality restores it without another download.
        if ((material.isMeshToonMaterial || material.userData.cs16PaintedPhysical || material.userData.cs16WorldSurface) && (material.normalMap || material.cs16DetailNormalMap)) {
          material.cs16DetailNormalMap ||= material.normalMap;
          const normal = quality === QUALITY.low ? null : material.cs16DetailNormalMap;
          if (material.normalMap !== normal) {
            material.normalMap = normal;
            material.needsUpdate = true;
          }
        }
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
          // Quality changes geometry/shader cost, not the authored lighting.
          // Lowering this value still samples the same environment texture and
          // made PBR stone and metal turn nearly black on the low preset.
          material.envMapIntensity = material.userData.cs16EnvironmentIntensity ?? .40;
          if(material.normalMap&&!material.userData.cs16PaintedPhysical&&!material.userData.cs16Realistic)material.normalScale.set(.35,.35);
          material.dithering = true;
        }
        // GLTFLoader already assigns sRGB to color maps and linear to data maps.
        Object.keys(material).forEach(key => {
          const texture = material[key];
          if (texture && texture.isTexture) texture.anisotropy = anisotropy;
        });
        if (material.transparent && material.opacity < 0.5) object.castShadow = false;
      });
    });
  }

  function makeSky(T, inferno, radius) {
    const direction = new T.Vector3(-0.40, 0.72, -0.57).normalize();
    const material = new T.ShaderMaterial({
      name: 'CS16 daylight atmosphere',
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        sunDirection: { value: direction },
        zenith: { value: new T.Color(inferno ? '#226bb8' : '#176fbe') },
        horizon: { value: new T.Color(inferno ? '#c7deeb' : '#beddea') },
        ground: { value: new T.Color(inferno ? '#888780' : '#899087') },
      },
      vertexShader: [
        'varying vec3 vSkyDirection;',
        'void main() {',
        '  vSkyDirection = position;',
        '  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = clip.xyww;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 sunDirection;',
        'uniform vec3 zenith;',
        'uniform vec3 horizon;',
        'uniform vec3 ground;',
        'varying vec3 vSkyDirection;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float noise(vec2 p) {',
        '  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);',
        '}',
        'float cloud(vec2 p) {',
        '  float f=.62*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+13.7;',
        '  f+=.21*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+7.1;',
        '  f+=.09*noise(p); return f;',
        '}',
        'void main() {',
        '  vec3 d=normalize(vSkyDirection);',
        '  float altitude=max(d.y,0.0);',
        '  float alignment=max(dot(d,sunDirection),0.0);',
        '  vec3 color=mix(horizon,zenith,pow(altitude,0.23));',
        '  color=mix(ground,color,smoothstep(-0.14,0.025,d.y));',
        '  color+=vec3(.38,.24,.10)*pow(alignment,12.0);',
        // Cloud density and a neighbour toward the sun approximate softly lit
        // cumulus in the existing sky pass; no volume raymarch or additional mesh.
        '  vec2 p=d.xz/(.30+altitude)*3.05+vec2(8.1,-3.7);',
        '  float density=cloud(p);',
        '  float cloudMask=smoothstep(.48,.615,density)*smoothstep(.015,.20,d.y);',
        '  float towardSun=cloud(p+sunDirection.xz*.48);',
        '  float edgeLight=clamp((density-towardSun)*4.4+.56,.0,1.);',
        '  float volume=smoothstep(.50,.78,density);',
        '  vec3 cloudShadow=vec3(.28,.40,.59);',
        '  vec3 cloudLight=vec3(1.25,1.18,1.05);',
        '  vec3 cloudColor=mix(cloudShadow,cloudLight,clamp(edgeLight-volume*.23,.0,1.));',
        '  cloudColor+=vec3(.28,.22,.13)*pow(alignment,18.0)*(1.-volume);',
        '  color=mix(color,cloudColor,cloudMask*.96);',
        '  float sunVisibility=1.-cloudMask*.90;',
        '  color+=vec3(1.0,.82,.57)*pow(alignment,300.0)*.36*sunVisibility;',
        '  color+=vec3(5.0,4.0,2.5)*smoothstep(.99986,.99997,alignment)*sunVisibility;',
        '  gl_FragColor=vec4(color,1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const mesh = new T.Mesh(new T.SphereGeometry(radius, 32, 16), material);
    mesh.name = 'CS16 sky';
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;
    return { mesh, direction };
  }

  function createWorld(options) {
    const T = options.THREE || global.THREE;
    const { renderer, scene, camera, grid } = options;
    const mapName = ['inferno','frontline'].includes(options.map)?options.map:'dust2';
    let quality = qualityOf(renderer.userData && renderer.userData.cs16Quality);
    let disposed = false, model = null, environmentTarget = null, skyTexture = null, nature = null, landscape = null, realisticWorld = null, bakedBuildings = false;
    let lampsTick = -Infinity;
    const CELL = options.CELL || 4;
    const group = new T.Group();
    group.name = 'CS16 Blender world: ' + mapName;
    scene.add(group);
    // These roots never move. A dirty identity scene otherwise forces every
    // static map mesh to multiply its world matrix again on every frame.
    scene.updateMatrix(); scene.matrixAutoUpdate = false;
    group.updateMatrix(); group.matrixAutoUpdate = false;

    const sky = makeSky(T, mapName === 'inferno', 1100);
    // Direction measured from the brightest texel of the bundled CC0 HDRI.
    sky.direction.set(.554562,.741980,.376731).normalize();
    group.add(sky.mesh);
    scene.background = null;
    scene.fog = new T.Fog(0xb9c7ce, 145, 600);

    const hemisphere = new T.HemisphereLight(0xdce8f2, 0x77736b, .62);
    group.add(hemisphere);
    const sun = new T.DirectionalLight(0xfff4e2, 3.0);
    sun.name = 'CS16 sun';
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadow, quality.shadow);
    // A tighter cascade spends the same texture budget on visible contact detail.
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 460 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.00022;
    sun.shadow.normalBias = 0.045;
    sun.shadow.radius = 3;
    group.add(sun, sun.target);

    // Actual CC0 pure-sky capture supplies background and physically coherent
    // rough reflections. The street and buildings remain navigable 3D geometry.
    const skyReady=new T.RGBELoader().loadAsync(ASSETS+'realistic/daylight-2k.hdr').then(texture=>{
      if(disposed){texture.dispose();return;}
      skyTexture=texture;texture.mapping=T.EquirectangularReflectionMapping;
      const pmrem=new T.PMREMGenerator(renderer);
      try{environmentTarget=pmrem.fromEquirectangular(texture);}finally{pmrem.dispose();}
      scene.background=texture;scene.backgroundIntensity=.70;
      scene.environment=environmentTarget.texture;sky.mesh.visible=false;
    });

    // Four lights are a fixed shader budget, independent of tunnel length.
    const lampCandidates = [];
    if (grid) for (let z = 0; z < grid.length; z++) for (let x = 0; x < grid[z].length; x++) {
      const cell = grid[z][x];
      if ((cell !== 4 && cell !== 8) || (x + z) % 3 !== 0) continue;
      lampCandidates.push({
        x: (x + 0.5) * CELL, z: (z + 0.5) * CELL,
        y: cell === 4 ? (options.TUN_CEIL || -1.3) - 0.15 : (options.VENT_CEIL || 1.35) - 0.16,
        color: cell === 4 ? 0xffd19a : 0xc4dfff,
        power: cell === 4 ? 12 : 6,
        distance: cell === 4 ? 10 : 7,
      });
    }
    for(const b of global.CS16Buildings.layout(grid,mapName).buildings)for(const deck of [0,3.6]){
      lampCandidates.push({x:b.x+9.8,y:deck+2.9,z:b.z+8.2,color:0xffd3a5,power:19,distance:8});
    }
    const lamps = Array.from({ length: 4 }, () => {
      const light = new T.PointLight(0xffd19a, 0, 10, 2);
      light.castShadow = false;
      group.add(light);
      return light;
    });
    const lightRight = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), sky.direction).normalize();
    const lightUp = new T.Vector3().crossVectors(sky.direction, lightRight).normalize();
    const target = new T.Vector3();
    const groundPoint = new T.Vector3();

    function update(activeCamera, time) {
      if (disposed || !activeCamera) return;
      sky.mesh.position.copy(activeCamera.position);
      realisticWorld?.update(activeCamera,typeof time==='number'?time:performance.now(),renderer.userData.cs16Quality);
      if(landscape)landscape.update(activeCamera,typeof time==='number'?time:performance.now(),renderer.userData.cs16Quality);
      groundPoint.set(activeCamera.position.x, 0, activeCamera.position.z);
      // Quantize in LIGHT coordinates to stop shadows swimming as the player walks.
      const texel = 64 / quality.shadow;
      const rx = Math.round(groundPoint.dot(lightRight) / texel) * texel;
      const ry = Math.round(groundPoint.dot(lightUp) / texel) * texel;
      const rz = Math.round(groundPoint.dot(sky.direction) / texel) * texel;
      target.copy(lightRight).multiplyScalar(rx).addScaledVector(lightUp, ry).addScaledVector(sky.direction, rz);
      sun.target.position.copy(target);
      sun.position.copy(target).addScaledVector(sky.direction, 110);
      sun.target.updateMatrixWorld();
      const now = typeof time === 'number' ? time : performance.now();
      if (now - lampsTick < 150) return;
      lampsTick = now;
      // Keep only the four relevant lamps; avoid allocating and sorting the entire map.
      const nearest = [];
      for(const lamp of lampCandidates){
        const distance=(lamp.x-activeCamera.position.x)**2+(lamp.z-activeCamera.position.z)**2+(lamp.y-activeCamera.position.y)**2*3;
        if(distance>42*42)continue;
        let index=0;while(index<nearest.length&&nearest[index].distance<distance)index++;
        if(index<quality.lamps){nearest.splice(index,0,{lamp,distance});if(nearest.length>quality.lamps)nearest.pop();}
      }
      lamps.forEach((light, index) => {
        const candidate = nearest[index];
        if (index >= quality.lamps || !candidate || candidate.distance > 42 * 42) { light.intensity = 0; return; }
        const lamp = candidate.lamp;
        light.position.set(lamp.x, lamp.y, lamp.z);
        light.color.setHex(lamp.color);
        light.distance = lamp.distance;
        light.intensity = lamp.power;
      });
    }

    const ready = Promise.allSettled([loadGLTF(T, ASSETS + (mapName==='frontline'?'':'anime-') + mapName + '.glb', options.onProgress),loadGLTF(T, ASSETS+'anime-nature.glb'),skyReady]).then(async results => {
      const failed=results.find(r=>r.status==='rejected');if(failed){for(const r of results)if(r.status==='fulfilled'&&r.value?.scene)disposeTree(r.value.scene);throw failed.reason;}
      const [gltf,natureAsset]=results.map(r=>r.value);
      if (disposed) {
        disposeTree(gltf.scene);disposeTree(natureAsset.scene);
        const error = new Error('World was replaced while loading');
        error.name = 'AbortError';
        throw error;
      }
      let preparedWorld;
      try{preparedWorld=await global.CS16RealisticWorld?.prepare({T,model:gltf.scene,grid,map:mapName,renderer});}
      catch(error){disposeTree(gltf.scene);disposeTree(natureAsset.scene);throw error;}
      if(disposed){preparedWorld?.dispose();disposeTree(gltf.scene);disposeTree(natureAsset.scene);const error=Error('World replaced during material preparation');error.name='AbortError';throw error;}
      model=gltf.scene;nature=natureAsset.scene;realisticWorld=preparedWorld;
      global.CS16AnimeMaterials.apply(T,model,{environment:true});
      global.CS16AnimeMaterials.apply(T,nature,{environment:true});
      bakedBuildings=false;model.traverse(o=>{if(o.userData.coastArchitecture)bakedBuildings=true;});
      const oldBuildings=scene.getObjectByName('Walkable two-storey buildings');if(bakedBuildings&&oldBuildings)oldBuildings.visible=false;
      model.name = 'CS16 ' + mapName + ' geometry';
      prepareMeshes(T, model, renderer, quality);
      // A map's Blender export may contain render lights/cameras; the runtime owns lighting.
      const auxiliaries = [];
      model.traverse(object => { if (object.isLight || object.isCamera) auxiliaries.push(object); });
      auxiliaries.forEach(object => { if (object.parent) object.parent.remove(object); });
      group.add(model);
      if(!global.CS16Landscape)throw Error('Landscape module unavailable');
      global.CS16EnvironmentView.sculpt(T,model,grid);
      landscape=global.CS16Landscape.create({T,scene,grid,map:mapName,model});
      freezeStatic(model);
      update(camera, 0);
      return model;
    });

    function setQuality(name) {
      quality = configureRenderer(renderer, { quality: name });
      sun.shadow.mapSize.set(quality.shadow, quality.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      if (model) prepareMeshes(T, model, renderer, quality);
      lampsTick = -Infinity;
      sun.shadow.needsUpdate = true;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if(landscape){landscape.dispose();landscape=null;}
      realisticWorld?.dispose();realisticWorld=null;
      if(nature){disposeTree(nature);nature=null;}
      if (model) { disposeTree(model); model = null; }
      disposeTree(sky.mesh);
      if (sun.shadow.map) sun.shadow.map.dispose();
      if (sun.shadow.mapPass) sun.shadow.mapPass.dispose();
      if (environmentTarget) {
        if (scene.environment === environmentTarget.texture) scene.environment = null;
        environmentTarget.dispose();
        environmentTarget = null;
      }
      if(skyTexture){if(scene.background===skyTexture)scene.background=null;skyTexture.dispose();skyTexture=null;}
      if (group.parent) group.parent.remove(group);
      group.clear();
    }

    update(camera, 0);
    return { ready, update, dispose, setQuality, bakedArchitecture:()=>bakedBuildings, groundSurface:(x,z)=>landscape?.groundSurface(x,z)||'stone', nature:()=>nature, surface(name){let found=null;model?.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.name===name)found=m;});return found;} };
  }

  const exteriorFiles = Object.freeze({ct:'classic-ct-bamen.glb',t:'classic-t-danly.glb'});
  const exteriorSources = new Map();
  const exteriorKey = name => name.replace(/^mixamorig:?/i,'').replace(/_\d+$/,'').toLowerCase();
  // One part per Classic character for both the main scene and shadow passes.
  // Pack the artist's textures and material constants once for all actor clones.
  function batchExterior(T,root) {
    root.updateMatrixWorld(true);
    const meshes=[],materials=[];
    root.traverse(node=>{
      if(!node.isSkinnedMesh)return;
      if(Array.isArray(node.material))throw new Error('Unsupported Classic primitive groups');
      node.skeleton.update();meshes.push(node);
      if(!materials.includes(node.material))materials.push(node.material);
    });
    if(!meshes.length||materials.length>16)throw new Error('Classic atlas scale not supported');
    const TILE=512,PAD=8,LENGTH=4*TILE;
    const layers=['color','normal','orm'].map(()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=LENGTH;
      return {canvas,ctx:canvas.getContext('2d',{willReadFrequently:true})};
    });
    const temporary=document.createElement('canvas');temporary.width=temporary.height=TILE;
    const paint=temporary.getContext('2d',{willReadFrequently:true});
    const rect=i=>[i%4*TILE,Math.floor(i/4)*TILE];
    function makeTile(layer,material,i){
      const [x,y]=rect(i),ctx=layers[layer].ctx;
      const map=layer===0?material.map:layer===1?material.normalMap:material.roughnessMap||material.metalnessMap;
      paint.fillStyle=layer===0?'#ffffff':layer===1?'rgb(128,128,255)':'#ffffff';
      paint.fillRect(0,0,TILE,TILE);
      if(map?.image)paint.drawImage(map.image,0,0,TILE,TILE);
      const rgba=paint.getImageData(0,0,TILE,TILE),pixels=rgba.data;
      const color=material.color.clone().convertLinearToSRGB();
      const sn=material.normalScale;
      for(let offset=0;offset<pixels.length;offset+=4){
        if(layer===0){pixels[offset]*=color.r;pixels[offset+1]*=color.g;pixels[offset+2]*=color.b;}
        else if(layer===1){
          pixels[offset]=128+(pixels[offset]-128)*(sn?.x??1);
          pixels[offset+1]=128+(pixels[offset+1]-128)*(sn?.y??1);
        }else{
          pixels[offset]=255;
          pixels[offset+1]=(material.roughnessMap?pixels[offset+1]:255)*material.roughness;
          pixels[offset+2]=(material.metalnessMap?pixels[offset+2]:255)*material.metalness;
        }
        pixels[offset+3]=255;
      }
      paint.putImageData(rgba,0,0);
      ctx.drawImage(temporary,x+PAD,y+PAD,TILE-2*PAD,TILE-2*PAD);
      const a=TILE-2*PAD;
      ctx.drawImage(temporary,0,0,TILE,1,x,y,TILE,PAD);
      ctx.drawImage(temporary,0,TILE-1,TILE,1,x,y+TILE-PAD,TILE,PAD);
      ctx.drawImage(temporary,0,0,1,TILE,x,y+PAD,PAD,a);
      ctx.drawImage(temporary,TILE-1,0,1,TILE,x+TILE-PAD,y+PAD,PAD,a);
    }
    materials.forEach((m,i)=>{for(let layer=0;layer<layers.length;layer++)makeTile(layer,m,i);});
    const atlas=layers.map(({canvas},i)=>{
      const texture=new T.CanvasTexture(canvas);
      texture.flipY=false;
      if(i===0)texture.colorSpace=T.SRGBColorSpace;
      return texture;
    });
    const packed=new T.MeshStandardMaterial({name:'Classic shared texture atlas',map:atlas[0],normalMap:atlas[1],roughnessMap:atlas[2],metalnessMap:atlas[2],roughness:1,metalness:1,side:T.DoubleSide});
    const positions=[],normals=[],uvs=[],indices=[],joints=[],weights=[],bones=[],boneIndices=new Map();
    const inv=root.matrixWorld.clone().invert(),relative=new T.Matrix4(),normalsToRoot=new T.Matrix3();
    const v=new T.Vector3(),where=new T.Vector3(),normal=new T.Vector3();
    for(const mesh of meshes){
      const geometry=mesh.geometry,{position,normal:n,uv,skinIndex,skinWeight}=geometry.attributes,offset=positions.length/3,[x,y]=rect(materials.indexOf(mesh.material));
      relative.multiplyMatrices(inv,mesh.matrixWorld);normalsToRoot.getNormalMatrix(relative);
      for(let i=0;i<position.count;i++){
        mesh.getVertexPosition(i,v);
        where.copy(v).applyMatrix4(relative);positions.push(where.x,where.y,where.z);
        normal.fromBufferAttribute(n,i).add(where.fromBufferAttribute(position,i));
        mesh.applyBoneTransform(i,normal);
        normal.sub(v).applyMatrix3(normalsToRoot).normalize();normals.push(normal.x,normal.y,normal.z);
        const u=T.MathUtils.clamp(uv?.getX(i)??.5,0,1),w=T.MathUtils.clamp(uv?.getY(i)??.5,0,1);
        uvs.push((x+PAD+u*(TILE-2*PAD))/LENGTH,(y+PAD+w*(TILE-2*PAD))/LENGTH);
        for(let j=0;j<4;j++){
          const component=['getX','getY','getZ','getW'][j];const bone=mesh.skeleton.bones[skinIndex[component](i)];
          if(!boneIndices.has(bone)){boneIndices.set(bone,bones.length);bones.push(bone);}
          joints.push(boneIndices.get(bone));weights.push(skinWeight[component](i));
        }
      }
      if(geometry.index)for(let i=0;i<geometry.index.count;i++)indices.push(offset+geometry.index.getX(i));
      else for(let i=0;i<position.count;i++)indices.push(offset+i);
    }
    const geometry=new T.BufferGeometry();
    for(const [name,data,size]of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['skinWeight',weights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(data,size));
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setIndex(indices);geometry.computeBoundingSphere();
    const mesh=new T.SkinnedMesh(geometry,packed);mesh.name='Batched Classic exterior';root.add(mesh);mesh.updateMatrixWorld(true);
    mesh.bind(new T.Skeleton(bones),root.matrixWorld);
    mesh.boundingSphere=geometry.boundingSphere.clone();mesh.boundingSphere.radius*=1.45;
    const old=new T.Group(),previousSkeletons=new Set();
    for(const part of meshes){old.add(part);previousSkeletons.add(part.skeleton);}
    disposeTree(old);
    for(const skeleton of previousSkeletons)skeleton.dispose();
  }
  async function loadExterior(T, team) {
    const {scene} = await loadGLTF(T,ASSETS+exteriorFiles[team]);
    if(team==='t') {
      const detached=[];
      scene.traverse(node=>{if(node.isMesh&&[].concat(node.material).every(m=>m?.name==='HeadphonesT'))detached.push(node);});
      for(const node of detached){node.removeFromParent();disposeTree(node);}
    }
    scene.updateMatrixWorld(true);
    scene.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});
    const box=new T.Box3().setFromObject(scene,true),height=box.max.y-box.min.y;
    if(!(height>1&&height<3))throw new Error('Unexpected Classic body bounds: '+team);
    let hips=null;
    scene.traverse(node=>{if(node.isBone&&exteriorKey(node.name)==='hips')hips=node.getWorldPosition(new T.Vector3());});
    if(!hips)throw new Error('Classic body rig is missing hips: '+team);
    const normalized = new T.Group(), facing = new T.Group(), scale=1.8/height;
    scene.position.set(-hips.x*scale,-box.min.y*scale,-hips.z*scale);
    scene.scale.multiplyScalar(scale);
    facing.rotation.y=Math.PI;facing.add(scene);normalized.add(facing);
    normalized.name='ClassicExterior-'+team;
    batchExterior(T,normalized);
    prepareMeshes(T,normalized,null,QUALITY.high);
    normalized.traverse(node=>{
      if(node.isSkinnedMesh){
        node.computeBoundingSphere();
        node.boundingSphere.radius*=1.45;
      }
    });
    exteriorSources.set(team,normalized);
  }

  function fitExterior(T, actor, exterior) {
    const bones=new Map(), rest=new Map();
    exterior.traverse(node=>{
      if(node.isBone){const key=exteriorKey(node.name);bones.set(key,node);rest.set(node,node.quaternion.clone());}
    });
    const limbs=['left','right'].map(side=>({
      side,
      upper:bones.get(side+'arm'), elbow:bones.get(side+'forearm'), hand:bones.get(side+'hand'),
      thigh:bones.get(side+'upleg'), shin:bones.get(side+'leg')
    }));
    if(limbs.some(l=>!l.upper||!l.elbow||!l.hand||!l.thigh||!l.shin))throw new Error('Classic exterior has incomplete limbs');
    const head=bones.get('head'),rootRotation=new T.Quaternion(),q=new T.Quaternion(),parent=new T.Quaternion();
    const v=()=>new T.Vector3(),start=v(),mid=v(),end=v(),direction=v(),pole=v(),target=v(),joint=v(),axis=v(),current=v(),wanted=v();
    const xAxis=new T.Vector3(1,0,0);
    let changed;
    const worldRotate=(bone,rotation)=>{
      bone.parent.getWorldQuaternion(parent);
      bone.quaternion.premultiply(q.copy(parent).invert().multiply(rotation).multiply(parent));
      bone.updateWorldMatrix(false,false);
    };
    const direct=(bone, child, goal)=>{
      bone.getWorldPosition(start);child.getWorldPosition(current).sub(start).normalize();
      wanted.copy(goal).sub(start).normalize();
      if(current.lengthSq()>.90&&wanted.lengthSq()>.90){
        deltaRotation.setFromUnitVectors(current,wanted);worldRotate(bone,deltaRotation);
      }
    };
    const deltaRotation=new T.Quaternion();
    function solveArm(l,gun,grip){
      l.upper.getWorldPosition(start);l.elbow.getWorldPosition(mid);l.hand.getWorldPosition(end);
      target.fromArray(grip);gun.localToWorld(target);
      const a=start.distanceTo(mid),b=mid.distanceTo(end);
      direction.copy(target).sub(start);
      const length=direction.length();if(length<.001||a<.001||b<.001)return;
      direction.divideScalar(length);
      const distance=T.MathUtils.clamp(length,Math.abs(a-b)+.003,a+b-.003);
      pole.set(l.side==='left'?-.43:.43,.94,-.14);actor.localToWorld(pole);pole.sub(start);
      pole.addScaledVector(direction,-pole.dot(direction)).normalize();
      if(pole.lengthSq()<.01)pole.set(0,-1,0);
      const along=(a*a-b*b+distance*distance)/(2*distance);
      joint.copy(start).addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
      const reached=target.copy(start).addScaledVector(direction,distance);
      direct(l.upper,l.elbow,joint);
      direct(l.elbow,l.hand,reached);
    }
    return {
      pose(gun,{stride=0,pitch=0,alive=true,crouched=false}={}){
        const signature=gun?.uuid+'/'+stride+'/'+pitch+'/'+alive+'/'+crouched;
        if(signature===changed)return;
        changed=signature;
        for(const [bone,rotation]of rest)bone.quaternion.copy(rotation);
        actor.getWorldQuaternion(rootRotation);axis.copy(xAxis).applyQuaternion(rootRotation);
        if(alive&&Math.abs(stride)>.01){
          for(const limb of limbs){
            const swing=(limb.side==='left'?stride:-stride)*.76;
            deltaRotation.setFromAxisAngle(axis,swing);worldRotate(limb.thigh,deltaRotation);
            deltaRotation.setFromAxisAngle(axis,Math.max(0,-swing)*.38);worldRotate(limb.shin,deltaRotation);
          }
        }
        if(alive&&head&&Math.abs(pitch)>.02){
          deltaRotation.setFromAxisAngle(axis,Math.max(-.48,Math.min(.48,pitch)));worldRotate(head,deltaRotation);
        }
        const grip=gun?.userData?.grip;
        if(alive&&grip?.right&&grip?.left){
          solveArm(limbs[0],gun,grip.left);
          solveArm(limbs[1],gun,grip.right);
        }
      },
      dispose(){const set=new Set();exterior.traverse(node=>{if(node.isSkinnedMesh)set.add(node.skeleton);});for(const skeleton of set)skeleton.dispose();}
    };
  }
  function loadOperators(THREE) {
    const T = THREE || global.THREE;
    if (operatorPromise) return operatorPromise;
    const epoch = operatorEpoch;
    const ids=[...Object.keys(global.CS16Characters.profiles),...Object.keys(global.CS16Magic.pets).map(id=>'pet-'+id)];
    operatorPromise = Promise.allSettled(ids.map(id => loadGLTF(T, ASSETS + (id.startsWith('pet-')?'':'hero-') + id + '.glb')))
      .then(results => {
        const failed = results.find(result => result.status === 'rejected');
        if (failed || epoch !== operatorEpoch) {
          results.forEach(result => { if (result.status === 'fulfilled') disposeTree(result.value.scene); });
          throw failed ? failed.reason : new Error('Operator loading was cancelled');
        }
        results.forEach((result, index) => {
          const root = ids[index].startsWith('pet-') ? skinPet(T,result.value.scene) : result.value.scene;
          prepareMeshes(T, root, null, QUALITY.high);
          operators.set(ids[index], root);
        });
        return Promise.allSettled(['ct','t'].map(team=>exteriorSources.has(team)?true:loadExterior(T,team))).then(results=>{for(const item of results)if(item.status==='rejected')console.warn('Classic exterior unavailable',item.reason?.message||item.reason);return true;});
      }).catch(error => {
        if (epoch === operatorEpoch) operatorPromise = null;
        throw error;
      });
    return operatorPromise;
  }

  function createOperator(team, characterId) {
    const id=global.CS16Characters.normalize(characterId);
    const source = operators.get(id);
    if (!source) return null;
    const T = global.THREE;
    const clone = T.SkeletonUtils && T.SkeletonUtils.clone ? T.SkeletonUtils.clone(source) : source.clone(true);
    clone.userData.cs16SharedOperator = true;
    const external=id==='classic'?exteriorSources.get(team):null;
    if(external){
      const body=T.SkeletonUtils.clone(external);
      clone.traverse(node=>{if(node.isMesh)node.visible=false;});
      clone.add(body);
      clone.userData.classicExterior=fitExterior(T,clone,body);
    }
    return clone;
  }

  // Rigid authoring pivots become bones of a single draw call. Geometry/material
  // are shared; each companion receives its own skeleton through SkeletonUtils.
  function skinPet(T,source){
    source.updateMatrixWorld(true);
    const root=new T.Group(),bones=[],boneFor=new Map();root.name=source.name;
    function hierarchy(node,parent){
      if(node.isMesh)return;
      const bone=new T.Bone();bone.name=node.name;bone.position.copy(node.position);
      bone.quaternion.copy(node.quaternion);bone.scale.copy(node.scale);parent.add(bone);
      boneFor.set(node,bones.length);bones.push(bone);
      for(const child of node.children)hierarchy(child,bone);
    }
    for(const node of source.children)hierarchy(node,root);
    const positions=[],normals=[],colours=[],indices=[],joints=[],weights=[];
    const inv=new T.Matrix4().copy(source.matrixWorld).invert(),matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),v=new T.Vector3();
    const oldGeometries=new Set();let material;
    source.traverse(node=>{
      if(!node.isMesh)return;
      const geometry=node.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal,color=geometry.attributes.color;
      const offset=positions.length/3,bone=boneFor.get(node.parent)??0;
      matrix.multiplyMatrices(inv,node.matrixWorld);normalMatrix.getNormalMatrix(matrix);
      for(let i=0;i<position.count;i++){
        v.fromBufferAttribute(position,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
        if(normal)v.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);else v.set(0,1,0);
        normals.push(v.x,v.y,v.z);colours.push(color?color.getX(i):1,color?color.getY(i):1,color?color.getZ(i):1);
        joints.push(bone,0,0,0);weights.push(1,0,0,0);
      }
      if(geometry.index)for(let i=0;i<geometry.index.count;i++)indices.push(offset+geometry.index.getX(i));
      else for(let i=0;i<position.count;i++)indices.push(offset+i);
      oldGeometries.add(geometry);material=Array.isArray(node.material)?node.material[0]:node.material;
    });
    const geometry=new T.BufferGeometry();
    for(const [name,array,size]of [['position',positions,3],['normal',normals,3],['color',colours,3],['skinWeight',weights,4]])geometry.setAttribute(name,new T.Float32BufferAttribute(array,size));
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.setIndex(indices);geometry.computeBoundingSphere();
    const mesh=new T.SkinnedMesh(geometry,material);mesh.name='Companion skin';mesh.frustumCulled=false;
    // Render sorting also requests a skin bound even when frustum culling is off.
    // Reuse the rest envelope instead of skinning every vertex on first display.
    mesh.boundingSphere=geometry.boundingSphere.clone();mesh.boundingSphere.radius*=1.6;
    root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
    root.userData.cs16SharedPet=true;for(const old of oldGeometries)old.dispose();return root;
  }
  function createPet(id){const source=operators.get('pet-'+id);return source?global.THREE.SkeletonUtils.clone(source):null;}
  global.CS16Graphics = Object.freeze({createPet, finishPlaster, configureRenderer, createWorld, loadOperators, createOperator });
})(window);
