(function(){
 'use strict';
 let options=null,api=null,canReview=()=>false,rows=[],limit=20,sequence=0,busy=false;
 const el=id=>document.getElementById(id);
 function node(tag,text,className){const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;}
 function safeUrl(value){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
 function entry(row,removable){
  const article=node('article',undefined,'hunt-entry'),head=node('div',undefined,'hunt-entry-head'),url=safeUrl(row.url),link=node('a',row.url||'Ссылка недоступна','hunt-link');
  if(url){link.href=url;link.target='_blank';link.rel='noopener noreferrer';}else{link.removeAttribute('href');link.classList.add('disabled');}
  head.append(link);if(removable){const remove=node('button','×','hunt-remove');remove.type='button';remove.title='Удалить хант';remove.setAttribute('aria-label','Удалить хант '+(row.url||''));remove.disabled=busy;remove.onclick=()=>removeHunt(row.id,remove);head.append(remove);}article.append(head,node('p',row.note||'Без описания','hunt-note'));return article;
 }
 function render(){
  const list=el('myHuntsList');if(!list)return;el('myHuntsCount').textContent=rows.length+' / '+limit;list.replaceChildren();
  if(!rows.length)list.append(node('p','Пока пусто. Добавь первую ссылку и коротко опиши её.','hunt-empty'));else for(const row of rows)list.append(entry(row,true));
  el('huntAddButton').disabled=busy||rows.length>=limit;el('myHuntsLimit').textContent=rows.length>=limit?'Достигнут лимит: 20 ссылок. Удали лишнюю, чтобы добавить новую.':'До 20 ссылок · описание до 300 символов';
 }
 function setup(){
  if(el('myHuntsPanel'))return;const calls=el('tab-shift')?.querySelector('.my-calls-panel');if(!calls)return;
  const panel=node('section',undefined,'hunts-panel');panel.id='myHuntsPanel';
  const header=node('div',undefined,'hunts-header'),title=node('h3','Мои ханты'),count=node('span','0 / 20','hunts-count');count.id='myHuntsCount';header.append(title,count);
  const form=node('form',undefined,'hunts-form');form.id='myHuntsForm';
  const url=node('input');url.id='huntUrl';url.type='url';url.required=true;url.maxLength=2048;url.placeholder='https://…';url.setAttribute('aria-label','Ссылка на хант');url.autocomplete='off';
  const note=node('textarea');note.id='huntNote';note.required=true;note.maxLength=300;note.rows=2;note.placeholder='Кратко: что это и что проверить';note.setAttribute('aria-label','Краткая информация о ханте');
  const add=node('button','+ Добавить хант','hunt-add');add.id='huntAddButton';add.type='submit';
  const status=node('p','','hunt-status');status.id='myHuntsStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const hint=node('p','До 20 ссылок · описание до 300 символов','hunt-limit');hint.id='myHuntsLimit';
  const list=node('div',undefined,'hunts-list');list.id='myHuntsList';form.append(url,note,add,status);panel.append(header,form,hint,list);calls.append(panel);
  form.onsubmit=event=>{event.preventDefault();addHunt();};
 }
 async function load(){
  if(!options)return;const seq=++sequence,config=options;el('myHuntsStatus').textContent='';
  try{const data=await api('/api/hunts/mine');if(config!==options||seq!==sequence)return;rows=Array.isArray(data.hunts)?data.hunts.slice(0,20):[];limit=data.limit===20?20:limit;render();}
  catch(error){if(config===options&&seq===sequence)el('myHuntsStatus').textContent=error.message;}
 }
 async function addHunt(){
  if(busy||rows.length>=limit)return;const url=safeUrl(el('huntUrl').value),note=el('huntNote').value.trim(),status=el('myHuntsStatus');
  if(!url||!note||note.length>300){status.textContent='Проверь HTTP/HTTPS-ссылку и заполни описание до 300 символов.';return;}
  busy=true;status.textContent='Сохраняем…';render();
  try{const data=await api('/api/hunts/mine',{method:'POST',body:JSON.stringify({url,note})});rows=data.hunts||[];el('huntUrl').value='';el('huntNote').value='';status.textContent='Хант сохранён.';render();el('huntUrl').focus();}
  catch(error){status.textContent=error.message;}finally{busy=false;render();}
 }
 async function removeHunt(id,button){
  if(busy)return;busy=true;button.disabled=true;el('myHuntsStatus').textContent='Удаляем…';render();
  try{const data=await api('/api/hunts/mine/'+encodeURIComponent(id),{method:'DELETE'});rows=data.hunts||[];el('myHuntsStatus').textContent='Хант удалён.';}
  catch(error){el('myHuntsStatus').textContent=error.message;}finally{busy=false;render();}
 }
 function teamDialog(){
  let dialog=el('teamHuntsDialog');if(dialog)return dialog;dialog=node('dialog',undefined,'desk-dialog team-hunts-dialog');dialog.id='teamHuntsDialog';
  const close=node('button','×','desk-close');close.type='button';close.setAttribute('aria-label','Закрыть ханты сотрудника');close.onclick=()=>dialog.close();
  const title=node('h2','Ханты сотрудника');title.id='teamHuntsTitle';const status=node('p','','desk-form-status');status.id='teamHuntsStatus';status.setAttribute('role','status');
  const list=node('div',undefined,'hunts-list team-hunts-list');list.id='teamHuntsList';dialog.append(close,title,status,list);document.body.append(dialog);return dialog;
 }
 async function openTeam(username){
  if(!options||!canReview())return;const dialog=teamDialog(),config=options,seq=++sequence;el('teamHuntsTitle').textContent='Ханты · '+username;el('teamHuntsStatus').textContent='Загружаем…';el('teamHuntsList').replaceChildren();if(!dialog.open)dialog.showModal();
  try{const data=await api('/api/fifflaren/hunts/'+encodeURIComponent(username));if(config!==options||seq!==sequence)return;el('teamHuntsStatus').textContent='Сохранено: '+(data.hunts?.length||0)+' из 20';const list=el('teamHuntsList');list.replaceChildren();if(!data.hunts?.length)list.append(node('p','Сотрудник пока не добавил ханты.','hunt-empty'));else for(const row of data.hunts)list.append(entry(row,false));}
  catch(error){if(config===options&&seq===sequence)el('teamHuntsStatus').textContent=error.message;}
 }
 function start(config,services){options=config;api=services.api;canReview=services.canReview;rows=[];busy=false;sequence++;setup();render();load();el('teamHuntsDialog')?.close();}
 window.HubHunts={start,openTeam,reload:load};
})();
