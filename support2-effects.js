/* Original spell visuals. Bounded effect lifetime; no gameplay or network authority. */
(function () {
  const active = [], limit = 36;
  function remove(effect) {
    effect.group.removeFromParent();
    effect.group.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); });
  }
  function cast(scene, from, target, color, ultimate, key) {
    if (!scene) return;
    while (active.length >= limit) remove(active.shift());
    const T = window.THREE, group = new T.Group(), duration = ultimate ? 1.7 : .85;
    const radius = ultimate ? 8 : key === 'W' ? 5 : 3;
    group.position.set(target.x, .75, target.z);
    const family=from.heroDef?.id||'varg';
    const material = (opacity = 1) => new T.MeshBasicMaterial({color, transparent:true, opacity,
      blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide, toneMapped:false});
    for (let i = 0; i < 2; i++) {
      const ring = new T.Mesh(new T.RingGeometry(radius * (.65 + i * .3), radius * (.68 + i * .3), 64), material(.9));
      ring.rotation.x = -Math.PI / 2; ring.position.y = i * .08;
      ring.userData.kind = 'ring'; group.add(ring);
    }
    const count = ultimate ? 28 : 12;
    for (let i = 0; i < count; i++) {
      const shard = new T.Mesh(new T.OctahedronGeometry(ultimate ? .35 : .2), material());
      if(['freya','vesper','astra'].includes(family))shard.geometry.scale(.6,3,.6);
      shard.userData = {kind:'shard', angle:i / count * Math.PI * 2, speed:2 + Math.random() * 4, phase:Math.random()};
      group.add(shard);
    }
    if (ultimate) {
      const beam = new T.Mesh(new T.CylinderGeometry(.12, 1.4, 15, 24, 1, true), material(.55));
      beam.position.y = 7.5; beam.userData.kind = 'pillar'; group.add(beam);
    }
    // Element-specific silhouettes rather than the same flash for every spell.
    const elemental=['cinder','freya','varg','briar','ksul','vesper'].includes(family);
    if(elemental){
      for(let i=0;i<(ultimate?12:6);i++){
        const angle=i*Math.PI*2/(ultimate?12:6),x=Math.cos(angle)*radius*.7,z=Math.sin(angle)*radius*.7;
        let geo;
        if(family==='freya')geo=new T.ConeGeometry(.45,3.4,5);
        else if(family==='cinder')geo=new T.ConeGeometry(.6,3.2,12,1,true);
        else {const curve=new T.CatmullRomCurve3([new T.Vector3(x,0,z),new T.Vector3(x*.7,2,z*.7),new T.Vector3(x*.4,3.8,z*.4),new T.Vector3(-x*.2,4.5,-z*.2)]);geo=new T.TubeGeometry(curve,16,.06,5,false);}
        const rune=new T.Mesh(geo,material(.75));if(['freya','cinder'].includes(family))rune.position.set(x,1.5,z);rune.userData.kind='growth';group.add(rune);
      }
    }
    // Arcing ribbons link the caster to the impact without obscuring units.
    if (Math.hypot(from.x - target.x, from.z - target.z) > 2) {
      const start = new T.Vector3(from.x - target.x, 1.6, from.z - target.z);
      const curve = new T.QuadraticBezierCurve3(start, start.clone().multiplyScalar(.5).add(new T.Vector3(0,4,0)), new T.Vector3(0,.2,0));
      const ribbon = new T.Mesh(new T.TubeGeometry(curve, 20, ultimate ? .12 : .055, 5, false), material(.65));
      ribbon.userData.kind = 'ribbon'; group.add(ribbon);
    }
    scene.add(group); active.push({group, time:0, duration, radius,source:{x:from.x,z:from.z}});
  }
  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i]; e.time += dt;
      if (e.time >= e.duration) { remove(e); active.splice(i,1); continue; }
      const p = e.time / e.duration, fade = Math.sin(Math.PI * Math.min(1, p * 1.1));
      for (const o of e.group.children) {
        o.material.opacity = Math.max(0, fade) * (o.userData.kind === 'pillar' ? .3 : .85);
        if (o.userData.kind === 'ring') { o.scale.setScalar(.25 + p * 1.1); o.rotation.z += dt * .35; }
        if (o.userData.kind === 'shard') {
          const {angle, speed, phase} = o.userData, r = e.radius * p;
          o.position.set(Math.cos(angle + p * .6) * r, Math.sin(p * Math.PI) * speed + phase, Math.sin(angle + p * .6) * r);
          o.rotation.set(p * 5, angle + p * 3, p * 2); o.scale.setScalar(1 - p * .7);
        }
        if (o.userData.kind === 'pillar') o.scale.set(1 - p * .8, 1, 1 - p * .8);
        if (o.userData.kind === 'growth')o.scale.y=Math.sin(p*Math.PI)*1.2;
      }
    }
  }
  function clear() { active.splice(0).forEach(remove); }
  function decorate(group, hero) {
    if (!['cinder','vesper','briar'].includes(hero.id)) return;
    const T=window.THREE, color=hero.color;
    const mat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.65,metalness:.5,roughness:.3});
    if(hero.id==='cinder') {
      for(const side of [-1,1]){
        const plate=new T.Mesh(new T.OctahedronGeometry(.52),mat);
        plate.position.set(side*.8,2.1,0);plate.scale.set(1,.7,1.1);group.add(plate);
        const horn=new T.Mesh(new T.ConeGeometry(.14,.75,6),mat);
        horn.position.set(side*.82,2.6,0);horn.rotation.z=-side*.4;group.add(horn);
      }
    } else if(hero.id==='vesper') {
      const halo=new T.Mesh(new T.TorusGeometry(.68,.045,8,36,Math.PI*1.6),mat);
      halo.position.set(0,2.7,-.25);halo.rotation.z=.6;group.add(halo);
      for(const side of [-1,1]){const gem=new T.Mesh(new T.OctahedronGeometry(.23),mat);gem.position.set(side*.9,1.8,0);gem.scale.y=2;group.add(gem);}
    } else {
      for(const side of [-1,1])for(let i=0;i<3;i++){
        const branch=new T.Mesh(new T.ConeGeometry(.12,.85-i*.1,5),mat);
        branch.position.set(side*(.35+i*.18),2.8+i*.12,0);branch.rotation.z=-side*(.3+i*.3);group.add(branch);
      }
    }
  }
  function visibility(canSee){for(const e of active)e.group.visible=canSee(e.group.position.x,e.group.position.z)&&canSee(e.source.x,e.source.z);}
  window.S2Effects = {cast, update, clear, decorate, visibility, get count(){return active.length;}};
})();
