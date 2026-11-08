/* Confirmed hits only. Three fixed instance buffers; no per-hit GPU resources. */
(function(g){
  'use strict';
  const styles=Object.freeze({body:{color:0xffedc3,label:'ПОПАДАНИЕ'},armor:{color:0x83dfff,label:'БРОНЯ'},head:{color:0xffca70,label:'В ГОЛОВУ'},kill:{color:0xff927e,label:'ЦЕЛЬ УСТРАНЕНА'}});
  let nextShotId=1;
  function create({T,scene,hud,camera,getQuality=()=> 'balanced',clock=()=>performance.now(),isVisible=()=>true}){
    const root=new T.Group();root.name='Confirmed target impacts';scene.add(root);
    const capacity=12,slots=Array.from({length:capacity},()=>({born:-Infinity,pos:new T.Vector3(),kind:'body',scale:1}));
    const pending=Array.from({length:32},()=>({born:-Infinity,target:'',weapon:'',point:new T.Vector3(),anchor:new T.Vector3()}));
    let cursor=0,pendingCursor=0,disposed=false,hudBorn=-Infinity,lastTarget='',total=0,lastKind='body',active=0;
    const dummy=new T.Object3D(),color=new T.Color(),direction=new T.Vector3(),point=new T.Vector3();
    function shape(points){
      const vertices=[];
      for(let j=0;j<points.length;j++)vertices.push(0,0,0,...points[j],0,...points[(j+1)%points.length],0);
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return geo;
    }
    const star=shape(Array.from({length:8},(_,j)=>{const a=j*Math.PI/4,r=j%2?.17:1;return [Math.cos(a)*r,Math.sin(a)*r];}));
    const diamond=shape([[0,1],[.24,0],[0,-1],[-.24,0]]);
    function pool(name,geometry,max){
      const material=new T.MeshBasicMaterial({transparent:true,opacity:.9,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide,forceSinglePass:true});
      const mesh=new T.InstancedMesh(geometry,material,max);mesh.name=name;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      // Allocate instance colours before the loading-screen shader warm-up.
      for(let i=0;i<max;i++)mesh.setColorAt(i,color.setHex(0xffffff));
      mesh.instanceColor.setUsage(T.DynamicDrawUsage);root.add(mesh);return mesh;
    }
    const flashes=pool('Painted contact flashes',star,capacity),rings=pool('Armor and precision ripples',new T.RingGeometry(.77,1,24),capacity),sparks=pool('Contact brush strokes',diamond,capacity*6);
    const meshes=[flashes,rings,sparks];
    let marker=null,value=null,label=null;
    if(hud){
      marker=document.createElement('div');marker.className='cs16-hit-feedback';marker.hidden=true;marker.setAttribute('aria-hidden','true');
      const cross=document.createElement('div');cross.className='cs16-hit-cross';
      for(let i=0;i<4;i++){const ray=document.createElement('i');ray.style.setProperty('--angle',(45+i*90)+'deg');cross.append(ray);}
      const badge=document.createElement('div');badge.className='cs16-hit-badge';
      value=document.createElement('strong');label=document.createElement('small');badge.append(value,label);marker.append(cross,badge);hud.append(marker);
    }
    function remember(target,weapon,point,anchor){
      if(disposed||!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)||!anchor||![anchor.x,anchor.y,anchor.z].every(Number.isFinite))return false;
      const shot=pending[pendingCursor++%pending.length];shot.id=nextShotId++;if(nextShotId>2147483647)nextShotId=1;
      shot.born=clock();shot.target=target;shot.weapon=weapon;shot.point.fromArray(point);shot.anchor.set(anchor.x,anchor.y,anchor.z);return shot.id;
    }
    function confirm(event,target,own=false){
      if(disposed||!event||!Number.isFinite(event.dmg)||event.dmg<=0)return false;
      const now=clock(),kind=event.hp<=0?'kill':event.head?'head':event.armorDamage>0?'armor':'body';
      if(own){
        total=lastTarget===event.target&&now-hudBorn<280?Math.min(9999,total+event.dmg):event.dmg;
        lastTarget=event.target;hudBorn=now;lastKind=kind;
        if(marker){marker.hidden=false;marker.dataset.kind=kind;marker.style.setProperty('--hit-color','#'+styles[kind].color.toString(16));
          value.textContent='−'+Math.round(total);label.textContent=kind==='kill'&&event.head?'УСТРАНЕНИЕ · В ГОЛОВУ':kind==='armor'&&event.armorBreak?'БРОНЯ РАЗБИТА':styles[kind].label;}
      }
      if(!target||![target.x,target.y,target.z].every(Number.isFinite))return true;
      const slot=slots[cursor% (getQuality()==='low'?6:capacity)],scale=target.crouched?.72:1;
      point.set(target.x,target.y+(event.head?1.72:event.zone==='leg'?.55:1.15)*scale,target.z);
      let remembered=null;
      if(own)for(const shot of pending){
        if(now-shot.born>1200||shot.born>now||shot.target!==event.target||event.weapon&&event.weapon!==shot.weapon)continue;
        if(Number.isSafeInteger(event.hitId)&&shot.id!==event.hitId)continue;
        if(!remembered||shot.born<remembered.born)remembered=shot;
      }
      if(remembered){point.copy(remembered.point).sub(remembered.anchor).add(direction.set(target.x,target.y,target.z));remembered.born=-Infinity;}
      else {direction.copy(camera.position).sub(point).normalize();point.addScaledVector(direction,event.head?.21:.35);}
      // Keep confirmed personal damage, but skip distant/off-screen world sparks
      // before the more expensive wall/smoke query. Camera matrices are updated by
      // the normal render loop; no additional camera update is needed per hit.
      const range=getQuality()==='low'?60:110;
      if(point.distanceToSquared(camera.position)>range*range)return true;
      direction.copy(point).project(camera);
      if(direction.z<-1||direction.z>1||Math.abs(direction.x)>1.15||Math.abs(direction.y)>1.15)return true;
      if(!isVisible(point))return true;
      direction.copy(camera.position).sub(point).normalize();point.addScaledVector(direction,.045);slot.pos.copy(point);
      slot.scale=.18+Math.min(.14,camera.position.distanceTo(slot.pos)*.004);slot.kind=kind;slot.born=now;cursor++;
      return true;
    }
    function put(mesh,index,pos,size,stretch,rotation,tint,fade){
      dummy.position.copy(pos);dummy.quaternion.copy(camera.quaternion);dummy.rotateZ(rotation);dummy.scale.set(size,size*stretch,1);dummy.updateMatrix();
      mesh.setMatrixAt(index,dummy.matrix);mesh.setColorAt(index,color.setHex(tint).multiplyScalar(fade));
    }
    function update(){
      if(disposed)return;
      const now=clock(),low=getQuality()==='low',limit=low?6:capacity;let nf=0,nr=0,ns=0;
      for(let i=0;i<slots.length;i++){
        const slot=slots[i],age=(now-slot.born)/1000,life=slot.kind==='kill'?.42:.30;
        if(i>=limit){slot.born=-Infinity;continue;}
        if(age<0||age>=life)continue;
        const t=age/life,fade=(1-t)*(1-t),tint=styles[slot.kind].color,size=slot.scale*(.65+Math.sin(t*Math.PI)*.6);
        put(flashes,nf++,slot.pos,size,1,Math.PI/4+i*.7,tint,fade);
        if(slot.kind!=='body')put(rings,nr++,slot.pos,slot.scale*(.5+t*1.65),1,0,tint,fade*.65);
        const rays=low?3:6;
        for(let j=0;j<rays;j++){
          const angle=j*Math.PI*2/rays+i*.73,reach=slot.scale*(.5+t*2.2);
          direction.set(Math.cos(angle)*reach,Math.sin(angle)*reach,0).applyQuaternion(camera.quaternion).add(slot.pos);
          put(sparks,ns++,direction,size*.085,3.8,angle-Math.PI/2,tint,fade);
        }
      }
      active=nf;
      [nf,nr,ns].forEach((count,i)=>{const mesh=meshes[i];mesh.count=count;mesh.visible=count>0;if(count){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}});
      if(marker&&!marker.hidden){
        const t=(now-hudBorn)/(lastKind==='kill'?700:460);
        if(t>=1)marker.hidden=true;
        else {marker.style.opacity=String(Math.min(1,(1-t)*3));marker.style.setProperty('--hit-scale',String(1+Math.max(0,1-t*5)*.25));}
      }
    }
    function clear(){for(const slot of slots)slot.born=-Infinity;for(const shot of pending)shot.born=-Infinity;active=0;hudBorn=-Infinity;lastTarget='';total=0;
      for(const mesh of meshes){mesh.count=0;mesh.visible=false;}if(marker)marker.hidden=true;}
    async function warm(renderer){
      if(disposed)return;
      try {for(const mesh of meshes){mesh.count=1;mesh.visible=true;}
        if(renderer.compileAsync)await renderer.compileAsync(scene,camera);else renderer.compile(scene,camera);
      } finally {clear();}
    }
    function dispose(){if(disposed)return;clear();disposed=true;root.removeFromParent();marker?.remove();for(const mesh of meshes){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}}
    return {remember,confirm,update,clear,dispose,warm,metrics:()=>({capacity,active,pending:pending.filter(s=>clock()-s.born<=1200).length,counts:meshes.map(m=>m.count),kind:lastKind,total,markerVisible:!!marker&&!marker.hidden})};
  }
  g.CS16HitFeedback={create,styles};
})(typeof window!=='undefined'?window:globalThis);
