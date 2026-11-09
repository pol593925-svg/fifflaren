/* Coast menu. Existing controls and socket handlers are moved, never duplicated. */
(function (g) {
  'use strict';
  let active = 'plaza', weapon = 'm4a1', teardown = null, scroll = 0, refresh = null;
  const labels = {plaza:'Площадь',squad:'Отряд',arsenal:'Арсенал',character:'Персонаж',settings:'Настройки'};
  const text = (tag, content, cls) => {const e=document.createElement(tag);e.textContent=content;if(cls)e.className=cls;return e;};
  function button(label, fn, cls='') {const b=text('button',label,cls);b.type='button';b.onclick=fn;return b;}
  function stop(){if(teardown){teardown();teardown=null;}}
  function capture(root){scroll=root?.querySelector('.coast-content')?.scrollTop||0;refresh=null;stop();}
  function weaponPreview(host, api) {
    const T=g.THREE;let renderer,gun,environment,drag=null,disposed=false,raf=0,watch;
    const status=text('small','Перетаскивай мышью, чтобы осмотреть модель');host.append(status);
    try {
      renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(1,g.devicePixelRatio||1));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      const canvas=renderer.domElement;canvas.setAttribute('aria-label','Осмотр оружия');canvas.tabIndex=0;host.prepend(canvas);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.01,10),pivot=new T.Group();scene.add(pivot);
      scene.add(new T.HemisphereLight(0xf4ead9,0x585a52,2.5));const sun=new T.DirectionalLight(0xffeed9,3.5);sun.position.set(1,2,2);scene.add(sun);
      const studio=new T.Scene();studio.background=new T.Color(0x8f998e);
      const softbox=new T.Mesh(new T.PlaneGeometry(6,4),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}));softbox.position.set(0,3,3);softbox.lookAt(0,0,0);studio.add(softbox);
      const pmrem=new T.PMREMGenerator(renderer);environment=pmrem.fromScene(studio,.04,.1,20);scene.environment=environment.texture;pmrem.dispose();softbox.geometry.dispose();softbox.material.dispose();
      gun=api.gun(weapon);if(!gun?.children.length)throw Error('Модель пока загружается');pivot.add(gun);
      const bounds=new T.Box3().setFromObject(gun),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());gun.position.sub(center);pivot.rotation.y=-1.72;pivot.rotation.x=.08;
      camera.position.set(0,.04,Math.max(.55,size.length()*1.18));camera.lookAt(0,0,0);
      const draw=()=>{raf=0;if(!disposed&&host.isConnected&&!document.hidden&&host.getClientRects().length)renderer.render(scene,camera);};
      const request=()=>{if(!raf)raf=requestAnimationFrame(draw);};
      watch=new ResizeObserver(()=>{const w=Math.min(760,host.clientWidth||400),h=Math.min(350,Math.max(220,w*.52));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();request();});watch.observe(host);
      canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
      canvas.onpointermove=e=>{if(!drag)return;pivot.rotation.y+=(e.clientX-drag[0])*.008;pivot.rotation.x=Math.max(-.7,Math.min(.7,pivot.rotation.x+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];request();};
      canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
      canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();pivot.rotation.y+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;pivot.rotation.x+=e.key==='ArrowUp'?-.08:e.key==='ArrowDown'?.08:0;request();};
      request();
    }catch(e){status.textContent=e.message||'Осмотр временно недоступен';}
    return ()=>{disposed=true;cancelAnimationFrame(raf);watch?.disconnect();if(gun)api.disposeGun(gun);environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();};
  }
  function mount(root, api) {
    stop();const old=root.firstElementChild;if(!old)return;
    const pick=s=>old.querySelector(s), heroes=pick('.cs16-character-panel'), classes=pick('.cs16-class-panel'), teams=pick('.cs16-teamCards'), controls=pick('.cs16-matchControls'), skins=pick('#cs16SkinsPanel'), royale=pick('.cs16-br-entry');
    const config=pick('.cs16MapBtn')?.parentElement.parentElement, guide=old.lastElementChild, hint=pick('.cs16-adminHint');
    const start=pick('#cs16StartBtn'), skinToggle=pick('#cs16SkinsBtn');
    root.classList.add('coast-menu');root.replaceChildren();
    const shell=text('section','','coast-shell'),header=text('header','','coast-header'),brand=text('div','','coast-brand');
    brand.append(text('small','SUPPORT HUB / COUNTER-STRIKE'),text('strong','КАМЕННЫЙ БЕРЕГ'));header.append(brand);
    const nav=text('nav','','coast-nav');nav.setAttribute('aria-label','Меню КС');header.append(nav);
    const content=text('main','','coast-content'),footer=text('footer','','coast-footer');shell.append(header,content,footer);root.append(shell);
    const sections={};for(const key of Object.keys(labels)){const panel=text('section','','coast-page coast-'+key);panel.dataset.page=key;sections[key]=panel;content.append(panel);}
    const go=key=>{if(!sections[key])return;stop();active=key;scroll=0;shell.dataset.scene=key==='arsenal'?'arsenal':key==='squad'?'squad':'plaza';content.scrollTop=0;for(const[k,p]of Object.entries(sections))p.hidden=k!==key;for(const b of nav.children)b.setAttribute('aria-current',b.dataset.page===key?'page':'false');if(key==='arsenal'){preview.replaceChildren();teardown=weaponPreview(preview,api);}};
    for(const [key,label]of Object.entries(labels)){const b=button(label,()=>go(key));b.dataset.page=key;nav.append(b);}
    const home=text('div','','coast-home');home.append(text('small','СОЛНЦЕ. КАМЕНЬ. ТВОЯ КОМАНДА.','coast-eyebrow'),text('h1','Встретимся на площади'),text('p','Собери отряд, выбери снаряжение — и выходи на улицы Каменного Берега.'),button('ИГРАТЬ  →',()=>go('squad'),'coast-play'),button('Осмотреть снаряжение',()=>go('arsenal'),'coast-secondary'));
    sections.plaza.append(home);
    const modeBar=text('div','','coast-modes');for(const b of config?.querySelectorAll('.cs16GmBtn')||[]){const q=button(b.textContent.replace(/^[^А-ЯA-Z]+/,''),()=>{go('squad');b.click();});q.dataset.mode=b.dataset.g;q.classList.toggle('selected',api.state.gm===b.dataset.g);modeBar.append(q);}if(royale)modeBar.append(button('Королевская битва',()=>royale.click()));sections.plaza.append(modeBar);
    const squadBox=text('div','','coast-panel coast-squad-panel');squadBox.append(text('small','СОБРАТЬ ОТРЯД','coast-eyebrow'),text('h2',api.map+' · '+api.mode));
    if(api.state.phase!=='lobby')squadBox.append(text('p','Матч уже идёт. Выбери команду, чтобы присоединиться.','coast-notice'));
    if(teams)squadBox.append(teams);if(controls)squadBox.append(controls);if(skinToggle)skinToggle.remove();
    if(start){start.disabled=api.nick!==api.state.host||api.state.phase!=='lobby';start.title=start.disabled?'Матч запускает хост из лобби':'';start.textContent=api.state.phase!=='lobby'?'Матч уже идёт':api.nick!==api.state.host?'Ожидаем хоста':'НАЧАТЬ МАТЧ  →';}
    const bots=config?.querySelector('.cs16-bot-controls');if(bots)squadBox.append(bots);
    const settings=text('details','','coast-match-settings');settings.open=false;settings.append(text('summary','Выбор карты'));if(config)settings.append(config);squadBox.append(settings);if(hint)squadBox.append(hint);if(royale)squadBox.append(royale);sections.squad.append(squadBox);
    const armory=text('div','','coast-arsenal-layout'),inspect=text('div','','coast-panel coast-inspect'),preview=text('div','','coast-preview');
    inspect.append(text('small','ТВОЙ АРСЕНАЛ','coast-eyebrow'),text('h2','Детали решают'));
    const selector=document.createElement('select');selector.setAttribute('aria-label','Оружие для осмотра');for(const[id,w]of Object.entries(api.weapons)){if(!api.hasGun(id))continue;selector.add(new Option(w.name||id.toUpperCase(),id));}if(![...selector.options].some(o=>o.value===weapon))weapon=selector.options[0]?.value||'m4a1';selector.value=weapon;selector.onchange=()=>{weapon=selector.value;stop();preview.replaceChildren();teardown=weaponPreview(preview,api);};inspect.append(selector,preview,text('p','Осмотр не покупает оружие. Во время боя магазин открывается на B.','coast-note'));armory.append(inspect);
    if(skins){skins.style.display='block';skins.classList.add('coast-panel');armory.append(skins);}sections.arsenal.append(armory);
    if(heroes)sections.character.append(heroes);if(classes)sections.character.append(classes);
    const prefs=text('div','','coast-panel coast-preferences');prefs.append(text('h2','Настройки и управление'));
    const qLabel=text('label','Качество графики'),quality=api.quality.cloneNode(true);quality.removeAttribute('id');quality.setAttribute('aria-label','Качество графики в меню');quality.value=api.quality.value;quality.onchange=()=>{api.quality.value=quality.value;api.quality.onchange();};qLabel.append(quality);prefs.append(qLabel,text('p','Авто подстраивает качество под нагрузку. В режиме «Производительность» ниже разрешение и отключены тени.','coast-note'));if(guide&&!guide.classList.contains('cs16-class-panel'))prefs.append(guide);sections.settings.append(prefs);
    const my=api.state.players.find(p=>p.nick===api.nick),character=g.CS16Characters.profiles[my?.characterId||api.character];
    const profile=text('div','','coast-profile');profile.append(text('strong',api.nick),text('small',(character?.name||'Оператор')+' · '+(my?.team==='ct'?'CT':my?.team==='t'?'T':'Без команды')));
    const roster=button('ОТРЯД  '+api.state.players.length+'  →',()=>go('squad'),'coast-roster');
    const hostInfo=text('span',api.state.host?'Хост: '+api.state.host:'Подключаемся к комнате…','coast-note');footer.append(profile,hostInfo,roster);
    refresh=()=>{if(active==='arsenal'&&root.getClientRects().length&&root.style.display!=='none')go(active);};
    const before=scroll;go(active);content.scrollTop=before;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else refresh?.();});
  g.CS16Menu={mount,capture,stop,refresh:()=>refresh?.()};
})(window);
