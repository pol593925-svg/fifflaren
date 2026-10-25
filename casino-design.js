document.addEventListener('DOMContentLoaded',()=>{
 const lobby=document.getElementById('casinoLobby');
 const hero=document.createElement('div');hero.className='casino-hero';
 hero.innerHTML='<div class="casino-heroCopy"><div class="hub-eyebrow">SUPPORT HUB · GAME LOUNGE</div><h2>Твой ход.</h2><p>Выбери игру.<br>Поймай свой момент.</p><span class="casino-heroLine">СЛОТЫ / КАРТЫ / АРКАДЫ</span></div><div class="casino-art" aria-hidden="true"><i class="casino-orbit"></i><i class="casino-chip chip-one">S</i><i class="casino-chip chip-two">S</i><div class="casino-artCard">A<span>♠</span></div><div class="casino-seven">7</div><div class="casino-diamond">◆</div></div>';
 lobby.prepend(hero);
 const descriptions=['Четыре темы · четыре барабана','Число, цвет или чётность','Собери свою комбинацию','Следи за множителем','Прогноз движения','Вызов сопернику','Один поворот колеса','Твой билет в игре','Открой поле','Карточная комбинация','Аркада на реакцию','Гонка до финиша','Открой награду','Испытай удачу','Баланс и переводы'];
 document.querySelectorAll('.casino-room-btn').forEach((button,i)=>{
  const first=[...button.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
  if(first){const art=document.createElement('b');art.className='casino-gameIcon';art.textContent=first.textContent;first.replaceWith(art);}
  const sub=document.createElement('small');sub.textContent=descriptions[i]||'';button.append(sub);
  const arrow=document.createElement('i');arrow.textContent='↗';arrow.className='casino-gameArrow';button.append(arrow);
 });
 const slot=document.getElementById('room-slot');slot.dataset.art='classic';
 const strip=document.getElementById('reel0').parentElement;strip.classList.add('casino-reelStage');
 document.querySelectorAll('.slot-theme-btn').forEach(button=>button.addEventListener('click',()=>{slot.dataset.art=button.dataset.theme;}));
 const reels=[...document.querySelectorAll('.casino-reel')];
 for(const reel of reels)new MutationObserver(records=>{
  if(records.some(r=>r.type==='childList')&&!reel.classList.contains('rolling'))reel.animate([{transform:'translateY(-8px)',filter:'blur(2px)'},{transform:'translateY(2px)',filter:'blur(0)'},{transform:'translateY(0)'}],{duration:260,easing:'ease-out'});
 }).observe(reel,{childList:true});
});
