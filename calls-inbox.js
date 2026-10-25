(function(){
 const TZ='Europe/Simferopol',OFFSET=10800000;
 function clock(now=Date.now()) {const d=new Date(now+OFFSET);return {day:d.toISOString().slice(0,10),hour:d.getUTCHours(),due:new Date(now+OFFSET-(d.getUTCHours()<19?86400000:0)).toISOString().slice(0,10)};}
 let options=null,timer=null,sequence=0,checking=false,rows=[],seen=new Set();
 const el=id=>document.getElementById(id);
 function safeLink(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function render(){
  const list=el('callsList');list.replaceChildren();el('callsCount').textContent=rows.length;
  if(!rows.length){list.textContent='За выбранный день колов пока нет.';return;}
  for(const row of rows){
   const card=document.createElement('article');card.className='call-entry';
   const head=document.createElement('div'),title=document.createElement('strong');title.textContent=row.service||row.kind||'Колл';head.append(title);
   const meta=document.createElement('small');meta.textContent=[row.user,row.kind,new Intl.DateTimeFormat('ru',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(row.createdAt))].filter(Boolean).join(' · ');head.append(meta);card.append(head);
   const link=safeLink(row.link),a=document.createElement(link?'a':'span');a.textContent=row.link||'Ссылка не указана';if(link){a.href=link;a.target='_blank';a.rel='noopener noreferrer';}card.append(a);
   if(row.note){const p=document.createElement('p');p.textContent=row.note;card.append(p);}list.append(card);
  }
 }
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
  if(!options||checking)return;
  const now=clock(),key='hub_calls_digest_fifflaren',last=localStorage.getItem(key);
  if(!last&&now.hour<19){localStorage.setItem(key,now.due);return;}
  if(last===now.due)return;checking=true;
  try{const report=await fetchDay(now.due);options.notify({title:'Колы команды за '+now.due,text:'Сводка к 19:00 готова. Коллов: '+report.rows.length+'. Нажми, чтобы открыть список.',date:now.due});localStorage.setItem(key,now.due);}
  catch(e){el('callsStatus').textContent='Сводка будет повторно запрошена после восстановления связи.';}finally{checking=false;}
 }
 function start(config){
  clearInterval(timer);sequence++;seen.clear();options=null;
  const allowed=String(config.username).toLowerCase()==='fifflaren';el('callsTabBtn').style.display=allowed?'':'none';
  if(!allowed)return;options=config;el('callsDate').value=clock().day;
  el('callsRefresh').onclick=()=>load().catch(()=>{});el('callsDate').onchange=()=>load().catch(()=>{});
  el('callsCopy').onclick=async()=>{try{await navigator.clipboard.writeText(rows.map(r=>[r.service||r.kind,r.link,r.user].join(' — ')).join('\n'));el('callsStatus').textContent='Список скопирован';}catch{el('callsStatus').textContent='Не удалось скопировать список';}};
  if(!config.token){el('callsStatus').textContent='Для личной вкладки нужен новый сервер. После его обновления войди заново.';return;}
  load().catch(()=>{});checkDigest();timer=setInterval(checkDigest,20000);
 }
 function subscribe(socket){
  if(!options?.token)return;socket.emit('calls_subscribe',options.token);
  if(socket.__hubCallsBound)return;socket.__hubCallsBound=true;
  socket.on('fifflaren_call',row=>{
   if(!options||seen.has(row.id))return;seen.add(row.id);if(seen.size>1000)seen.delete(seen.values().next().value);
   if(row.user.toLowerCase()!=='fifflaren')options.notify({title:'Новый колл · '+row.user,text:(row.service||row.kind)+'\n'+row.link,date:clock().day});
   if(el('callsDate').value===clock().day)load().catch(()=>{});
  });
 }
 window.HubCalls={start,subscribe,clock,checkDigest,load:()=>load().catch(()=>{}),open:date=>{if(!options)return;el('callsTabBtn').click();el('callsDate').value=date||clock().day;load().catch(()=>{});}};
})();
