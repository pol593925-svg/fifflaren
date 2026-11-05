(() => {
  'use strict';
  const drinks=[{id:'cola',name:'Кола'},{id:'sprite',name:'Спрайт'},{id:'fanta',name:'Фанта'}];
  let cfg=null,admin=null,menu=null,popcorn=null,timer=null,audio=null,revision=0,serial=0,popping=false;
  const $=id=>document.getElementById(id),isOwner=()=>cfg?.username?.toLowerCase()==='fifflaren';
  async function request(body){
    const session=cfg;if(!session?.token)throw Error('Войди в Support Hub.');
    const res=await fetch(session.server+'/api/cinema/drinks',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const data=await res.json();if(cfg!==session)throw Error('Смена аккаунта.');if(!res.ok)throw Error(data.message||'Не удалось загрузить напитки.');return data;
  }
  function safeURL(value){
    try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}
  }
  async function loadAdmin(){
    if(!isOwner()||!admin)return;const turn=++serial;$('cinDrinkSave').disabled=true;$('cinDrinkStatus').textContent='Загрузка…';
    try{const data=await request();if(turn!==serial)return;revision=data.rev;
      for(const d of drinks)$('cinDrinkURL-'+d.id).value=data.links[d.id]||'';
      $('cinDrinkSave').disabled=false;$('cinDrinkStatus').textContent='Ссылки сохранены для всего кинозала. Пустое поле отключает напиток.';
    }catch(e){if(turn===serial)$('cinDrinkStatus').textContent=e.message;}
  }
  function buildAdmin(){
    const parent=document.querySelector('#tab-admin .admin-card');if(!parent)return;
    admin=document.createElement('section');admin.id='cinDrinkAdmin';admin.className='admin-section';
    admin.innerHTML='<h4>Напиток · кинозал</h4><p>Выбор напитка откроет указанный сайт в браузере сотрудника.</p><form id="cinDrinkForm"><div class="cin-drink-settings">'+drinks.map(d=>'<label><img src="assets/cinema/'+d.id+'.svg" alt=""><span>'+d.name+'</span><input id="cinDrinkURL-'+d.id+'" type="url" maxlength="2048" placeholder="https://…" aria-label="Ссылка — '+d.name+'"></label>').join('')+'</div><div class="cin-bar-actions"><button id="cinDrinkSave" type="submit">Сохранить ссылки</button><button id="cinDrinkRefresh" type="button">Обновить</button></div><p id="cinDrinkStatus" role="status"></p></form>';
    parent.prepend(admin);$('cinDrinkRefresh').onclick=loadAdmin;
    $('cinDrinkForm').onsubmit=async e=>{e.preventDefault();if(!isOwner())return;const session=cfg,turn=++serial;
      $('cinDrinkSave').disabled=true;$('cinDrinkRefresh').disabled=true;
      try{const links={};for(const d of drinks)links[d.id]=$('cinDrinkURL-'+d.id).value.trim();
        const data=await request({rev:revision,links});if(turn!==serial)return;revision=data.rev;
        $('cinDrinkStatus').textContent='Сохранено. Настройки применятся при следующем открытии напитков.';
      }catch(err){if(cfg===session)$('cinDrinkStatus').textContent=err.message;}
      finally{if(cfg===session){$('cinDrinkSave').disabled=false;$('cinDrinkRefresh').disabled=false;}}
    };
  }
  function closeSnacks(){
    if(menu?.open)menu.close();if(popcorn?.open)popcorn.close();cancelPopcorn();
  }
  function cancelPopcorn(){
    clearInterval(timer);timer=null;popping=false;if(audio){audio.close().catch(()=>{});audio=null;}
  }
  function readySound(){
    const ctx=audio;if(!ctx||ctx.state==='closed')return;
    [660,880,1100].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*.12;
      osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.065,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.19);
      osc.connect(gain).connect(ctx.destination);osc.start(at);osc.stop(at+.2);
    });
  }
  function pop(){
    if(popping)return;cancelPopcorn();popcorn.showModal();popping=true;
    $('cinPopTitle').textContent='Готовим попкорн';$('cinPopCount').hidden=false;$('cinPopCancel').textContent='Отмена';
    try{audio=new AudioContext();audio.resume().catch(()=>{});}catch{}
    const until=performance.now()+5000;
    const update=()=>{const left=Math.ceil((until-performance.now())/1000);$('cinPopCount').textContent=String(Math.max(0,left));
      if(left<=0){clearInterval(timer);timer=null;popping=false;$('cinPopTitle').textContent='Попкорн готов!';$('cinPopCount').hidden=true;$('cinPopCancel').textContent='Приятного просмотра';readySound();}
    };update();timer=setInterval(update,100);
  }
  async function openDrinks(){
    const session=cfg;if(!session?.token)return;menu.showModal();const cards=$('cinDrinkCards');cards.replaceChildren();$('cinDrinkMessage').textContent='Открываем кинобар…';
    try{const data=await request();if(cfg!==session||!menu.open)return;
      $('cinDrinkMessage').textContent='Выбери напиток — откроется сайт, заданный Fifflaren.';
      for(const d of drinks){
        const url=safeURL(data.links[d.id]),card=document.createElement('button');card.type='button';card.className='cin-drink-card';card.dataset.drink=d.id;card.disabled=!url;
        const img=document.createElement('img');img.src='assets/cinema/'+d.id+'.svg';img.alt=d.name;
        const label=document.createElement('strong');label.textContent=d.name;card.append(img,label);if(!url){const state=document.createElement('small');state.textContent='Скоро появится';card.append(state);}
        card.onclick=async()=>{card.disabled=true;
          try{if(cfg!==session)return;if(session.openCinemaDrink)await session.openCinemaDrink(url.href);else window.open(url.href,'_blank','noopener,noreferrer');
            if(menu.open)menu.close();
          }catch(e){if(cfg===session&&menu.open)$('cinDrinkMessage').textContent=e.message;}
          finally{card.disabled=false;}
        };cards.append(card);
      }
    }catch(e){if(cfg===session&&menu.open)$('cinDrinkMessage').textContent=e.message;}
  }
  function attach(room){
    const bar=document.createElement('div');bar.className='cin-snackbar';
    bar.innerHTML='<span>КИНОБАР</span><button id="cinPopcorn" type="button">🍿 Заказать попкорн</button><button id="cinOrderDrink" type="button">🥤 Заказать напиток</button>';
    room.querySelector('.cin-sound').after(bar);
    menu=document.createElement('dialog');menu.className='cin-snack-dialog';menu.id='cinDrinkMenu';menu.setAttribute('aria-labelledby','cinDrinkTitle');
    menu.innerHTML='<header><div><small>SUPPORT HUB · КИНОБАР</small><h2 id="cinDrinkTitle">Что будешь пить?</h2></div><button id="cinDrinkClose" type="button" aria-label="Закрыть напитки">✕</button></header><p id="cinDrinkMessage" role="status"></p><div id="cinDrinkCards"></div>';
    popcorn=document.createElement('dialog');popcorn.className='cin-snack-dialog cin-popcorn';popcorn.id='cinPopDialog';popcorn.setAttribute('aria-labelledby','cinPopTitle');
    popcorn.innerHTML='<span class="cin-pop-art" aria-hidden="true">🍿</span><h2 id="cinPopTitle">Готовим попкорн</h2><output id="cinPopCount" aria-live="polite"></output><button id="cinPopCancel" type="button">Отмена</button>';
    room.append(menu,popcorn);
    $('cinPopcorn').onclick=pop;$('cinOrderDrink').onclick=openDrinks;$('cinDrinkClose').onclick=()=>menu.close();$('cinPopCancel').onclick=()=>popcorn.close();
    popcorn.addEventListener('close',cancelPopcorn);room.addEventListener('close',closeSnacks);
  }
  function stop(){
    ++serial;cfg=null;closeSnacks();if(admin){admin.remove();admin=null;}
  }
  function start(session){
    stop();cfg=session;if(isOwner()){buildAdmin();loadAdmin();}
  }
  window.HubCinemaSnacks={start,stop,attach,close:closeSnacks};
})();
