(function(){
  'use strict';
  let cfg, station, revisionTime=0, timer, reading=false, listening=false, loadedId='', blobURL='', pending;
  const player=new Audio(), $=id=>document.getElementById(id);
  const owner=()=>cfg?.username.toLowerCase()==='fifflaren';
  const time=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const say=s=>{$('radioNotice').textContent=s;$('radioToggle').title=s||'Подключиться к эфиру';};
  function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
  async function request(path,init={}){
    const session=cfg;
    const r=await fetch(session.server+'/api/radio/'+path,{...init,headers:{Authorization:'Bearer '+session.token,...init.headers},signal:init.signal||AbortSignal.timeout(30000)});
    if(session!==cfg)throw Error('Аккаунт изменился.');
    if(!r.ok){let msg;try{msg=(await r.json()).message;}catch{}throw Error(msg||'Радио временно недоступно.');}return r;
  }
  function installState(s,transit=0){
    if(station&&(s.rev<station.rev||(s.rev===station.rev&&s.now<station.now)))return;
    const redraw=!station||s.rev!==station.rev||s.current!==station.current;
    station=s;revisionTime=performance.now()-transit;draw(redraw);sync().catch(e=>say(e.message));
  }
  function draw(queueChanged){
    const t=station?.queue.find(t=>t.id===station.current);
    $('radioTitle').textContent=t?(station.playing?t.title:'Пауза · '+t.title):'Эфир ожидает трек';
    $('radioToggle').textContent=listening?'■':'▶';$('radioToggle').setAttribute('aria-pressed',String(listening));
    $('radioToggle').setAttribute('aria-label',listening?'Отключиться от радио':'Слушать общий эфир');
    if(!owner()||!station)return;
    $('radioBroadcast').textContent=station.playing?'Пауза эфира':'Начать эфир';
    for(const id of ['radioBroadcast','radioPrev','radioNext','radioSeek'])$(id).disabled=!t;
    if(t&&document.activeElement!==$('radioSeek')){$('radioSeek').max=t.duration;$('radioSeek').value=station.position;}
    $('radioTime').textContent=t?time(station.position)+' / '+time(t.duration):'—';
    if(!queueChanged)return;
    const list=$('radioQueue');list.replaceChildren();station.queue.forEach((item,i)=>{
      const li=document.createElement('li'), title=document.createElement('span');li.classList.toggle('on-air',item.id===station.current);
      title.textContent=(i+1)+'. '+item.title+' · '+time(item.duration);li.append(title,button('В эфир',()=>control('select',{id:item.id})));
      for(const [label,op,off] of [['↑','up',i===0],['↓','down',i===station.queue.length-1],['Удалить','remove',false]]){
        const b=button(label,()=>control(op,{id:item.id}));b.disabled=off;li.append(b);
      }list.append(li);
    });
  }
  function release(){
    if(!pending&&!loadedId&&!blobURL)return;pending?.abort();pending=null;player.pause();player.removeAttribute('src');player.load();loadedId='';
    if(blobURL)URL.revokeObjectURL(blobURL);blobURL='';
  }
  async function sync(){
    if(!listening||!station?.current){if(loadedId||pending)release();return;}
    if(!station.playing){if(pending)release();player.pause();return;}
    const id=station.current;
    if(loadedId!==id){
      if(pending?.track===id)return;release();const job=new AbortController();job.track=id;pending=job;
      try{
        const data=await (await request('audio/'+id,{signal:job.signal})).blob();
        if(job.signal.aborted||pending!==job||station.current!==id||!listening)return;
        blobURL=URL.createObjectURL(data);loadedId=id;player.src=blobURL;
      }catch(e){if(job.signal.aborted)return;throw e;}finally{if(pending===job)pending=null;}
    }
    if(!player.readyState)return;
    const target=station.position+Math.max(0,performance.now()-revisionTime)/1000;
    if(target>=player.duration)return;
    if(Math.abs(player.currentTime-target)>.5)player.currentTime=target;
    if(player.paused){try{await player.play();}catch(e){if(e.name==='NotAllowedError'){listening=false;release();draw(false);say('Нажми ▶ для прослушивания.');}else if(e.name!=='AbortError')throw e;}}
  }
  async function pull(){
    if(!cfg||reading)return;reading=true;
    try{const t=performance.now(),s=await (await request('state')).json();installState(s,Math.min(500,(performance.now()-t)/2));}
    catch(e){say(e.message);}finally{reading=false;}
  }
  async function control(op,extra={}){
    if(!station)return;
    try{const s=await (await request('control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,rev:station.rev,...extra})})).json();installState(s);say('');}
    catch(e){say(e.message);await pull();}
  }
  function duration(file){return new Promise((resolve,reject)=>{
    const a=new Audio(), url=URL.createObjectURL(file);
    function finish(ok){clearTimeout(timeout);const d=a.duration;a.removeAttribute('src');a.load();URL.revokeObjectURL(url);ok&&Number.isFinite(d)&&d>=1&&d<=3600?resolve(d):reject(Error('Не удалось прочитать длительность трека.'));}
    const timeout=setTimeout(()=>finish(false),8000);a.onloadedmetadata=()=>{a.onloadedmetadata=a.onerror=null;finish(true);};a.onerror=()=>{a.onloadedmetadata=a.onerror=null;finish(false);};a.preload='metadata';a.src=url;
  });}
  async function upload(){
    const input=$('radioFiles'),files=Array.from(input.files);input.disabled=true;
    try{for(const f of files){
      if(f.size>12*1024*1024)throw Error(f.name+' больше 12 МБ.');
      say('Загрузка · '+f.name);const d=await duration(f);
      const query=new URLSearchParams({title:f.name.replace(/\.(mp3|ogg|wav)$/i,''),duration:String(d)});
      installState(await (await request('tracks?'+query,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:f})).json());
    }say('Треки добавлены в очередь.');}catch(e){say(e.message);}finally{input.value='';input.disabled=false;}
  }
  function start(session){
    clearInterval(timer);release();listening=false;station=null;cfg=session;
    $('radioTabButton').style.display=owner()?'':'none';
    if(!$('hubRadio')){const tools=document.querySelector('.hub-tools');if(!tools)return;
      const box=document.createElement('div');box.id='hubRadio';
      box.innerHTML='<button id="radioToggle" type="button" aria-label="Слушать общий эфир">▶</button><div><small>КОМАНДНОЕ РАДИО</small><span id="radioTitle">Подключиться к эфиру</span></div><input id="radioVolume" type="range" min="0" max="100" aria-label="Громкость радио">';
      tools.before(box);}
    const volume=$('radioVolume');let saved=null;try{saved=localStorage.getItem('hub-radio-volume:'+session.username);}catch{}
    volume.value=saved??40;player.volume=Number(volume.value)/100;volume.oninput=()=>{player.volume=volume.value/100;try{localStorage.setItem('hub-radio-volume:'+session.username,volume.value);}catch{}};
    draw(false);$('radioToggle').onclick=()=>{listening=!listening;if(!listening)release();draw(false);if(listening)pull();};
    $('radioFiles').onchange=upload;$('radioBroadcast').onclick=()=>control(station?.playing?'pause':'play');
    $('radioPrev').onclick=()=>control('previous');$('radioNext').onclick=()=>control('next');
    $('radioSeek').onchange=e=>control('seek',{id:station?.current,position:Number(e.target.value)});
    $('radioTabButton').addEventListener('click',pull);player.onloadedmetadata=()=>sync().catch(e=>say(e.message));
    player.onended=pull;player.onerror=()=>{if(listening&&loadedId)say('Не удалось воспроизвести файл.');};
    timer=setInterval(()=>{if(listening||owner()&&$('tab-radio').classList.contains('active'))pull();},2000);
    if(owner())pull();
  }
  window.HubRadio={start};
})();
