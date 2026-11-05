(() => {
  'use strict';
  let session,room,socket,timer,show,received=0,openId=0,requested='',retryAt=0,blocked=false,attempting=false;
  let movies=[],nextPage=null,librarySerial=0,previewSerial=0,previewing=false;
  const messages=new Map(),seenPosters=new Map(),$=id=>room.querySelector('#'+id),owner=()=>session?.username.toLowerCase()==='fifflaren';
  let posterSocket,banner,bannerTimer,voice,ownsBrowserFullscreen=false;
  function posterNotice(cfg,p){
    if(cfg!==session||!cfg.notify||!Number.isSafeInteger(p?.id)||p.id<1||typeof p.title!=='string'||!Number.isFinite(p.startsAt))return;
    const nick=cfg.username.toLowerCase(),key='hub-cinema-poster:'+nick;
    let seen=seenPosters.get(nick)||0;try{seen=Math.max(seen,Number(localStorage.getItem(key))||0);}catch{}
    if(seen>=p.id)return;
    const when=new Date(p.startsAt).toLocaleString('ru',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
    const text=(p.phase==='playing'?'Показ уже идёт. Начало — ':'Начало — ')+when+'. Нажми, чтобы войти в кинозал.';
    cfg.notify({kind:'cinema',username:nick,title:'Афиша · '+p.title,text});
    seenPosters.set(nick,p.id);try{localStorage.setItem(key,String(p.id));}catch{}
  }
  function openNotice(nick){
    if(!session||session.username.toLowerCase()!==nick)return;
    const entry=document.getElementById('cinemaButton');if(entry)entry.click();else open();
  }
  function fallback(p){
    if(!session||session.username.toLowerCase()!==p?.username)return;
    clearTimeout(bannerTimer);banner?.remove();banner=document.createElement('button');
    banner.type='button';banner.className='cinema-notice';banner.setAttribute('role','status');
    banner.textContent=p.title+' · '+p.text;banner.onclick=()=>{banner.remove();openNotice(p.username);};
    document.body.append(banner);bannerTimer=setTimeout(()=>banner?.remove(),20000);
  }
  const clock=()=>show.now+performance.now()-received;
  const stamp=seconds=>[Math.floor(seconds/3600),Math.floor(seconds/60)%60,Math.floor(seconds)%60].map(x=>String(Math.max(0,x)).padStart(2,'0')).join(':');
  async function api(path,body,method=body?'POST':'GET'){
    const cfg=session;const r=await fetch(cfg.server+'/api/cinema/'+path,{method,headers:{Authorization:'Bearer '+cfg.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const data=await r.json();if(cfg!==session)throw Error('Смена аккаунта.');if(!r.ok)throw Error(data.message||'Кинозал временно недоступен.');return data;
  }
  const notice=t=>{$('cinNote').textContent=t;};
  function update(state){
    if(show&&(state.rev<show.rev||state.rev===show.rev&&state.now<show.now))return;
    show=state;received=performance.now();tick();
  }
  function stopVideo(){const v=$('cinVideo');v.pause();if(v.hasAttribute('src')){v.removeAttribute('src');v.load();}requested='';blocked=false;attempting=false;$('cinUnmute').hidden=true;}
  async function source(id){
    const epoch=openId;stopVideo();requested=id;
    try{const {ticket}=await api('video/'+id+'/ticket',{});if(openId!==epoch||requested!==id)return;
      $('cinVideo').src=session.server+'/api/cinema/video/'+id+'?ticket='+encodeURIComponent(ticket);
    }catch(e){if(openId===epoch&&requested===id){retryAt=performance.now()+5000;requested='';notice(e.message);}}
  }
  function play(){
    if(attempting||blocked)return;
    const epoch=openId,id=requested;attempting=true;
    $('cinVideo').play().catch(e=>{
      if(epoch!==openId||requested!==id||e.name==='AbortError')return;
      blocked=true;$('cinUnmute').hidden=false;notice(e.name==='NotAllowedError'?'Нажми «Смотреть со звуком», чтобы подключить воспроизведение.':'Этот видеофайл не воспроизводится.');
    }).finally(()=>{if(epoch===openId&&requested===id)attempting=false;});
  }
  function tick(){
    if(!room?.open||!show)return;
    const now=clock(),waiting=show.startsAt>now,film=show.film,seconds=waiting?Math.ceil((show.startsAt-now)/1000):0;
    const elapsed=show.startsAt?Math.max(0,(now-show.startsAt)/1000):show.position+(show.playing?Math.max(0,now-show.now)/1000:0);
    const pos=film?Math.min(film.duration,elapsed):0,playing=!!film&&!waiting&&(show.startsAt>0||show.playing)&&pos<film.duration;
    $('cinTitle').textContent=show.title||'Скоро на экране';
    $('cinWhen').textContent=show.startsAt?'Начало · '+new Date(show.startsAt).toLocaleString('ru',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'Общий кинозал Support Hub';
    $('cinPhase').textContent=waiting?'До начала показа':!film?'Ожидаем показ':pos>=film.duration?'Показ завершён':playing?'Сейчас в эфире':'Пауза';
    $('cinClock').textContent=waiting?stamp(seconds):film?stamp(pos)+' / '+stamp(film.duration):'—';
    const v=$('cinVideo');v.hidden=!film||waiting;room.classList.toggle('cin-screening',!v.hidden);
    $('cinVideoFull').hidden=v.hidden;$('cinQuality').textContent=!v.hidden&&v.videoWidth?'Оригинал · '+v.videoWidth+' × '+v.videoHeight:'';
    $('cinSeek').max=film?.duration||1;if(document.activeElement!==$('cinSeek'))$('cinSeek').value=pos;
    for(const id of ['cinPlay','cinPause','cinSeek'])$(id).disabled=!film;
    $('cinAttach').disabled=!show.title||!!film;
    if(!film){if(requested)stopVideo();return;}
    if(requested!==film.id){if(performance.now()>=retryAt)source(film.id);return;}
    if(previewing){if(!v.paused)v.pause();return;}
    if(!v.readyState)return;
    if(Math.abs(v.currentTime-pos)>.65&&!v.seeking)v.currentTime=pos;
    if(!playing){if(!v.paused)v.pause();return;}if(v.paused&&!v.ended)play();
  }
  function log(rows){
    for(const m of rows)messages.set(m.id,m);
    const sorted=Array.from(messages.values()).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));messages.clear();
    const list=$('cinMessages'),stick=list.scrollHeight-list.scrollTop-list.clientHeight<40;
    const fragment=document.createDocumentFragment();
    for(const m of sorted.slice(-100)){messages.set(m.id,m);const row=document.createElement('li'),name=document.createElement('b'),t=document.createElement('span');name.textContent=m.nick;t.textContent=m.text;row.append(name,t);fragment.append(row);}
    list.replaceChildren(fragment);if(stick)list.scrollTop=list.scrollHeight;
  }
  async function library(more=false){
    const seq=++librarySerial,epoch=openId;
    try{const result=await api('library'+(more&&nextPage?'?before='+nextPage:''));if(epoch!==openId||seq!==librarySerial)return;
      movies=more?movies.concat(result.tracks):result.tracks;nextPage=result.before;const sel=$('cinFilms'),old=sel.value;
      sel.replaceChildren(new Option('Только анонс, без файла',''));for(const f of movies)sel.add(new Option(f.title,f.id));if(movies.some(f=>f.id===old))sel.value=old;
      if(result.space){
        const space=result.space,fmt=n=>(n/1e9).toLocaleString('ru',{maximumFractionDigits:2});
        $('cinSpace').textContent='Занято '+fmt(space.used)+' из '+fmt(space.limit)+' ГБ · свободно '+fmt(Math.max(0,space.limit-space.used))+' ГБ. '+(space.online?'ПК на связи.':'ПК с библиотекой не подключён.');
        $('cinBind').disabled=space.online;
      }
      selection();$('cinMore').hidden=!nextPage;
    }catch(e){if(epoch===openId)notice(e.message);}
  }
  async function control(op){
    if(!show)return;const epoch=openId;
    try{const state=await api('control',{op,rev:show.rev,title:$('cinName').value,minutes:Number($('cinDelay').value),film:$('cinFilms').value,position:Number($('cinSeek').value)});if(epoch===openId){notice('');update(state);}}
    catch(e){if(epoch===openId){notice(e.message);try{const fresh=await api('state');if(epoch===openId)update(fresh);}catch{}}}
  }
  function selection(){
    const film=movies.find(f=>f.id===$('cinFilms').value);$('cinTest').disabled=$('cinDelete').disabled=!film;
    $('cinFileInfo').textContent=film?[film.width&&film.height?film.width+' × '+film.height:'',film.size?(film.size/1e6).toLocaleString('ru',{maximumFractionDigits:1})+' МБ':'',film.storage==='pc'?'На ПК Fifflaren':'Ранее загружен'].filter(Boolean).join(' · '):'';
  }
  async function inspectFile(file){
    const v=document.createElement('video'),src=URL.createObjectURL(file);
    try{return await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('Не удалось прочитать видео.')),30000);
      v.onloadedmetadata=()=>{clearTimeout(timer);const meta={duration:v.duration,width:v.videoWidth,height:v.videoHeight};
        if(meta.width&&meta.height&&Number.isFinite(meta.duration)&&meta.duration>0)ok(meta);else no(Error('Не удалось определить размер кадра и длительность.'));
      };
      v.onerror=()=>{clearTimeout(timer);no(Error('Файл не воспроизводится. Нужен MP4 или WebM с поддерживаемым кодеком.'));};v.preload='metadata';v.src=src;
    });}finally{v.onloadedmetadata=v.onerror=null;v.removeAttribute('src');v.load();URL.revokeObjectURL(src);}
  }
  function closeTest(){
    ++previewSerial;previewing=false;const v=$('cinTestVideo');v.pause();if(v.hasAttribute('src')){v.removeAttribute('src');v.load();}$('cinTestPanel').hidden=true;
  }
  async function testFilm(){
    const item=movies.find(f=>f.id===$('cinFilms').value);if(!owner()||!item)return;
    closeTest();const token=previewSerial,epoch=openId;previewing=true;$('cinVideo').pause();
    $('cinTestPanel').hidden=false;$('cinTestState').textContent='Проверяем поток · '+item.title;
    try{const clip=await api('video/'+item.id+'/ticket',{});if(token!==previewSerial||epoch!==openId)return;
      const v=$('cinTestVideo');v.src=session.server+'/api/cinema/video/'+item.id+'?ticket='+encodeURIComponent(clip.ticket);await v.play();
    }catch(e){if(token===previewSerial&&epoch===openId)$('cinTestState').textContent=e.name==='NotAllowedError'?'Нажми ▶ в тестовом плеере.':'Тест не запустился: '+e.message;}
  }
  function fullscreen(on){
    if(!room)return;
    room.classList.toggle('cin-max',on);$('cinFull').textContent=on?'Оконный режим':'Во весь экран';
    if(session?.cinemaFullscreen){session.cinemaFullscreen(on);return;}
    if(on&&!document.fullscreenElement){
      const epoch=openId;
      document.documentElement.requestFullscreen?.().then(()=>{
        if(epoch!==openId||!room.open){document.exitFullscreen().catch(()=>{});return;}
        ownsBrowserFullscreen=true;
      }).catch(()=>{});
    }else if(!on&&ownsBrowserFullscreen){
      ownsBrowserFullscreen=false;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    }
  }
  function build(){
    room=document.createElement('dialog');room.id='hubCinema';room.setAttribute('aria-labelledby','cinTitle');
    room.innerHTML=`<header><span>SUPPORT HUB · КИНОЗАЛ КОМАНДЫ</span><button type="button" id="cinExit" aria-label="Выйти из зала">✕</button></header>
      <div class="cin-layout"><main><section class="cin-marquee"><small>АФИША КИНОЗАЛА</small><h2 id="cinTitle">Скоро на экране</h2><p id="cinWhen"></p><strong id="cinPhase"></strong><output id="cinClock">—</output></section>
      <video id="cinVideo" preload="metadata" playsinline hidden></video><div class="cin-sound"><button id="cinUnmute" hidden>Смотреть со звуком</button><label>Громкость <input id="cinVolume" type="range" min="0" max="100" value="70"></label><button id="cinFull">Во весь экран</button><button id="cinVideoFull" hidden>Развернуть фильм</button><small id="cinQuality"></small></div>
      <p id="cinNote" role="status"></p><details id="cinHost"><summary>Управление показом · Fifflaren</summary><div>
      <button id="cinBind" type="button">Подключить этот ПК</button><small id="cinSpace">Библиотека · 10 ГБ</small>
      <small>Выбери файл на диске, проверь его кнопкой «Проверить показ», затем объяви сеанс. Во время показа Support Hub должен работать на этом ПК.</small><label>Добавить с моего ПК <input id="cinFiles" type="file" accept="video/mp4,video/webm,.mp4,.webm" multiple></label><small id="cinProgress"></small>
      <label>Фильм из библиотеки <select id="cinFilms"></select></label><button id="cinMore" hidden>Ещё фильмы</button><small id="cinFileInfo"></small>
      <div class="cin-actions"><button id="cinTest" type="button">Проверить показ</button><button id="cinDelete" type="button">Удалить из библиотеки</button></div>
      <section id="cinTestPanel" hidden><strong>Пробный показ · только для тебя</strong><video id="cinTestVideo" controls playsinline></video><small id="cinTestState"></small><button id="cinTestClose" type="button">Закрыть проверку</button></section>
      <label>Название на афише <input id="cinName" maxlength="160" placeholder="Название показа"></label><label>Минут до начала <input id="cinDelay" type="number" min="0" max="43200" value="15"></label>
      <div class="cin-actions"><button id="cinSchedule">Объявить показ</button><button id="cinAttach">Прикрепить к анонсу</button><button id="cinPlay">Пуск</button><button id="cinPause">Пауза</button><button id="cinClear">Снять с афиши</button></div>
      <label>Перемотать <input id="cinSeek" type="range" min="0" step="1"></label></div></details></main>
      <aside><section class="cin-voice"><h3>Голосовой звонок</h3><small id="cinVoicePeople">В звонке пока никого</small><div><button type="button" id="cinVoiceJoin">Присоединиться к звонку</button><button type="button" id="cinVoiceMute" hidden>Выключить микрофон</button><button type="button" id="cinVoiceLeave" hidden>Выйти из звонка</button></div></section><h3>Чат кинозала</h3><ol id="cinMessages" aria-label="Сообщения зала"></ol><form id="cinChat"><input id="cinText" placeholder="Сообщение в зал…" maxlength="600" aria-label="Сообщение"><button type="submit">Отправить</button></form></aside></div>`;
    document.body.append(room);$('cinExit').onclick=()=>room.close();room.addEventListener('close',cleanup);
    $('cinVideo').crossOrigin='anonymous';$('cinVideo').volume=.7;$('cinVolume').oninput=e=>{$('cinVideo').volume=e.target.value/100;};
    $('cinVideo').onloadedmetadata=tick;$('cinVideo').onerror=()=>{if(!requested)return;notice('Не удалось воспроизвести фильм. Проверь подключение ПК Fifflaren и видеокодек.');retryAt=performance.now()+8000;stopVideo();};
    $('cinUnmute').onclick=()=>{blocked=false;$('cinUnmute').hidden=true;notice('');play();};
    $('cinFull').onclick=()=>fullscreen(!room.classList.contains('cin-max'));
    for(const [id,op]of [['Schedule','schedule'],['Attach','attach'],['Play','play'],['Pause','pause'],['Clear','clear']])$('cin'+id).onclick=()=>control(op);
    $('cinSeek').onchange=()=>control('seek');$('cinMore').onclick=()=>library(true);
    $('cinVideoFull').onclick=()=>{const v=$('cinVideo');(document.fullscreenElement===v?document.exitFullscreen():v.requestFullscreen()).catch(e=>notice(e.message));};
    $('cinBind').onclick=async()=>{try{await session.cinemaPC.connect(session.token,true);notice('ПК подключён. Можно свернуть приложение во время показа.');await library();}catch(e){notice(e.message);}};
    $('cinFilms').onchange=()=>{closeTest();selection();};$('cinTest').onclick=testFilm;$('cinTestClose').onclick=closeTest;
    $('cinTestVideo').crossOrigin='anonymous';$('cinTestVideo').onloadeddata=()=>{const v=$('cinTestVideo');$('cinTestState').textContent='Оригинал · '+v.videoWidth+' × '+v.videoHeight+' · проверь звук и перемотку';};
    $('cinTestVideo').onerror=()=>{if(previewing)$('cinTestState').textContent='Нет видео. Проверь связь с ПК-источником и формат файла.';};
    $('cinDelete').onclick=async()=>{const item=movies.find(f=>f.id===$('cinFilms').value);if(!item||!window.confirm('Удалить «'+item.title+'» из библиотеки кинотеатра?'))return;
      try{closeTest();await api('library/'+item.id,null,'DELETE');await library();notice('Фильм удалён из библиотеки.');}catch(e){notice(e.message);}
    };
    $('cinFiles').onchange=async e=>{
      const input=e.target,files=[...input.files],cfg=session;input.disabled=true;let count=0;const errors=[];
      try{for(const file of files){if(cfg!==session)break;
        try{if(!cfg.cinemaPC)throw Error('Открой кинотеатр в приложении на ПК Fifflaren.');if(file.size>10e9)throw Error('Файл больше всей библиотеки (10 ГБ).');
          const meta=await inspectFile(file);await cfg.cinemaPC.connect(cfg.token,true);
          await cfg.cinemaPC.add(file,meta,p=>{$('cinProgress').textContent=file.name+' · '+p+'%';});count++;}catch(err){errors.push(file.name+' — '+err.message);}
      }if(cfg===session){$('cinProgress').textContent='Сохранено '+count+' из '+files.length+'. '+errors.join(' ');if(room.open)await library();}}
      finally{input.value='';input.disabled=false;}
    };
    $('cinChat').onsubmit=async e=>{e.preventDefault();const input=$('cinText'),text=input.value.trim(),epoch=openId;if(!text)return;
      if(!socket?.connected)return notice('Чат переподключается.');
      try{const answer=await socket.timeout(6000).emitWithAck('say',text);if(epoch!==openId)return;if(!answer.ok)throw Error(answer.error);if(input.value.trim()===text)input.value='';}
      catch(err){if(epoch===openId)notice(err.message);}
    };
  }
  function cleanup(){
    if(room?.open)return;closeTest();fullscreen(false);++openId;clearInterval(timer);voice?.close();voice=null;socket?.disconnect();socket=null;stopVideo();show=null;retryAt=0;
    messages.clear();$('cinMessages').replaceChildren();$('cinText').value='';$('cinHost').open=false;notice('');
  }
  function open(){
    if(!session?.token)return;if(!room)build();if(room.open)return;
    const epoch=++openId;room.showModal();fullscreen(true);$('cinHost').hidden=!owner();$('cinTitle').textContent='Афиша кинозала';$('cinClock').textContent='—';$('cinPhase').textContent='Подключаемся…';$('cinWhen').textContent='';$('cinVideo').hidden=true;
    const net=session.io(session.server+'/cinema',{auth:{token:session.token}});socket=net;
    voice=HubCinemaVoice.create(net,{join:$('cinVoiceJoin'),mute:$('cinVoiceMute'),leave:$('cinVoiceLeave'),people:$('cinVoicePeople')},notice);
    net.on('show',s=>{if(openId===epoch)update(s);});net.on('message',m=>{if(openId===epoch)log([m]);});net.on('history',rows=>{if(openId===epoch)log(rows);});
    net.on('connect',()=>notice(''));net.on('connect_error',e=>notice(e.message));net.on('disconnect',()=>{if(room.open)notice('Переподключаемся к залу…');});
    net.on('room_error',notice);
    let checks=0;timer=setInterval(()=>{tick();if(++checks%30===0)api('state').then(s=>{if(openId===epoch)update(s);}).catch(()=>{});},400);
    if(owner())library();
  }
  function stop(){
    if(owner())session?.cinemaPC?.stop();posterSocket?.disconnect();posterSocket=null;clearTimeout(bannerTimer);banner?.remove();
    if(room?.open){room.close();cleanup();}session=null;
  }
  function start(cfg){
    stop();session=cfg;if(!cfg?.token||!cfg.io)return;
    if(owner()&&cfg.cinemaPC)cfg.cinemaPC.connect(cfg.token,false).then(()=>{if(session===cfg&&room?.open)library();}).catch(e=>{if(session===cfg&&room?.open)notice(e.message);});
    posterSocket=cfg.io(cfg.server+'/cinema-posters',{auth:{token:cfg.token}});
    posterSocket.on('poster',p=>posterNotice(cfg,p));
  }
  window.HubCinema={start,open,stop,openNotice,fallback};
})();
