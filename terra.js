/* TERRA 5.0: preserve the original controls, data, permissions and event handlers. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const $=id=>document.getElementById(id), body=document.body, nav=document.querySelector('.tabs');
  if(!nav)return;
  body.classList.remove('hub-floating-nav','hub-dock-expanded','hub-navCollapsed');
  body.classList.add('terra');
  // A new installation starts in the selected warm theme; existing users may switch to night mode.
  try{body.classList.toggle('light',localStorage.getItem('terra-appearance')!=='night');}catch{body.classList.add('light');}
  const themeButton=$('themeToggleBtn');
  themeButton?.addEventListener('click',()=>{
    try{localStorage.setItem('terra-appearance',body.classList.contains('light')?'day':'night');}catch{}
  });
  const build=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const getButton=id=>nav.querySelector('[data-tab="'+id+'"]');
  const allowed=b=>b&&!b.hidden&&b.style.display!=='none'&&!b.disabled;
  const icon=id=>window.HubNavIcon?.(id)||document.createTextNode('•');
  const toggle=document.querySelector('.hub-menuToggle');
  const scrim=build('button','terra-nav-scrim');scrim.type='button';scrim.setAttribute('aria-label','Закрыть меню');scrim.hidden=true;body.append(scrim);
  function menu(open){
    body.classList.toggle('terra-menu-open',open);scrim.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрыть разделы':'Все разделы');
    if(open)nav.querySelector('.terra-nav-search')?.focus();else toggle.focus({preventScroll:true});
  }
  toggle.onclick=()=>menu(!body.classList.contains('terra-menu-open'));
  scrim.onclick=()=>menu(false);
  const search=build('input','terra-nav-search');search.placeholder='Найти раздел…';search.setAttribute('aria-label','Поиск раздела');nav.querySelector('.hub-brand')?.after(search);
  search.oninput=()=>{const q=search.value.trim().toLocaleLowerCase('ru');for(const b of nav.querySelectorAll('[data-tab]'))b.classList.toggle('terra-filtered',!((b.title||b.textContent).toLocaleLowerCase('ru').includes(q)));};
  nav.addEventListener('click',e=>{if(e.target.closest('[data-tab]'))menu(false);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&body.classList.contains('terra-menu-open')){e.preventDefault();menu(false);}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')&&!document.querySelector('.cs16-fullscreen')){e.preventDefault();menu(true);}
  });
  const dock=build('nav','terra-dock');dock.setAttribute('aria-label','Быстрые разделы');body.append(dock);
  const dockItems=[['shift','Смена'],['exchanges','Биржи'],['tasks','Задачи'],['chat','Общение'],['cs16','КС'],['cinema','Кинозал'],['all','Разделы']];
  for(const [id,title] of dockItems){
    const b=build('button','',null);b.type='button';b.dataset.terraTab=id;b.append(icon(id==='cinema'?'feed':id==='all'?'hq':id),build('span','',title));
    b.onclick=()=>{if(id==='all')return menu(true);if(id==='cinema')return $('cinemaButton')?.click();const original=getButton(id);if(allowed(original))original.click();};
    dock.append(b);
  }
  function refreshDock(){
    const current=nav.querySelector('[data-tab].active')?.dataset.tab;
    for(const b of dock.querySelectorAll('button')){
      const id=b.dataset.terraTab,original=getButton(id);
      b.hidden=id!=='all'&&id!=='cinema'&&!allowed(original);
      b.classList.toggle('active',id===current);
      b.setAttribute('aria-current',id===current?'page':'false');
    }
  }
  new MutationObserver(refreshDock).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','hidden','style','disabled']});refreshDock();
  const brand=nav.querySelector('.hub-brand');if(brand){brand.querySelector('small').textContent='TERRA / 5.0.0';}
  const eyebrow=document.querySelector('.hub-eyebrow');if(eyebrow)eyebrow.textContent='SUPPORT HUB / TERRA 5.0';
  // The clock and existing action buttons are re-laid out, never recreated.
  const shift=$('tab-shift'),card=shift?.querySelector('.orbit-card'),ring=shift?.querySelector('.shift-orbit');
  if(card&&ring){
    card.classList.add('terra-shift-card');card.querySelector('h3').textContent='Моя смена';
    const core=ring.querySelector('.shift-orbit-core');
    const actions=build('div','terra-shift-actions'),secondary=build('div','terra-shift-secondary');
    for(const [cls,title,where]of [['orbit-addOneBtn','Добавить лог · +1',actions],['orbit-call','Новый колл',actions],['orbit-addFiveBtn','+5 логов',secondary],['orbit-copyBtn','Скопировать отчёт',secondary]]){
      const b=ring.querySelector('.'+cls);if(!b)continue;b.replaceChildren(build('span','',title));b.classList.add('terra-action');where.append(b);
    }
    ring.append(actions,secondary);
    const tools=build('section','terra-work-tools');tools.append(build('h4','','Рабочие инструменты'));
    const grid=build('div','terra-tool-grid');tools.append(grid);
    const ids=['hq','support','notes','leave','crypto','mycalls'];
    for(const id of ids){
      const original=getButton(id);if(!original)continue;
      const b=build('button');b.type='button';b.dataset.terraTool=id;b.append(icon(id),build('span','',original.title));b.onclick=()=>{if(allowed(original))original.click();};grid.append(b);
    }
    card.append(tools);
    const syncTools=()=>{for(const b of grid.children)b.hidden=!allowed(getButton(b.dataset.terraTool));};
    new MutationObserver(syncTools).observe(nav,{subtree:true,attributes:true,attributeFilter:['style','hidden','disabled']});syncTools();
    const extras=[...shift.children].filter(n=>n.classList.contains('card')&&n!==card&&!n.id);
    for(const extra of extras)extra.classList.add('terra-shift-extra');
    const legend=build('p','terra-shift-note','Результаты сохраняются в смене. Логи и коллы — рядом с командой.');card.append(legend);
    core.querySelector('small').textContent='ВРЕМЯ В СМЕНЕ';
  }
  // Defer expensive hidden decoration and respect the user's reduced-motion setting.
  document.querySelectorAll('.content img').forEach(img=>{img.loading='lazy';img.decoding='async';});
  const init=()=>{if(allowed(getButton('shift')))getButton('shift').click();};
  document.addEventListener('hub:work-ready',init);
  window.HubTerra={openMenu:()=>menu(true),closeMenu:()=>menu(false)};
});

