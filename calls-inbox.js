(function(){
 const TZ='Europe/Simferopol',OFFSET=10800000;
 function clock(now=Date.now()) {const d=new Date(now+OFFSET);return {day:d.toISOString().slice(0,10),hour:d.getUTCHours(),due:new Date(now+OFFSET-(d.getUTCHours()<19?86400000:0)).toISOString().slice(0,10)};}
 let options=null,timer=null,sequence=0,checking=false,rows=[],seen=new Set();
 const el=id=>document.getElementById(id);
 function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 const statusNames={pending:'В ожидании',done:'Сделан',rejected:'Отклонён'};
 let personal=[],minePage=0,mineSeq=0,mineMore=false,owner=false;
 function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 async function api(path,init={}){if(!options?.token)throw Error('Войди заново, чтобы загрузить колы.');const response=await fetch(options.server+path,{...init,headers:{Authorization:'Bearer '+options.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'Не удалось выполнить запрос');return data;}
 function card(row,editable){
  const article=node('article',undefined,'call-entry'),head=node('div'),title=node('strong',row.service||row.kind||'Колл');
  const status=statusNames[row.status]?row.status:'pending',badge=node('span',statusNames[status],'call-badge call-'+status);head.append(title,badge);article.append(head);
  article.append(node('small',[editable?row.user:'',row.kind,new Intl.DateTimeFormat('ru',{timeZone:TZ,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(row.createdAt))].filter(Boolean).join(' · ')));
  const link=node('button',row.link||'Ссылка не указана','call-copy-link');link.type='button';link.title='Нажми, чтобы скопировать ссылку';link.disabled=!row.link;
  link.onclick=async()=>{try{await navigator.clipboard.writeText(row.link);link.textContent='✓ Ссылка скопирована';setTimeout(()=>link.textContent=row.link,1600);}catch{link.textContent='Не удалось скопировать — попробуй ещё раз';}};article.append(link);
  if(row.note)article.append(node('p',row.note));
  if(status==='rejected'&&row.reason)article.append(node('p','Причина: '+row.reason,'call-reason'));
  if(editable){const controls=node('div',undefined,'call-review'),select=node('select'),reason=node('textarea'),save=node('button','Сохранить статус','call-save'),message=node('small');
   select.setAttribute('aria-label','Статус колла');for(const [id,label] of Object.entries(statusNames)){const o=node('option',label);o.value=id;select.append(o);}select.value=status;
   reason.placeholder='Причина отклонения — увидит автор';reason.setAttribute('aria-label','Причина отклонения');reason.maxLength=500;reason.rows=2;reason.value=row.reason||'';reason.hidden=status!=='rejected';
   select.onchange=()=>{reason.hidden=select.value!=='rejected';};save.type='button';
   save.onclick=async()=>{if(select.value==='rejected'&&!reason.value.trim()){message.textContent='Укажи причину отклонения';reason.focus();return;}save.disabled=true;message.textContent='Сохраняем…';try{const data=await api('/api/fifflaren/calls/'+encodeURIComponent(row.id),{method:'PATCH',body:JSON.stringify({status:select.value,reason:reason.value.trim()})});rows=rows.map(r=>r.id===row.id?data.call:r);render();loadMine().catch(()=>{});}catch(e){message.textContent=e.message;save.disabled=false;}};
   controls.append(select,save,reason,message);article.append(controls);
  }return article;
 }
 function render(){const list=el('callsList');list.replaceChildren();el('callsCount').textContent=rows.length;if(!rows.length){list.textContent='За выбранный день колов пока нет.';return;}for(const row of rows)list.append(card(row,true));}
 function setupMine(){if(el('myCallsList'))return;const tab=el('tab-cols'),form=tab.querySelector('.card'),wrap=node('div',undefined,'calls-workspace'),aside=node('aside',undefined,'my-calls-panel');
  form.classList.add('call-compose');form.querySelector('h3').textContent='Новый колл';el('sendCallBtn').textContent='Отправить на рассмотрение';
  const header=node('div',undefined,'my-calls-header'),title=node('h3','Мои колы'),refresh=node('button','↻ Обновить','call-refresh');refresh.type='button';refresh.onclick=()=>loadMine().catch(()=>{});header.append(title,refresh);
  const info=node('p','Твои заявки и результаты рассмотрения','my-calls-info');info.id='myCallsStatus';const list=node('div');list.id='myCallsList';const more=node('button','Показать ещё','call-refresh');more.id='myCallsMore';more.hidden=true;more.onclick=()=>loadMine(true).catch(()=>{});
  aside.append(header,info,list,more);wrap.append(form,aside);tab.append(wrap);
 }
 async function loadMine(append=false){if(!options)return;const seq=++mineSeq,page=append?minePage+1:0,config=options;try{const data=await api('/api/calls/mine?page='+page);if(seq!==mineSeq||config!==options)return;minePage=page;personal=append?personal.concat(data.calls):data.calls;mineMore=data.hasMore;const list=el('myCallsList');list.replaceChildren();if(!personal.length)list.append(node('div','Пока нет колов. Отправь первый — он появится здесь.','call-empty'));for(const row of personal)list.append(card(row,false));el('myCallsStatus').textContent='Всего: '+data.total+' · обновляется автоматически';el('myCallsMore').hidden=!mineMore;}catch(e){if(seq===mineSeq)el('myCallsStatus').textContent=e.message;throw e;}}
 async function submit(fields){await api('/api/events',{method:'POST',body:JSON.stringify({user:options.username,type:'call',...fields})});await loadMine().catch(()=>{});}
 async function fetchDay(date){
  const all=[];let page=0;
  while(true){const r=await fetch(options.server+'/api/fifflaren/calls?date='+encodeURIComponent(date)+'&page='+page,{headers:{Authorization:'Bearer '+options.token},signal:AbortSignal.timeout(15000)});const d=await r.json();
   if(!r.ok||!d.success)throw Error(d.message||'Не удалось загрузить колы');
   all.push(...d.calls);if(!d.hasMore)return {rows:all,team:d.team};page++;
  }
 }
 async function load(date=el('callsDate').value){
  if(!options)return;const seq=++sequence;el('callsStatus').textContent='Загружаем колы…';
  try{const data=await fetchDay(date);if(seq!==sequence)return;rows=data.rows;render();el('callsStatus').textContent='Команда: '+data.team+' · '+date+' · время UTC+3';}
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
 function start(config){
  clearInterval(timer);sequence++;seen.clear();options=null;
  owner=String(config.username).toLowerCase()==='fifflaren';el('callsTabBtn').style.display=owner?'':'none';
  options=config;personal=[];mineSeq++;setupMine();el('myCallsList').replaceChildren();loadMine().catch(()=>{});timer=setInterval(()=>{if(!document.hidden&&el('tab-cols').style.display!=='none')loadMine().catch(()=>{});checkDigest();},20000);if(!owner)return;el('callsDate').value=clock().day;
  el('callsRefresh').onclick=()=>load().catch(()=>{});el('callsDate').onchange=()=>load().catch(()=>{});
  el('callsCopy').onclick=async()=>{try{await navigator.clipboard.writeText(rows.map(r=>[r.service||r.kind,r.link,r.user].join(' — ')).join('\n'));el('callsStatus').textContent='Список скопирован';}catch{el('callsStatus').textContent='Не удалось скопировать список';}};
  if(!config.token){el('callsStatus').textContent='Для личной вкладки нужен новый сервер. После его обновления войди заново.';return;}
  load().catch(()=>{});checkDigest();
 }
 function subscribe(socket){
  if(!options?.token)return;socket.emit('calls_subscribe',options.token);
  if(socket.__hubCallsBound)return;socket.__hubCallsBound=true;
  socket.on('my_call',()=>{loadMine().catch(()=>{});});
  socket.on('call_updated',()=>{loadMine().catch(()=>{});if(owner)load().catch(()=>{});});
  socket.on('fifflaren_call',row=>{
   if(!options||!owner||seen.has(row.id))return;seen.add(row.id);if(seen.size>1000)seen.delete(seen.values().next().value);
   if(row.user.toLowerCase()!=='fifflaren')options.notify({title:'Новый колл · '+row.user,text:(row.service||row.kind)+'\n'+row.link,date:clock().day});
   if(el('callsDate').value===clock().day)load().catch(()=>{});
  });
 }
 window.HubCalls={start,subscribe,clock,checkDigest,submit,loadMine:()=>loadMine().catch(()=>{}),load:()=>load().catch(()=>{}),open:date=>{if(!options)return;el('callsTabBtn').click();el('callsDate').value=date||clock().day;load().catch(()=>{});}};
})();
