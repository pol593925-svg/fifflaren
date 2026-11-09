(()=>{'use strict';
 let cfg,dialog,form,mini,viewer,track,wanted,playing=false;
 const $=id=>document.getElementById(id);
 function release(){viewer?.destroy();viewer=null;track=null;wanted=null;playing=false;mini?.remove();mini=null;}
 function stop(){release();if(dialog?.open)dialog.close();form?.destroy();form=null;cfg=null;}
 function open(){
  if(!cfg)return;cfg.onPreviewPlaying?.();
  if(!dialog){dialog=document.createElement('dialog');dialog.id='radioYouTubeDialog';dialog.setAttribute('aria-labelledby','radioYouTubeTitle');
   dialog.innerHTML='<header><div><small>SUPPORT HUB / ОБЩИЙ ЭФИР</small><h2 id="radioYouTubeTitle">Музыка по ссылке.</h2></div><button type="button" aria-label="Закрыть">✕</button></header><p>Из YouTube или YouTube Music — прямо в очередь команды.</p><div id="radioYouTubeForm"></div>';
   dialog.querySelector('header button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{form?.destroy();form=null;});document.body.append(dialog);
  }
  form?.destroy();form=HubYouTube.mountLinkForm($('radioYouTubeForm'),{server:cfg.server,api:cfg.api,allowNow:cfg.isOwner,onAdded:cfg.onAdded,onPreviewPlaying:cfg.onPreviewPlaying});
  if(!dialog.open)dialog.showModal();form.focus();
 }
 function mount(options){
  stop();cfg=options;
  let button=$('radioYouTubeButton');
  if(!button){button=document.createElement('button');button.id='radioYouTubeButton';button.type='button';button.className='radio-phone-button';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 6 3-6 3Z"/></svg><span>YouTube / Music</span>';button.title='Добавить песню по ссылке';$('radioPhoneUpload')?.before(button);}
  button.onclick=open;
 }
 function sync(t,c){
  if(!cfg)return;
  if(!viewer||track?.id!==t.id){
   release();track=t;mini=document.createElement('aside');mini.id='radioYouTubePlayer';mini.setAttribute('aria-label','Плеер общего эфира YouTube');
   mini.innerHTML='<header><span>YOUTUBE · ОБЩИЙ ЭФИР</span><button type="button" aria-label="Отключиться от YouTube-эфира">✕</button></header><div class="yt-mini-screen"></div><div class="yt-mini-info"><strong></strong><p role="status"></p><button class="yt-retry" type="button" hidden>Повторить</button></div>';
   document.body.append(mini);mini.querySelector('strong').textContent=t.title;mini.querySelector('header button').onclick=()=>cfg?.onStop?.();
   const header=mini.querySelector('header');let drag;
   header.onpointerdown=e=>{if(e.target.closest('button'))return;const r=mini.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);};
   header.onpointermove=e=>{if(!drag)return;mini.style.left=Math.max(0,Math.min(innerWidth-mini.offsetWidth,e.clientX-drag.x))+'px';mini.style.top=Math.max(0,Math.min(innerHeight-mini.offsetHeight,e.clientY-drag.y))+'px';mini.style.bottom='auto';};
   header.onpointerup=header.onpointercancel=()=>{drag=null;};
   viewer=HubYouTube.createPlayer(mini.querySelector('.yt-mini-screen'),{server:cfg.server,onEvent:m=>{
    if(!cfg||!mini)return;
    const status=mini.querySelector('p'),retry=mini.querySelector('.yt-retry');
    if(m.event==='state'){playing=m.state===1;cfg.onPlayback?.(playing);if(playing){status.textContent='Сейчас в общем эфире';retry.hidden=true;}else if(m.state===3)status.textContent='Буферизация YouTube…';}
    if(m.event==='blocked'){playing=false;cfg.onPlayback?.(false);status.textContent='Нажми ▶ в плеере, чтобы включить звук.';}
    if(m.event==='error'){playing=false;cfg.onPlayback?.(false);status.textContent=m.message;retry.hidden=false;}
   }});
   mini.querySelector('.yt-retry').onclick=()=>{const keepTrack=track,keepWanted=wanted;release();if(keepTrack&&keepWanted)sync(keepTrack,keepWanted);};
  }
  wanted=c;viewer.sync({videoId:t.videoId,playing:c.playing&&!document.hidden,position:c.position,volume:c.volume});
 }
 document.addEventListener('visibilitychange',()=>{if(viewer&&track&&wanted)sync(track,wanted);});
 window.HubRadioYouTube={mount,stop,release,sync,get active(){return !!viewer},get audible(){return playing&&!document.hidden}};
})();
