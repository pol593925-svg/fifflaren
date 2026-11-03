document.addEventListener('DOMContentLoaded',()=>{
 const voice=new Audio('assets/audio/welcome.wav');voice.volume=.65;let played=false,trying=false;
 async function play(){if(played||trying)return;try{if(localStorage.getItem('sh_sound')==='off'){played=true;return;}trying=true;await voice.play();played=true;document.removeEventListener('pointerdown',play);}catch{}finally{trying=false;}}
 setTimeout(play,650);document.addEventListener('pointerdown',play);document.getElementById('soundToggleBtn')?.addEventListener('click',()=>{if(localStorage.getItem('sh_sound')==='off'){voice.pause();played=true;document.removeEventListener('pointerdown',play);}});
});
