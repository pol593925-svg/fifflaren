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
 const stage=document.createElement('div');stage.className='hub-hero-grid hub-hero-stage';stage.tabIndex=0;stage.setAttribute('role','region');stage.setAttribute('aria-roledescription','карусель');stage.setAttribute('aria-label','Герои разделов. Колёсико или стрелки вращают сцену, клик открывает раздел.');dialog.append(stage);
 const orbit=document.createElement('div');orbit.className='hub-hero-orbit';orbit.setAttribute('aria-hidden','true');stage.append(orbit);
 const footer=document.createElement('div');footer.className='hub-carousel-footer';dialog.append(footer);
 const previous=document.createElement('button'),next=document.createElement('button'),summary=document.createElement('div');previous.textContent='←';next.textContent='→';previous.setAttribute('aria-label','Предыдущий раздел');next.setAttribute('aria-label','Следующий раздел');summary.className='hub-carousel-summary';summary.setAttribute('aria-live','polite');footer.append(previous,summary,next);
 const hint=document.createElement('p');hint.className='hub-carousel-hint';hint.textContent='Колёсико / ← → — вращать · Клик по герою — открыть · Esc — закрыть';dialog.append(hint);
 let filter='all',items=[],center=0,focusedId=null,wheelDelta=0,lastWheel=0;
 for(const [id,label]of [['all','Все разделы'],...Object.entries(captions)]){const b=document.createElement('button');b.textContent=label;b.dataset.filter=id;b.onclick=()=>{filter=id;render();};filters.append(b);}
 function allowed(b){return !b.hidden&&b.style.display!=='none'&&!b.disabled&&groups[b.dataset.tab];}
 function position(){
  const count=items.length,radius=stage.clientWidth*.41;
  items.forEach((item,i)=>{let d=i-center;if(d>count/2)d-=count;if(d<-count/2)d+=count;const distance=Math.abs(d),visible=distance<=3,step=Math.max(-4,Math.min(4,d)),angle=step*Math.PI/7,scale=1-distance*.145;
   item.button.style.setProperty('--hero-x',Math.sin(angle)*radius+'px');item.button.style.setProperty('--hero-y',(8-Math.min(distance,4)*32)+'px');item.button.style.setProperty('--hero-scale',Math.max(.36,scale));item.button.style.setProperty('--hero-light',Math.max(.52,1-distance*.13));item.button.style.zIndex=String(10-Math.min(distance,4));item.button.style.visibility=visible?'visible':'hidden';item.button.style.opacity=visible?'1':'0';item.button.style.pointerEvents=visible?'auto':'none';item.button.tabIndex=visible?0:-1;item.button.setAttribute('aria-hidden',String(!visible));item.button.classList.toggle('centered',d===0);item.button.setAttribute('aria-current',String(d===0));item.button.dataset.offset=String(d);
  });
  previous.disabled=next.disabled=count<2;summary.replaceChildren();
  if(count){const item=items[center];focusedId=item.id;const title=document.createElement('strong');title.textContent=item.name;const meta=document.createElement('small');meta.textContent=captions[groups[item.id]]+' · '+(center+1)+' / '+count;summary.append(title,meta);}else{focusedId=null;summary.textContent='Разделы не найдены';}
 }
 function rotate(direction){if(items.length<2)return;center=(center+direction+items.length)%items.length;position();}
 previous.onclick=()=>rotate(-1);next.onclick=()=>rotate(1);
 function render(){const query=search.value.trim().toLowerCase();for(const b of filters.children){b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));}
  const available=Array.from(nav.querySelectorAll('[data-tab]')).filter(b=>allowed(b)&&(filter==='all'||groups[b.dataset.tab]===filter)&&(b.title||b.textContent).toLowerCase().includes(query));
  for(const item of items)item.button.remove();items=[];
  for(const original of available){const id=original.dataset.tab,name=original.title||original.textContent.trim(),button=document.createElement('button');button.className='hub-hero-card';button.dataset.section=id;button.setAttribute('aria-label','Открыть '+name);
   const portrait=document.createElement('span');portrait.className='hub-hero-portrait';portrait.style.backgroundPosition=(art[id]*20)+'% center';portrait.setAttribute('aria-hidden','true');button.append(portrait);
   const label=document.createElement('span');label.className='hub-hero-label';label.textContent=name;button.append(label);button.onclick=()=>{if(!allowed(original)){render();return;}dialog.close();original.click();};stage.append(button);items.push({id,name,button,original});
  }
  center=Math.max(0,items.findIndex(item=>item.id===focusedId));position();
 }
 stage.addEventListener('wheel',e=>{if(e.ctrlKey||items.length<2)return;e.preventDefault();const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!Number.isFinite(delta)||!delta)return;const now=performance.now();if(now-lastWheel<150)return;wheelDelta+=delta*(e.deltaMode===1?24:e.deltaMode===2?stage.clientHeight:1);if(Math.abs(wheelDelta)>=45){rotate(Math.sign(wheelDelta));wheelDelta=0;lastWheel=now;}},{passive:false});
 dialog.addEventListener('keydown',e=>{if(e.target===search)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotate(e.key==='ArrowRight'?1:-1);}else if(e.key==='Enter'&&e.target===stage&&items[center]){e.preventDefault();items[center].button.click();}});
 search.oninput=()=>{wheelDelta=0;render();};toggle.onclick=()=>{filter='all';search.value='';focusedId=nav.querySelector('[data-tab].active')?.dataset.tab||focusedId;render();dialog.showModal();position();stage.focus();};toggle.textContent='◈';toggle.title='Выбрать раздел';toggle.setAttribute('aria-label','Выбрать раздел');toggle.setAttribute('aria-haspopup','dialog');
 dialog.addEventListener('close',()=>toggle.focus());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 new ResizeObserver(()=>{if(dialog.open)position();}).observe(stage);
 new MutationObserver(()=>{if(dialog.open)render();}).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','style','hidden','disabled']});document.body.classList.add('hub-heroNavigation');
});
