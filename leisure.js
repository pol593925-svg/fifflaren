/* One lightweight gateway to existing games. Opening the chooser starts no game. */
(function(){
  'use strict';
  const games=[
    {id:'cs16',title:'Counter-Strike',tag:'КС · 5 × 5',description:'Командные раунды, оружие и способности. Собирай команду и выходи на карту.',action:'Открыть КС',art:'combat'},
    {id:'voxel',title:'Блочный мир',tag:'ОБЩИЙ МИР · 18+',description:'Исследуй, строй и создавай. Постройки и инвентарь остаются в общем мире.',action:'Войти в мир',art:'world'},
    {id:'casino',title:'Казино',tag:'ИГРЫ И БАЛЛЫ',description:'Выбирай любимую игру и следи за результатами команды.',action:'Открыть казино',art:'casino'}
  ];
  let dialog,launcher,launching=false;
  const cards=new Map(),$=id=>document.getElementById(id);
  const original=id=>document.querySelector('.tabs [data-tab="'+id+'"]');
  const allowed=id=>{const button=original(id);return !!button&&!button.hidden&&!button.disabled&&button.style.display!=='none';};
  function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  const artPaths={combat:'M19 21h58v8H46l-7 26H23l8-26H19z M77 22h15v5H77 M57 29v9h12v-9 M41 14h28 M26 20l7-8h10 M42 49h12',world:'m52 8 29 17-29 17-29-17z M23 25v35l29 17 29-17V25 M52 42v35 M37 17l29 17 M23 46l29 17 29-17 M37 33v35 M66 34v34',casino:'M27 13h51l6 10v54H21V23z M27 13l-6 10h63 M31 33h12v26H31z M50 33h12v26H50z M69 33h8v26h-8 M29 69h47 M84 39h12V26 M40 33l-5 26 M59 33l-5 26'};
  function artwork(kind){
    const wrap=element('div','leisure-art leisure-art-'+kind);wrap.setAttribute('aria-hidden','true');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 108 88');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',artPaths[kind]);svg.append(path);wrap.append(svg);
    const orbit=element('i','leisure-art-orbit');wrap.append(orbit);return wrap;
  }
  function announce(){document.dispatchEvent(new Event('hub:leisure-state'));}
  function refresh(){
    const active=document.querySelector('.tabs [data-tab].active')?.dataset.tab;
    for(const game of games){const state=cards.get(game.id);if(!state)continue;state.button.disabled=!allowed(game.id);state.card.classList.toggle('is-current',active===game.id);state.current.hidden=active!==game.id;state.button.textContent=active===game.id?'Вернуться в игру':game.action;}
    const entry=document.querySelector('.tabs [data-leisure-menu]');if(entry)entry.disabled=!games.some(game=>allowed(game.id));
  }
  function mount(){
    if(dialog)return true;
    if(!document.body||!document.querySelector('.terra-dock'))return false;
    dialog=element('dialog','hub-leisure-dialog');dialog.id='hubLeisureDialog';dialog.setAttribute('aria-labelledby','hubLeisureTitle');
    const header=element('header','leisure-heading'),copy=element('div');copy.append(element('span','leisure-eyebrow','ПЕРЕРЫВ ДЛЯ СЕБЯ'));
    const title=element('h2',null,'Досуг');title.id='hubLeisureTitle';copy.append(title,element('p',null,'Три игры команды — выбирай настроение.'));
    const close=element('button','leisure-close','×');close.type='button';close.setAttribute('aria-label','Закрыть досуг');close.onclick=()=>dialog.close();header.append(copy,close);dialog.append(header);
    const grid=element('div','leisure-grid');
    for(const game of games){
      const card=element('article','leisure-card leisure-card-'+game.art);card.dataset.leisureCard=game.id;card.append(artwork(game.art));
      const content=element('div','leisure-card-copy'),top=element('div','leisure-card-top');top.append(element('span','leisure-tag',game.tag));
      const current=element('span','leisure-current','Открыто сейчас');current.hidden=true;top.append(current);
      content.append(top,element('h3',null,game.title),element('p',null,game.description));
      const button=element('button','leisure-launch',game.action);button.type='button';button.dataset.leisureLaunch=game.id;button.onclick=()=>launch(game.id);
      content.append(button);card.append(content);grid.append(card);cards.set(game.id,{card,button,current});
    }
    dialog.append(grid);
    const foot=element('footer','leisure-footer');foot.append(element('span',null,'Рабочие разделы всегда рядом.'));
    const back=element('button','leisure-back','Вернуться к смене');back.type='button';back.onclick=()=>{launching=true;dialog.close();window.HubWorkspace?.open('shift')||original('shift')?.click();};foot.append(back);dialog.append(foot);
    dialog.addEventListener('close',()=>{announce();if(!launching&&launcher?.isConnected)launcher.focus({preventScroll:true});launching=false;});
    dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();});
    document.body.append(dialog);
    new MutationObserver(()=>{if(dialog.open)refresh();}).observe(document.querySelector('.tabs'),{subtree:true,attributes:true,attributeFilter:['hidden','style','disabled','class']});
    return true;
  }
  function open(source){
    if(!mount())return false;
    launcher=source instanceof HTMLElement?source:document.querySelector('[data-terra-tab="leisure"]');
    window.HubTerra?.closeMenu();refresh();
    if(!dialog.open)dialog.showModal();announce();
    dialog.querySelector('.leisure-launch:not(:disabled)')?.focus({preventScroll:true});return true;
  }
  function launch(id){
    if(!games.some(game=>game.id===id)||!allowed(id))return false;
    launching=true;if(dialog?.open)dialog.close();
    // Use existing routing, including game engine loading and original game entry hooks.
    original(id).click();return true;
  }
  window.HubLeisure={open,launch,close:()=>dialog?.close(),isOpen:()=>!!dialog?.open};
  document.addEventListener('DOMContentLoaded',mount);
})();
