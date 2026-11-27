(function(g){
 'use strict';
 const valid=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 function create(T,scene,hud){
  const active=new Map(),label=document.createElement('div');label.className='cs16-seeker';label.hidden=true;hud.append(label);
  const hull=new T.ConeGeometry(.09,.42,16).rotateX(Math.PI/2),tail=new T.ConeGeometry(.065,.72,12).rotateX(-Math.PI/2);
  const metal=new T.MeshStandardMaterial({color:0x75796a,metalness:.72,roughness:.34});
  const light=new T.MeshBasicMaterial({color:0xffac50,toneMapped:false});
  const core=new T.MeshBasicMaterial({color:0xfff1bd,toneMapped:false});
  const smokeMaterial=new T.ShaderMaterial({name:'Rocket smoke · bounded point trail',transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
   vertexShader:`attribute float aAge;attribute float aSeed;varying float vAlpha;varying float vSeed;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float life=clamp(1.-aAge/2.8,0.,1.);vAlpha=life*life*.34;vSeed=aSeed;
     gl_PointSize=clamp((18.+aAge*23.)*(220./max(1.,-mv.z)),2.,96.);gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`varying float vAlpha;varying float vSeed;
    void main(){vec2 p=gl_PointCoord-.5;float d=length(p)*2.;if(d>1.)discard;
     float billow=.82+.18*sin((p.x*13.+p.y*17.+vSeed)*6.283);float a=smoothstep(1.,.12,d)*vAlpha*billow;
     gl_FragColor=vec4(mix(vec3(.30,.31,.29),vec3(.63,.64,.59),1.-d),a);}`});
  let mode=null,next=0,progress=0,name='',updated=0;const at=new T.Vector3();
  function end(id){
   const m=active.get(id);if(!m)return null;m.group.removeFromParent();m.smoke.removeFromParent();m.smoke.geometry.dispose();active.delete(id);return m;
  }
  function start(d){
   if(!d||!valid(d.pos)||!valid(d.dir))return;
   if(active.has(d.id))end(d.id);if(active.size>=64)return;
   const group=new T.Group(),flame=new T.Mesh(tail,light),inner=new T.Mesh(tail,core);flame.position.z=-.46;inner.position.z=-.40;inner.scale.set(.46,.70,.46);group.add(new T.Mesh(hull,metal),flame,inner);scene.add(group);group.position.fromArray(d.pos);
   const geometry=new T.BufferGeometry(),positions=new Float32Array(24*3),ages=new Float32Array(24),seeds=new Float32Array(24);
   geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
   geometry.setAttribute('aAge',new T.BufferAttribute(ages,1).setUsage(T.DynamicDrawUsage));
   geometry.setAttribute('aSeed',new T.BufferAttribute(seeds,1));geometry.setDrawRange(0,0);
   const smoke=new T.Points(geometry,smokeMaterial);smoke.name='RPG smoke trail';smoke.frustumCulled=false;scene.add(smoke);
   active.set(d.id,{id:d.id,kind:d.kind||'vehicle',group,smoke,particles:[],lastPuff:0,from:new T.Vector3(...d.pos),dir:new T.Vector3(...d.dir).normalize(),speed:d.speed||65,at:performance.now()});
  }
  function frame(rows){if(!Array.isArray(rows))return;const t=performance.now();for(const row of rows){
   if(!Array.isArray(row)||row.length!==7)return;const [id,x,y,z,dx,dy,dz]=row,pos=[x/10,y/10,z/10],dir=[dx/100,dy/100,dz/100];if(!valid(pos)||!valid(dir))continue;
   if(!active.has(id))start({id,pos,dir});const m=active.get(id);if(!m)continue;m.from.fromArray(pos);m.dir.fromArray(dir).normalize();m.at=t;
  }}
  function lock(d){if(!d||d.kind!==mode)return;progress=d.progress||0;name=d.name||'';updated=performance.now();}
  function update(t,kind,dir,send){
   const dt=Math.min(.08,Math.max(0,(t-(update.last||t-16))/1000));update.last=t;
   for(const [id,m]of [...active]){
    if(t-m.at>2400){end(id);continue;}
    m.group.position.copy(m.from).addScaledVector(m.dir,Math.min(.16,(t-m.at)/1000)*m.speed);m.group.lookAt(at.copy(m.group.position).add(m.dir));
    for(const p of m.particles){p.age+=dt;p.y+=dt*(.10+p.seed*.12);p.x+=Math.sin(p.seed*19+p.age*2)*dt*.025;}
    m.particles=m.particles.filter(p=>p.age<2.8);
    if(t-m.lastPuff>32&&m.particles.length<24){m.lastPuff=t;m.particles.unshift({x:m.group.position.x-m.dir.x*.36,y:m.group.position.y-m.dir.y*.36,z:m.group.position.z-m.dir.z*.36,age:0,seed:Math.random()});}
    const position=m.smoke.geometry.attributes.position,age=m.smoke.geometry.attributes.aAge,seed=m.smoke.geometry.attributes.aSeed;
    m.particles.forEach((p,i)=>{position.setXYZ(i,p.x,p.y,p.z);age.setX(i,p.age);seed.setX(i,p.seed);});m.smoke.geometry.setDrawRange(0,m.particles.length);position.needsUpdate=age.needsUpdate=seed.needsUpdate=true;
   }
   if(mode!==kind){mode=kind;progress=0;name='';next=0;label.hidden=!mode;if(!mode)send({kind:null});}
   if(!mode)return;
   if(t>=next){next=t+150;send({kind:mode,dir});}
   if(t-updated>550){progress=0;name='';}
   const text=!name?'Ракеты · поиск цели':(progress>=1?'Цель захвачена':'Захват '+Math.round(progress*100)+'%')+' · '+name;
   if(label.textContent!==text)label.textContent=text;label.classList.toggle('ready',progress>=1);
  }
  function reset(){for(const id of [...active.keys()])end(id);mode=null;label.hidden=true;name='';progress=0;}
  function dispose(){reset();label.remove();for(const r of [hull,tail,metal,light,core,smokeMaterial])r.dispose();}
  return {start,end,frame,lock,update,reset,dispose,count:()=>active.size};
 }
 g.CS16MissileView={create};
})(window);
