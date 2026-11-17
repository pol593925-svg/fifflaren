// Runs inside the actual game closure: checks hits through the live raycaster.
module.exports=function roofSceneCheck(){
 const previous={...P},phase=state.phase,alive=me.alive,team=me.team,weapon=current,reload=reloading,random=Math.random;
 const data=CS16Buildings.layout(grid,curMap),results=[];
 try{
  state.phase='live';me.alive=true;me.team='ct';current='ak47';reloading=0;Math.random=()=>0;
  for(const [from,to,label]of [
   [[194,9,268],[238,9,268],'above-tunnel'],
   [[data.buildings[0].x+10.8,7.2,data.buildings[0].z+10],[data.buildings[1].x+10.8,7.2,data.buildings[1].z+10],'roof-to-roof']]){
   Object.assign(P,{x:from[0],y:from[1],z:from[2],yaw:Math.atan2(from[0]-to[0],from[2]-to[2]),pitch:Math.atan2(to[1]+1.72-from[1]-eyeH(),Math.hypot(from[0]-to[0],from[2]-to[2])),onGround:true,crouched:false});
   const r=addRemote('Roof regression','t');Object.assign(r,{x:to[0],tx:to[0],y:to[1],ty:to[1],z:to[2],tz:to[2],alive:true});r.group.position.set(...to);
   ammo.ak47={mag:30,reserve:90};window.__emitted=[];fireOne();
   const hit=window.__emitted.find(e=>e.n==='cs16_hit');if(!hit||hit.d.target!=='Roof regression'||!hit.d.point)throw Error('Roof shot failed: '+label);
   results.push({label,...hit.d});
  }
 }finally{Math.random=random;Object.assign(P,previous);state.phase=phase;me.alive=alive;me.team=team;current=weapon;reloading=reload;const r=remotes.get('Roof regression');if(r){scene.remove(r.group);remotes.delete('Roof regression');}}
 return results;
};
