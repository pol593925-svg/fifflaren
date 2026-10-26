/* Presentation only: all balances, odds, positions and outcomes stay server-owned. */
(function(){
 const arena=new Image();arena.src='assets/casino/race-arena.png';
 const symbols=['7','🍒','🔔','💎','⭐','🍋','7','🍌','🍍','🥭','🍉','🍇','7','⚡','🏛️','🦅','👑','🛡️','7','🐕','🐩','🐕‍🦺','🦴','🏠'];
 const themes={classic:0,bananza:1,zeus:2,dogs:3};
 function reel(el){const symbol=el.textContent.trim(),theme=themes[document.getElementById('room-slot').dataset.art]||0;let index=symbol==='7'?theme*6:symbols.indexOf(symbol);if(index<0){el.removeAttribute('data-painted');return;}el.dataset.painted='1';el.setAttribute('aria-label',symbol);el.style.setProperty('--symbol-x',((index%6+.5-1/2.4)/(6-1/1.2))*100+'%');el.style.setProperty('--symbol-y',((Math.floor(index/6)+.5-1/2.4)/(4-1/1.2))*100+'%');}
 function rooster(ctx,x,y,size,color,phase){
  ctx.save();ctx.translate(x,y);ctx.scale(size/60,size/60);
  ctx.fillStyle='#20150b44';ctx.beginPath();ctx.ellipse(0,20,27,5,0,0,7);ctx.fill();
  ctx.strokeStyle='#edb761';ctx.lineWidth=3;ctx.lineCap='round';
  for(const sign of [-1,1]){const swing=Math.sin(phase+sign)*9;ctx.beginPath();ctx.moveTo(sign*6,8);ctx.lineTo(sign*7+swing,20);ctx.lineTo(sign*7+swing+8,21);ctx.stroke();}
  for(let i=0;i<5;i++){ctx.save();ctx.translate(-13,1);ctx.rotate(-.8-i*.2);const feather=ctx.createLinearGradient(0,0,0,-40);feather.addColorStop(0,'#133b3c');feather.addColorStop(1,color);ctx.fillStyle=feather;ctx.beginPath();ctx.ellipse(0,-13,6,23,0,0,7);ctx.fill();ctx.restore();}
  const body=ctx.createRadialGradient(4,-6,1,0,0,25);body.addColorStop(0,'#fff1b8');body.addColorStop(.4,color);body.addColorStop(1,'#6c321e');ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(0,0,22,16,-.12,0,7);ctx.fill();
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(-1,1,13,8,.2,0,7);ctx.fill();
  ctx.fillStyle='#f4deae';ctx.beginPath();ctx.ellipse(17,-13,10,16,.2,0,7);ctx.fill();
  ctx.fillStyle='#bf3036';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(13+i*5,-29,4,7,0,0,7);ctx.fill();}
  ctx.fillStyle='#e9a23d';ctx.beginPath();ctx.moveTo(24,-17);ctx.lineTo(36,-12);ctx.lineTo(24,-9);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(21,-19,3.3,0,7);ctx.fill();ctx.fillStyle='#181a20';ctx.beginPath();ctx.arc(22,-19,1.8,0,7);ctx.fill();ctx.restore();
 }
 function race(cv,state,smooth){
  if(cv.width!==960){cv.width=960;cv.height=580;}const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  c.fillStyle='#64442b';c.fillRect(0,0,W,H);if(arena.complete&&arena.naturalWidth)c.drawImage(arena,0,0,W,H);
  const colors=['#e3a044','#66a8c0','#bf668f','#6eaf78','#a78cce','#cf6553'],n=state.roosters.length,laneH=(H-190)/Math.max(n,1),left=72,width=W-165;
  c.fillStyle='#0e1729bb';c.fillRect(18,18,340,42);c.fillStyle='#ffe5aa';c.font='700 20px Segoe UI';c.fillText('АРЕНА · '+(state.phase==='run'?'ЗАБЕГ ИДЁТ':'ГОТОВНОСТЬ К СТАРТУ'),32,46);
  for(let i=0;i<n;i++){
   const y=180+i*laneH;c.fillStyle=i%2?'#391f111c':'#fff4ce14';c.fillRect(18,y,W-36,laneH);c.strokeStyle='#fbe5a866';c.setLineDash([10,12]);c.beginPath();c.moveTo(22,y+laneH);c.lineTo(W-20,y+laneH);c.stroke();c.setLineDash([]);
   smooth[i]=(Number(smooth[i])||0)+((Number(state.positions[i])||0)-(Number(smooth[i])||0))*.12;
   const progress=Math.max(0,Math.min(100,smooth[i])),x=left+progress/100*width;
   c.fillStyle='#211f21cc';c.fillRect(25,y+3,240,19);c.fillStyle='#fff4dc';c.font='600 13px Segoe UI';c.fillText(state.roosters[i].name+'  ×'+state.roosters[i].odds,33,y+17);
   rooster(c,x,y+laneH*.62,Math.min(68,laneH*.9),colors[i%colors.length],state.phase==='run'?Date.now()/85+i:0);
   if(state.winner===i){c.fillStyle='#ffe29e';c.font='bold 15px Segoe UI';c.fillText('ПОБЕДИТЕЛЬ',Math.min(x+25,W-145),y+laneH*.6);}
  }
  for(let y=180;y<H-10;y+=14)for(let x=0;x<2;x++){c.fillStyle=(Math.floor(y/14)+x)%2?'#fff8e9':'#25262d';c.fillRect(W-61+x*12,y,12,14);}
 }
 function chart(cv,ticks,start,price){
  if(cv.width!==900){cv.width=900;cv.height=340;}const c=cv.getContext('2d'),W=cv.width,H=cv.height;
  const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#112733');bg.addColorStop(1,'#0b1422');c.fillStyle=bg;c.fillRect(0,0,W,H);
  c.fillStyle='#8ca8ba';c.font='12px Segoe UI';c.fillText('ИГРОВОЙ РЫНОК / ТЕКУЩИЙ РАУНД',24,30);c.fillStyle='#edf6ff';c.font='600 30px Segoe UI';c.fillText(Number(price).toFixed(2),24,67);
  const values=ticks.length?ticks:[start],all=[...values,start,price],low=Math.min(...all)-1,high=Math.max(...all)+1;
  const x=i=>54+i/Math.max(1,values.length-1)*(W-145),y=v=>H-35-(v-low)/(high-low)*(H-130);
  c.font='11px Segoe UI';for(let i=0;i<5;i++){const value=low+(high-low)*i/4,yy=y(value);c.strokeStyle='#36506466';c.beginPath();c.moveTo(45,yy);c.lineTo(W-70,yy);c.stroke();c.fillStyle='#829dad';c.fillText(value.toFixed(1),W-60,yy+4);}
  c.setLineDash([6,7]);c.strokeStyle='#d4bd8366';c.beginPath();c.moveTo(45,y(start));c.lineTo(W-70,y(start));c.stroke();c.setLineDash([]);
  const color=price>=start?'#65e0be':'#ff8b9f',fill=c.createLinearGradient(0,95,0,H);fill.addColorStop(0,price>=start?'#40c5a644':'#e04f7544');fill.addColorStop(1,'#00000000');
  c.beginPath();values.forEach((v,i)=>i?c.lineTo(x(i),y(v)):c.moveTo(x(i),y(v)));c.lineTo(x(values.length-1),H-34);c.lineTo(x(0),H-34);c.closePath();c.fillStyle=fill;c.fill();
  c.beginPath();values.forEach((v,i)=>i?c.lineTo(x(i),y(v)):c.moveTo(x(i),y(v)));c.strokeStyle=color;c.lineWidth=3;c.shadowColor=color;c.shadowBlur=10;c.stroke();c.shadowBlur=0;c.fillStyle=color;c.beginPath();c.arc(x(values.length-1),y(price),5,0,7);c.fill();
 }
 function wheel(cv,sectors,rotation){
  const c=cv.getContext('2d'),R=cv.width/2,total=sectors.reduce((s,v)=>s+v.w,0);c.clearRect(0,0,cv.width,cv.height);if(!total)return;
  c.save();c.translate(R,R);c.rotate(rotation);let angle=0;
  for(const sector of sectors){const span=sector.w/total*Math.PI*2,paint=c.createRadialGradient(0,0,20,0,0,R);paint.addColorStop(0,'#26333e');paint.addColorStop(.75,sector.id.startsWith('fine')?'#833d52':sector.id.startsWith('win')?'#267b68':'#56477c');paint.addColorStop(1,'#101923');c.beginPath();c.moveTo(0,0);c.arc(0,0,R-13,angle,angle+span);c.closePath();c.fillStyle=paint;c.fill();c.strokeStyle='#d4b77e';c.lineWidth=.8;c.stroke();c.save();c.rotate(angle+span/2);c.textAlign='right';c.fillStyle='#fff2cf';c.font='600 10px Segoe UI';c.fillText(sector.label,R-22,4);c.restore();angle+=span;}
  c.restore();c.strokeStyle='#d8b76f';c.lineWidth=6;c.beginPath();c.arc(R,R,R-9,0,7);c.stroke();for(let i=0;i<40;i++){const a=i/40*Math.PI*2;c.fillStyle=i%2?'#ffefbb':'#9b7a48';c.beginPath();c.arc(R+Math.cos(a)*(R-5),R+Math.sin(a)*(R-5),2,0,7);c.fill();}
  const gold=c.createRadialGradient(R-8,R-8,2,R,R,24);gold.addColorStop(0,'#fff1c4');gold.addColorStop(.6,'#d1a260');gold.addColorStop(1,'#6c4d2b');c.fillStyle=gold;c.beginPath();c.arc(R,R,23,0,7);c.fill();c.fillStyle='#241c25';c.textAlign='center';c.font='bold 18px Georgia';c.fillText('S',R,R+6);c.textAlign='left';c.fillStyle='#ffe4a2';c.beginPath();c.moveTo(R-10,0);c.lineTo(R+10,0);c.lineTo(R,26);c.closePath();c.fill();
 }
 function chest(cv,state,reward){
  const c=cv.getContext('2d'),W=cv.width,H=cv.height,x=W/2,y=H*.6;
  const bg=c.createRadialGradient(x,y-30,5,x,y,180);bg.addColorStop(0,'#5f4760');bg.addColorStop(.6,'#22233a');bg.addColorStop(1,'#111b27');c.fillStyle=bg;c.fillRect(0,0,W,H);
  const gold=c.createLinearGradient(x-80,0,x+80,0);gold.addColorStop(0,'#7f572b');gold.addColorStop(.3,'#f5d391');gold.addColorStop(.5,'#b78a4d');gold.addColorStop(.8,'#ffe9ae');gold.addColorStop(1,'#926233');
  const wood=c.createLinearGradient(0,y-60,0,y+40);wood.addColorStop(0,'#547e79');wood.addColorStop(.5,'#244346');wood.addColorStop(1,'#102d33');
  c.shadowColor='#0009';c.shadowBlur=18;c.fillStyle=wood;c.beginPath();c.roundRect(x-88,y-25,176,77,9);c.fill();c.shadowBlur=0;c.strokeStyle=gold;c.lineWidth=6;c.stroke();
  c.save();if(state!=='closed'){c.translate(0,-38);c.scale(1,.85);}c.fillStyle=wood;c.beginPath();c.roundRect(x-88,y-62,176,55,[22,22,3,3]);c.fill();c.strokeStyle=gold;c.lineWidth=5;c.stroke();c.restore();
  c.fillStyle=gold;for(const dx of [-62,53])c.fillRect(x+dx,y-55,10,101);c.beginPath();c.roundRect(x-13,y-18,26,34,5);c.fill();c.fillStyle='#18232b';c.beginPath();c.arc(x,y-6,4,0,7);c.fill();c.fillRect(x-2,y-5,4,10);
  for(let i=0;i<12;i++){const a=i*2.399,xx=x+Math.cos(a)*(70+i*3),yy=y-30+Math.sin(a)*(35+i*2);c.fillStyle='#ffe6a288';c.fillRect(xx,yy,2,2);}
  if(state!=='closed'){const light=c.createLinearGradient(0,20,0,y);light.addColorStop(0,'#fff0b400');light.addColorStop(1,'#fff0b4aa');c.fillStyle=light;c.beginPath();c.moveTo(x-60,y-24);c.lineTo(x-100,15);c.lineTo(x+100,15);c.lineTo(x+60,y-24);c.fill();}
  if(state==='reward'){c.textAlign='center';c.font='bold 32px Segoe UI';c.fillStyle='#fff0bc';c.shadowColor='#eec680';c.shadowBlur=18;c.fillText(reward>0?'+'+reward+'$':'Пусто',x,48);c.shadowBlur=0;c.textAlign='left';}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  for(const el of document.querySelectorAll('.casino-reel')){reel(el);new MutationObserver(()=>reel(el)).observe(el,{childList:true});}
  const slot=document.getElementById('room-slot');new MutationObserver(()=>document.querySelectorAll('.casino-reel').forEach(reel)).observe(slot,{attributes:true,attributeFilter:['data-art']});
  const subtitles={slot:'Сокровища четырёх миров',roulette:'Красное. Чёрное. Твой выбор.',blackjack:'Карты на стол',crash:'Поймай момент',options:'Ритм игрового рынка',duel:'Один на один',wheel:'Колесо возможностей',lottery:'Твой счастливый билет',mines:'Открой сокровища',poker:'Собери свою комбинацию',snake:'Аркада на реакцию',race:'Большая арена',case:'Сокровище дня',rr:'Испытание удачи',bank:'Твой игровой баланс'};
  for(const room of document.querySelectorAll('.casino-room')){room.classList.add('casino-illustrated');const p=document.createElement('p');p.className='casino-sceneCaption';p.textContent=subtitles[room.id.replace('room-','')];room.querySelector('h4')?.after(p);}
  const raceCanvas=document.getElementById('raceCanvas'),raceRoom=document.getElementById('room-race');
  raceRoom.insertBefore(document.getElementById('raceRoosters'),raceCanvas);
  raceRoom.insertBefore(document.getElementById('raceBetAmount').parentElement,raceCanvas);
 });
 window.CasinoArt={race,chart,rooster,wheel,chest};
})();
