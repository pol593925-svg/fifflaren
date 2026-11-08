(function(root){
 'use strict';
 const stageNames={connecting:'Подключение',map:'Карта и окружение',models:'Руки и оружие',shaders:'Подготовка графики',ready:'Готов',error:'Нужен повтор'};
 const maps={dust2:{title:'Лазурный квартал',code:'DUST II',detail:'Тёплый камень. Тихие переулки. Две точки решают всё.'},
  inferno:{title:'Солнечная гавань',code:'INFERNO',detail:'Арки, крыши и подземные пути. Держитесь вместе.'}};
 function create({parent,getMap,getNick,send,leave,retry}){
  function node(tag,cls,parent,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;parent?.append(el);return el;}
  const root=node('section','cs16-loading',parent);root.setAttribute('aria-label','Подготовка матча');
  const backdrop=node('div','csload-backdrop',root),shell=node('div','csload-shell',root);
  const header=node('header','csload-header',shell);
  const brand=node('div','csload-brand',header);node('span','',brand,'SUPPORT HUB');node('small','',brand,'ВСТРЕЧА КОМАНД');
  const rules=node('div','csload-rules',header,'5 × 5  /  ПО РАУНДАМ');
  const exit=node('button','csload-exit',header,'Выйти в лобби');exit.type='button';exit.onclick=()=>{if(notice){notice='';draw();}else leave();};
  const body=node('div','csload-body',shell);
  function team(side,label,letter){
   const panel=node('section','csload-team csload-'+side,body),head=node('header','csload-team-head',panel);
   node('b','csload-team-symbol',head,letter);const caption=node('div','',head);node('small','',caption,'КОМАНДА '+letter);node('h2','',caption,label);
   const list=node('div','csload-roster',panel);return {panel,list,rows:new Map()};
  }
  const t=team('t','Атака','T');
  const center=node('div','csload-center',body);
  const emblem=node('div','csload-emblem',center);node('span','',emblem,'A');node('i','',emblem);node('span','',emblem,'B');
  const code=node('div','csload-map-code',center),title=node('h1','',center),desc=node('p','csload-description',center);
  const count=node('div','csload-count',center,'Подготовка карты');
  count.setAttribute('role','status');
  const clock=node('div','csload-countdown',center);clock.hidden=true;
  const hint=node('p','csload-hint',center,'Матч начнётся, когда обе команды будут готовы.');
  const ct=team('ct','Защита','CT');
  const footer=node('footer','csload-footer',shell),local=node('div','csload-local',footer);
  const localHead=node('div','csload-local-head',local),status=node('span','',localHead,'Подготовка карты'),value=node('b','',localHead,'0%');
  status.setAttribute('role','status');
  const track=node('div','csload-track',local),fill=node('i','',track);
  track.setAttribute('role','progressbar');track.setAttribute('aria-label','Готовность вашей игры');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
  const stages=node('div','csload-stages',local);
  const steps=['Карта','Модели','Графика','Готово'].map(text=>node('span','',stages,text));
  const bottom=node('div','csload-bottom',footer);
  const note=node('p','',bottom,'Готовим графику заранее, чтобы начать бой вместе.');
  const retryButton=node('button','csload-retry',bottom,'Повторить загрузку');retryButton.type='button';retryButton.hidden=true;retryButton.onclick=retry;
  let localMap=getMap(),percent=0,stage='map',gate=null,participating=false,offline=false,ticker=null,lastReport='',offset=0,notice='';
  function row(list,p){
   let r=list.rows.get(p.id);
   if(!r){
    const el=node('article','csload-player',list.list),avatar=node('img','csload-avatar',el);avatar.alt='';avatar.decoding='async';
    const info=node('div','csload-player-info',el),line=node('div','csload-player-line',info);
    const name=node('strong','',line),amount=node('b','csload-player-value',line);
    const detail=node('div','csload-player-stage',info),bar=node('div','csload-track',info),barFill=node('i','',bar);
    r={el,avatar,name,amount,detail,barFill};list.rows.set(p.id,r);
   }
   const profile=rootWindow.CS16Characters?.profiles[p.characterId],id=profile?p.characterId:'classic';
   const image='assets/cs16/'+id+'.png';if(r.avatar.getAttribute('src')!==image)r.avatar.src=image;
   r.name.textContent=p.nick;r.name.title=p.nick;
   r.amount.textContent=p.percent+'%';
   r.detail.textContent=(p.bot?'БОТ · ':p.nick===getNick()?'ВЫ · ':'')+(stageNames[p.stage]||stageNames.connecting);
   r.barFill.style.transform='scaleX('+p.percent/100+')';
   r.el.classList.toggle('is-ready',!!p.ready);r.el.classList.toggle('is-you',p.nick===getNick());
   r.el.setAttribute('aria-label',p.nick+': '+p.percent+'%, '+(stageNames[p.stage]||''));
  }
  function roster(list,side){
   const members=(gate?.players||[]).filter(p=>p.team===side);
   for(const [id,r] of list.rows)if(!members.some(p=>p.id===id)){r.el.remove();list.rows.delete(id);}
   for(const p of members)row(list,p);
   let empty=list.list.querySelector('.csload-empty');
   if(!members.length){if(!empty)empty=node('div','csload-empty',list.list,'Состав появится при старте матча');}else empty?.remove();
  }
  function report(reset=false){
   if(!gate||!participating||offline||gate.map!==localMap)return;
   const data={id:gate.id,map:localMap,percent,stage,ready:percent===100&&stage==='ready',reset};
   const key=JSON.stringify(data);if(key===lastReport&&!reset)return;
   lastReport=key;send(data);
  }
  function drawClock(){
   if(!gate||!participating||offline)return;
   const all=gate.players.length,ready=gate.players.filter(p=>p.ready).length;
   count.textContent=ready+' / '+all+' готовы';
   if(gate.startAt){
    clock.hidden=false;clock.textContent=String(Math.max(1,Math.ceil((gate.startAt-Date.now()-offset)/1000)));
    hint.textContent='Все на месте. Приготовьтесь к первому раунду.';
    note.textContent='После отсчёта будет время на покупку оружия.';
   }else{
    clock.hidden=true;
    const waiting=gate.players.filter(p=>!p.ready).map(p=>p.nick);
    hint.textContent=waiting.length?'Ожидаем: '+waiting.join(', '):'Подтверждаем готовность команд…';
    const seconds=Math.max(0,Math.ceil((gate.deadline-Date.now()-offset)/1000));
    note.textContent='Ожидание игроков · до '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'. Если загрузка не завершится, вернёмся в лобби.';
   }
  }
  function draw(){
   const visible=percent<100||(gate&&participating)||!!notice;
   root.style.display=visible?'flex':'none';
   if(visible&&!ticker)ticker=setInterval(drawClock,250);
   if(!visible&&ticker){clearInterval(ticker);ticker=null;}
   const map=maps[getMap()]||maps.dust2;
   root.dataset.map=getMap();code.textContent=map.code;title.textContent=map.title;desc.textContent=map.detail;
   value.textContent=percent+'%';fill.style.transform='scaleX('+percent/100+')';track.setAttribute('aria-valuenow',String(percent));
   steps.forEach((el,i)=>el.classList.toggle('is-done',percent>=[46,80,98,100][i]));
   roster(t,'t');roster(ct,'ct');
   exit.hidden=!participating&&!notice;root.classList.toggle('is-offline',offline);
   if(notice){count.textContent='Подготовка остановлена';clock.hidden=true;hint.textContent=notice;note.textContent='Вернитесь в лобби, проверьте подключение и повторите старт.';}
   else if(offline){count.textContent='Связь потеряна';clock.hidden=true;hint.textContent='Переподключаемся к серверу…';}
   else if(gate&&participating)drawClock();
   else{count.textContent='Подготовка карты';clock.hidden=true;hint.textContent='Загружаем окружение и снаряжение.';note.textContent='Готовим графику заранее, чтобы начать бой вместе.';}
  }
  const rootWindow=window;
  return {root,status,retry:retryButton,
   progress(value,nextStage,text){if(value===0)notice='';localMap=getMap();percent=Math.max(0,Math.min(100,Math.floor(value)));stage=nextStage;status.textContent=text||stageNames[stage];retryButton.hidden=stage!=='error';report(value===0);draw();},
   state(state,socketId){participating=!!state.players?.some(p=>(p.id===socketId||p.nick===getNick())&&['t','ct'].includes(p.team));
    offline=false;this.gate(state.phase==='loading'?state.loading:null);},
   gate(data){
    if(data&&data.map!==getMap())return;
    const old=gate?.id;gate=data;if(data)notice='';
    if(old!==gate?.id)lastReport='';
    if(gate?.now)offset=gate.now-Date.now();
    // Retry a report lost during a transient transport disconnect/roster change.
    if(gate?.players?.some(p=>p.nick===getNick()&&p.percent<percent))lastReport='';
    report();draw();
   },
   disconnected(){offline=true;lastReport='';draw();},
   error(message){gate=null;notice=String(message);draw();},
   dismiss(){gate=null;participating=false;draw();},
  };
 }
 root.CS16Loading={create};
})(window);
