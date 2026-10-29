(function(){
 const brands={'3commas':'3commas.io','bitopro':'www.bitopro.com','bitpoint':'www.bitpoint.co.jp','coincheck':'coincheck.com','coinhako':'www.coinhako.com','deribit':'www.deribit.com','digifinex':'www.digifinex.com','latoken':'latoken.com','la-token':'latoken.com','mercadobitcoin':'www.mercadobitcoin.com.br','nicehash':'www.nicehash.com','paribu':'www.paribu.com','polymarket':'polymarket.com','redotpay':'www.redotpay.com','solflare':'www.solflare.com','tokocrypto':'www.tokocrypto.com','tradesilvania':'www.tradesilvania.com','woox':'woox.io'};
 const labels={yes:'Точно да',condition:'С условиями',no:'Точно нет'};
 let selectedKey=null;let entries=[],filter='all',shown=60,config=null;
 const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/[\u0300-\u036f]/g,'').trim();
 function safeUrl(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function website(row){
  if(row.website)return safeUrl(row.website);
  const name=String(row.name||'').trim(),known=brands[name.toLowerCase()];if(known)return 'https://'+known+'/';
  if(/^https:\/\//i.test(name))return safeUrl(name);
  if(/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[\/:?#]|$)/i.test(name))return safeUrl('https://'+name);
  return null;
 }
 function rank(row,q){const name=norm(row.name),site=norm(website(row));if(!q)return 1;if(name===q||site.replace(/\/$/,'')===q.replace(/\/$/,''))return 4;if(name.startsWith(q)||site.startsWith(q))return 3;if(name.includes(q)||site.includes(q))return 2;return 0;}
 function render(){
  const grid=document.getElementById('exchangeGrid');if(!grid)return;
  const input=document.getElementById('exchangeSearchInput').value.trim();
  let query=input;try{if(/^https?:\/\//i.test(input))query=new URL(input).hostname;}catch{}
  const q=norm(query),matches=entries.filter(r=>filter==='all'||r.section===filter).map(r=>({r,score:rank(r,q)})).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.r.name.localeCompare(b.r.name));
  grid.replaceChildren();document.getElementById('exchangeResultsCount').textContent=matches.length+' из '+entries.length;
  const exact=matches.filter(m=>m.score===4),chosen=matches.find(m=>selectedKey===m.r.name+'|'+m.r.section)||(exact.length===1?exact[0]:matches.length===1&&q?matches[0]:null);
  if(!q){const p=document.createElement('p');p.className='exchange-prompt';p.textContent='Введи название биржи или её ссылку. Здесь появится крупный ответ из справочника команды, условия и официальный сайт.';grid.append(p);}
  else if(!chosen){for(const {r}of matches.slice(0,shown)){const b=document.createElement('button');b.className='exchange-choice';const title=document.createElement('strong');title.textContent=r.name;const label=document.createElement('small');label.textContent=labels[r.section];b.append(title,label);b.onclick=()=>{selectedKey=r.name+'|'+r.section;render();};grid.append(b);}}
  for(const {r} of chosen?[chosen]:[]){
   const card=document.createElement('article');card.className='exchange-card';card.dataset.section=r.section;
   const head=document.createElement('header'),logo=document.createElement('div');logo.className='exchange-logo';logo.textContent=r.name.replace(/^https?:\/\//,'').slice(0,2).toUpperCase();
   const url=website(r);if(url){const img=document.createElement('img');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=safeUrl(r.logo)||'https://www.google.com/s2/favicons?sz=64&domain_url='+encodeURIComponent(url);img.onerror=()=>img.remove();logo.append(img);}
   const title=document.createElement('h3');title.textContent=r.name;head.append(logo,title);card.append(head);
   const badge=document.createElement('span');badge.className='exchange-badge';badge.textContent=labels[r.section];card.append(badge);
   const condition=document.createElement('p');condition.className='exchange-condition';condition.textContent=r.condition||(r.section==='condition'?'Условия не заполнены в справочнике. Уточни их у руководителя.':r.section==='yes'?'Разрешено по справочнику команды.':'Не разрешено по справочнику команды.');card.append(condition);
   const foot=document.createElement('footer');
   if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Перейти на сайт ↗';link.title=url;foot.append(link);}else{const s=document.createElement('span');s.textContent='Сайт пока не указан';foot.append(s);}
   if(config?.isAdmin()){const edit=document.createElement('button');edit.className='exchange-edit';edit.textContent=url?'Изменить сайт':'Указать сайт';edit.onclick=async()=>{
    const raw=prompt('HTTPS-ссылка на сайт для '+r.name,url||'https://');if(raw===null)return;const link=safeUrl(raw.trim());if(!link){alert('Укажи корректную HTTPS-ссылку');return;}
    const logoRaw=prompt('Ссылка на логотип (HTTPS). Оставь пустой для иконки сайта.',r.logo||'');if(logoRaw===null)return;if(logoRaw&&!safeUrl(logoRaw)){alert('Некорректный адрес логотипа');return;}
    try{await config.save(r,link,logoRaw);r.website=link;r.logo=logoRaw;render();}catch(e){alert(e.message);}
   };foot.append(edit);}
   card.append(foot);grid.append(card);
  }
  if(!matches.length){grid.textContent='Нет данных в справочнике. Проверь название или уточни у руководителя.';}
  document.getElementById('exchangeMore').hidden=!q||!!chosen||shown>=matches.length;
  for(const b of document.querySelectorAll('[data-exchange-filter]')){b.classList.toggle('active',b.dataset.exchangeFilter===filter);b.setAttribute('aria-pressed',String(b.dataset.exchangeFilter===filter));}
 }
 function init(){
  for(const b of document.querySelectorAll('[data-exchange-filter]'))if(labels[b.dataset.exchangeFilter])b.textContent=labels[b.dataset.exchangeFilter];
  document.getElementById('exchangeSearchInput').addEventListener('input',()=>{selectedKey=null;shown=60;render();});
  document.querySelectorAll('[data-exchange-filter]').forEach(b=>b.onclick=()=>{selectedKey=null;filter=b.dataset.exchangeFilter;shown=60;render();});
  document.getElementById('exchangeClear').onclick=()=>{document.getElementById('exchangeSearchInput').value='';selectedKey=null;filter='all';shown=60;render();};
  document.getElementById('exchangeMore').onclick=()=>{shown+=60;render();};render();
 }
 document.addEventListener('DOMContentLoaded',init);
 window.HubExchanges={set:data=>{entries=data;render();},configure:c=>{config=c;render();},render,website,rank};
})();
