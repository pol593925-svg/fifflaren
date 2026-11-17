const {test}=require('node:test'),assert=require('node:assert/strict'),tools=require('../cs16-admin-tools');
const enemy=(nick,x,y,z,extra={})=>({nick,x,y,z,alive:true,team:'t',...extra});
test('aim selects the nearest angular visible living enemy inside the forward cone',()=>{
 const players=[enemy('friend',0,0,-10,{team:'ct'}),enemy('dead',0,0,-8,{alive:false}),enemy('behind',0,0,8),enemy('outside',20,0,-5),enemy('hidden',0,0,-10),enemy('visible',2,0,-12),enemy('far',0,0,-300)];
 const hit=tools.aim([0,1.62,0],0,0,'ct',players,(_,r)=>r.nick!=='hidden');
 assert.equal(hit.nick,'visible');assert(hit.yaw<0&&hit.pitch>0);
 assert.equal(tools.aim([0,1.62,0],Math.PI,0,'ct',[enemy('ahead',0,0,-10)]),null);
});
test('crouched and raised targets use the real combat head height',()=>{
 const hit=tools.aim([0,1.62,0],0,0,'ct',[enemy('roof',0,3,-10,{crouched:true})]);
 assert.deepEqual(hit.point,[0,3+1.72*.72,-10]);assert(hit.pitch>.2);
});
test('no valid target never changes aim',()=>{assert.equal(tools.aim([0,0,0],0,0,'ct',[]),null);assert.equal(tools.aim([0,0,0],0,0,'ct',[enemy('x',0,0,-5)],()=>false),null);});
