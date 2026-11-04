/* Support Hub: Blender-authored maps and operators, Three.js r160 PBR renderer. */
(function (global) {
  'use strict';

  const QUALITY = Object.freeze({
    low: { dpr: 1, shadow: 1024, anisotropy: 2, lamps: 2 },
    balanced: { dpr: 1, shadow: 1024, anisotropy: 4, lamps: 3 },
    high: { dpr: 1.5, shadow: 2048, anisotropy: 8, lamps: 4 },
  });
  const ASSETS = 'models/csgo/';
  let operatorPromise = null;
  let operatorEpoch = 0;
  const operators = new Map();

  function qualityOf(name) { return QUALITY[name] || QUALITY.high; }

  function configureRenderer(renderer, options) {
    const T = global.THREE;
    const name = options && options.quality || 'high';
    const quality = qualityOf(name);
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, quality.dpr));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
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
        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
          material.envMapIntensity = 0.65;
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
    const direction = new T.Vector3(0.48, 0.77, 0.39).normalize();
    const material = new T.ShaderMaterial({
      name: 'CS16 daylight atmosphere',
      side: T.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        sunDirection: { value: direction },
        zenith: { value: new T.Color(inferno ? '#4689ba' : '#327fbc') },
        horizon: { value: new T.Color(inferno ? '#c9d7dd' : '#c0d5df') },
        ground: { value: new T.Color(inferno ? '#827466' : '#94856f') },
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
        '  float f=0.0; f+=0.5*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p;',
        '  f+=0.25*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p;',
        '  f+=0.125*noise(p); return f;',
        '}',
        'void main() {',
        '  vec3 d=normalize(vSkyDirection);',
        '  float altitude=max(d.y,0.0);',
        '  vec3 color=mix(horizon,zenith,pow(altitude,0.48));',
        '  color=mix(ground,color,smoothstep(-0.12,0.03,d.y));',
        '  vec2 p=d.xz/(0.18+max(d.y,0.0))*2.1;',
        '  float wisps=smoothstep(0.51,0.76,cloud(p))*smoothstep(0.05,0.25,d.y);',
        '  color=mix(color,vec3(0.91,0.93,0.94),wisps*0.68);',
        '  float alignment=max(dot(d,sunDirection),0.0);',
        '  color+=vec3(1.0,0.79,0.48)*pow(alignment,28.0)*0.16;',
        '  color+=vec3(1.0,0.91,0.73)*pow(alignment,700.0)*0.75;',
        '  color+=vec3(4.0,3.4,2.4)*smoothstep(0.99988,0.99997,alignment);',
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
    const mapName = options.map === 'inferno' ? 'inferno' : 'dust2';
    let quality = qualityOf(renderer.userData && renderer.userData.cs16Quality);
    let disposed = false, model = null, environmentTarget = null, nature = null, landscape = null;
    let lampsTick = -Infinity;
    const CELL = options.CELL || 4;
    const group = new T.Group();
    group.name = 'CS16 Blender world: ' + mapName;
    scene.add(group);

    const sky = makeSky(T, mapName === 'inferno', 1100);
    group.add(sky.mesh);
    scene.background = null;
    scene.fog = new T.Fog(mapName === 'inferno' ? 0xd8d4ca : 0xe1d6c5, 245, 910);

    const hemisphere = new T.HemisphereLight(0xc9dfff, mapName === 'inferno' ? 0x7c6651 : 0x738459, 0.86);
    group.add(hemisphere);
    const sun = new T.DirectionalLight(0xffe2b7, 2.22);
    sun.name = 'CS16 sun';
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadow, quality.shadow);
    Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 460 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.08;
    sun.shadow.radius = 3;
    group.add(sun, sun.target);

    // Keep the procedural sky as a fallback while the local photographic panorama loads.
    let photoSky=null;
    new T.TextureLoader().load('assets/royale/daylight.jpg',texture=>{
      if(disposed){texture.dispose();return;}texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;
      photoSky=texture;scene.background=scene.environment=texture;sky.mesh.visible=false;
    });
    // Reuse the same atmosphere for metal reflections; no remote HDR dependency.
    const envScene = new T.Scene();
    const envSky = makeSky(T, mapName === 'inferno', 10);
    envScene.add(envSky.mesh);
    const pmrem = new T.PMREMGenerator(renderer);
    try {
      environmentTarget = pmrem.fromScene(envScene, 0.035, 0.1, 30);
      scene.environment = environmentTarget.texture;
    } finally {
      pmrem.dispose();
      disposeTree(envSky.mesh);
    }

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
      if(landscape)landscape.update(activeCamera,typeof time==='number'?time:performance.now(),renderer.userData.cs16Quality);
      groundPoint.set(activeCamera.position.x, 0, activeCamera.position.z);
      // Quantize in LIGHT coordinates to stop shadows swimming as the player walks.
      const texel = 130 / quality.shadow;
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

    const ready = Promise.allSettled([loadGLTF(T, ASSETS + mapName + '.glb', options.onProgress),loadGLTF(T, ASSETS+'nature.glb')]).then(results => {
      const failed=results.find(r=>r.status==='rejected');if(failed){for(const r of results)if(r.status==='fulfilled')disposeTree(r.value.scene);throw failed.reason;}
      const [gltf,natureAsset]=results.map(r=>r.value);
      if (disposed) {
        disposeTree(gltf.scene);disposeTree(natureAsset.scene);
        const error = new Error('World was replaced while loading');
        error.name = 'AbortError';
        throw error;
      }
      model = gltf.scene;nature=natureAsset.scene;
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
      if(nature){disposeTree(nature);nature=null;}
      if (model) { disposeTree(model); model = null; }
      disposeTree(sky.mesh);if(photoSky){if(scene.background===photoSky)scene.background=null;if(scene.environment===photoSky)scene.environment=null;photoSky.dispose();photoSky=null;}
      if (sun.shadow.map) sun.shadow.map.dispose();
      if (sun.shadow.mapPass) sun.shadow.mapPass.dispose();
      if (environmentTarget) {
        if (scene.environment === environmentTarget.texture) scene.environment = null;
        environmentTarget.dispose();
        environmentTarget = null;
      }
      if (group.parent) group.parent.remove(group);
      group.clear();
    }

    update(camera, 0);
    return { ready, update, dispose, setQuality, groundSurface:(x,z)=>landscape?.groundSurface(x,z)||'stone', nature:()=>nature, surface(name){let found=null;model?.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.name===name)found=m;});return found;} };
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
          const root = result.value.scene;
          prepareMeshes(T, root, null, QUALITY.high);
          operators.set(ids[index], root);
        });
        return true;
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
    return clone;
  }

  function createPet(id){const source=operators.get('pet-'+id);return source?source.clone(true):null;}
  global.CS16Graphics = Object.freeze({createPet, configureRenderer, createWorld, loadOperators, createOperator });
})(window);
