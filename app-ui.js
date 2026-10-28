// Presentation only: existing nodes, permissions and business handlers are retained.
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.tabs');
  const sections = {
    mycalls:['Колы команды','Личная сводка Fifflaren · каждый день к 19:00'], hq:['Штаб','Команда и люди, с которыми ты работаешь'], support:['Поддержка','Всё для решения рабочих вопросов'],
    shift:['Моя смена','Рабочее время, логи и результаты дня'], cols:['Колы','Фиксируй звонки и сохраняй важные детали'],
    leave:['Отпроситься','Укажи время и причину отсутствия'], crypto:['Крипто','Обозреватели сетей и проверка транзакций'],
    notes:['Заметки','Твоё пространство для мыслей и рабочих записей'], exchanges:['Биржи','Справочник условий и доступных направлений'],
    tasks:['Задачи','Держи важное в фокусе'], feed:['Лента','Новости, публикации и события команды'],
    approve:['Найти апрув','Быстрый поиск нужного подтверждения'], chat:['Чат команды','Обсуждай рабочие вопросы вместе'],
    pm:['Личные сообщения','Разговоры один на один'], swipe:['Дайсерчвинчик','Знакомься с коллегами'],
    casino:['Казино','Время сделать перерыв'], tops:['Топ','Достижения и результаты участников'],
    battleship:['Морской бой','Тактика, флот и точный расчёт'], cs16:['Counter-Strike','Командная игра · Dust2 / Inferno'],
    voxel:['Блочный мир','Один общий мир · постройки и инвентарь сохраняются'], support2:['Support2','Собери команду и присоединяйся к матчу'], salary:['Зарплата','Расчёты и результаты за месяц'],
    tlpanel:['ТЛ-панель','Управление командой и рабочими событиями'], admin:['Администрирование','Люди, настройки и управление приложением']
  };
  nav.setAttribute('aria-label','Разделы приложения');
  const brand=document.createElement('div');brand.className='hub-brand';
  brand.innerHTML='<span class="hub-mark">S</span><div>Support Hub<small>РАБОЧЕЕ ПРОСТРАНСТВО</small></div>';
  nav.prepend(brand);
  const groups=[['РАБОТА',['hq','support','shift','cols','mycalls','leave','notes','tasks','crypto','exchanges']],['ОБЩЕНИЕ',['feed','chat','pm']],['ДОСУГ',['swipe','casino','tops','battleship','cs16','support2','voxel']],['УПРАВЛЕНИЕ',['tlpanel','admin']]];
  for(const [label,ids] of groups){
    const group=document.createElement('div');group.className='hub-navGroup';
    const caption=document.createElement('div');caption.className='hub-navLabel';caption.textContent=label;group.append(caption);
    for(const id of ids){const button=nav.querySelector(`[data-tab="${id}"]`);if(button){button.title=sections[id][0];group.append(button);}}
    nav.append(group);
  }
  const header=document.createElement('header');header.className='hub-header';
  header.innerHTML='<button class="hub-menuToggle" aria-label="Свернуть меню" title="Свернуть меню">☰</button><div class="hub-heading"><div class="hub-eyebrow">SUPPORT HUB / РАБОЧЕЕ ПРОСТРАНСТВО</div><h1 id="hubPageTitle"></h1><p id="hubPageDescription"></p></div><div class="hub-tools"><span class="hub-date"></span></div>';
  nav.after(header);
  const tools=header.querySelector('.hub-tools');
  for(const id of ['soundToggleBtn','themeToggleBtn','logoutBtn']){const b=document.getElementById(id);if(b){b.classList.add('hub-tool');b.setAttribute('aria-label',b.title);tools.append(b);}}
  header.querySelector('.hub-date').textContent=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long'}).format(new Date());
  header.querySelector('.hub-menuToggle').onclick=()=>{
    const collapsed=document.body.classList.toggle('hub-navCollapsed');
    header.querySelector('.hub-menuToggle').setAttribute('aria-label',collapsed?'Развернуть меню':'Свернуть меню');
    window.dispatchEvent(new Event('resize'));
  };
  function update(){
    const selected=nav.querySelector('[data-tab].active');const id=selected?.dataset.tab||'support';
    document.getElementById('hubPageTitle').textContent=sections[id]?.[0]||'Support Hub';
    document.getElementById('hubPageDescription').textContent=sections[id]?.[1]||'';
    document.body.dataset.hubPage=id;
    for(const b of nav.querySelectorAll('[data-tab]')) b.setAttribute('aria-current',b===selected?'page':'false');
    for(const group of nav.querySelectorAll('.hub-navGroup')) group.hidden=![...group.querySelectorAll('[data-tab]')].some(b=>b.style.display!=='none');
  }
  // Also handles role changes and navigation triggered by an existing notification.
  new MutationObserver(update).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','style']});
  update();
});
