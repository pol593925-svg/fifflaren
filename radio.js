(function(){
  'use strict';
  let cfg, station, revisionTime=0, timer, reading=false, listening=false, loadedId='', pending;
  let library=[], before=null, listing=0, volumeControl;
  const player=new Audio(), $=id=>document.getElementById(id);
  player.crossOrigin='anonymous';
  let presence,reported=null,sounding=false,lights=false,context,meter,lightTimer;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const owner=()=>cfg?.username.toLowerCase()==='fifflaren';
  const time=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const say=s=>{$('radioNotice').textContent=s;$('radioToggle').title=s||'Подключиться к эфиру';};
  function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
  async function request(path,init={}){
    const session=cfg;
    const r=await fetch(session.server+'/api/radio/'+path,{...init,headers:{Authorization:'Bearer '+session.token,...init.headers},signal:init.signal||AbortSignal.timeout(30000)});
    if(session!==cfg)throw Error('Аккаунт изменился.');
    if(!r.ok){let msg;try{msg=(await r.json()).message;}catch{}throw Object.assign(Error(msg||'Радио временно недоступно.'),{status:r.status});}return r;
  }
  function installState(s,transit=0){
    if(station&&(s.rev<station.rev||(s.rev===station.rev&&s.now<station.now)))return;
    if(!s.queue)s.queue=owner()&&station?.rev===s.rev?station.queue:(s.track?[s.track]:[]);
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
      title.textContent=(i+1)+'. '+item.title+' · '+time(item.duration)+(item.addedBy?' · '+item.addedBy:'');li.append(title,button('В эфир',()=>control('select',{id:item.id})));
      for(const [label,op,off] of [['↑','up',i===0],['↓','down',i===station.queue.length-1],['Из очереди','remove',false]]){
        const b=button(label,()=>control(op,{id:item.id}));b.disabled=off;li.append(b);
      }list.append(li);
    });drawLibrary();
  }
  function drawLibrary(){
    const list=$('radioLibrary');list.replaceChildren();const queued=new Set((station?.queue||[]).map(t=>t.id));
    for(const t of library){
      const li=document.createElement('li'),title=document.createElement('span');title.textContent=t.title+' · '+time(t.duration);
      const b=button(queued.has(t.id)?'В очереди':'Добавить в очередь',async()=>{
        b.disabled=true;try{installState(await (await request('library/'+t.id+'/queue',{method:'POST'})).json());}
        catch(e){b.disabled=false;say(e.message);}
      });b.disabled=queued.has(t.id);li.append(title,b);list.append(li);
    }
    $('radioMore').hidden=!before;
  }
  async function loadLibrary(append=false){
    if(!owner())return;
    const seq=++listing;
    try{const data=await (await request('library'+(append&&before?'?before='+before:''))).json();
      if(seq!==listing)return;
      library=append?[...library,...data.tracks]:data.tracks;before=data.before;drawLibrary();
    }catch(e){if(seq===listing)say(e.message);}
  }
  function showAudience(names){
    const count=$('radioCount'),list=$('radioListeners');if(!list)return;
    list.replaceChildren();
    $('radioPreview').textContent=names?.slice(0,2).join(', ')||'';
    count.textContent=names?String(names.length):'—';
    $('radioAudience').querySelector('summary').setAttribute('aria-label','Слушатели радио: '+(names?names.length:'нет связи'));
    for(const nick of names?.length?names:[names?'Пока никто не слушает':'Список временно недоступен']){
      const li=document.createElement('li');li.textContent=nick;list.append(li);
    }
  }
  function audible(){return Boolean(listening&&sounding&&station?.playing&&station.current===loadedId&&!player.paused&&!player.ended&&!player.muted&&player.volume>0);}
  function connectAudience(session){
    if(!session.token||!session.io)return;
    const sock=session.io(session.server+'/radio',{auth:{token:session.token}});presence=sock;
    sock.on('connect',()=>{reported=null;refreshPlayback();});
    sock.on('audience',names=>{if(presence===sock&&Array.isArray(names))showAudience(names);});
    const offline=()=>{if(presence===sock){reported=null;showAudience(null);}};
    sock.on('disconnect',offline);sock.on('connect_error',offline);
  }
  function stopMeter(){
    clearInterval(lightTimer);lightTimer=null;
    if(!meter)return;
    meter.source.disconnect();meter.analyser.disconnect();meter.stream.getTracks().forEach(t=>t.stop());meter=null;
  }
  function updateLights(){
    const surface=$('radioGlow');if(!surface)return;
    const active=lights&&audible()&&!document.hidden;
    surface.hidden=!active;
    if(!active||reduced.matches){stopMeter();surface.style.removeProperty('--beat');return;}
    if(lightTimer||!context||context.state!=='running'||!player.captureStream)return;
    // Tap a copy of the playing audio. The normal audio output stays independent of the lights.
    let stream;
    try{
      stream=player.captureStream();
      if(!stream.getAudioTracks().length){stream.getTracks().forEach(t=>t.stop());return;}
      const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();
      analyser.fftSize=256;analyser.smoothingTimeConstant=.75;source.connect(analyser);
      meter={stream,source,analyser};const bins=new Uint8Array(analyser.frequencyBinCount);
      lightTimer=setInterval(()=>{
        analyser.getByteFrequencyData(bins);let bass=0;
        for(let i=1;i<=5;i++)bass+=bins[i];
        surface.style.setProperty('--beat',(bass/(255*5)).toFixed(2));
      },110);
    }catch{stopMeter();stream?.getTracks().forEach(t=>t.stop());}
  }
  function setLights(on){
    lights=on;const btn=$('radioLights');if(btn)btn.setAttribute('aria-pressed',String(on));
    if(on&&!context&&!reduced.matches){
      try{context=new AudioContext();context.resume().then(updateLights).catch(()=>{});}catch{}
    }
    if(!on){stopMeter();if(context){context.close().catch(()=>{});context=null;}}
    updateLights();
  }
  function refreshPlayback(){
    const playing=audible();
    if(presence?.connected&&reported!==playing){presence.emit('listening',playing);reported=playing;}
    updateLights();
  }
  function sound(on){sounding=on;refreshPlayback();}
  player.addEventListener('playing',()=>sound(true));
  for(const event of ['pause','waiting','seeking','ended','emptied','error'])player.addEventListener(event,()=>sound(false));
  player.addEventListener('seeked',()=>{if(!player.paused&&player.readyState>=3)sound(true);});
  player.addEventListener('volumechange',refreshPlayback);
  document.addEventListener('visibilitychange',updateLights);reduced.addEventListener('change',updateLights);
  function release(){
    sound(false);
    if(!pending&&!loadedId)return;pending?.abort();pending=null;player.pause();player.removeAttribute('src');player.load();loadedId='';
  }
  async function sync(){
    if(!listening||!station?.current){if(loadedId||pending)release();return;}
    if(!station.playing){if(pending)release();player.pause();return;}
    const id=station.current;
    if(loadedId!==id){
      if(pending?.track===id)return;release();const job=new AbortController();job.track=id;pending=job;
      try{
        const {ticket}=await (await request('audio/'+id+'/ticket',{method:'POST',signal:job.signal})).json();
        if(job.signal.aborted||pending!==job||station.current!==id||!listening)return;
        loadedId=id;player.src=cfg.server+'/api/radio/audio/'+id+'?ticket='+encodeURIComponent(ticket);
      }catch(e){if(job.signal.aborted)return;throw e;}finally{if(pending===job)pending=null;}
    }
    if(!player.readyState)return;
    const target=station.position+Math.max(0,performance.now()-revisionTime)/1000;
    if(target>=player.duration)return;
    if(Math.abs(player.currentTime-target)>.5)player.currentTime=target;
    if(player.paused){try{await player.play();}catch(e){if(e.name==='NotAllowedError'){listening=false;release();setLights(false);draw(false);say('Нажми ▶ для прослушивания.');}else if(e.name!=='AbortError')throw e;}}
  }
  async function pull(){
    if(!cfg||reading)return;reading=true;
    try{const t=performance.now(),query=owner()?(station?'?since='+station.rev:''):'?compact=1';
      const s=await (await request('state'+query)).json();installState(s,Math.min(500,(performance.now()-t)/2));}
    catch(e){say(e.message);}finally{reading=false;}
  }
  async function control(op,extra={}){
    if(!station)return;
    try{const s=await (await request('control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,rev:station.rev,...extra})})).json();installState(s);say('');}
    catch(e){say(e.message);await pull();}
  }
  function duration(file){return new Promise((resolve,reject)=>{
    const a=new Audio(), url=URL.createObjectURL(file);
    function finish(ok){clearTimeout(timeout);a.onloadedmetadata=a.onerror=null;const d=a.duration;a.removeAttribute('src');a.load();URL.revokeObjectURL(url);ok&&Number.isFinite(d)&&d>0?resolve(d):reject(Error('Формат не воспроизводится или длительность не определена.'));}
    const timeout=setTimeout(()=>finish(false),60000);a.onloadedmetadata=()=>finish(true);a.onerror=()=>finish(false);a.preload='metadata';a.src=url;
  });}
  async function uploadFile(file,progress){
    const session=cfg,d=await duration(file),title=file.name.replace(/\.[a-z0-9]+$/i,'').slice(0,200)||file.name.slice(0,200);
    // Remember the upload ID across restarts without retaining a full file in renderer memory.
    const sample=new Blob([JSON.stringify([file.name,file.size,file.lastModified]),file.slice(0,65536),file.slice(-65536)]);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await sample.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
    const key='hub-radio-upload:'+session.username+':'+digest;
    let id;try{id=localStorage.getItem(key);}catch{}
    if(!/^[a-f0-9]{24}$/.test(id)){
      id=Math.floor(Date.now()/1000).toString(16).padStart(8,'0')+Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>v.toString(16).padStart(2,'0')).join('');
      try{localStorage.setItem(key,id);}catch{}
    }
    const uri='uploads/'+id;
    async function step(path,init){
      for(let attempt=0;;attempt++){
        if(session!==cfg)throw Error('Аккаунт изменился.');
        try{return await (await request(path,init)).json();}catch(e){
          if(attempt>=3||e.status&&e.status<500&&e.status!==429)throw e;
          await new Promise(ok=>setTimeout(ok,700*2**attempt));
        }
      }
    }
    const state=await step(uri,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,size:file.size,duration:d})});
    for(let n=state.next;n<Math.ceil(file.size/state.partSize);n++){
      const start=n*state.partSize,end=Math.min(file.size,start+state.partSize);
      await step(uri+'/parts/'+n,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(start,end)});
      progress(Math.floor(end/file.size*100));
    }
    const result=await step(uri+'/finish',{method:'POST'});if(session!==cfg)throw Error('Аккаунт изменился.');installState(result);try{localStorage.removeItem(key);}catch{}return result;
  }
  let uploading=false;
  function uploadDialog(){
    let dialog=$('radioUploadDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='radioUploadDialog';dialog.setAttribute('aria-labelledby','radioUploadTitle');
      dialog.innerHTML='<header><div><small>КОМАНДНОЕ РАДИО</small><h2 id="radioUploadTitle">Добавить свои песни</h2></div><button id="radioUploadClose" type="button" aria-label="Закрыть">✕</button></header><p>Выбери один или несколько аудиофайлов. После загрузки они попадут в конец общей очереди. Текущая песня продолжит играть. Музыка сохраняется на ПК Fifflaren — его приложение должно быть открыто.</p><label class="radio-upload-picker">Выбрать песни<input id="radioGuestFiles" type="file" multiple accept="audio/*,.mp3,.ogg,.opus,.wav,.flac,.m4a,.mp4,.aac,.weba,.webm,.aiff,.aif"></label><p id="radioGuestStatus" role="status"></p>';
      document.body.append(dialog);$('radioUploadClose').onclick=()=>dialog.close();$('radioGuestFiles').onchange=upload;
    }
    $('radioGuestFiles').disabled=uploading;if(uploading)$('radioGuestStatus').textContent='Загрузка уже идёт. Дождись её завершения.';dialog.showModal();
  }
  async function upload(event){
    const input=event?.currentTarget||$('radioFiles'),files=Array.from(input.files),session=cfg;
    if(uploading||!files.length)return;uploading=true;
    const output=input.id==='radioGuestFiles'?$('radioGuestStatus'):$('radioUploadStatus');
    for(const id of ['radioFiles','radioGuestFiles'])if($(id))$(id).disabled=true;
    let ok=0;const errors=[];
    try{for(const [i,f] of files.entries()){
      if(cfg!==session)break;
      const progress=p=>{if(cfg===session)output.textContent=(i+1)+' из '+files.length+' · '+f.name+' · '+p+'%';};progress(0);
      try{await uploadFile(f,progress);ok++;}catch(e){errors.push(f.name+' — '+e.message);}
    }if(cfg===session){output.textContent='В очередь добавлено '+ok+' из '+files.length+(errors.length?'\n'+errors.join('\n'):'');await loadLibrary();}}
    finally{input.value='';uploading=false;for(const id of ['radioFiles','radioGuestFiles'])if($(id))$(id).disabled=false;}
  }
  function stop(){
    if($('radioUploadDialog')?.open)$('radioUploadDialog').close();if($('radioGuestStatus'))$('radioGuestStatus').textContent='';
    volumeControl?.destroy();volumeControl=null;
    if(owner())cfg?.radioPC?.stop();window.HubCinema?.stop();clearInterval(timer);listening=false;station=null;release();setLights(false);
    presence?.disconnect();presence=null;reported=null;showAudience(null);cfg=null;listing++;
  }
  function start(session){
    stop();cfg=session;window.HubCinema?.start(session);library=[];before=null;
    $('radioTabButton').style.display=owner()?'':'none';
    if(!$('hubRadio')){const tools=document.querySelector('.hub-tools');if(!tools)return;
      const box=document.createElement('div');box.id='hubRadio';
      box.innerHTML='<button id="radioToggle" type="button" aria-label="Слушать общий эфир">▶</button><div><small>КОМАНДНОЕ РАДИО</small><span id="radioTitle">Подключиться к эфиру</span></div><span id="radioVolumeControls"></span>';
      const light=button('✦',()=>{
        setLights(!lights);
        if(lights&&!listening){listening=true;draw(false);pull();}
      });light.id='radioLights';light.title='Светомузыка на моём экране';light.setAttribute('aria-label',light.title);light.setAttribute('aria-pressed','false');box.append(light);
      const people=document.createElement('details');people.id='radioAudience';
      people.innerHTML='<summary title="Кто слушает радио"><span aria-hidden="true">♬</span><b id="radioCount">—</b><span id="radioPreview"></span></summary><div class="radio-audience-pop"><strong>Сейчас слушают</strong><ul id="radioListeners"></ul></div>';
      box.append(people);
      const addSong=button('＋ Песня',uploadDialog);addSong.id='radioAddSong';addSong.title='Добавить свои песни в общую очередь';box.append(addSong);
      if(window.HubCinema){const cinema=button('Кинозал',()=>{if(listening){listening=false;release();setLights(false);draw(false);}HubCinema.open();});cinema.id='cinemaButton';cinema.title='Кинотеатр команды';box.append(cinema);}
      tools.before(box);
      const glow=document.createElement('div');glow.id='radioGlow';glow.hidden=true;glow.setAttribute('aria-hidden','true');document.body.append(glow);
      document.addEventListener('pointerdown',e=>{if(people.open&&!people.contains(e.target))people.open=false;});
      people.addEventListener('keydown',e=>{if(e.key==='Escape'){people.open=false;people.querySelector('summary').focus();}});
    }
    showAudience(null);connectAudience(session);
    volumeControl=HubMediaVolume.mount($('radioVolumeControls'),player,{id:'radioVolume',label:'радио',key:'hub-radio-volume:'+session.username,initial:40});
    draw(false);$('radioToggle').onclick=()=>{listening=!listening;if(!listening){release();setLights(false);}draw(false);if(listening)pull();};
    $('radioFiles').onchange=upload;$('radioBroadcast').onclick=()=>control(station?.playing?'pause':'play');
    $('radioPrev').onclick=()=>control('previous');$('radioNext').onclick=()=>control('next');
    $('radioSeek').onchange=e=>control('seek',{id:station?.current,position:Number(e.target.value)});
    $('radioTabButton').onclick=()=>{pull();loadLibrary();};$('radioMore').onclick=()=>loadLibrary(true);
    player.onloadedmetadata=()=>sync().catch(e=>say(e.message));
    player.onended=pull;player.onerror=()=>{if(listening&&loadedId){release();say('Не удалось получить аудио. Переподключаемся к эфиру.');}};
    timer=setInterval(()=>{if(listening||owner()&&$('tab-radio').classList.contains('active'))pull();},2000);
    if(owner()){pull();loadLibrary();if(session.radioPC)session.radioPC.connect(session.token).catch(e=>{if(cfg===session)say(e.message);});}
  }
  window.addEventListener('pagehide',stop);
  window.HubRadio={start,stop};
})();
