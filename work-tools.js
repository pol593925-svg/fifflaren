(function(g){
 'use strict';
 const ids=['callTypeSelect','callServiceName','callLinkInput','callNoteInput'];
 let session=null;
 const get=id=>document.getElementById(id),draftKey=()=> 'hub-call-draft:'+session.username.toLowerCase();
 function start(config){session=config;
   let draft={};try{draft=JSON.parse(localStorage.getItem(draftKey())||'{}')||{};}catch{}
   for(const [i,id] of ids.entries()){const el=get(id);if(!el)continue;el.value=typeof draft[id]==='string'?draft[id]:(i===0?el.options[0].value:'');}
   const status=get('callStatus');if(status)status.textContent=ids.slice(1).some(id=>get(id)?.value)?'Восстановлен черновик':'';
 }
 function save(){if(!session)return;const values=Object.fromEntries(ids.map(id=>[id,get(id).value]));
   try{if(ids.slice(1).some(id=>values[id])||get(ids[0]).selectedIndex>0)localStorage.setItem(draftKey(),JSON.stringify(values));else localStorage.removeItem(draftKey());}catch{}}
 document.addEventListener('input',e=>{if(ids.includes(e.target.id))save();});
 document.addEventListener('change',e=>{if(ids.includes(e.target.id))save();});
 document.addEventListener('hub:call-sent',()=>{if(session){get(ids[0]).selectedIndex=0;try{localStorage.removeItem(draftKey());}catch{}}});
 async function request(path,init={}){
   if(!session?.token)throw Error('Войди в приложение заново.');
   const cfg=session,r=await fetch(cfg.server+path,{...init,headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(15000)});
   const d=await r.json();if(cfg!==session||!r.ok||!d.success)throw Error(d.message||'Запрос не выполнен');return d;
 }
 const names={pending:'В ожидании',done:'Сделан',rejected:'Отклонён',returned:'На доработке',log:'Лог'};
 async function checkLink(link){const {matches}=await request('/api/work/duplicates?link='+encodeURIComponent(link));
   if(matches.length&&!window.confirm('Эта ссылка уже встречалась в твоей команде.\n\n'+matches.map(r=>r.user+' · '+(names[r.status]||r.status)+' · '+new Date(r.createdAt).toLocaleString('ru')).join('\n')+'\n\nОтправить ещё раз?'))throw Error('Отправка отменена.');}
 function node(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;}
 function history(article,row){if(!row.history?.length)return;const details=node('details'),summary=node('summary','История · '+row.history.length);details.append(summary);for(const h of row.history){const p=node('p',[new Date(h.at).toLocaleString('ru'),h.by,h.action==='resubmitted'?'Исправлен и отправлен':h.action==='submitted'?'Отправлен':h.action==='previous'?'До исправления':names[h.status],h.reason,h.service,h.link,h.note].filter(Boolean).join(' · '));details.append(p);}article.append(details);}
 function repair(article,row,onSuccess){
   const open=node('button','Исправить и отправить повторно');open.type='button';article.append(open);open.onclick=()=>{
     open.remove();const form=node('form'),type=node('select'),name=node('input'),link=node('input'),note=node('textarea'),err=node('small'),save=node('button','Отправить на проверку');
     for(const s of ['Колл на биржу','Колл на почту'])type.add(new Option(s,s));type.value=row.kind;name.value=row.service;link.value=row.link;note.value=row.note||'';link.type='url';link.required=name.required=true;name.maxLength=160;note.maxLength=3000;
     for(const [caption,el]of [['Тип',type],['Название',name],['Ссылка',link],['Информация',note]]){const label=node('label',caption);label.append(el);form.append(label);}
     form.append(save,err);article.append(form);name.focus();form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{if(link.value.trim()!==row.link)await checkLink(link.value.trim());await request('/api/calls/mine/'+encodeURIComponent(row.id),{method:'PATCH',body:JSON.stringify({version:row.version||0,callType:type.value,serviceName:name.value,callLink:link.value,callNote:note.value})});await onSuccess();}catch(e){err.textContent=e.message;save.disabled=false;}};
   };
 }
 function exchange(card,row,admin,onUpdate){
   const p=node('p',row.verifiedAt?'Проверил '+row.verifiedBy+' · '+new Date(row.verifiedAt).toLocaleDateString('ru'):'Проверка пока не записана');card.append(p);
   if(row.sourceUrl){try{const u=new URL(row.sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password){const a=node('a','Источник проверки ↗');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}}catch{}}
   if(!row._id||!session)return;const message=node('small'),report=node('button',row.needsReview?'Ожидает проверки':'Данные устарели');report.disabled=!!row.needsReview;card.append(report,message);
   report.onclick=async()=>{report.disabled=true;try{await request('/api/exchanges/'+row._id+'/report',{method:'POST'});row.needsReview=true;onUpdate();}catch(e){report.disabled=false;message.textContent=e.message;}};
   if(admin){const open=node('button','Проверить и обновить ответ');card.append(open);open.onclick=()=>{open.remove();const f=node('form'),source=node('input'),section=node('select'),conditions=node('textarea'),save=node('button','Сохранить проверку');
     source.type='url';source.required=true;source.value=row.sourceUrl||'';source.placeholder='HTTPS-ссылка на источник';section.add(new Option('Точно да','yes'));section.add(new Option('С условиями','condition'));section.add(new Option('Точно нет','no'));section.value=row.section;conditions.value=row.condition||'';conditions.placeholder='Условия или пояснение';f.append(source,section,conditions,save);card.append(f);
     f.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const d=await request('/api/exchanges/'+row._id+'/verify',{method:'PATCH',body:JSON.stringify({sourceUrl:source.value,section:section.value,condition:conditions.value})});Object.assign(row,d.entry);onUpdate();}catch(e){message.textContent=e.message;save.disabled=false;}};
   };}
 }
 g.HubWork={start,checkLink,history,repair,exchange};
})(window);
