(function(g,f){const api=f();if(typeof module==='object'&&module.exports)module.exports=api;if(g)g.CS16Karambit=api;})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const TAU=Math.PI*2, speed=TAU/1.35;
  function motion(){return {angle:0,lastAttack:-Infinity,from:0,to:0};}
  function advance(s,dt,now,attackAt=-Infinity){
    if(attackAt>s.lastAttack){
      s.lastAttack=attackAt;s.from=s.angle;s.to=Math.ceil(s.angle/TAU)*TAU;
    }
    const age=now-s.lastAttack;
    if(age<.42){
      const t=Math.max(0,Math.min(1,age/.085)),ease=t*t*(3-2*t);
      s.angle=s.from+(s.to-s.from)*ease;
    }else s.angle=(s.angle+Math.max(0,Math.min(.05,dt))*speed)%TAU;
    return s.angle;
  }
  function bind(T,gun,basis,firstPerson){
    if(!basis)return;
    const source=basis.getObjectByName('weapon'),pivot=source?.userData.spinPivot||[0,.006,.13];
    const rotor=new T.Group();rotor.name='karambitRotor';rotor.position.fromArray(pivot);
    for(const child of [...basis.children]){basis.remove(child);child.position.sub(rotor.position);rotor.add(child);}
    basis.add(rotor);basis.updateMatrix();
    const point=new T.Vector3(...pivot).applyMatrix4(basis.matrix);
    // The ring remains on the curled index, while the blade rotates independently of the glove.
    if(gun.userData.grip){
      const scale=gun.userData.grip.handScale;
      gun.userData.grip.right=firstPerson?point.clone().sub(new T.Vector3(-.012,-.040,-.032).multiplyScalar(scale)).toArray():point.toArray();
    }
    gun.userData.karambit={rotor,pivot:point.toArray(),state:motion()};
  }
  function fitHands(T,gun,source){
    const data=gun.userData.karambit;if(!data||!source)return false;
    const attach=(name)=>{const original=source.getObjectByName(name);if(!original)return null;
      const hand=original.clone(true);hand.position.fromArray(data.pivot);hand.scale.setScalar(gun.userData.grip.handScale);gun.add(hand);return hand;};
    data.hand=attach('rightHand');data.attackHand=attach('attackHand');
    if(data.attackHand)data.attackHand.visible=false;
    return !!data.hand;
  }
  function update(gun,dt,time,attackAt){
    const data=gun?.userData.karambit;if(!data)return;
    data.rotor.rotation.x=advance(data.state,dt,time,attackAt);
    if(data.hand&&data.attackHand){
      const age=time-data.state.lastAttack,grip=age>=.065&&age<.42;
      data.hand.visible=!grip;data.attackHand.visible=grip;
    }
  }
  return {motion,advance,bind,fitHands,update};
});
