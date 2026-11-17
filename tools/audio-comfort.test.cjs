const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const steps=require('../cs16-footsteps'),window={};vm.runInNewContext(fs.readFileSync(require.resolve('../cs16-battle-audio'),'utf8'),{window});
for(const rate of [22050,44100,48000])test('soft cached sound banks have no edge clicks or clipping at '+rate+' Hz',()=>{
 for(const [bank,types]of [[steps,['stone','earth','grass','wood','metal']],[window.CS16BattleAudio,['rifle','pistol','smg','sniper','suppressed']]])for(const type of types){
  const a=bank.samples(type,0,rate),b=bank.samples(type,1,rate);let energy=0,difference=0,peak=0;
  for(let i=0;i<a.length;i++){assert(Number.isFinite(a[i]));peak=Math.max(peak,Math.abs(a[i]));energy+=a[i]*a[i];if(i)difference+=(a[i]-a[i-1])**2;}
  assert(a[0]===0&&a.at(-1)===0);assert(peak<.72);assert(energy/a.length>.0001);
  assert(difference/energy<.55,'harsh high-frequency energy: '+type);
  assert(a.some((v,i)=>Math.abs(v-b[i])>.01),'variations must differ');
 }
});
