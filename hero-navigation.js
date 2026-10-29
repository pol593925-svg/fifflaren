/* The original navigation remains the sole source of permissions and click handlers. */
document.addEventListener('DOMContentLoaded',()=>{
 const nav=document.querySelector('.tabs'),toggle=document.querySelector('.hub-menuToggle');if(!nav||!toggle)return;
 const groups={hq:'work',support:'work',shift:'work',cols:'work',mycalls:'work',leave:'work',notes:'work',tasks:'work',crypto:'work',exchanges:'work',feed:'social',chat:'social',pm:'social',swipe:'social',casino:'games',tops:'games',battleship:'games',cs16:'games',support2:'games',voxel:'games',tlpanel:'admin',admin:'admin'};
 const art={hq:0,support:1,shift:0,cols:1,mycalls:0,leave:2,notes:2,tasks:2,crypto:5,exchanges:5,feed:2,chat:1,pm:1,swipe:1,casino:3,tops:5,battleship:4,cs16:4,support2:5,voxel:2,tlpanel:0,admin:5};
 const captions={work:'Работа',social:'Общение',games:'Игры и отдых',admin:'Управление'};
 const dialog=document.createElement('dialog');dialog.className='hub-selector';dialog.setAttribute('aria-label','Выбор раздела');document.body.append(dialog);
 const head=document.createElement('header');head.className='hub-selector-head';head.innerHTML='<div><small>SUPPORT HUB / ВЫБОР РАЗДЕЛА</small><h2>Твоё пространство</h2><p>Выбери, чем займёмся сейчас</p></div>';dialog.append(head);
 const close=document.createElement('button');close.textContent='✕';close.className='hub-selector-close';close.setAttribute('aria-label','Закрыть выбор раздела');head.append(close);close.onclick=()=>dialog.close();
 const controls=document.createElement('div');controls.className='hub-selector-controls';dialog.append(controls);const filters=document.createElement('div');filters.className='hub-selector-filters';controls.append(filters);const search=document.createElement('input');search.placeholder='Найти раздел…';search.setAttribute('aria-label','Найти раздел');controls.append(search);
 const grid=document.createElement('div');grid.className='hub-hero-grid';dialog.append(grid);let filter='all';
 for(const [id,label]of [['all','Все разделы'],...Object.entries(captions)]){const b=document.createElement('button');b.textContent=label;b.dataset.filter=id;b.onclick=()=>{filter=id;render();};filters.append(b);}
 function allowed(b){return !b.hidden&&b.style.display!=='none'&&!b.disabled&&groups[b.dataset.tab];}
 function render(){const query=search.value.trim().toLowerCase();grid.replaceChildren();for(const b of filters.children)b.classList.toggle('active',b.dataset.filter===filter);
  for(const original of nav.querySelectorAll('[data-tab]')){const id=original.dataset.tab,name=original.title||original.textContent.trim();if(!allowed(original)||(filter!=='all'&&groups[id]!==filter)||!name.toLowerCase().includes(query))continue;
   const card=document.createElement('button');card.className='hub-hero-card'+(original.classList.contains('active')?' selected':'');card.dataset.section=id;card.setAttribute('aria-label',name);const portrait=document.createElement('span');portrait.className='hub-hero-portrait';portrait.style.backgroundPosition=(art[id]*20)+'% center';card.append(portrait);
   const emblem=document.createElement('span');emblem.className='hub-hero-emblem';emblem.textContent=original.textContent.trim().split(' ')[0];card.append(emblem);const label=document.createElement('span');label.className='hub-hero-label';const group=document.createElement('small');group.textContent=captions[groups[id]];const title=document.createElement('strong');title.textContent=name;const action=document.createElement('span');action.textContent=original.classList.contains('active')?'Сейчас открыт':'Открыть раздел →';label.append(group,title,action);card.append(label);
   card.onclick=()=>{if(!allowed(original)){render();return;}dialog.close();original.click();};grid.append(card);
  }
  if(!grid.children.length){const empty=document.createElement('p');empty.className='hub-selector-empty';empty.textContent='Разделы не найдены';grid.append(empty);}
 }
 search.oninput=render;toggle.onclick=()=>{render();dialog.showModal();search.focus();};toggle.textContent='◈';toggle.title='Выбрать раздел';toggle.setAttribute('aria-label','Выбрать раздел');toggle.setAttribute('aria-haspopup','dialog');dialog.addEventListener('close',()=>toggle.focus());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 new MutationObserver(()=>{if(dialog.open)render();}).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','style','hidden','disabled']});document.body.classList.add('hub-heroNavigation');
});
