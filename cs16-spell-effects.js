/* Original readable ability VFX. Shared geometry, bounded instances, no full-screen postprocess. */
(function(g){'use strict';
 const styles={flame:['#ff904c','#fff0b2',1.45,5],frost:['#60c9ff','#e4ffff',1.65,6],wind:['#60e5bc','#d8fff2',1.0,2],stone:['#e0a452','#ffe5a0',7,1.45],light:['#ffe18b','#fff9de',1.8,7],fox:['#ffb67c','#fff4bd',.85,1],dragon:['#ff765d','#ffdfa1',1.25,3],owl:['#7ddcff','#d5f6ff',1.2,2],golem:['#8bd2a6','#d9ffe8',5,1.3],deer:['#c1a0ff','#f0dfff',1.8,2]};
 function create({T,scene,getQuality=()=> 'balanced',getEye=()=>null,getTeam=()=>null,getPlayerPosition=()=>null,clock=()=>performance.now()}){
  const effects=[],freeEffects=[],allEffects=[],allMaterials=new Set(),dummy=new T.Object3D();let disposed=false,warming=false;
  const geo={ring:new T.TorusGeometry(1,.022,5,64),orb:new T.IcosahedronGeometry(1,2),shard:new T.ConeGeometry(.13,1,5),spark:new T.PlaneGeometry(.08,.34),shield:new T.IcosahedronGeometry(1,1),strip:new T.PlaneGeometry(.07,1,1,6),cross:new T.BoxGeometry(.1,.32,.06)};
  // Curved, tapered ribbons replace rectangular streaks. Still one instanced draw per effect.
  geo.strip.dispose();const ribbonPoints=[],ribbonUv=[],ribbonIndex=[];
  for(let i=0;i<=18;i++){const t=i/18,a=(t-.5)*2.1,w=Math.sin(Math.PI*t)*.045+.002;for(const side of [-1,1]){ribbonPoints.push(Math.sin(a)*.54,.16*Math.sin(t*Math.PI*2)+side*w,Math.cos(a)*.54-.35);ribbonUv.push((side+1)/2,t)}if(i<18){const n=i*2;ribbonIndex.push(n,n+1,n+2,n+1,n+3,n+2)}}
  geo.strip=new T.BufferGeometry();geo.strip.setAttribute('position',new T.Float32BufferAttribute(ribbonPoints,3));geo.strip.setAttribute('uv',new T.Float32BufferAttribute(ribbonUv,2));geo.strip.setIndex(ribbonIndex);geo.strip.computeVertexNormals();
  geo.cross.dispose();const crossParts=[new T.BoxGeometry(.09,.34,.045).toNonIndexed(),new T.BoxGeometry(.26,.09,.045).toNonIndexed()];const crossPosition=[],crossNormal=[],crossUV=[];for(const part of crossParts){crossPosition.push(...part.attributes.position.array);crossNormal.push(...part.attributes.normal.array);crossUV.push(...part.attributes.uv.array);part.dispose()}geo.cross=new T.BufferGeometry();geo.cross.setAttribute('position',new T.Float32BufferAttribute(crossPosition,3));geo.cross.setAttribute('normal',new T.Float32BufferAttribute(crossNormal,3));geo.cross.setAttribute('uv',new T.Float32BufferAttribute(crossUV,2));
  // Split ice facets shade from a blue base to bright tips without extra lights or draws.
  geo.shard.dispose();geo.shard=new T.CylinderGeometry(.025,.19,1,5,3).toNonIndexed();
  const icePosition=geo.shard.attributes.position,iceColor=new Float32Array(icePosition.count*3);
  for(let i=0;i<icePosition.count;i++){const h=icePosition.getY(i)+.5,x=icePosition.getX(i),z=icePosition.getZ(i),facet=.78+.22*Math.max(0,Math.sin(Math.atan2(x,z)*5+.7));icePosition.setXYZ(i,x*(1+.22*Math.sin(h*Math.PI)),icePosition.getY(i),z);iceColor[i*3]=(.38+.62*h)*facet;iceColor[i*3+1]=(.66+.34*h)*facet;iceColor[i*3+2]=facet;}geo.shard.setAttribute('color',new T.BufferAttribute(iceColor,3));geo.shard.computeVertexNormals();
  // A curved wedge makes the direction of ice unambiguous.
  const fan=new T.RingGeometry(.4,1,40,1,Math.PI*.16,Math.PI*.68);fan.rotateX(-Math.PI/2);geo.fan=fan;
  for(const geometry of Object.values(geo)){
   if(geometry.attributes.uv)geometry.setAttribute('spellUv',geometry.attributes.uv);
   // All shared materials use vertex colour. Missing colour attributes otherwise
   // render the rings/fire black after drawing the coloured ice geometry.
   if(!geometry.attributes.color)geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(1),3));
  }
  function material(){const m=new T.MeshBasicMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,vertexColors:true}),soft={value:0};m.userData.soft=soft;
   m.onBeforeCompile=s=>{s.uniforms.spellSoft=soft;s.vertexShader='attribute vec2 spellUv; varying vec2 spellTexcoord;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nspellTexcoord=spellUv;');s.fragmentShader='uniform float spellSoft; varying vec2 spellTexcoord;\n'+s.fragmentShader.replace('#include <alphatest_fragment>','float edge=pow(max(0.,1.-abs(spellTexcoord.x*2.-1.)),.65)*smoothstep(0.,.14,spellTexcoord.y)*smoothstep(0.,.16,1.-spellTexcoord.y);diffuseColor.a*=mix(1.,edge,spellSoft);\n#include <alphatest_fragment>');};m.customProgramCacheKey=()=> 'painted-magic-soft-edge-v2';allMaterials.add(m);return m;}
  const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  // Keep the instance buffers alive between casts. Recreating/discarding them on
  // every burst used to trigger first-use uploads and garbage collection in combat.
  function makeEffect(){
   const group=new T.Group(),materials=Array.from({length:3},material),[base,glow,rim]=materials;
   const particles=new T.InstancedMesh(geo.spark,glow,32),ribbon=new T.InstancedMesh(geo.strip,glow,8);
   for(const mesh of [particles,ribbon]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);}
   const ring=new T.Mesh(geo.ring,base),teamRing=new T.Mesh(geo.ring,rim),core=new T.Mesh(geo.orb,base);
   ring.rotation.x=teamRing.rotation.x=Math.PI/2;group.add(particles,ring,teamRing,core,ribbon);
   const f={group,materials,base,glow,rim,particles,ribbon,ring,teamRing,core,origin:new T.Vector3(),end:new T.Vector3(),dir:new T.Vector3()};
   allEffects.push(f);return f;
  }
  for(let i=0;i<16;i++)freeEffects.push(makeEffect());
  function remove(f){f.group.removeFromParent();freeEffects.push(f);}
  function fx(data){if(disposed||!styles[data?.id]||!valid(data.pos))return false;
   const eye=getEye(),range=getQuality()==='low'?55:120;if(eye&&Math.hypot(data.pos[0]-eye.x,data.pos[2]-eye.z)>range)return false;
   while(effects.length>=(!warming&&getQuality()==='low'?8:16))remove(effects.shift());
   const [color,light,duration,radius]=styles[data.id],selfTeam=getTeam(),enemy=!!data.team&&!!selfTeam&&selfTeam!==data.team;
   const f=freeEffects.pop(),{group,base,glow,rim,particles,ribbon,ring,teamRing,core,origin,end,dir}=f;
   group.rotation.set(0,0,0);core.visible=true;core.rotation.set(0,0,0);
   glow.userData.soft.value=['frost','light','deer'].includes(data.id)?0:1;
   base.color.set(color);base.opacity=.8;base.blending=T.NormalBlending;
   glow.color.set(data.id==='frost'?'#69baff':light);glow.opacity=.7;glow.blending=data.id==='frost'?T.NormalBlending:T.AdditiveBlending;
   rim.color.set(enemy?'#ff635f':'#8ce8f7');rim.opacity=.65;
   origin.fromArray(valid(data.origin)?data.origin:data.pos);end.fromArray(data.pos);if(valid(data.dir))dir.fromArray(data.dir);else dir.copy(end).sub(origin).normalize();if(dir.lengthSq()<.1)dir.set(0,0,-1);
   const kind=data.id,count=!warming&&getQuality()==='low'?14:32;
   particles.geometry=kind==='frost'?geo.shard:kind==='light'||kind==='deer'?geo.cross:geo.spark;particles.count=count;
   core.geometry=kind==='stone'||kind==='golem'?geo.shield:kind==='frost'?geo.fan:geo.orb;
   const traveling=kind==='flame'||kind==='dragon';group.position.copy(traveling?end:origin);if(!traveling)group.position.y-=1.23;group.position.y+=.05;
   scene.add(group);Object.assign(f,{kind,count,start:clock(),duration,radius,by:data.by,traveling,seed:effects.length*1.79});effects.push(f);return true;
  }
  function update(dt,t=clock()){
   if(disposed)return;
   while(effects.length>(!warming&&getQuality()==='low'?8:16))remove(effects.shift());
   for(let i=effects.length-1;i>=0;i--){const f=effects[i],time=Math.max(0,(t-f.start)/1000),k=time/f.duration;if(k>=1){remove(f);effects.splice(i,1);continue}
    const shield=f.kind==='stone'||f.kind==='golem',heal=f.kind==='light'||f.kind==='deer',dash=f.kind==='wind'||f.kind==='owl',ice=f.kind==='frost',reload=f.kind==='fox';
    const burst=Math.max(0,time-(f.traveling?.19:0)),fade=shield?Math.min(1,time*6,(f.duration-time)*3):Math.pow(1-k,1.3);
    f.base.opacity=(shield?.12:ice?.21:.50)*fade;f.glow.opacity=.85*fade;f.rim.opacity=.65*fade;
    if(shield){const p=getPlayerPosition(f.by);if(p)f.group.position.set(p.x,p.y+.03,p.z)}
    f.ring.position.y=.08;f.teamRing.position.y=.06;
    const spread=shield?f.radius:ice?Math.min(f.radius,burst*13):heal?Math.min(f.radius,burst*6):Math.min(f.radius,burst*9+.2);
    f.ring.scale.setScalar(Math.max(.01,spread));f.teamRing.scale.setScalar(Math.max(.01,spread*1.025));
    if(f.traveling&&time<.19){f.core.position.copy(f.origin).lerp(f.end,time/.19).sub(f.group.position);f.core.scale.setScalar(.13+time*.7);f.ring.visible=f.teamRing.visible=false}else{f.ring.visible=f.teamRing.visible=true;f.core.position.set(0,shield?1.05:heal?.55:ice?.12:.18,0);f.core.scale.setScalar(shield?f.radius:ice?Math.min(12,burst*18):heal?.10+Math.sin(time*8)*.03:Math.max(.001,.8-burst*1.7));}
    if(ice){f.core.rotation.y=Math.atan2(-f.dir.x,-f.dir.z);f.ring.visible=false;f.teamRing.visible=false}
    if(f.traveling&&time>=.19){f.core.position.y=.5;f.core.scale.setScalar(.25+Math.sin(Math.min(1,burst/.42)*Math.PI)*1.5);f.core.rotation.set(time*1.8,time*2.4,time*.7);f.base.opacity*=Math.max(0,1-burst/.55);}
    if(shield){f.core.scale.y=f.radius*1.15;f.core.rotation.y=time*.24}
    if(dash||reload)f.core.visible=false;
    for(let j=0;j<f.count;j++){
     const a=j*2.39996+f.seed,rad=.35+(j%7)/7,age=Math.min(1,burst/(heal?1.7:.9));dummy.rotation.set(0,a,0);dummy.scale.set(1,1,1);
     if(ice){const angle=(j/f.count-.5)*2.14+Math.atan2(f.dir.x,f.dir.z),r=2+(j%7)*1.38,arrival=r/24,growth=T.MathUtils.smoothstep(time-arrival,0,.16)*(1-T.MathUtils.smoothstep(time-arrival,.52,.97)),height=growth*(.45+rad*.60);dummy.position.set(Math.sin(angle)*r,height*.5,Math.cos(angle)*r);dummy.scale.set(.75+rad*.55,height,.75+rad*.55);dummy.rotation.z=(j%3-1)*.24;}
     else if(shield){const phi=j/f.count*Math.PI*2;dummy.position.set(Math.cos(phi)*f.radius, .4+(j%4)*.35,Math.sin(phi)*f.radius);dummy.scale.set(.8,.55,.8);dummy.rotation.y=-phi;}
     else if(heal){const r=(.5+rad)*Math.min(2.7,f.radius*.45),phi=a+time*.6;dummy.position.set(Math.sin(phi)*r,(time*.9+j*.13)%2.5,Math.cos(phi)*r);dummy.scale.setScalar(.5+rad*.5);dummy.rotation.set(0,-a,0);}
     else if(dash){const r=.5+rad*.3;dummy.position.set(Math.cos(a+time*5)*r,.6+Math.sin(a+time*5)*r,-age*(2+j%5));dummy.rotation.x=Math.PI/2;dummy.scale.set(.7,2.2,.7);}
     else if(reload){dummy.position.set(Math.cos(a+time*8)*.6,.7+Math.sin(a+time*8)*.5,Math.sin(a)*.35);dummy.rotation.z=-a-time*8;dummy.scale.set(.6,.6,.6);}
     else{dummy.position.set(Math.cos(a)*age*f.radius*rad,Math.sin(age*Math.PI)*(1+rad)*1.8,Math.sin(a)*age*f.radius*rad);dummy.rotation.set(a+time*3,a,time);dummy.scale.setScalar(Math.max(.01,1-age)*1.2);}
     dummy.updateMatrix();f.particles.setMatrixAt(j,dummy.matrix);
    }
    f.particles.instanceMatrix.needsUpdate=true;
    for(let j=0;j<8;j++){const a=j*Math.PI/4+time*(shield?.3:2);dummy.position.set(Math.cos(a)*spread*.65,(shield?1:.35)+Math.sin(a*2+time*5)*.22,Math.sin(a)*spread*.65);dummy.rotation.set(0,-a,heal||shield?0:Math.PI/2);dummy.scale.set(shield?1.8:1,shield?1.6:heal?1.8:Math.max(.1,spread*.4),1);dummy.updateMatrix();f.ribbon.setMatrixAt(j,dummy.matrix)}f.ribbon.instanceMatrix.needsUpdate=true;
    if(dash)f.group.rotation.y=Math.atan2(-f.dir.x,-f.dir.z);
   }
  }
  function clear(){while(effects.length)remove(effects.pop())}
  async function warm(renderer,camera,beforeRender){
   if(disposed)return;const eye=getEye()||{x:0,y:0,z:0},ids=Object.keys(styles);warming=true;
   try{clear();for(let i=0;i<16;i++)fx({id:ids[i%ids.length],origin:[eye.x,eye.y+1.3,eye.z],pos:[eye.x,eye.y+.2,eye.z-3],dir:[0,0,-1]});
    update(0,clock()+100);if(renderer.compileAsync)await renderer.compileAsync(scene,camera);else renderer.compile(scene,camera);
    if(!disposed){beforeRender?.();renderer.render(scene,camera);}
   }finally{clear();warming=false;}
  }
  return {fx,update,clear,warm,metrics:()=>({effects:effects.length,instances:effects.reduce((n,f)=>n+f.count+8,0),limit:getQuality()==='low'?8:16,materialPool:allMaterials.size,effectPool:allEffects.length}),dispose(){if(disposed)return;disposed=true;clear();for(const f of allEffects){f.particles.dispose();f.ribbon.dispose();}Object.values(geo).forEach(x=>x.dispose());allMaterials.forEach(m=>m.dispose());allMaterials.clear();freeEffects.length=0}};
 }
 g.CS16SpellEffects={create,styles};
})(typeof window==='undefined'?globalThis:window);
