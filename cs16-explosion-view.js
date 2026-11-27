(function(g){
 'use strict';
 const MAX_EFFECTS=8,FIRE_COUNT=12,SMOKE_COUNT=16,SPARK_COUNT=20,DEBRIS_COUNT=10;
 const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 function create(T,scene){
  const effects=[];
  const ringGeometry=new T.RingGeometry(.65,1,48).rotateX(-Math.PI/2);
  const debrisGeometry=new T.TetrahedronGeometry(.09,0);
  const debrisMaterial=new T.MeshStandardMaterial({color:0x27211c,roughness:.94,metalness:.08});
  const vertex=`attribute float aAge;attribute float aSize;attribute float aSeed;attribute vec3 aTint;
   varying float vAge;varying float vSeed;varying vec3 vTint;uniform float uGrow;
   void main(){vAge=aAge;vSeed=aSeed;vTint=aTint;vec4 mv=modelViewMatrix*vec4(position,1.);
    gl_PointSize=clamp(aSize*(1.+max(0.,aAge)*uGrow)*(260./max(1.,-mv.z)),1.,180.);
    gl_Position=projectionMatrix*mv;}`;
  const fireMaterial=new T.ShaderMaterial({name:'Explosion · turbulent fire',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
   uniforms:{uGrow:{value:1.25}},vertexShader:vertex,
   fragmentShader:`varying float vAge;varying float vSeed;varying vec3 vTint;
    void main(){if(vAge<0.||vAge>1.)discard;vec2 p=gl_PointCoord-.5;float angle=atan(p.y,p.x);
     float d=length(p)*2.;float edge=.91+.09*sin(angle*7.+vSeed*19.);if(d>edge)discard;
     float billow=.82+.18*sin((p.x*11.+p.y*13.+vSeed)*6.283);
     float alpha=(1.-smoothstep(.08,edge,d))*pow(1.-vAge,1.35)*billow;
     vec3 color=mix(vTint*1.65,vTint*vec3(.62,.20,.045),vAge);
     gl_FragColor=vec4(color,alpha);}`});
  const smokeMaterial=new T.ShaderMaterial({name:'Explosion · rolling smoke',transparent:true,depthWrite:false,blending:T.NormalBlending,toneMapped:false,
   uniforms:{uGrow:{value:2.1}},vertexShader:vertex,
   fragmentShader:`varying float vAge;varying float vSeed;varying vec3 vTint;
    void main(){if(vAge<0.||vAge>1.)discard;vec2 p=gl_PointCoord-.5;float angle=atan(p.y,p.x);
     float d=length(p)*2.;float edge=.88+.12*sin(angle*6.+vSeed*23.);if(d>edge)discard;
     float billow=.74+.26*sin((p.x*9.-p.y*12.+vSeed)*6.283);
     float alpha=(1.-smoothstep(.04,edge,d))*sin(min(1.,vAge*5.)*1.5708)*pow(1.-vAge,1.15)*.68*billow;
     gl_FragColor=vec4(vTint,alpha);}`});
  const sparkMaterial=new T.ShaderMaterial({name:'Explosion · hot sparks',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
   uniforms:{uGrow:{value:0}},vertexShader:vertex,
   fragmentShader:`varying float vAge;varying float vSeed;varying vec3 vTint;
    void main(){if(vAge<0.||vAge>1.)discard;float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
     gl_FragColor=vec4(vTint*(1.8-vAge*.6),(1.-d)*(1.-vAge));}`});
  const dummy=new T.Object3D();let serial=0;
  function particles(count,material){
   const geometry=new T.BufferGeometry(),positions=new Float32Array(count*3),ages=new Float32Array(count),sizes=new Float32Array(count),seeds=new Float32Array(count),tints=new Float32Array(count*3);
   geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
   geometry.setAttribute('aAge',new T.BufferAttribute(ages,1).setUsage(T.DynamicDrawUsage));
   geometry.setAttribute('aSize',new T.BufferAttribute(sizes,1));geometry.setAttribute('aSeed',new T.BufferAttribute(seeds,1));geometry.setAttribute('aTint',new T.BufferAttribute(tints,3));
   const points=new T.Points(geometry,material);points.frustumCulled=false;
   return {points,geometry,positions,ages,sizes,seeds,tints,velocities:new Float32Array(count*3),duration:1,count};
  }
  function makeEffect(){
   const group=new T.Group();group.name='Pooled explosion';group.visible=false;
   const fire=particles(FIRE_COUNT,fireMaterial),smoke=particles(SMOKE_COUNT,smokeMaterial),sparks=particles(SPARK_COUNT,sparkMaterial);
   const ringMaterial=new T.MeshBasicMaterial({color:0xffb15a,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,toneMapped:false});
   const ring=new T.Mesh(ringGeometry,ringMaterial);ring.visible=false;
   const debris=new T.InstancedMesh(debrisGeometry,debrisMaterial,DEBRIS_COUNT);debris.instanceMatrix.setUsage(T.DynamicDrawUsage);debris.frustumCulled=false;
   const light=new T.PointLight(0xff8a35,0,24,2);group.add(fire.points,smoke.points,sparks.points,ring,debris,light);scene.add(group);
   const effect={group,fire,smoke,sparks,ring,ringMaterial,debris,light,active:false,age:0,born:0,debrisVelocity:new Float32Array(DEBRIS_COUNT*3),debrisSpin:new Float32Array(DEBRIS_COUNT*3)};
   effects.push(effect);return effect;
  }
  function random(index,salt){const x=Math.sin((serial+1)*12.9898+index*78.233+salt*37.719)*43758.5453;return x-Math.floor(x);}
  function setupPart(part,effect,kind,flash){
   const isFire=kind==='fire',isSmoke=kind==='smoke';
   part.duration=flash?(isSmoke ? .01 : isFire ? .30 : .38):(isFire ? .48 : isSmoke ? 2.5 : .85);
   for(let i=0;i<part.count;i++){
    const j=i*3,a=random(i,1)*Math.PI*2,r=random(i,2),up=random(i,3),size=isFire?1.8+r*2.0:isSmoke?2.2+r*2.3:.055+r*.065;
    part.ages[i]=-random(i,4)*(isSmoke ? .13 : .045);part.sizes[i]=size;part.seeds[i]=random(i,5);
    part.positions[j]=Math.cos(a)*r*(isSmoke ? .45 : .22);part.positions[j+1]=(up-.3)*(isSmoke ? .55 : .30);part.positions[j+2]=Math.sin(a)*r*(isSmoke ? .45 : .22);
    const speed=isFire?2.0+r*3.4:isSmoke?.8+r*1.6:4.5+r*9;
    part.velocities[j]=Math.cos(a)*speed;part.velocities[j+1]=(isSmoke?1.1+up*1.6:isFire?.5+up*2.1:2+up*8);part.velocities[j+2]=Math.sin(a)*speed;
    const tint=flash?[1,1,1]:isSmoke?[.20+r*.10,.18+r*.09,.16+r*.08]:[1,.32+r*.38,.055+r*.10];
    part.tints[j]=tint[0];part.tints[j+1]=tint[1];part.tints[j+2]=tint[2];
   }
   for(const name of ['position','aAge','aSize','aSeed','aTint'])part.geometry.attributes[name].needsUpdate=true;
  }
  function spawn(pos,kind){
   if(!valid(pos))return;
   let effect=effects.find(e=>!e.active);if(!effect&&effects.length<MAX_EFFECTS)effect=makeEffect();
   if(!effect)effect=effects.reduce((oldest,e)=>e.born<oldest.born?e:oldest,effects[0]);
   serial++;const flash=kind==='flash';effect.active=true;effect.age=0;effect.born=performance.now();effect.group.visible=true;effect.group.position.fromArray(pos);
   setupPart(effect.fire,effect,'fire',flash);setupPart(effect.smoke,effect,'smoke',flash);setupPart(effect.sparks,effect,'sparks',flash);
   effect.ring.visible=true;effect.ring.position.y=-Math.min(.85,Math.max(0,pos[1]-.05));effect.ring.scale.setScalar(.4);effect.ringMaterial.color.setHex(flash?0xffffff:0xffb15a);effect.ringMaterial.opacity=.34;
   effect.light.color.setHex(flash?0xffffff:0xff8a35);effect.light.intensity=flash?65:95;effect.debris.visible=!flash;
   for(let i=0;i<DEBRIS_COUNT;i++){
    const j=i*3,a=random(i,8)*Math.PI*2,speed=2.5+random(i,9)*5;
    effect.debrisVelocity[j]=Math.cos(a)*speed;effect.debrisVelocity[j+1]=2.5+random(i,10)*6;effect.debrisVelocity[j+2]=Math.sin(a)*speed;
    effect.debrisSpin[j]=random(i,11)*8;effect.debrisSpin[j+1]=random(i,12)*8;effect.debrisSpin[j+2]=random(i,13)*8;
   }
  }
  function updatePart(part,dt,kind){
   const drag=Math.max(0,1-dt*(kind==='smoke'?.35:kind==='fire'?2.6:.15));
   for(let i=0;i<part.count;i++){
    const j=i*3;part.ages[i]+=dt;part.geometry.attributes.aAge.array[i]=part.ages[i]/part.duration;
    if(part.ages[i]<0||part.ages[i]>part.duration)continue;
    part.positions[j]+=part.velocities[j]*dt;part.positions[j+1]+=part.velocities[j+1]*dt;part.positions[j+2]+=part.velocities[j+2]*dt;
    part.velocities[j]*=drag;part.velocities[j+2]*=drag;
    if(kind==='sparks')part.velocities[j+1]-=12*dt;else if(kind==='smoke')part.velocities[j]+=.12*dt;
   }
   part.geometry.attributes.position.needsUpdate=true;part.geometry.attributes.aAge.needsUpdate=true;
  }
  function update(dt){
   for(const effect of effects){
    if(!effect.active)continue;effect.age+=dt;
    updatePart(effect.fire,dt,'fire');updatePart(effect.smoke,dt,'smoke');updatePart(effect.sparks,dt,'sparks');
    const ringAge=Math.min(1,effect.age/.42);effect.ring.scale.setScalar(.4+ringAge*7);effect.ringMaterial.opacity=.30*(1-ringAge);effect.ring.visible=ringAge<1;
    effect.light.intensity=95*Math.pow(Math.max(0,1-effect.age/.28),2);
    for(let i=0;i<DEBRIS_COUNT;i++){
     const j=i*3,t=Math.max(0,effect.age-i*.002),visible=effect.debris.visible&&t<1.35;
     dummy.position.set(effect.debrisVelocity[j]*t,effect.debrisVelocity[j+1]*t-6*t*t,effect.debrisVelocity[j+2]*t);
     dummy.rotation.set(effect.debrisSpin[j]*t,effect.debrisSpin[j+1]*t,effect.debrisSpin[j+2]*t);dummy.scale.setScalar(visible?1:0);dummy.updateMatrix();effect.debris.setMatrixAt(i,dummy.matrix);
    }
    effect.debris.instanceMatrix.needsUpdate=true;
    if(effect.age>2.65){effect.active=false;effect.group.visible=false;effect.light.intensity=0;}
   }
  }
  function reset(){for(const effect of effects){effect.active=false;effect.group.visible=false;effect.light.intensity=0;}}
  function dispose(){reset();for(const effect of effects){effect.group.removeFromParent();for(const part of [effect.fire,effect.smoke,effect.sparks])part.geometry.dispose();effect.ringMaterial.dispose();}effects.length=0;for(const resource of [ringGeometry,debrisGeometry,debrisMaterial,fireMaterial,smokeMaterial,sparkMaterial])resource.dispose();}
  return {spawn,update,reset,dispose,count:()=>effects.filter(e=>e.active).length,stats:()=>({active:effects.filter(e=>e.active).length,pooled:effects.length,capacity:MAX_EFFECTS})};
 }
 g.CS16ExplosionView={create};
})(window);
