const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),server=path.resolve(root,'../support-hub-server'),T=require('../cs16-tactical-map'),B=require('../cs16-buildings'),E=require('../cs16-environment');
const parse=(file,name)=>vm.runInNewContext('('+fs.readFileSync(file,'utf8').match(new RegExp('const '+name+' = (\\{[\\s\\S]*?\\n *\\});'))[1]+')');
const maps=parse(path.join(root,'cs16.js'),'MAP_ROWS'),remote=parse(path.join(server,'server.js'),'CS16_MAP_ROWS');
const codes={'#':1,'.':0,D:2,C:3,4:4,5:5,6:6,7:7,V:8,B:9,S:10,T:11},reports=[];
for(const map of ['dust2','inferno']){
 assert.deepEqual(Array.from(maps[map]),T.generate(map));assert.deepEqual(Array.from(remote[map]),T.generate(map));
 const grid=maps[map].map(r=>Array.from(r,c=>codes[c])),data=B.layout(grid,map),def=T.definition(map),index=(x,z)=>z*126+x;
 const walk=(x,z)=>[0,4,5,6,7].includes(grid[z]?.[x])&&!B.contains(grid,map,x*4+2,z*4+2,0);
 const bfs=(start)=>{const q=[start],d=new Map([[index(...start),0]]);for(let i=0;i<q.length;i++){const[x,z]=q[i];for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=index(nx,nz);if(walk(nx,nz)&&!d.has(k)){d.set(k,d.get(index(x,z))+1);q.push([nx,nz]);}}}return d;};
 assert.equal(data.buildings.length,6);assert.equal(data.environment.doors.length,6);assert.deepEqual(Object.keys(def.sites),['A','B']);
 const routes={};for(const team of ['t','ct'])for(let i=0;i<5;i++){
  const pos=T.spawn(map,team,i),start=[Math.floor(pos[0]/4),Math.floor(pos[2]/4)];assert(walk(...start),'spawn clear');const dist=bfs(start);
  for(const[id,s]of Object.entries(def.sites)){const x=Math.floor((s.x1+s.x2)/2),z=Math.floor((s.y1+s.y2)/2);assert(dist.has(index(x,z)),team+' reaches '+id);routes[team+id]=dist.get(index(x,z))*4;assert.equal(T.siteAt(map,[x*4+2,0,z*4+2]),id);}
 }
 assert.equal(T.siteAt(map,T.spawn(map,'t')),null);assert.equal(T.siteAt(map,[310,8,204]),null);
 for(const house of data.buildings){
  const {x,z}=house;
  // Room, second floor, open rear roof terrace and stairs are real collision surfaces.
  for(const [dx,dz,y]of [[4,6,.02],[4,6,3.6],[4,9,7.2]])assert(Math.abs(B.vertical(grid,map,x+dx,z+dz,y).floor-y)<.03);
  for(let n=0;n<20;n++){const xx=x+9.7,zz=z+.75+n*.5,y=(n+1)*.18;assert(Math.abs(B.vertical(grid,map,xx,zz,y).floor-y)<.03,'first stair '+n);}
  const door=data.environment.doors.find(d=>d.building===house.id);const origin=[door.x,1.3,door.z-1],dir=[0,0,1];
  const open=B.ray(grid,map,origin,dir,2);assert(open===null,'open doorway clear');door.open=false;data.environment.revision++;assert(B.ray(grid,map,origin,dir,2)!==null,'closed door blocks');door.open=true;data.environment.revision++;
  assert(B.ray(grid,map,[x+4.5,12,z+2],[0,-1,0],5)!==null,'curved roof stops shots');
 }
 const full=bfs([62,43]);for(const [x,z]of [[49,66],[58,66],[66,64],[76,64]])assert(full.has(index(x,z)),'tunnel connected '+x+','+z);
 reports.push({map,sites:2,houses:data.buildings.length,doors:data.environment.doors.length,reachableCells:full.size,routeMetres:routes});
}
for(const f of ['cs16-tactical-map.js','cs16-buildings.js','cs16-terrain.js','cs16-props.js'])assert(fs.readFileSync(path.join(root,f)).equals(fs.readFileSync(path.join(server,f))),f+' client/server drift');
fs.writeFileSync(path.join(root,'graphics-qa/tactical-layout-checks.json'),JSON.stringify(reports,null,2));console.log('TACTICAL_MAP_PASS',JSON.stringify(reports));
