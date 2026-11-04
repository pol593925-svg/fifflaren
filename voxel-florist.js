(() => {
  'use strict';
  window.HubVoxelFlorist = (T,scene) => {
    const npc=new T.Group(), visitor=new T.Group(), geo=new T.BoxGeometry(1,1,1), materials=new Map();
    scene.add(npc,visitor);npc.visible=visitor.visible=false;
    function part(group,color,size,pos) {
      if(!materials.has(color))materials.set(color,new T.MeshLambertMaterial({color}));
      const mesh=new T.Mesh(geo,materials.get(color));mesh.scale.set(...size);mesh.position.set(...pos);group.add(mesh);return mesh;
    }
    const skin=0xc7916e, apron=0x46765b, boots=0x5f4739;
    for(const x of [-.14,.14])part(npc,boots,[.23,.73,.28],[x,.365,0]);
    const torso=new T.Group();torso.position.y=.72;npc.add(torso);
    part(torso,apron,[.56,.65,.32],[0,.32,0]);part(torso,0xb59055,[.38,.19,.05],[0,.23,.18]);
    part(torso,skin,[.40,.40,.39],[0,.86,0]);part(torso,0x684433,[.43,.13,.43],[0,1.05,0]);
    part(torso,0xceaa6b,[.62,.075,.54],[0,1.12,0]);part(torso,0xb78e4c,[.42,.16,.38],[0,1.21,0]);
    for(const x of [-.10,.10])part(torso,0x493a31,[.045,.037,.025],[x,.88,.20]);
    const arm=new T.Group();arm.position.set(-.34,.57,0);torso.add(arm);part(arm,skin,[.16,.54,.18],[0,-.24,0]);
    part(torso,skin,[.16,.54,.18],[.34,.28,0]);
    const bloom=new T.Group();npc.add(bloom);part(bloom,0x5b924f,[.035,.26,.035],[0,.15,0]);part(bloom,0xe85866,[.13,.13,.13],[0,.30,0]);
    part(visitor,0x476b90,[.53,.62,.31],[0,1.01,0]);part(visitor,0xc49374,[.41,.43,.4],[0,1.54,0]);
    for(const x of [-.145,.145])part(visitor,0x414f66,[.23,.68,.27],[x,.34,0]);
    const desired=new T.Vector3(),center=new T.Vector3(),ray=new T.Vector3();
    let visit=null;
    function place(pos){if(Array.isArray(pos)){npc.position.fromArray(pos);npc.visible=true;}}
    function near(p){return npc.visible&&npc.position.distanceTo(p)<3.2;}
    function stop(){visit=null;visitor.visible=false;torso.rotation.x=arm.rotation.x=0;bloom.position.set(-.46,0,.4);}
    function begin(data,p){place(data.spot);stop();visit={id:data.id,start:performance.now(),ms:data.ms};visitor.visible=true;visitor.position.copy(p);visitor.rotation.y=Math.atan2(npc.position.x-p.x,npc.position.z-p.z);}
    function tick(t,p,camera,solid){
      if(!npc.visible)return;
      if(!visit){if(near(p))npc.rotation.y=Math.atan2(p.x-npc.position.x,p.z-npc.position.z);return;}
      const u=(t-visit.start)/visit.ms;if(u>=1){stop();return;}
      const bend=u<.5?Math.sin(Math.min(1,u/.5)*Math.PI):0;
      npc.rotation.y=Math.atan2(p.x-npc.position.x,p.z-npc.position.z);
      torso.rotation.x=bend*.95;arm.rotation.x=-.7*bend-(u>.5?.9:0);
      bloom.position.set(-.36,u<.25?0:Math.min(1,(u-.25)*3)*.85,.4+Math.max(0,u-.5)*.5);
      center.copy(npc.position).lerp(p,.48);center.y+=1.05;
      const angle=npc.rotation.y+Math.PI/2;desired.copy(center);desired.x+=Math.sin(angle)*3.25;desired.z+=Math.cos(angle)*3.25;desired.y+=.55;
      ray.subVectors(desired,center);const len=ray.length();ray.normalize();let distance=.25;
      for(let d=.25;d<=len;d+=.16){const x=center.x+ray.x*d,y=center.y+ray.y*d,z=center.z+ray.z*d;if(solid(Math.floor(x),Math.floor(y),Math.floor(z)))break;distance=d;}
      camera.position.copy(center).addScaledVector(ray,distance);camera.lookAt(center);
    }
    function dispose(){npc.removeFromParent();visitor.removeFromParent();geo.dispose();for(const m of materials.values())m.dispose();}
    stop();return {place,near,begin,stop,tick,dispose,get active(){return !!visit;}};
  };
})();
