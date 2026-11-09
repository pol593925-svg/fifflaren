(()=>{
  'use strict';
  const $=id=>document.getElementById(id),pairs=new Map();let cfg,dialog,mode='upload',timer,sequence=0,polling=false;
  const icons={upload:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 18.5h4M12 14V7m-3 3 3-3 3 3"/></svg>',dj:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="11" width="5" height="9" rx="2"/><rect x="16" y="11" width="5" height="9" rx="2"/><path d="M8 20h3"/></svg>'};
  function button(id,label,kind){const b=document.createElement('button');b.type='button';b.id=id;b.className='radio-phone-button';b.innerHTML=icons[kind];b.append(document.createTextNode(label));b.onclick=()=>open(kind);return b;}
  async function request(route,method='GET',body){
    const session=cfg;if(!session)throw Error('Войди в Support Hub.');
    const r=await fetch(session.server+'/api/radio/mobile/'+route,{method,headers:{Authorization:'Bearer '+session.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    if(session!==cfg)throw Error('Аккаунт изменился.');
    let data;try{data=await r.json();}catch{throw Error(r.status===404?'Сервер ещё не получил обновление QR-радио.':'Не удалось подключиться к радио.');}
    if(!r.ok)throw Object.assign(Error(data.message||'Радио временно недоступно.'),{status:r.status});return data;
  }
  function setupDialog(){
    if(dialog)return;dialog=document.createElement('dialog');dialog.id='radioQrDialog';dialog.setAttribute('aria-labelledby','radioQrTitle');
    dialog.innerHTML='<header><div><small>SUPPORT HUB / С ТЕЛЕФОНА</small><h2 id="radioQrTitle"></h2></div><button id="radioQrClose" type="button" aria-label="Закрыть">✕</button></header><p id="radioQrIntro"></p><div class="radio-qr-layout"><div class="radio-qr-code"><img id="radioQrImage" width="240" height="240" alt="QR для подключения телефона"><div id="radioQrConnected" hidden><span aria-hidden="true">✓</span><strong>Телефон подключён</strong><p>Это окно можно закрыть</p></div></div><div class="radio-qr-instructions"><span id="radioQrKind" class="radio-qr-badge"></span><ol><li>Открой камеру телефона.</li><li>Наведи её на QR и перейди по ссылке.</li><li id="radioQrStep"></li></ol><p id="radioQrHost"></p><p id="radioQrExpiry"></p></div></div><p id="radioQrNotice" role="status"></p><div id="radioQrUploads"></div><footer><button id="radioQrCopy" type="button">Скопировать ссылку</button><button id="radioQrRenew" type="button">Новый QR</button><button id="radioQrRevoke" type="button">Отключить телефон</button></footer>';
    document.body.append(dialog);$('radioQrClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{clearInterval(timer);sequence++;});
    $('radioQrCopy').onclick=async()=>{const p=pairs.get(mode);if(!p||p.connected)return;try{await navigator.clipboard.writeText(p.url);$('radioQrNotice').textContent='Ссылка скопирована.';}catch{$('radioQrNotice').textContent='Не удалось скопировать. Отсканируй QR камерой.';}};
    $('radioQrRenew').onclick=()=>generate();
    $('radioQrRevoke').onclick=async()=>{const p=pairs.get(mode);if(!p)return;try{await request('pairs/'+p.id,'DELETE');pairs.delete(mode);$('radioQrImage').hidden=true;$('radioQrConnected').hidden=true;$('radioQrCopy').disabled=true;$('radioQrRevoke').disabled=true;$('radioQrNotice').textContent='Доступ телефона отключён.';}catch(e){$('radioQrNotice').textContent=e.message;}};
  }
  function render(p){
    const connected=p.connected;$('radioQrImage').hidden=connected;$('radioQrImage').src=p.qr;$('radioQrConnected').hidden=!connected;
    $('radioQrCopy').disabled=connected||p.expiresAt<=Date.now();$('radioQrRevoke').disabled=false;
    $('radioQrHost').textContent=p.hostOnline?'● ПК Fifflaren в сети':'ПК Fifflaren не в сети. Открой на нём Support Hub для загрузки песен.';
    const minutes=Math.max(0,Math.ceil((p.expiresAt-Date.now())/60000));
    $('radioQrExpiry').textContent=connected?'Подключение активно до '+new Date(p.expiresAt).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):'QR действует ещё '+minutes+' мин. · Одно подключение';
    const box=$('radioQrUploads');box.replaceChildren();
    for(const u of p.uploads||[]){const row=document.createElement('div'),name=document.createElement('span'),percent=document.createElement('b'),bar=document.createElement('progress');row.className='radio-qr-progress';name.textContent=u.title;percent.textContent=u.done?'✓ В очереди':u.percent+'%';bar.max=100;bar.value=u.percent;bar.setAttribute('aria-label',u.title);row.append(name,percent,bar);box.append(row);}
  }
  async function generate(){
    const turn=++sequence,kind=mode;$('radioQrNotice').textContent='Создаём QR…';$('radioQrRenew').disabled=true;$('radioQrCopy').disabled=true;$('radioQrRevoke').disabled=true;$('radioQrImage').hidden=true;$('radioQrConnected').hidden=true;
    try{const p=await request('pairs','POST',{mode:kind});pairs.set(kind,p);if(turn!==sequence||!dialog.open)return;render(p);$('radioQrNotice').textContent=kind==='dj'?'Пароль вводится на телефоне. Новый QR отключает предыдущий пульт.':'Загруженные песни сохранятся на ПК Fifflaren и попадут в конец очереди.';}
    catch(e){if(turn===sequence)$('radioQrNotice').textContent=e.message;}
    finally{if(turn===sequence)$('radioQrRenew').disabled=false;}
  }
  async function poll(){
    const kind=mode,p=pairs.get(kind),turn=sequence;if(!p||!dialog?.open||document.hidden||polling)return;polling=true;
    try{const status=await request('pairs/'+p.id);if(turn!==sequence)return;Object.assign(p,status);render(p);}
    catch(e){if(turn!==sequence)return;$('radioQrNotice').textContent=e.message;if([401,404].includes(e.status)){$('radioQrImage').hidden=true;$('radioQrConnected').hidden=true;$('radioQrCopy').disabled=true;pairs.delete(kind);}}
    finally{polling=false;}
  }
  async function open(kind){
    if(!cfg||kind==='dj'&&cfg.username.toLowerCase()!=='fifflaren')return;mode=kind;setupDialog();
    $('radioQrTitle').textContent=kind==='dj'?'DJ-пульт на телефоне':'Добавить музыку с телефона';$('radioQrKind').textContent=kind==='dj'?'ЛИЧНЫЙ ПУЛЬТ FIFFLAREN':'БЕЗ ПАРОЛЯ';
    $('radioQrIntro').textContent=kind==='dj'?'Управляй общим эфиром: включай песни, меняй очередь и перематывай.':'Выбирай несколько песен на телефоне. Текущий трек продолжит играть.';
    $('radioQrStep').textContent=kind==='dj'?'Введи пароль пульта и управляй эфиром.':'Выбери аудиофайлы и дождись загрузки.';
    $('radioQrNotice').textContent='';$('radioQrRenew').disabled=false;if(!dialog.open)dialog.showModal();
    clearInterval(timer);timer=setInterval(poll,2500);const p=pairs.get(kind);if(p){render(p);await poll();}else await generate();
  }
  function stop(){
    clearInterval(timer);sequence++;if(dialog?.open)dialog.close();
    const old=cfg;cfg=null;for(const p of pairs.values())if(old)fetch(old.server+'/api/radio/mobile/pairs/'+p.id,{method:'DELETE',headers:{Authorization:'Bearer '+old.token},keepalive:true}).catch(()=>{});pairs.clear();
  }
  function mount(session){
    stop();cfg=session;const add=$('radioAddSong');if(!add)return;
    if(!$('radioPhoneUpload')){const upload=button('radioPhoneUpload','С телефона','upload'),dj=button('radioPhoneDJ','DJ-пульт','dj'),actions=document.createElement('div');actions.className='radio-phone-actions';add.before(actions);actions.append(add,upload,dj);}
    $('radioPhoneDJ').hidden=session.username.toLowerCase()!=='fifflaren';
  }
  window.HubRadioQR={mount,stop};
})();
