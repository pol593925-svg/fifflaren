/* Premium login and saved badge. A badge never authenticates without server validation. */
(function(global){'use strict';
 let cfg,profile=null,mode='login',busy=false,activeToken='',mounted=false,dirty=false;
 const $=id=>document.getElementById(id);
 const say=(text,tone='error')=>{$('authErrorMsg').textContent=text;$('authErrorMsg').dataset.tone=tone;};
 const invoke=(name,data)=>cfg.ipc.invoke(name,data);
 function draw(){
  const badge=mode==='pass',register=mode==='register';
  $('authFields').hidden=badge;$('authPass').hidden=!badge;
  $('authTeamField').hidden=!register;$('authRememberField').hidden=register;
  $('authOtherAccount').hidden=!badge;$('authUsePassword').hidden=!badge;$('authSwitchMode').hidden=badge;
  $('authPassword').autocomplete=register?'new-password':'current-password';
  $('authPassword').type='password';$('authShowPassword').setAttribute('aria-pressed','false');$('authShowPassword').setAttribute('aria-label','Показать пароль');
  $('authTitle').textContent=badge?'С возвращением, '+profile.username:register?'Добро пожаловать':'С возвращением';
  $('authSubtitle').textContent=badge?'Твоё пространство готово. Продолжим?':register?'Создай свой профиль в команде.':'Войди в своё пространство команды.';
  $('authAvatar').textContent=Array.from(badge?profile.username:$('authUsername').value.trim()||'S')[0].toUpperCase();
  $('authPassName').textContent=profile?.username||'';
  $('authSubmitBtn').textContent=badge?'Продолжить как '+profile.username:register?'Создать аккаунт':'Войти →';
  $('authSwitchMode').textContent=register?'Уже есть аккаунт? Войти':'Создать аккаунт';
 }
 function lock(value){busy=value;$('authForm').setAttribute('aria-busy',String(value));for(const el of $('authForm').querySelectorAll('input,select,button'))el.disabled=value;}
 async function api(path,{token,body,timeout=35000}={}){
  const response=await fetch(cfg.server+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(timeout)});
  let data;try{data=await response.json();}catch{throw Error('Сервер временно недоступен. Повтори попытку.');}
  return {status:response.status,data};
 }
 async function forget(){profile=null;await invoke('auth-forget').catch(()=>{});}
 async function signOut(){
  const saved=await invoke('auth-session-read').catch(()=>null),token=activeToken||saved?.token;
  try{if(token)await api('/api/auth/logout',{token,body:{},timeout:6000});}catch{}finally{activeToken='';await forget();}
 }
 async function complete(data){
  if(!data?.success||typeof data.username!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.callsToken||''))throw Error('Не удалось подтвердить вход. Повтори попытку.');
  activeToken=data.callsToken;$('authPassword').value='';
  await cfg.onAuthenticated(data);
  $('authScreen').style.display='none';document.body.classList.remove('hub-auth-visible');
  document.dispatchEvent(new Event('hub:work-ready'));
 }
 async function submit(event){
  event.preventDefault();if(busy)return;
  const badge=mode==='pass',register=mode==='register',username=$('authUsername').value.trim(),password=$('authPassword').value,team=$('authTeam').value;
  if(!badge){
   if(!username){say('Введи свой логин.');$('authUsername').focus();return;}
   if(!password){say('Введи пароль.');$('authPassword').focus();return;}
   if(register&&$('authTeam').options.length>1&&!team){say('Выбери свою команду.');$('authTeam').focus();return;}
  }
  lock(true);say(badge?'Проверяем личный пропуск…':'Подключаемся к твоему пространству…','info');
  const slow=setTimeout(()=>say('Сервер ещё отвечает. Подождём немного…','info'),8000);
  try{
   let result;
   if(badge){
    const saved=await invoke('auth-session-read');
    if(!saved){$('authUsername').value=profile?.username||'';await forget();mode='login';draw();say('Пропуск истёк. Введи пароль, чтобы продолжить.');return;}
    result=await api('/api/auth/session',{token:saved.token});
    if(result.status===401||result.status===403){
     $('authUsername').value=profile?.username||saved.username;await forget();mode='login';draw();
     say(result.data.message||'Пропуск истёк. Войди с паролем.');return;
    }
    if(result.status===404){say('Для быстрого входа нужен обновлённый сервер. Пока выбери «Войти с паролем».');return;}
   }else result=await api(register?'/api/register':'/api/login',{body:register?{username,password,team}:{username,password}});
   const data=result.data;
   if(result.status>=400||!data?.success){
    if(data?.offboarded){await forget();await cfg.offboard?.();}
    say(data?.message||'Не удалось войти. Проверь данные и попробуй снова.');return;
   }
   if(register){mode='login';draw();$('authPassword').value='';say('Профиль создан. Войди со своим паролем.','info');return;}
   if(!badge){
    if($('authRemember').checked){const kept=await invoke('auth-save',data).catch(()=>null);if(!kept?.saved)await forget();}
    else await forget();
   }
   await complete(data);
  }catch(e){say(e.name==='TimeoutError'||e.name==='AbortError'?'Сервер не ответил вовремя. Попробуй ещё раз.':'Не удалось подключиться. Проверь интернет и повтори вход.');}
  finally{clearTimeout(slow);lock(false);}
 }
 async function mount(options){
  if(mounted)return;mounted=true;cfg=options;document.body.classList.add('hub-auth-visible');
  $('authScreen').style.display='flex';
  // Retire plaintext password storage without using it for an automatic login.
  try{const old=JSON.parse(localStorage.getItem('sh_auth')||'null');if(old?.u)$('authUsername').value=String(old.u).slice(0,100);}catch{}
  localStorage.removeItem('sh_auth');
  $('authForm').addEventListener('submit',submit);
  $('authUsername').addEventListener('input',()=>{dirty=true;$('authAvatar').textContent=Array.from($('authUsername').value.trim()||'S')[0].toUpperCase();});
  $('authPassword').addEventListener('input',()=>{dirty=true;});
  $('authSwitchMode').onclick=()=>{mode=mode==='register'?'login':'register';say('');draw();$('authUsername').focus();};
  $('authShowPassword').onclick=()=>{const reveal=$('authPassword').type==='password';$('authPassword').type=reveal?'text':'password';$('authShowPassword').setAttribute('aria-pressed',String(reveal));$('authShowPassword').setAttribute('aria-label',reveal?'Скрыть пароль':'Показать пароль');};
  $('authUsePassword').onclick=()=>{$('authUsername').value=profile?.username||'';mode='login';say('');draw();$('authPassword').focus();};
  $('authOtherAccount').onclick=async()=>{if(busy)return;lock(true);await signOut();mode='login';$('authUsername').value='';$('authPassword').value='';say('');draw();lock(false);$('authUsername').focus();};
  $('authHelp').onclick=()=>document.getElementById('support-chat-toggle')?.click();
  draw();
  try{
   const info=await invoke('auth-profile');
   if(info?.version)$('authVersion').textContent='Версия '+info.version;
   if(info?.profile&&!dirty&&!busy&&mode==='login'){profile=info.profile;mode='pass';draw();}
  }catch{}
 }
 global.HubLogin={mount,forget,signOut};
})(window);
