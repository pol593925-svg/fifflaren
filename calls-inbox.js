(function(){
 const TZ='Europe/Simferopol',OFFSET=10800000;
 function clock(now=Date.now()) {const d=new Date(now+OFFSET);return {day:d.toISOString().slice(0,10),hour:d.getUTCHours(),due:new Date(now+OFFSET-(d.getUTCHours()<19?86400000:0)).toISOString().slice(0,10)};}
 let options=null,timer=null,sequence=0,checking=false,rows=[],seen=new Set();
 const el=id=>document.getElementById(id);
 function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 const statusNames={pending:'В ожидании',done:'Сделано',rejected:'Отклонён',returned:'На доработке'};
 let personal=[],minePage=0,mineSeq=0,mineMore=false,owner=false,canReview=false;
 function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 const authors=new Map(),savedAvatars=new Map();
 function safeAvatar(value){return typeof value==='string'&&value.length<=400000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)?value:'';}
 function paintAvatar(target,value){const initial=Array.from(target.dataset.author||'?')[0].toUpperCase();target.replaceChildren();const image=safeAvatar(value);if(!image){target.textContent=initial;return;}const img=node('img');img.alt='';img.width=32;img.height=32;img.decoding='async';img.onerror=()=>{if(img.parentNode===target)target.replaceChildren(document.createTextNode(initial));};img.src=image;target.append(img);}
 function rememberAuthor(username,avatar,saved=false){const key=String(username||'').toLowerCase();if(!key)return;const value=safeAvatar(avatar);if(saved)savedAvatars.set(key,value);else if(savedAvatars.has(key))return;if(authors.get(key)===value)return;authors.set(key,value);for(const target of document.querySelectorAll('.call-author-avatar'))if(target.dataset.author===key)paintAvatar(target,value);}
 function rememberAuthors(data){for(const [name,profile]of Object.entries(data?.authors||{}))rememberAuthor(name,profile?.avatar);for(const row of [...(data?.calls||[]),...(data?.logs||[]),...(data?.call?[data.call]:[]),...(data?.log?[data.log]:[])])if(Object.prototype.hasOwnProperty.call(row,'avatar'))rememberAuthor(row.user,row.avatar);}
 function avatarFor(row){const avatar=node('span',undefined,'call-author-avatar');avatar.dataset.author=String(row.user||'').toLowerCase();avatar.setAttribute('role','img');avatar.setAttribute('aria-label','Аватар '+(row.user||'пользователя'));paintAvatar(avatar,authors.get(avatar.dataset.author));return avatar;}
 // A poll already in flight must not undo an avatar confirmed by the profile save.
 document.addEventListener('hub:profile-updated',event=>{if(options&&String(event.detail?.username||'').toLowerCase()===String(options.username).toLowerCase())rememberAuthor(event.detail.username,event.detail.avatar,true);});
 async function api(path,init={}){const config=options;if(!config?.token)throw Error('Войди заново, чтобы загрузить колы.');const response=await fetch(config.server+path,{...init,headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});const data=await response.json();if(config!==options)throw Error('Аккаунт изменился. Открой список заново.');if(!response.ok||!data.success)throw Error(data.message||'Не удалось выполнить запрос');return data;}
 function card(row,editable){
  const article=node('article',undefined,'call-entry'),head=node('div',undefined,'call-entry-heading'),title=node('strong',row.service||row.kind||'Колл');
  article.dataset.callId=row.id;
  const author=node('div',undefined,'call-author'),authorText=node('span',row.user||'Пользователь');author.append(avatarFor(row),authorText);article.append(author);
  const status=statusNames[row.status]?row.status:'pending',badge=node('span',statusNames[status],'call-badge call-'+status);head.append(title,badge);article.append(head);
  if(row.requestType==='network'){article.classList.add('call-network-request');article.append(node('span','Заявка по сети','desk-request-label'));}
  if(row.requestType==='logs'){article.classList.add('call-log-request');article.append(node('span','Количество: '+Number(row.quantity).toLocaleString('ru'),'desk-request-label'));}
  article.append(node('small',[row.kind,new Intl.DateTimeFormat('ru',{timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(row.createdAt))].filter(Boolean).join(' · ')));
  if(row.requestType!=='logs'){
  const link=node('button',row.link||'Ссылка не указана','call-copy-link');link.type='button';link.title='Нажми, чтобы скопировать ссылку';link.disabled=!row.link;
  link.onclick=async()=>{try{await navigator.clipboard.writeText(row.link);link.textContent='✓ Ссылка скопирована';setTimeout(()=>link.textContent=row.link,1600);}catch{link.textContent='Не удалось скопировать — попробуй ещё раз';}};article.append(link);
  }
  if(row.note)article.append(node('p',row.note));
  if(['rejected','returned'].includes(status)&&row.reason)article.append(node('p','Причина: '+row.reason,'call-reason'));
  if(editable){const controls=node('div',undefined,'call-review'),select=node('select'),reason=node('textarea'),save=node('button','Сохранить статус','call-save'),message=node('small');
   select.setAttribute('aria-label','Статус колла');for(const [id,label] of Object.entries(statusNames)){const o=node('option',label);o.value=id;select.append(o);}select.value=status;
   reason.placeholder='Причина решения — увидит автор';reason.setAttribute('aria-label','Причина отклонения');reason.maxLength=500;reason.rows=2;reason.value=row.reason||'';reason.hidden=!['rejected','returned'].includes(status);
   select.onchange=()=>{reason.hidden=!['rejected','returned'].includes(select.value);};save.type='button';
   save.onclick=async()=>{if(['rejected','returned'].includes(select.value)&&!reason.value.trim()){message.textContent='Укажи причину для автора';reason.focus();return;}save.disabled=true;message.textContent='Сохраняем…';try{const data=await api('/api/fifflaren/calls/'+encodeURIComponent(row.id),{method:'PATCH',body:JSON.stringify({status:select.value,reason:reason.value.trim(),version:row.version||0})});rememberAuthors(data);rows=rows.map(r=>r.id===row.id?data.call:r);render();loadMine().catch(()=>{});}catch(e){message.textContent=e.message;save.disabled=false;}};
   controls.append(select,save,reason,message);
   if(['network','logs'].includes(row.requestType)&&status!=='done'){const done=node('button','Сделано','call-done-action');done.type='button';done.onclick=()=>{if(save.disabled)return;select.value='done';select.onchange();save.click();};controls.prepend(done);}
   article.append(controls);
    window.HubOffice?.offer(article,row);
  }HubWork.history(article,row);if(!editable&&status==='returned')HubWork.repair(article,row,()=>loadMine());return article;
 }
 function render(){const list=el('callsList');list.replaceChildren();el('callsCount').textContent=rows.length;if(!rows.length){list.textContent='За выбранный день колов пока нет.';return;}for(const row of rows)list.append(card(row,true));}
 function setupMine(){if(el('myCallsList'))return;const tab=el('tab-shift'),form=el('sendCallBtn').closest('.card'),aside=node('aside',undefined,'my-calls-panel shift-calls-panel');
  form.classList.add('call-compose');form.querySelector('h3').textContent='Новый колл';el('sendCallBtn').textContent='Отправить на рассмотрение';
  const header=node('div',undefined,'my-calls-header'),title=node('h3','Мои коллы'),refresh=node('button','↻ Обновить','call-refresh');refresh.type='button';refresh.onclick=()=>loadMine().catch(()=>{});header.append(title,refresh);
  const info=node('p','Твои заявки и результаты рассмотрения','my-calls-info');info.id='myCallsStatus';const list=node('div');list.id='myCallsList';const more=node('button','Показать ещё','call-refresh');more.id='myCallsMore';more.hidden=true;more.onclick=()=>loadMine(true).catch(()=>{});
  aside.append(header,info,list,more);tab.insertBefore(aside,tab.children[1]||null);
 }
 async function loadMine(append=false){if(!options)return;const seq=++mineSeq,page=append?minePage+1:0,config=options;try{const data=await api('/api/calls/mine?page='+page);if(seq!==mineSeq||config!==options)return;rememberAuthors(data);minePage=page;personal=append?personal.concat(data.calls):data.calls;mineMore=data.hasMore;const list=el('myCallsList');list.replaceChildren();if(!personal.length)list.append(node('div','Пока нет колов. Отправь первый — он появится здесь.','call-empty'));for(const row of personal)list.append(card(row,false));el('myCallsStatus').textContent='Всего: '+(data.total??personal.length)+' · обновляется автоматически';el('myCallsMore').hidden=!mineMore;}catch(e){if(seq===mineSeq)el('myCallsStatus').textContent=e.message;throw e;}}
 let logs=[];
 function renderLogs(){let panel=el('teamLogFeed');if(!panel){panel=node('section',undefined,'team-log-feed card');panel.id='teamLogFeed';panel.append(node('h3','Живая лента команды'));const list=node('div');list.id='teamLogList';list.setAttribute('aria-live','polite');panel.append(list);el('tab-shift').insertBefore(panel,el('tab-shift').children[1]||null);}const list=el('teamLogList');list.replaceChildren();for(const row of logs.slice(0,60)){const item=node('article',undefined,'team-log-entry'),author=node('div',undefined,'team-log-author');author.append(avatarFor(row),node('strong',row.user),node('small',new Date(row.createdAt).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})));item.append(author,node('p',row.comment));const url=safeLink(row.link);if(url){const a=node('a',row.link);a.href=url;a.target='_blank';a.rel='noopener noreferrer';item.append(a);}list.append(item);}if(!logs.length)list.append(node('p','Здесь появятся новые логи твоей команды.'));}
 async function loadLogs(){const config=options;try{const data=await api('/api/logs/team');if(config!==options)return;rememberAuthors(data);logs=[...new Map([...(data.logs||[]),...logs].map(r=>[r.id,r])).values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,60);renderLogs();}catch(e){if(config===options){renderLogs();el('teamLogList').textContent=e.message;}}}
 async function submitLog(fields){await HubWork.checkLink(fields.link);const data=await api('/api/logs',{method:'POST',body:JSON.stringify(fields)});if(data.log){rememberAuthors(data);logs=[data.log,...logs.filter(r=>r.id!==data.log.id)].slice(0,60);renderLogs();}return data;}
 async function submit(fields){await HubWork.checkLink(fields.callLink);await api('/api/events',{method:'POST',body:JSON.stringify({user:options.username,type:'call',...fields})});await loadMine().catch(()=>{});}
 async function fetchDay(date){
  const all=[],config=options;let page=0;
  while(true){const r=await fetch(config.server+'/api/fifflaren/calls?date='+encodeURIComponent(date)+'&page='+page,{headers:{Authorization:'Bearer '+config.token},signal:AbortSignal.timeout(15000)});const d=await r.json();
   if(config!==options)throw Error('Аккаунт изменился.');if(!r.ok||!d.success)throw Error(d.message||'Не удалось загрузить колы');rememberAuthors(d);
   all.push(...d.calls);if(!d.hasMore)return {rows:all,team:d.team};page++;
  }
 }
 async function load(date=el('callsDate').value){
  if(!options||!canReview)return;const seq=++sequence;el('callsStatus').textContent='Загружаем колы…';
  try{const data=await fetchDay(date);if(seq!==sequence||!canReview)return;rows=data.rows;render();el('callsStatus').textContent='Команда: '+data.team+' · '+date+' · время UTC+3';}
  catch(e){if(seq===sequence)el('callsStatus').textContent=e.message;throw e;}
 }
 async function checkDigest(){
  if(!options||!owner||checking)return;
  const now=clock(),key='hub_calls_digest_fifflaren',last=localStorage.getItem(key);
  if(!last&&now.hour<19){localStorage.setItem(key,now.due);return;}
  if(last===now.due)return;checking=true;
  try{const report=await fetchDay(now.due);options.notify({title:'Колы команды за '+now.due,text:'Сводка к 19:00 готова. Коллов: '+report.rows.length+'. Нажми, чтобы открыть список.',date:now.due});localStorage.setItem(key,now.due);}
  catch(e){el('callsStatus').textContent='Сводка будет повторно запрошена после восстановления связи.';}finally{checking=false;}
 }
 function setReviewAccess(access){
  const before=canReview;canReview=access.canReview===true;
  el('callsTabBtn').style.display=canReview?'':'none';
  if(!canReview){sequence++;rows=[];el('callsList').replaceChildren();el('callsCount').textContent='0';if(el('tab-mycalls').classList.contains('active'))document.querySelector('.tabs [data-tab="shift"]')?.click();}
  else if(!before){el('callsDate').value=clock().day;load().catch(()=>{});}
 }
 function start(config){
  clearInterval(timer);sequence++;seen.clear();authors.clear();savedAvatars.clear();options=null;rows=[];el('callsList').replaceChildren();el('callsCount').textContent='0';el('callsStatus').textContent='';
  owner=String(config.username).toLowerCase()==='fifflaren';canReview=owner;el('callsTabBtn').style.display=canReview?'':'none';
  options=config;HubWork.start(config);window.HubOffice?.start(config);HubAccess.start(config);HubRadio.start(config);logs=[];renderLogs();loadLogs();personal=[];mineSeq++;setupMine();el('myCallsList').replaceChildren();loadMine().catch(()=>{});timer=setInterval(()=>{if(!document.hidden){if(el('tab-shift').style.display!=='none')loadMine().catch(()=>{});window.HubTeamCalls?.refreshAccess();}checkDigest();},20000);el('callsDate').value=clock().day;
  el('callsRefresh').onclick=()=>load().catch(()=>{});el('callsDate').onchange=()=>load().catch(()=>{});
  el('callsCopy').onclick=async()=>{try{await navigator.clipboard.writeText(rows.map(r=>[r.service||r.kind,r.link,r.user].join(' — ')).join('\n'));el('callsStatus').textContent='Список скопирован';}catch{el('callsStatus').textContent='Не удалось скопировать список';}};
  window.HubTeamCalls?.start(config,{access:setReviewAccess,accessError:error=>{if(!canReview)el('callsStatus').textContent=error.message;}});
  window.HubLoans?.start(config);
  if(!config.token){el('callsStatus').textContent='Для личной вкладки нужен новый сервер. После его обновления войди заново.';return;}
  if(canReview)load().catch(()=>{});checkDigest();
 }
 function subscribe(socket){
  if(!options?.token)return;socket.emit('calls_subscribe',options.token);
  window.HubLoans?.subscribe(socket);
  if(socket.__hubCallsBound)return;socket.__hubCallsBound=true;
  socket.on('connect',()=>{if(options?.token){socket.emit('calls_subscribe',options.token);loadLogs();window.HubTeamCalls?.refreshAccess();}});
  socket.on('calls_access_changed',access=>{if(!options)return;if(access&&typeof access.canReview==='boolean')setReviewAccess(access);window.HubTeamCalls?.refreshAccess();});
  socket.on('team_log',row=>{if(!options||!row?.id)return;if(Object.prototype.hasOwnProperty.call(row,'avatar'))rememberAuthor(row.user,row.avatar);logs=[row,...logs.filter(r=>r.id!==row.id)].slice(0,60);renderLogs();});
  socket.on('my_call',()=>{loadMine().catch(()=>{});});
  socket.on('call_updated',row=>{if(!options)return;if(Object.prototype.hasOwnProperty.call(row||{},'avatar'))rememberAuthor(row.user,row.avatar);if(canReview&&row?.history?.at(-1)?.action==='resubmitted'){options.notify({title:'Исправлен колл · '+row.user,text:row.service,date:clock(Date.parse(row.createdAt)).day});}loadMine().catch(()=>{});if(canReview)load().catch(()=>{});});
  socket.on('fifflaren_call',row=>{
   if(!options||!canReview||seen.has(row.id))return;if(Object.prototype.hasOwnProperty.call(row,'avatar'))rememberAuthor(row.user,row.avatar);seen.add(row.id);if(seen.size>1000)seen.delete(seen.values().next().value);
   if(row.user.toLowerCase()!=='fifflaren')options.notify({title:'Новый колл · '+row.user,text:[row.service||row.kind,row.link].filter(Boolean).join('\n'),date:clock().day});
   if(el('callsDate').value===clock().day)load().catch(()=>{});
  });
 }
 window.HubCalls={start,subscribe,submitLog,clock,checkDigest,submit,loadMine:()=>loadMine().catch(()=>{}),load:()=>load().catch(()=>{}),open:date=>{if(!options||!canReview)return;el('callsTabBtn').click();el('callsDate').value=date||clock().day;load().catch(()=>{});}};
})();
