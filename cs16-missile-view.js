(function(g){
 function create(T,scene,hud){
   const active=new Map(),label=document.createElement('div');label.className='cs16-seeker';label.hidden=true;hud.append(label);
   const hull=new T.ConeGeometry(.09,.42,8).rotateX(Math.PI/2),tail=new T.ConeGeometry(.065,.72,6).rotateX(-Math.PI/2);
   const metal=new T.MeshStandardMaterial({color:0x75796a,metalness:.55,roughness:.4});
   const light=new T.MeshBasicMaterial({color:0xffac50,toneMapped:false});
   let mode=null,next=0,progress=0,name='',updated=0;const at=new T.Vector3();
   function end(id){const m=active.get(id);if(m)m.group.removeFromParent();active.delete(id);}
   function start(d){
     if(active.has(d.id))end(d.id);if(active.size>=64)return;
     const group=new T.Group(),flame=new T.Mesh(tail,light);flame.position.z=-.46;group.add(new T.Mesh(hull,metal),flame);scene.add(group);group.position.fromArray(d.pos);
     active.set(d.id,{group,from:new T.Vector3(...d.pos),dir:new T.Vector3(...d.dir),speed:d.speed||65,at:performance.now()});
   }
   function frame(rows){const t=performance.now();for(const [id,x,y,z,dx,dy,dz] of rows){
     const pos=[x/10,y/10,z/10],dir=[dx/100,dy/100,dz/100];if(!active.has(id))start({id,pos,dir});const m=active.get(id);if(!m)continue;
     m.from.fromArray(pos);m.dir.fromArray(dir).normalize();m.at=t;
   }}
   function lock(d){if(d.kind!==mode)return;progress=d.progress||0;name=d.name||'';updated=performance.now();}
   function update(t,kind,dir,send){
     for(const [id,m]of active){if(t-m.at>2400){end(id);continue;}
       m.group.position.copy(m.from).addScaledVector(m.dir,Math.min(.16,(t-m.at)/1000)*m.speed);m.group.lookAt(at.copy(m.group.position).add(m.dir));
     }
     if(mode!==kind){mode=kind;progress=0;name='';next=0;label.hidden=!mode;if(!mode)send({kind:null});}
     if(!mode)return;
     if(t>=next){next=t+150;send({kind:mode,dir});}
     if(t-updated>550){progress=0;name='';}
     const text=!name?'Ракеты · поиск цели':(progress>=1?'Цель захвачена':'Захват '+Math.round(progress*100)+'%')+' · '+name;
     if(label.textContent!==text)label.textContent=text;label.classList.toggle('ready',progress>=1);
   }
   function reset(){for(const id of active.keys())end(id);mode=null;label.hidden=true;name='';progress=0;}
   function dispose(){reset();label.remove();for(const r of [hull,tail,metal,light])r.dispose();}
   return {start,end,frame,lock,update,reset,dispose};
 }
 g.CS16MissileView={create};
})(window);
