(function(global){'use strict';
 const FEED='https://api.github.com/repos/pol593925-svg/fifflaren/releases?per_page=100',CACHE='hub-release-history-v1';
 const TERRA={title:'TERRA · Новое пространство команды',intro:'Рабочий день, общение и отдых — в едином тёплом стиле. Светлые поверхности, лесной зелёный и спокойный ночной режим.',groups:[
  ['Добавлено','Новая навигация и оформление',[
   'Нижняя панель быстрых разделов. Полное меню открывается кнопкой «Разделы» или сочетанием Ctrl + K; нужную вкладку можно найти поиском.',
   'Единый стиль для смены, коллов, бирж, заметок, задач, штаба, поддержки, чатов и административных экранов.',
   'Радио, кинозал, казино и игровые меню получили оформление TERRA. Доступ к инструментам по-прежнему зависит от роли сотрудника.']],
  ['Изменено','Смена и игровой мир',[
   'На экране смены рядом расположены время и действия, живая лента команды и личные коллы. Логи, черновики, статусы, причины отказа и отчёт сохранили прежнюю механику.',
   'Dust2 и Inferno пересобраны: фактурные фасады, каменные наличники, обновлённые земля, растительность, плющ, свет и тени.',
   'Оружие расположено ниже и дальше от камеры, освобождая обзор. Прицеливание осталось по центру экрана.']],
  ['Исправлено','Меньше лишней нагрузки',[
   'С летних карт убран снег. Декоративная растительность ограничена расстоянием и выбранным качеством.',
   'Рабочие вкладки не загружают 3D-движок. Для 4K-экранов ограничено внутреннее разрешение рендера; автоматическое качество быстрее реагирует на сильное падение частоты кадров.',
   'Сокращена искусственная пятисекундная заставка казино. Медиа, постройки, заметки и рабочие данные не сбрасываются.']]
 ],checks:'Перед выпуском проверены рабочие формы, права сотрудника, день и ночь, размеры окон, прицеливание, обе карты, запуск Electron и восстановление после потери графического контекста. Производительность зависит от компьютера и качества графики.'};
 const UPCOMING={tag:'v6.0.0',title:'Следующая глава · 6.0.0',planned:true,groups:[
  ['В разработке','Живописный аниме-стиль КС',[
   'Плавная архитектура, проходимые дома, двери, окна, укрытия и подземные маршруты. Два плента: A и B.',
   'Детализация рук, всего арсенала и пяти питомцев: выразительные силуэты, ткань, эмаль, металл и анимации.',
   'Бой 5 на 5 по раундам. Снайперское оружие с оптическим увеличением; техника и РПГ исключены из нового режима.',
   'Подтверждённые попадания: рисованные искры на цели, маркер у прицела и число урона. Отдельные эффекты для брони, попадания в голову и устранения; промах не показывает урон.']],
  ['Подготовка','Сначала проверка в игре',[
   'Новый экран подготовки матча: составы команд, герои и проценты загрузки каждого. Старт после готовности всех игроков и общего отсчёта; время на покупку оружия сохраняется.',
   'Настройка производительности для слабых компьютеров, проверка прицеливания, эффектов и загрузки карт.',
   'Скриншоты и проверки готовятся в локальной сборке. Обновление ещё не опубликовано; дата выхода не объявлена.']]
 ]};
 let entries=[],dialog,list,article,status,button,selected=UPCOMING.tag,loadedAt=0,pending=null;
 function valid(row){return row&&/^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(row.tag||'')&&Number.isFinite(Date.parse(row.date));}
 function clean(rows){return (Array.isArray(rows)?rows:[]).filter(valid).slice(0,200).map(r=>({tag:r.tag,title:String(r.title||r.tag).slice(0,180),date:r.date,preview:!!r.preview,body:String(r.body||'Описание этого выпуска пока не опубликовано.').slice(0,30000)}));}
 function merge(rows){const by=new Map(entries.map(r=>[label(r),r]));for(const r of clean(rows))by.set(label(r),r);entries=[...by.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,200);}
 function releases(){return entries.some(r=>label(r)===label(UPCOMING))?entries:[UPCOMING,...entries];}
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
 function date(value){return new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});}
 function label(row){return row.tag.replace(/^v/,'');}
 function remember(){try{localStorage.setItem(CACHE,JSON.stringify({at:loadedAt,entries}));}catch{}}
 merge(global.HubReleaseHistory);
 try{const c=JSON.parse(localStorage.getItem(CACHE));if(c&&Number.isFinite(c.at)){merge(c.entries);loadedAt=Math.min(c.at,Date.now());}}catch{}
 function section(kicker,title,items,index){const s=el('section','patch-section'),head=el('div','patch-section-heading');head.append(el('span','patch-number',String(index+1).padStart(2,'0')),el('div','',kicker));s.append(head,el('h3','',title));const ul=el('ul');for(const text of items)ul.append(el('li','',text));s.append(ul);return s;}
 // Release text is untrusted data: never inject remote HTML or activate embedded links.
 function prose(body){const fragment=document.createDocumentFragment();let ul=null;for(const raw of body.split(/\r?\n/)){
  const text=raw.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__/g,'').trim();if(!text){ul=null;continue;}
  if(/^[-*] /.test(text)){if(!ul){ul=el('ul','patch-note-list');fragment.append(ul);}ul.append(el('li','',text.slice(2)));}
  else{ul=null;fragment.append(el(/^#{1,6} /.test(text)?'h3':'p','',text.replace(/^#{1,6} /,'')));}
 }return fragment;}
 function show(tag){const rows=releases(),row=rows.find(r=>label(r)===String(tag).replace(/^v/,''))||rows[0];if(!row)return;selected=row.tag;
  for(const item of list.children)item.setAttribute('aria-pressed',String(item.dataset.tag===selected));
  article.replaceChildren();article.scrollTop=0;
  const head=el('header','patch-hero'),meta=el('div','patch-meta');meta.append(el('span','patch-version',label(row)),el('span',row.planned?'patch-planned':'',row.planned?'В разработке · ещё не опубликовано':row.preview?'Предварительная версия':'Опубликованный выпуск'));if(!row.planned)meta.append(el('time','',date(row.date)));
  const terra=row.tag.replace(/^v/,'')==='5.0.0';head.append(meta,el('h2','',terra?TERRA.title:row.title));
  if(terra)head.append(el('p','',TERRA.intro));article.append(head);
  if(row.planned){head.append(el('p','','5.0.0 — часть истории Support Hub. Работа продолжается: здесь — направление следующего большого обновления.'));const groups=el('div','patch-sections');row.groups.forEach((g,i)=>groups.append(section(...g,i)));article.append(groups);}
  else if(terra){const groups=el('div','patch-sections');TERRA.groups.forEach((g,i)=>groups.append(section(...g,i)));article.append(groups,el('p','patch-checks',TERRA.checks));}
  else{const notes=el('div','patch-prose');notes.append(prose(row.body));article.append(notes);}
  article.append(el('p','patch-archive',row.planned?'План может уточняться. После публикации здесь автоматически появится итоговое описание 6.0.0.':'Это описание версии на момент её выпуска. Более новые изменения перечислены отдельно.'));
  article.setAttribute('aria-label','Изменения версии '+label(row));
 }
 function draw(){if(!dialog)return;const scroll=article.scrollTop;list.replaceChildren();const latest=entries.find(e=>!e.preview);
  for(const row of releases()){const item=el('button','patch-release');item.type='button';item.dataset.tag=row.tag;item.append(el('strong','',label(row)),el('small','',row.planned?'Следующее большое обновление':date(row.date)));if(row.planned)item.append(el('span','patch-planned','В разработке'));else if(row===latest)item.append(el('span','patch-latest','Последний опубликованный'));else if(row.preview)item.append(el('span','patch-preview','Альфа'));item.onclick=()=>show(row.tag);list.append(item);}
  show(selected);article.scrollTop=scroll;
 }
 async function refresh(force=false){if(pending)return pending;if(!force&&Date.now()-loadedAt<3600000)return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  if(status)status.textContent='Проверяем новые выпуски…';
  pending=(async()=>{try{
   const response=await fetch(FEED,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json'}});if(!response.ok)throw Error('HTTP '+response.status);
   const rows=await response.json();if(!Array.isArray(rows))throw Error('Invalid feed');
   const published=rows.filter(r=>!r.draft&&r.published_at).map(r=>({tag:r.tag_name,title:r.name,date:r.published_at,preview:r.prerelease,body:r.body}));
   if(!clean(published).length)throw Error('Empty feed');merge(published);loadedAt=Date.now();remember();draw();
   if(status)status.textContent='История обновлена · новые выпуски появятся здесь автоматически';
  }catch{if(status)status.textContent='Сохранённая история доступна. Проверим новые выпуски при следующем открытии.';}
  finally{clearTimeout(timer);pending=null;}})();return pending;
 }
 function build(){if(dialog)return;dialog=el('dialog','hub-patches');dialog.id='hubPatches';dialog.setAttribute('aria-labelledby','patchesTitle');
  const top=el('header','patch-top'),intro=el('div');intro.append(el('small','','SUPPORT HUB / ИСТОРИЯ ВЕРСИЙ'));const title=el('h1','','Обновления и патчи');title.id='patchesTitle';intro.append(title);
  const close=el('button','patch-close','×');close.type='button';close.setAttribute('aria-label','Закрыть обновления');close.onclick=()=>dialog.close();top.append(intro,close);
  const body=el('div','patch-body');list=el('nav','patch-list');list.setAttribute('aria-label','Выбрать версию');article=el('article','patch-detail');article.tabIndex=0;body.append(list,article);
  const foot=el('footer','patch-footer');status=el('span','','История опубликованных версий');status.setAttribute('role','status');const check=el('button','patch-refresh','Проверить обновления списка');check.type='button';check.onclick=()=>refresh(true);foot.append(status,check);
  dialog.append(top,body,foot);document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>button?.focus());draw();
 }
 function open(){build();draw();if(!dialog.open)dialog.showModal();refresh();}
 function mount(radio){if(!radio||document.getElementById('hubPatchesButton'))return;button=el('button','patch-launch');button.id='hubPatchesButton';button.type='button';button.setAttribute('aria-haspopup','dialog');button.title='История обновлений Support Hub';button.append(el('span','patch-launch-icon','↗'),el('span','','Обновления / патчи'));button.onclick=open;radio.after(button);}
 global.HubPatches=Object.freeze({mount,open});
})(window);
