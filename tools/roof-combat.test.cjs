const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const B=require('../cs16-buildings'),Terrain=require('../cs16-terrain'),Tactical=require('../cs16-tactical-map');
const Hit=require('../../support-hub-server/cs16-hit-validation');
const codes={'#':1,'.':0,D:2,C:3,4:4,5:5,6:6,7:7,V:8,B:9,S:10,T:11};
const source=fs.readFileSync(require.resolve('../cs16.js'),'utf8');
function fixture(map){const grid=Tactical.generate(map).map(r=>Array.from(r,c=>codes[c]));const ctx={CS16Buildings:B,CS16Terrain:Terrain,CS16Front:require('../cs16-front'),grid,curMap:map,cellAt:(x,z)=>grid[Math.floor(z/4)]?.[Math.floor(x/4)]??1};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function rayWall('),source.indexOf('  function losClear(')),ctx);return{grid,ctx};}
for(const map of ['dust2','inferno']){
 test(map+': real client rays cross above tunnel roofs; slabs and curved roofs still stop bullets',()=>{
  const {grid,ctx}=fixture(map);
  assert.equal(ctx.rayWall(194,9,268,1,0,0,44),null,'invisible wall above underground flank');
  assert.equal(ctx.rayWall(210,-2,268,1,0,0,10),null,'tunnel interior remains open');
  const ceiling=ctx.rayWall(214,-2,268,0,1,0,5);assert(Math.abs(ceiling.t-.7)<1e-6,'origin-cell ceiling');
  const floor=ctx.rayWall(214,9,268,0,-1,0,12);assert(Math.abs(floor.t-9)<1e-6,'roof blocks downward shot');
  const b=B.layout(grid,map).buildings[0],roof=ctx.rayWall(b.x+4.5,12,b.z+2,0,-1,0,12);
  assert(roof.t>2.3&&roof.t<2.5,'curved house roof remains solid');
 });
 test(map+': visible rooftop head is not rejected because the lower torso is behind cover',()=>{
  const {grid}=fixture(map),b=B.layout(grid,map).buildings[0];let example;
  for(const u of [1,2,4.5,7,8.2,10.7])for(const z of [2,6,9,10.8])for(const dx of [-8,5,18])for(const dz of [-12,24]){
   const y=z<5.25&&u<8.85?B.roofHeight(u)+.06:7.2;
   const attacker={lx:b.x+dx,ly:0,lz:b.z+dz},target={lx:b.x+u,ly:y,lz:b.z+z};
   const head=Hit.segment(attacker,target,{head:true}),body=Hit.segment(attacker,target,{zone:'body'});
   const blocked=s=>B.ray(grid,map,s.origin,s.dir,s.limit)!==null||!!B.gridHit(grid,s.origin,s.dir,s.limit);
   if(!blocked(head)&&blocked(body)){example={attacker,target,head};break;}
  }
  assert(example,'need real visible-head/covered-torso fixture');
  const {head,attacker,target}=example,shot={origin:head.origin,point:head.point,dist:Math.hypot(...head.point.map((v,i)=>v-head.origin[i])),head:true};
  const validated=Hit.segment(attacker,target,shot);assert(validated);assert.equal(B.ray(grid,map,validated.origin,validated.dir,validated.limit),null);
  assert.equal(Hit.segment(attacker,target,{...shot,point:[target.lx+12,target.ly+1,target.lz]}),null);
  assert.equal(Hit.segment(attacker,target,{...shot,origin:[attacker.lx+5,1.62,attacker.lz]}),null);
 });
}
test('finite vent/bridge slabs allow rooftop sight but block shots through ceilings',()=>{
 const g=Array.from({length:6},()=>Array(6).fill(0));g[2][2]=8;g[3][2]=9;
 assert.equal(B.gridHit(g,[2,8,10],[1,0,0],18),null);
 assert.equal(B.gridHit(g,[10,.7,10],[0,1,0],5).t,1.35-.7);
 assert.equal(B.gridHit(g,[10,5,14],[0,-1,0],5).t,5-2.3);
});
test('the client reports the rendered impact point and both sides share collision geometry',()=>{
 assert(source.includes('point:origin.map((v,i)=>v+dir[i]*hit.t)'));
 assert(fs.readFileSync(require.resolve('../cs16-buildings')).equals(fs.readFileSync(require.resolve('../../support-hub-server/cs16-buildings'))));
});
