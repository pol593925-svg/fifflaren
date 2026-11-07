/* Original facade and garden ornament. Baked into shared material meshes by world.js. */
window.AnimeCourtyardDetails=function(T,{add,slab,tube,planter,tree,foliage,portal,m,random,collision}){
 const basePaint=(name,color)=>new T.MeshToonMaterial({name,color,gradientMap:m.wall.gradientMap,side:T.DoubleSide});
 const petal=basePaint('Rose petals','#f78bb4'),petalCenter=basePaint('Flower hearts','#ffdc91'),lime=basePaint('Warm leaf tips','#b7d179');
 const gold=basePaint('Moulded copper','#d59a55'),pink=basePaint('Rose linen canopy','#dc8990'),white=basePaint('Porcelain accents','#ffedce');
 const patch=[basePaint('Plaster pale','#f7ddbe'),basePaint('Plaster rose','#e5c3aa'),basePaint('Plaster stone','#d0bfa1')];
 function polygon(points,mat,x,y,z,ry=0){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ShapeGeometry(s);add(g,mat,x,y,z,0,ry)}
 function floral(x,y,z,scale=1,ry=0){const g=new T.CircleGeometry(.075*scale,7);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(g,petal,x+Math.cos(a)*.105*scale,y+Math.sin(a)*.105*scale,z,0,ry)}add(new T.SphereGeometry(.033*scale,8,6),petalCenter,x,y,z+.025)}
 // Broad brush marks on the plaster, not photographic noise or a flat screenshot.
 for(let i=0;i<165;i++){const a=random()*Math.PI*2,y=.25+random()*7.1,x=7+Math.sin(a)*3.363,z=-12+Math.cos(a)*3.363;if(Math.cos(a)>.78&&Math.abs(x-7)<1.4)continue;const w=.10+random()*.32,h=.08+random()*.24;polygon([[-w,0],[-w*.7,h],[w*.6,h*.78],[w,h*.15],[w*.3,-h*.13]],patch[i%3],x,y,z,a)}
 // Dressed entrance stones, cut voussoirs and framed windows.
 for(const level of [0,3.6]){
  for(let i=0;i<13;i++){const angle=Math.PI*i/12,x=7+Math.cos(angle)*1.35,y=level+2+Math.sin(angle)*1.35;slab(x,y,-8.37,.35,.31,.13,i%3?m.trim:white,0,.035)}
  for(const x of [5.65,8.35])for(let j=0;j<5;j++)slab(x,.20+j*.38+level,-8.37,.38,.34,.14,j%2?m.stone:m.trim,0,.025);
 }
 // Roof skirts, exposed wooden eaves and beams remove the floating roof appearance.
 add(new T.CylinderGeometry(3.38,3.38,.17,64,1,true),m.wood,7,7.72,-12);
 for(let i=0;i<32;i++){const a=i*Math.PI/16,x=7+Math.sin(a)*3.57,z=-12+Math.cos(a)*3.57;slab(x,7.52,z,.16,.34,.75,m.wood,a,.025)}
 for(const y of [7.63,7.91])add(new T.TorusGeometry(3.95,.065,6,80),gold,7,y,-12,Math.PI/2);
 for(const x of [-9.5,-8.4,-7.3,-6.2,-5.1])slab(x,6.02,-5.61,.15,.30,.6,m.wood,0,.025);
 // The pavilion has shingled curved roof bands and copper ribs.
 for(let k=0;k<9;k++){const th=.15+k*.15,pts=[];for(let j=0;j<=48;j++){const a=j*Math.PI*2/48;pts.push([-7.2+Math.sin(a)*4.18*Math.sin(th),6.15+2.02*Math.cos(th),-10.2+Math.cos(a)*5.38*Math.sin(th)])}tube(pts,.035,k%2?m.roofLight:m.roof,5)}
 for(const x of [-8.6,-6.0]){slab(x,4.28,-5.53,1.7,.16,.42,m.trim);slab(x,4.09,-5.44,1.5,.30,.35,m.wood);foliage(x,4.45,-5.38,.48,m.leaf,65);for(let i=0;i<8;i++)floral(x+(random()-.5)*1.1,4.48+random()*.15,-5.22,.68)}
 // Recessed panel doors and decorative fanlights, well inside the playable arcade.
 for(const x of [-9.55,-4.85]){slab(x,1.18,-14.37,1.05,2.25,.16,m.teal,0,.035);for(const yy of [.55,1.4])slab(x,yy,-14.25,.78,.57,.035,m.roofLight,0,.02);add(new T.SphereGeometry(.05,10,8),gold,x+.32,1.18,-14.18)}
 // Hanging sign with original stylised laurel, also repeated on banners and pottery.
 function emblem(x,y,z,s=1){tube([[x-.16*s,y-.40*s,z],[x,y-.10*s,z],[x+.15*s,y+.43*s,z]],.018*s,white,7);for(let i=0;i<5;i++){const yy=y-.30*s+i*.14*s;for(const d of [-1,1])polygon([[0,0],[d*.19*s,.07*s],[d*.23*s,.20*s],[d*.05*s,.16*s]],white,x+(yy-y)*.3,yy,z)}}
 emblem(5.25,5.6,-8.76,.8);
 for(const [x,z]of [[-3.5,-4],[3.6,1],[-4,-21]])emblem(x,.38,z+.43,.22);
 const awning=new T.PlaneGeometry(3.4,2.15,18,12),pos=awning.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setXYZ(i,x,-.25*(1-y*y)+Math.sin(x*5)*.04,y)}awning.computeVertexNormals();add(awning,pink,-7.2,2.84,-4.38);
 for(let j=0;j<9;j++)add(new T.SphereGeometry(.18,12,8).scale(1,.5,.15),pink,-8.65+j*.36,2.74,-3.31);
 // Produce stall, fruit, timber crates and tapering barrels.
 slab(-7.1,.85,-4.2,2.7,.18,.9,m.wood);for(const x of [-8.3,-5.9])for(const z of [-4.55,-3.85])slab(x,.4,z,.12,.8,.12,m.wood);
 const fruit=[basePaint('Peaches','#ecac68'),basePaint('Green pears','#aec46d'),basePaint('Plums','#9174b1')];for(let k=0;k<30;k++){const x=-8.2+(k%10)*.23,z=-4.45+Math.floor(k/10)*.20;add(new T.SphereGeometry(.12,10,8),fruit[k%3],x,1.06+random()*.06,z)}
 for(const[x,z]of [[-9.5,-3.2],[-9.4,-2.4]]){const pts=[[.33,0],[.40,.12],[.46,.55],[.42,.92],[.34,1.02]].map(v=>new T.Vector2(...v));add(new T.LatheGeometry(pts,22),m.wood,x,0,z);for(const y of [.15,.82])add(new T.TorusGeometry(.42,.03,6,24),m.dark,x,y,z,Math.PI/2);add(new T.CircleGeometry(.35,22).rotateX(-Math.PI/2),m.wood,x,1.02,z)}
 // Lantern cages with warm glass, without extra dynamic lights.
 const lamp=basePaint('Amber lantern glass','#ffe9a1');lamp.emissive.set('#ae6a18');lamp.emissiveIntensity=.4;
 for(const [x,y,z]of [[-9.65,3.3,-5.20],[8.8,2.4,-8.5],[5,5.8,-8.6],[-2.9,3.6,-22]]){tube([[x,y+.4,z-.2],[x,y+.65,z],[x,y+.35,z+.2]],.035,m.dark);add(new T.CylinderGeometry(.14,.10,.35,6),lamp,x,y,z+.2);add(new T.ConeGeometry(.23,.17,6),m.dark,x,y+.27,z+.2);for(let j=0;j<6;j++){const a=j*Math.PI/3;tube([[x+Math.sin(a)*.14,y-.17,z+.2+Math.cos(a)*.14],[x+Math.sin(a)*.14,y+.18,z+.2+Math.cos(a)*.14]],.012,m.dark)} }
 // Flowers spilling over the rail and climbing across the entrance.
 for(let i=0;i<35;i++){const a=-1.05+i*.06,x=7+Math.sin(a)*4.06,z=-12+Math.cos(a)*4.06;foliage(x,3.84,z,.25,m.leaf,14);floral(x,4.05+Math.sin(i*.8)*.12,z+.15,.72,a)}
 for(let i=0;i<24;i++){const x=-9.95+i*.18,y=3.75+Math.sin(i*.17)*.60;floral(x,y,-5.38,.65+random()*.4);if(i%3===0)foliage(x,y,-5.45,.35,lime,20)}
 // Close leafy canopy gives foreground depth like the agreed illustration.
 tree(-4.8,5.3,1.3);
 for(let i=0;i<55;i++){const x=(random()-.5)*18,z=-random()*24;if(Math.abs(x)<2.5&&z>-7)continue;add(new T.CircleGeometry(.05+random()*.04,5),petal,x,.006,z,-Math.PI/2,0,random()*6.28)}
 // Distant architecture and arched aqueduct on the horizon. Low polygon and no colliders.
 for(let i=0;i<7;i++){const x=-35+i*11,z=-72-random()*12,h=4+random()*9;slab(x,h/2+3,z,3.2,h,3.4,m.wall,0,.2);add(new T.ConeGeometry(2.9,3.2,16),m.roof,x,h+4.5,z);add(new T.CylinderGeometry(.7,1,5,16),m.wall,x+1,h+5,z);add(new T.ConeGeometry(1.25,2,16),gold,x+1,h+8.4,z)}
 for(let i=0;i<9;i++){const x=-34+i*6;slab(x,3.3,-61,1.0,8,1.5,m.trim);tube([[x,5,-61],[x+1.4,7,-61],[x+3,7.3,-61],[x+4.6,7,-61],[x+6,5,-61]],.42,m.trim,8)}
 for(let i=0;i<10;i++){const x=(random()-.5)*100,z=-67-random()*45;add(new T.ConeGeometry(1.1,7,10),m.leaf,x,6,z);add(new T.CylinderGeometry(.18,.25,4,8),m.wood,x,1,z)}
 // Foreground garden wall, open central walkway and an olive branch overhead.
 for(const side of [-1,1])for(let i=0;i<8;i++){const z=6-i*.95,x=side*(11+Math.sin(i*.3)*.5);slab(x,.46,z,1,.88,1,m.trim,0,.09);slab(x,.92,z,1.15,.16,1.08,m.stone,0,.05);foliage(x,1.08,z,.35,m.leaf,24)}
 tube([[-11,0,2],[-10,1.8,1.5],[-8,3.9,0],[-5.8,5.0,-2.2],[-2.2,5.5,-5]],.21,m.wood,12);
 collision(new T.CylinderGeometry(.30,.36,3.4,9),-10.7,1.7,1.7);
 for(let i=0;i<11;i++){const t=i/10,x=-5.8+t*4.0,y=5.0+t*.7,z=-1.9-t*3.1;foliage(x,y,z,.8,m.leaf,90);foliage(x,y+.20,z,.65,lime,35)}
 const table=new T.BoxGeometry(2.7,.22,.9);collision(table.clone(),-7.1,.85,-4.2);collision(table,-7.1,.85,-4.2,0,true);
 for(const[x,z]of [[-9.5,-3.2],[-9.4,-2.4]]){const b=new T.CylinderGeometry(.40,.40,1.02,10);collision(b.clone(),x,.51,z);collision(b,x,.51,z,0,true)}
};
