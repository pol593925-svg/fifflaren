(() => {
  'use strict';
  const speaker='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path data-sound d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path data-silent d="m16 9 6 6m0-6-6 6"/></svg>';
  function mount(host,media,{id,label,key,initial}){
    const read=(name,fallback)=>{try{const value=localStorage.getItem(name);if(value!==null&&value.trim()!==''&&Number.isFinite(Number(value)))return Math.max(0,Math.min(100,Math.round(Number(value))));}catch{}return fallback;};
    const save=(name,value)=>{try{localStorage.setItem(name,String(value));}catch{}};
    let previous=read(key+':previous',initial)||initial;
    media.muted=false;media.volume=read(key,initial)/100;
    host.classList.add('hub-volume');host.setAttribute('role','group');host.setAttribute('aria-label','Громкость '+label);
    host.innerHTML='<button type="button" data-mute>'+speaker+'</button><button type="button" data-down>−</button><output aria-live="polite" aria-atomic="true"></output><button type="button" data-up>+</button>';
    const mute=host.querySelector('[data-mute]'),down=host.querySelector('[data-down]'),up=host.querySelector('[data-up]'),output=host.querySelector('output');
    mute.id=id+'Mute';down.id=id+'Down';up.id=id+'Up';output.id=id;
    for(const [button,text]of [[down,'Уменьшить'],[up,'Увеличить']]){button.title=text+' громкость '+label+' на 5%';button.setAttribute('aria-label',button.title);}
    const level=()=>media.muted?0:Math.round(media.volume*100);
    function render(){
      const value=level();if(value>0)previous=value;
      output.textContent=value+'%';output.setAttribute('aria-label','Громкость '+label+': '+value+'%');
      mute.title=(value?'Выключить':'Включить')+' звук '+label;mute.setAttribute('aria-label',mute.title);mute.setAttribute('aria-pressed',String(value===0));
      down.disabled=value===0;up.disabled=value===100;
      save(key,value);save(key+':previous',previous);
    }
    function change(value){media.muted=false;media.volume=Math.max(0,Math.min(100,value))/100;render();}
    down.onclick=()=>change(level()-5);up.onclick=()=>change(level()+5);
    mute.onclick=()=>change(level()?0:previous);
    media.addEventListener('volumechange',render);render();
    return {destroy(){media.removeEventListener('volumechange',render);mute.onclick=down.onclick=up.onclick=null;}};
  }
  window.HubMediaVolume={mount};
})();
