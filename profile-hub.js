/* Own profile: authenticated server persistence, no token or avatar in browser storage. */
(function (global) {
  'use strict';
  const statuses = {available:'На связи',break:'Перерыв',dnd:'Не беспокоить'};
  const $ = id => document.getElementById(id);
  let session=null, epoch=0, profile=null, mounted=false, dialog, chip, busy=false;
  let avatarDraft='', avatarSequence=0, lastFocus=null, loadSequence=0;
  const pending=new Set();
  function el(tag,text,cls) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(id,text,handler,cls='profile-hub-secondary') {const n=el('button',text,cls);n.id=id;n.type='button';n.addEventListener('click',handler);return n;}
  function safeAvatar(value) {return typeof value==='string'&&value.length<=400000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)?value:'';}
  function avatar(target,value,name) {
    target.replaceChildren();const image=safeAvatar(value);
    if(image){const img=el('img');img.src=image;img.alt='Аватар '+name;target.append(img);}
    else target.textContent=Array.from(name||'?')[0].toUpperCase();
  }
  function say(text,error=false) {if(!$('hubProfileMessage'))return;$('hubProfileMessage').textContent=text;$('hubProfileMessage').classList.toggle('is-error',error);}
  function active(generation) {return !!session&&generation===epoch;}
  function lock(value) {
    busy=value;if(!mounted)return;dialog.setAttribute('aria-busy',String(value));
    for(const id of ['hubProfilePhoto','hubProfileRemovePhoto','hubProfileTelegram','hubProfileStatus','hubProfileSave'])$(id).disabled=value||!profile;
    $('hubProfileRefresh').disabled=value;
    $('hubProfileSave').textContent=value?'Подождите…':'Сохранить изменения';
  }
  async function api(method,body) {
    if(!session)throw Error('Войди в Support Hub заново.');
    const cfg=session,controller=new AbortController();pending.add(controller);
    const timeout=setTimeout(()=>controller.abort(),18000);
    try {
      const response=await fetch(cfg.server+'/api/profile/me',{method,headers:{Authorization:'Bearer '+cfg.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});
      let data;try{data=await response.json();}catch{throw Error('Сервер не смог загрузить профиль. Повтори попытку.');}
      if(!response.ok||!data.success)throw Error(data.message||'Не удалось сохранить профиль. Повтори попытку.');
      if(!data.profile||String(data.profile.username).toLowerCase()!==cfg.username.toLowerCase())throw Error('Не удалось подтвердить владельца профиля. Войди заново.');
      return data.profile;
    } catch(error) {
      if(error.name==='AbortError')throw Error('Сервер не ответил вовремя. Повтори попытку.');
      if(error instanceof TypeError)throw Error('Нет связи с сервером. Изменения пока не сохранены.');
      throw error;
    } finally {clearTimeout(timeout);pending.delete(controller);}
  }
  function drawChip() {
    if(!session||!chip)return;const current=profile||{username:session.username,status:'available'};
    avatar($('hubProfileChipAvatar'),current.avatar,current.username);
    $('hubProfileChipName').textContent=current.username;
    $('hubProfileChipStatus').textContent=profile?statuses[current.status]||statuses.available:'Мой профиль';
    chip.dataset.status=profile?current.status:'loading';
    chip.setAttribute('aria-label','Мой профиль: '+current.username+(profile?', '+(statuses[current.status]||statuses.available):''));
  }
  function metric(value,minutes=false) {
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)return '—';
    return minutes?Math.floor(value/60)+' ч '+Math.floor(value%60)+' мин':new Intl.NumberFormat('ru-RU').format(value);
  }
  function drawProfile() {
    const p=profile;avatarDraft=safeAvatar(p?.avatar);
    avatar($('hubProfileAvatar'),avatarDraft,p?.username||session?.username||'');
    $('hubProfileUsername').value=p?.username||session?.username||'';
    $('hubProfileTelegram').value=p?.telegram?'@'+p.telegram.replace(/^@/,''):'';
    $('hubProfileStatus').value=statuses[p?.status]?p.status:'available';
    $('hubProfileTeam').textContent=p?.team||'—';
    $('hubProfilePosition').textContent=p?.position||'Сотрудник команды';
    const month=p?.month;
    $('hubProfileMonth').textContent=month?.label||'Текущий месяц';
    for(const [id,key] of [['hubProfileHours','workedMinutes'],['hubProfileLogs','logs'],['hubProfileShifts','shifts'],['hubProfileClosedCalls','closedCalls']])$(id).textContent=metric(month?.[key],key==='workedMinutes');
    $('hubProfileStatsNote').textContent=month?'Отправленные логи и записанные завершённые смены. Текущая смена не учитывается.'+(month.durationUnknownShifts?' У '+month.durationUnknownShifts+' смен нет данных о длительности — их время не включено.':''):p?.statsUnavailable?'Статистика временно недоступна. Нажми «Обновить», чтобы повторить загрузку.':'Статистика появится после загрузки профиля.';
    $('hubProfileRemovePhoto').disabled=busy||!p||!avatarDraft;
    $('hubProfileFile').value='';
  }
  function accept(value) {
    profile={...value,avatar:safeAvatar(value.avatar),telegram:typeof value.telegram==='string'?value.telegram:'',status:statuses[value.status]?value.status:'available'};
    drawChip();drawProfile();
    document.dispatchEvent(new CustomEvent('hub:profile-updated',{detail:{username:profile.username,avatar:profile.avatar,telegram:profile.telegram,status:profile.status}}));
  }
  async function refresh(preserveDraft=false) {
    if(!session)return false;const generation=epoch,sequence=++loadSequence;
    const draft=preserveDraft===true&&profile&&dialog.open?{avatar:avatarDraft,telegram:$('hubProfileTelegram').value,status:$('hubProfileStatus').value}:null;
    lock(true);say('Загружаем профиль…');
    try {
      const value=await api('GET');if(!active(generation)||sequence!==loadSequence)return false;accept(value);
      if(draft&&dialog.open){avatarDraft=draft.avatar;avatar($('hubProfileAvatar'),avatarDraft,profile.username);$('hubProfileTelegram').value=draft.telegram;$('hubProfileStatus').value=draft.status;}
      say('');return true;
    }
    catch(error){if(active(generation)&&sequence===loadSequence)say(error.message,true);return false;}
    finally {if(active(generation)&&sequence===loadSequence){lock(false);$('hubProfileRemovePhoto').disabled=!profile||!avatarDraft;}}
  }
  function close() {if(busy&&dialog?.dataset.saving==='true')return;avatarSequence++;if(dialog?.open)dialog.close();}
  async function open() {
    if(!session)return false;mount();lastFocus=document.activeElement;drawProfile();say('');
    if(!dialog.open)dialog.showModal();
    await refresh();return dialog.open;
  }
  async function encodePhoto(file) {
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выбери фото JPG, PNG или WebP.');
    if(file.size>8*1024*1024)throw Error('Выбери фото до 8 МБ. Оно будет уменьшено для профиля.');
    const url=URL.createObjectURL(file),image=new Image();
    try {
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{image.src='';reject(Error('Не удалось прочитать фото. Выбери другое изображение.'));},12000);
        image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('Не удалось прочитать фото. Выбери другое изображение.'));};image.src=url;
      });
      if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>8192||image.naturalHeight>8192||image.naturalWidth*image.naturalHeight>32000000)throw Error('Изображение слишком большое. Выбери фото до 32 мегапикселей и 8192 пикселей по стороне.');
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#202522';ctx.fillRect(0,0,256,256);
      const size=Math.min(image.naturalWidth,image.naturalHeight);
      ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);
      return canvas.toDataURL('image/jpeg',0.85);
    } finally {URL.revokeObjectURL(url);image.onload=null;image.onerror=null;}
  }
  async function preparePhoto(file) {
    if(!session||!profile||busy)return false;const generation=epoch,sequence=++avatarSequence;
    lock(true);say('Подготавливаем фото…');
    try {const data=await encodePhoto(file);if(!active(generation)||sequence!==avatarSequence||!dialog.open)return false;avatarDraft=data;avatar($('hubProfileAvatar'),data,profile.username);say('Фото готово. Нажми «Сохранить изменения».');return true;}
    catch(error){if(active(generation)&&sequence===avatarSequence)say(error.message,true);return false;}
    finally {if(active(generation)&&sequence===avatarSequence){lock(false);$('hubProfileRemovePhoto').disabled=!avatarDraft;}}
  }
  async function save(event) {
    event?.preventDefault();if(!session||!profile||busy)return;
    const telegram=$('hubProfileTelegram').value.trim().replace(/^@/,'');
    if(telegram&&!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(telegram)){say('Telegram: от 5 до 32 символов, первая — латинская буква. Можно использовать цифры и _.',true);$('hubProfileTelegram').focus();return;}
    const status=$('hubProfileStatus').value;
    const patch={};if(telegram!==profile.telegram)patch.telegram=telegram;
    if(status!==profile.status)patch.status=status;
    if(avatarDraft!==profile.avatar)patch.avatar=avatarDraft;
    if(!Object.keys(patch).length){close();return;}
    const generation=epoch;dialog.dataset.saving='true';lock(true);say('Сохраняем изменения…');
    try {const value=await api('PATCH',patch);if(!active(generation))return;accept(value);say('Сохранено. Профиль доступен после перезапуска приложения.');}
    catch(error){if(active(generation))say(error.message,true);}
    finally {if(active(generation)){delete dialog.dataset.saving;lock(false);$('hubProfileRemovePhoto').disabled=!avatarDraft;}}
  }
  function mount() {
    if(mounted)return;mounted=true;
    chip=button('hubProfileButton',undefined,()=>open(),'profile-hub-chip');chip.hidden=true;chip.setAttribute('aria-haspopup','dialog');
    const chipAvatar=el('span',undefined,'profile-hub-avatar');chipAvatar.id='hubProfileChipAvatar';
    const caption=el('span',undefined,'profile-hub-chip-caption'),name=el('strong'),status=el('small');name.id='hubProfileChipName';status.id='hubProfileChipStatus';caption.append(name,status);
    chip.append(chipAvatar,caption,el('span','⌄','profile-hub-chevron'));
    const header=document.querySelector('.hub-header');
    const placeChip=()=>{const radio=$('hubRadio');if(radio){if(radio.previousElementSibling!==chip)radio.before(chip);}else if(!chip.isConnected)header?.append(chip);};
    placeChip();if(header)new MutationObserver(placeChip).observe(header,{childList:true});
    dialog=el('dialog',undefined,'profile-hub-dialog');dialog.id='hubProfileDialog';dialog.setAttribute('aria-labelledby','hubProfileTitle');
    const head=el('header',undefined,'profile-hub-heading'),heading=el('div');
    heading.append(el('small','ЛИЧНОЕ ПРОСТРАНСТВО','profile-hub-kicker'));const title=el('h2','Мой профиль');title.id='hubProfileTitle';heading.append(title);
    const x=button('hubProfileClose','×',close,'profile-hub-close');x.setAttribute('aria-label','Закрыть профиль');head.append(heading,x);dialog.append(head);
    const form=el('form');form.id='hubProfileForm';form.addEventListener('submit',save);
    const photo=el('div',undefined,'profile-hub-photo'),large=el('span',undefined,'profile-hub-avatar');large.id='hubProfileAvatar';
    const photoInfo=el('div',undefined,'profile-hub-photo-info');photoInfo.append(el('strong','Тебя узнают по аватару'),el('p','JPG, PNG или WebP · до 8 МБ'));
    const actions=el('div',undefined,'profile-hub-photo-actions');actions.append(button('hubProfilePhoto','Загрузить фото',()=>$('hubProfileFile').click()),button('hubProfileRemovePhoto','Убрать',()=>{avatarDraft='';avatar(large,'',profile.username);$('hubProfileRemovePhoto').disabled=true;say('Аватар будет удалён после сохранения.');}));photoInfo.append(actions);
    const file=el('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.id='hubProfileFile';file.hidden=true;file.addEventListener('change',()=>{const chosen=file.files[0];if(chosen)preparePhoto(chosen);file.value='';});photo.append(large,photoInfo,file);form.append(photo);
    const fields=el('div',undefined,'profile-hub-fields');
    function field(id,label,control,copy){const wrap=el('div',undefined,'profile-hub-field'),lab=el('label',label);lab.htmlFor=id;control.id=id;wrap.append(lab,control);if(copy)wrap.append(el('small',copy));fields.append(wrap);return control;}
    const nick=el('input');nick.readOnly=true;field('hubProfileUsername','Ник в приложении',nick,'Твой рабочий аккаунт');
    const select=el('select');for(const [key,text]of Object.entries(statuses)){const option=el('option',text);option.value=key;select.append(option);}field('hubProfileStatus','Мой статус',select,'Виден в профиле. Не отключает уведомления.');
    const tg=el('input');tg.type='text';tg.placeholder='@username';tg.maxLength=33;tg.autocomplete='off';tg.spellcheck=false;field('hubProfileTelegram','Telegram',tg,'Твой ник, чтобы коллегам было проще связаться.');
    form.append(fields);
    const team=el('div',undefined,'profile-hub-team'),teamText=el('span');teamText.append(el('span','Моя команда'));const position=el('small');position.id='hubProfilePosition';teamText.append(position);const teamName=el('strong');teamName.id='hubProfileTeam';team.append(teamText,teamName);form.append(team);
    const stats=el('section',undefined,'profile-hub-stats'),statsHead=el('div',undefined,'profile-hub-stats-head');statsHead.append(el('h3','Личная статистика'));const month=el('span');month.id='hubProfileMonth';statsHead.append(month,button('hubProfileRefresh','Обновить',()=>refresh(true),'profile-hub-text-button'));stats.append(statsHead);
    const metrics=el('div',undefined,'profile-hub-metrics');for(const [id,label]of [['hubProfileHours','Время в сменах'],['hubProfileLogs','Логов'],['hubProfileShifts','Завершено смен'],['hubProfileClosedCalls','Закрыто коллов']]){const cell=el('div'),count=el('strong','—');count.id=id;cell.append(count,el('span',label));metrics.append(cell);}stats.append(metrics);const statsNote=el('p',undefined,'profile-hub-muted');statsNote.id='hubProfileStatsNote';stats.append(statsNote);form.append(stats);
    const message=el('p',undefined,'profile-hub-message');message.id='hubProfileMessage';message.setAttribute('role','status');message.setAttribute('aria-live','polite');form.append(message);
    const footer=el('footer',undefined,'profile-hub-footer');footer.append(button('hubProfileCancel','Закрыть',close));const submit=button('hubProfileSave','Сохранить изменения',()=>{},'profile-hub-primary');submit.type='submit';footer.append(submit);form.append(footer);dialog.append(form);document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{if(dialog.dataset.saving==='true')event.preventDefault();});
    dialog.addEventListener('close',()=>{avatarSequence++;delete dialog.dataset.saving;drawProfile();if(session&&lastFocus?.isConnected)lastFocus.focus();lastFocus=null;});
  }
  function stop() {
    epoch++;loadSequence++;avatarSequence++;session=null;profile=null;avatarDraft='';busy=false;
    for(const controller of pending)controller.abort();pending.clear();
    if(dialog?.open)dialog.close();
    if(mounted){chip.hidden=true;chip.removeAttribute('title');$('hubProfileChipAvatar').replaceChildren();$('hubProfileChipName').textContent='';$('hubProfileChipStatus').textContent='';drawProfile();say('');lock(false);}
  }
  function start(options) {
    stop();if(!options?.username||!options.token||!options.server)return Promise.resolve(false);
    session={username:String(options.username),token:String(options.token),server:String(options.server).replace(/\/$/,'')};mount();chip.hidden=false;drawChip();drawProfile();return refresh();
  }
  async function updateAvatar(file) {if(!await open())return false;return file?preparePhoto(file):true;}
  global.HubProfile={start,stop,open,updateAvatar};
})(window);
