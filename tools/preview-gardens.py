from pathlib import Path

root = Path(__file__).resolve().parent.parent
p = root / 'cs16-landscape.js'
source = p.read_text(encoding='utf-8')
start = source.index(' // Small garden borders')
end = source.index(' function create(', start)
replacement = r''' // Authored courtyard beds and ceramic-vase planting. Instances stay against solid
 // facade sections: no new obstacle, doorway, stair, or window collision is introduced.
 function gardens(T,scene,buildings){
  function builder(){
   const positions=[],normals=[],colors=[],indices=[],p=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3(),tint=new T.Color();
   function face(points,hex){
    // Leaf ends meet at a point. Skip collapsed fan triangles and choose a
    // non-degenerate normal: a zero normal otherwise poisons the HDR lighting.
    const origin=new T.Vector3(...points[0]),normal=new T.Vector3(),valid=[];
    for(let i=1;i<points.length-1;i++){
     const area=new T.Vector3(...points[i]).sub(origin).cross(new T.Vector3(...points[i+1]).sub(origin));
     if(area.lengthSq()<1e-18)continue;
     valid.push(i);if(normal.lengthSq()===0)normal.copy(area).normalize();
    }
    if(!valid.length)return;
    const base=positions.length/3;tint.set(hex);
    points.forEach(v=>{positions.push(...v);normals.push(normal.x,normal.y,normal.z);colors.push(tint.r,tint.g,tint.b)});
    for(const i of valid)indices.push(base,base+i,base+i+1);
   }
   function append(geometry,matrix,hex){
    const base=positions.length/3,a=geometry.attributes.position,b=geometry.attributes.normal;tint.set(hex);nm.getNormalMatrix(matrix);
    for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(matrix);n.fromBufferAttribute(b,i).applyNormalMatrix(nm);positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);colors.push(tint.r,tint.g,tint.b)}
    if(geometry.index)for(const i of geometry.index.array)indices.push(base+i);else for(let i=0;i<a.count;i++)indices.push(base+i);
   }
   function leaf(x,y,z,angle,length,width,lift,hex){
    const dx=Math.cos(angle),dz=Math.sin(angle),rows=[];
    for(let k=0;k<=5;k++){
     const q=k/5,w=Math.sin(q*Math.PI)*width,curl=Math.sin(q*Math.PI)*length*.19;
     rows.push([-1,0,1].map(side=>[x+dx*q*length-dz*side*w,y+q*lift+curl-(side?Math.sin(q*Math.PI)*width*.27:0),z+dz*q*length+dx*side*w]));
    }
    for(let k=0;k<5;k++)for(let side=0;side<2;side++)face([rows[k][side],rows[k+1][side],rows[k+1][side+1],rows[k][side+1]],hex);
   }
   function blossom(x,y,z,r,hex){
    const petals=6;
    for(let k=0;k<petals;k++){
     const a=k*Math.PI*2/petals,dx=Math.cos(a),dz=Math.sin(a),side=.48*r;
     face([[x,y,z],[x+dx*r*.55-dz*side,y+r*.12,z+dz*r*.55+dx*side],
      [x+dx*r,y+r*.30,z+dz*r],[x+dx*r*.55+dz*side,y+r*.12,z+dz*r*.55-dx*side]],hex);
    }
    const disk=[];for(let k=0;k<8;k++)disk.push([x+Math.cos(-k*Math.PI/4)*r*.23,y+r*.10,z+Math.sin(-k*Math.PI/4)*r*.23]);face(disk,'#f1cc78');
   }
   function finish(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();return g;}
   return {face,append,leaf,blossom,finish};
  }
  const dummy=new T.Object3D(),stone=new T.SphereGeometry(1,10,5),bed=builder();
  // Slightly varied rounded limestone edging rather than a flat rectangular decal.
  for(let i=0;i<22;i++){
   const a=i*Math.PI*2/22,x=Math.cos(a)*1.08,z=Math.sin(a)*.29;
   dummy.position.set(x,.095,z);dummy.rotation.set(noise(i,13)*.2,a,noise(i,71)*.15);
   dummy.scale.set(.20+noise(i,19)*.025,.105+noise(i,23)*.018,.135);dummy.updateMatrix();
   bed.append(stone,dummy.matrix,['#c3b89a','#cec2a6','#b9ae91','#d1c7b0'][i%4]);
  }
  const soil=[];for(let i=0;i<28;i++){const a=-i*Math.PI*2/28;soil.push([Math.cos(a)*1.07,.075,Math.sin(a)*.27]);}bed.face(soil,'#6a6250');
  // Sage and lavender rosettes: folded broad leaves, small clustered flowers,
  // and varied heights provide readable volume without alpha-card overdraw.
  for(let i=0;i<15;i++){
   const x=-.87+(i%5)*.435+(noise(i,52)-.5)*.09,z=(Math.floor(i/5)-1)*.16;
   const h=.29+noise(i,9)*.26,a=i*2.399,lavender=i%3===0;
   bed.face([[x-.007,.08,z],[x+.007,.08,z],[x+.018,h+.11,z],[x+.004,h+.11,z]],'#61774e');
   for(let k=0;k<5;k++)bed.leaf(x,.105+k*.032,z,a+k*2.399,.20+noise(i,k)*.12,.04+noise(k,i)*.015,.045+noise(k,i+3)*.11,
    ['#557746','#73975a','#8ea76a','#698e56','#91ad72'][(i+k)%5]);
   if(lavender){
    for(let j=0;j<5;j++)for(let k=0;k<3;k++){
     const aa=k*Math.PI*2/3+j*.7;bed.blossom(x+Math.cos(aa)*.025,h-.06+j*.045,z+Math.sin(aa)*.025,.035-j*.002,['#ac9abe','#c5b2d4','#9b8fb6'][j%3]);
    }
   }else bed.blossom(x,h+.09,z,.085+noise(i,61)*.035,i%2?'#e6c5a4':'#e2c5d0');
  }
  // Tiny foundation gravel connects the raised beds to the paving, not the path.
  for(let i=0;i<12;i++){
   const a=i*2.399;dummy.position.set(Math.cos(a)*(1.13+noise(i,3)*.08),.028,Math.sin(a)*(.32+noise(i,9)*.09));
   dummy.scale.set(.035+noise(i,10)*.025,.025,.03+noise(i,11)*.02);dummy.rotation.y=a;dummy.updateMatrix();bed.append(stone,dummy.matrix,'#bcb399');
  }
  const pot=builder();
  for(let i=0;i<15;i++){
   const a=i*2.399,r=Math.sqrt(noise(i,27))*.19,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.09+noise(i,83)*.30;
   pot.face([[x-.007,0,z],[x+.007,0,z],[x+.012,h+.10,z],[x,h+.10,z]],'#647e4c');
   for(let k=0;k<5;k++)pot.leaf(x,k*.035,z,a+k*2.399,.18+noise(k,i)*.16,.045+noise(i,k)*.03,.05+noise(i,k+8)*.15,
     ['#4c7443','#7d9d62','#6a8d54','#90aa70'][(i+k)%4]);
   if(i%2===0)pot.blossom(x,h+.11,z,.095,['#d8b1c5','#e6c2cd','#d0b9da'][i%3]);
  }
  stone.dispose();
  const material=new T.MeshStandardMaterial({name:'Courtyard sculpted planting',vertexColors:true,side:T.DoubleSide,roughness:.87,metalness:0,envMapIntensity:.35,dithering:true});
  const bedGeo=bed.finish(),potGeo=pot.finish();
  const beds=new T.InstancedMesh(bedGeo,material,18),pots=new T.InstancedMesh(potGeo,material,16);
  beds.name='Sculpted limestone herb borders';pots.name='Full ceramic-vase planting';
  for(const mesh of [beds,pots]){mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);}
  const patches=[],vases=[];
  for(const b of buildings){
   for(const [x,z,angle]of [[2.55,-.43,0],[8.65,-.43,0],[-.37,5.7,Math.PI/2],[12.37,5.7,Math.PI/2],[2.45,12.37,0],[9.5,12.37,0]])patches.push({x:b.x+x,z:b.z+z,angle});
   for(const x of [.85,10.8])vases.push({x:b.x+x,z:b.z-.6,angle:b.id*2.399});
  }
  let tick=-Infinity,viewX=Infinity,viewZ=Infinity,lastQuality='';
  function place(mesh,items,range,limit,y){
   const near=[];for(const p of items){const d=(p.x-viewX)**2+(p.z-viewZ)**2;if(d<range*range)near.push({p,d});}
   near.sort((a,b)=>a.d-b.d);mesh.count=Math.min(limit,near.length);
   for(let i=0;i<mesh.count;i++){const p=near[i].p;dummy.position.set(p.x,y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
   mesh.instanceMatrix.needsUpdate=true;
  }
  return{update(camera,time,quality){
   if(time-tick<350)return;tick=time;if(quality===lastQuality&&Math.hypot(camera.position.x-viewX,camera.position.z-viewZ)<1)return;
   viewX=camera.position.x;viewZ=camera.position.z;lastQuality=quality;
   const low=quality==='low',high=quality==='high';
   beds.castShadow=pots.castShadow=!low;
   place(beds,patches,low?23:high?56:42,low?6:high?18:12,.012);
   place(pots,vases,low?26:high?60:44,low?6:high?16:10,.68);
  },dispose(){for(const mesh of [beds,pots]){mesh.removeFromParent();mesh.dispose();}bedGeo.dispose();potGeo.dispose();material.dispose();}};
 }
'''
p.write_text(source[:start] + replacement + source[end:], encoding='utf-8')
print('Replaced courtyard planting with sculpted instanced beds and vase plants')
