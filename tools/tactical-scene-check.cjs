// Runs the real movement and collision code in the WebGL client, not a second physics implementation.
module.exports = async function tacticalSceneCheck() {
  const previous = {...P}, phase = state.phase, alive = me.alive, weapon = current;
  const actors = [...remotes.values()].map(r => [r, r.alive]);
  const data = CS16Buildings.layout(grid, curMap), reports = [];
  const staticArt = await worldGraphics.ready;
  if(curMap==='dust2') {
    const totals={kind:'weapon-lod',fullTriangles:0,worldTriangles:0,fullDraws:0,worldDraws:0};
    const stats=root=>{let triangles=0,draws=0;root.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return {triangles,draws};};
    for(const id of Object.keys(glbCache)) {
      if(!glbCache[id].world)continue;
      const full=buildGun(id,'',1),world=buildGun(id,'',1,true),a=stats(full),b=stats(world);
      try {
        if(CS16FieldView.supported(id)){
          const rail=new THREE.Vector3(...full.userData.grip.rail);full.updateMatrixWorld(true);
          const down=new THREE.Raycaster(rail.clone().add(new THREE.Vector3(0,.012,0)),new THREE.Vector3(0,-1,0),0,.048);
          if(!down.intersectObject(full,true).length)throw Error('Reflex mount floats above weapon: '+id);
        }
        if(b.triangles>a.triangles*.3||b.draws>2)throw Error('Remote weapon budget '+id);
        const near=new THREE.Box3().setFromObject(full),far=new THREE.Box3().setFromObject(world);
        if(near.min.distanceTo(far.min)>.035||near.max.distanceTo(far.max)>.035)throw Error('Remote weapon silhouette shifted '+id);
        for(const side of ['left','right'])if(full.userData.grip[side])
          if(new THREE.Vector3(...full.userData.grip[side]).distanceTo(new THREE.Vector3(...world.userData.grip[side]))>.001)throw Error('Remote grip shifted '+id);
        const painted=buildGun(id,'gold',1,true);
        try {painted.traverse(o=>{if(o.isMesh&&o.material.name==='Weapon finish / world'&&(!o.material.map||o.material.vertexColors))throw Error('Remote skin mask '+id);});}
        finally {disposeGun(painted);}
        totals.fullTriangles+=a.triangles;totals.worldTriangles+=b.triangles;totals.fullDraws+=a.draws;totals.worldDraws+=b.draws;
      }finally {disposeGun(full);disposeGun(world);}
    }
    if(totals.worldDraws<19)throw Error('Remote weapon LODs did not load');
    reports.push(totals);
  }
  // Observe actual rendered frames: the immutable map must not recompute transforms.
  await new Promise(requestAnimationFrame);
  const tracked = []; let staticUpdates = 0;
  staticArt.traverse(node => {
    const original = node.updateMatrixWorld;
    tracked.push([node, original]);
    node.updateMatrixWorld = function(force) { staticUpdates++; return original.call(this, force); };
  });
  try {
    for (let i = 0; i < 12; i++) await new Promise(requestAnimationFrame);
    if (staticUpdates) throw Error('Static map transforms repeated during rendering: ' + staticUpdates);
    reports.push({kind:'static-map',frames:12,transformUpdates:staticUpdates});
  } finally {
    for (const [node, original] of tracked) node.updateMatrixWorld = original;
  }
  const reset = (x,y,z,yaw) => Object.assign(P,{x,y,z,yaw,pitch:0,vx:0,vy:0,vz:0,onGround:true,crouched:false});
  const walk = frames => {for(let i=0;i<frames;i++)stepPlayer(1/60,{w:true});};
  const doorArt = data.environment.doors.filter(d=>!d.kind);
  const leafMeshes = [];
  scene.getObjectByName('Interactive interiors').traverse(o=>{
    if(o.isInstancedMesh && o.name.startsWith('Painted house doors wood '))leafMeshes.push(o);
  });
  if(leafMeshes.length!==2 || leafMeshes.some(m=>m.count!==doorArt.length))throw Error('Door art batching incomplete');
  const checkLeaf = (door, closed) => {
    environmentView.update(.9,performance.now(),camera);
    scene.updateMatrixWorld(true);
    for(const offset of [-.5,.5]) {
      const ray=new THREE.Raycaster(new THREE.Vector3(door.x+offset,1.3,door.z-1),new THREE.Vector3(0,0,1),0,1.3);
      if(Boolean(ray.intersectObjects(leafMeshes,false).length)!==closed)
        throw Error('Door art/collision mismatch '+door.id+' closed='+closed+' side='+offset);
    }
  };
  try {
    state.phase='live';me.alive=true;current='knife';
    for(const [r] of actors)r.alive=false;
    for(const [start,end,z] of [[48.5*4,59.5*4,67*4],[65.5*4,77.5*4,65*4]]) {
      for(const reverse of [false,true]) {
        reset(reverse?end:start,0,z,reverse?Math.PI/2:-Math.PI/2);
        let lowest=0;
        for(let i=0;i<600 && Math.abs(P.x-(reverse?start:end))>.3;i++) {
          stepPlayer(1/60,{w:true});lowest=Math.min(lowest,P.y);
        }
        if(Math.abs(P.x-(reverse?start:end))>.4 || Math.abs(P.y)>.03 || lowest> -3.15)
          throw Error('Tunnel traversal failed '+JSON.stringify({start,end,z,reverse,x:P.x,y:P.y,lowest}));
        reports.push({kind:'tunnel',reverse,lowest,end:[P.x,P.y,P.z]});
      }
    }
    for(const house of data.buildings) {
      const door=data.environment.doors.find(d=>d.building===house.id),wasOpen=door.open;
      try {
        door.open=false;data.environment.revision++;
        checkLeaf(door,true);
        reset(door.x,0,door.z-1.5,Math.PI);walk(45);
        if(P.z>door.z-.2)throw Error('Closed door did not stop player '+door.id);
        window.__emitted=[];
        window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',code:'KeyE'}));
        if(!window.__emitted.some(e=>e.n==='cs16_door'&&e.d===door.id))throw Error('E did not address house door '+door.id);
        const snap=CS16Environment.snapshot(data);
        window.__socket.receive('cs16_environment',{...snap,map:curMap,revision:snap.revision+1,closed:snap.closed.filter(id=>id!==door.id)});
        if(!door.open)throw Error('Door state did not synchronize '+door.id);
        checkLeaf(door,false);
        for(const y of [.68,1.3,2.3]) for(const dx of [-.5,.5]) {
          const ray=new THREE.Raycaster(new THREE.Vector3(door.x+dx,y,door.z-2),new THREE.Vector3(0,0,1),0,4);
          if(ray.intersectObject(staticArt,true).length)throw Error('Static decoration crosses entrance '+door.id+' y='+y);
        }
        reset(door.x,0,door.z-1.5,Math.PI);walk(45);
        if(P.z<door.z+2||Math.abs(P.y-.02)>.03)throw Error('Open entrance blocked '+door.id);
        // Walk up each stair flight and the upper landing using the same capsule as a player.
        reset(house.x+9.7,.02,house.z+.40,Math.PI);walk(78);
        if(P.y<3.55)throw Error('First stair blocked '+house.id+' y='+P.y+' z='+P.z);
        reset(house.x+11.05,3.6,house.z+10.8,0);
        for(let i=0;i<100&&P.y<7.19;i++)stepPlayer(1/60,{w:true});
        if(P.y<7.15)throw Error('Roof stair blocked '+house.id+' y='+P.y+' z='+P.z);
        reports.push({kind:'house',id:house.id,roofY:P.y});
      } finally {door.open=wasOpen;data.environment.revision++;}
    }
    return reports;
  } finally {
    Object.assign(P,previous);state.phase=phase;me.alive=alive;current=weapon;
    for(const [r,value]of actors)r.alive=value;
  }
};
