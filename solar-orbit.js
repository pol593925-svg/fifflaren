document.addEventListener('DOMContentLoaded',()=>{
 const ring=document.querySelector('.shift-orbit');if(!ring)return;ring.classList.add('solar-system');
 const sun=document.createElement('div');sun.className='orbit-sun';sun.setAttribute('aria-hidden','true');ring.prepend(sun);
 const button=document.createElement('button');button.className='orbit-action orbit-exchanges';button.innerHTML='<b>◈</b><span>Биржи</span>';ring.append(button);
 const dialog=document.createElement('dialog');dialog.className='hub-work-dialog orbit-exchange-dialog';dialog.setAttribute('aria-label','Поиск бирж');const close=document.createElement('button');close.className='hub-work-close';close.textContent='✕';close.setAttribute('aria-label','Закрыть');dialog.append(close);document.body.append(dialog);
 let home=null,after=null;const tab=document.getElementById('tab-exchanges');button.onclick=()=>{home=tab.parentNode;after=tab.nextSibling;dialog.append(tab);tab.style.display='block';dialog.showModal();document.getElementById('exchangeSearchInput').focus();};close.onclick=()=>dialog.close();dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.close();}});dialog.addEventListener('close',()=>{if(home)home.insertBefore(tab,after);tab.style.display='none';button.focus();});
});
