/* Personal Desk: presentation only. Reuse existing controls and task handlers. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const body = document.body;
  const shift = $('tab-shift');
  if (!shift || !body.classList.contains('terra')) return;
  body.classList.add('personal-desk');
  const node = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const eyebrow = document.querySelector('.hub-eyebrow');
  if (eyebrow) eyebrow.textContent = 'SUPPORT HUB / ЛИЧНЫЙ СТОЛ';
  const brand = document.querySelector('.hub-brand small');
  if (brand) brand.textContent = 'ЛИЧНЫЙ СТОЛ';
  function arrangeRadio() {
    const actions = document.querySelector('#hubRadio .radio-phone-actions');
    const cinema = $('cinemaButton');
    if (actions && cinema && cinema.parentElement !== actions) actions.append(cinema);
  }
  arrangeRadio();

  const toolbar = node('div', 'desk-toolbar');
  const introduction = node('div', 'desk-introduction');
  introduction.append(node('span', 'desk-kicker', 'ЛИЧНОЕ ПРОСТРАНСТВО'), node('p', '', 'Всё нужное для твоей смены'));
  const configure = node('button', 'desk-configure', 'Настроить стол');
  configure.type = 'button';
  configure.setAttribute('aria-haspopup', 'dialog');
  if (window.HubNavIcon) configure.prepend(window.HubNavIcon('tasks'));
  toolbar.append(introduction, configure);
  shift.prepend(toolbar);

  const shiftCard = shift.querySelector('.terra-shift-card');
  if (shiftCard) {
    shiftCard.querySelector('h3').textContent = 'Моя смена';
    if ($('startBtn')) $('startBtn').textContent = 'Начать смену';
    if ($('stopBtn')) $('stopBtn').textContent = 'Завершить смену';
    const caption = shiftCard.querySelector('.terra-shift-note');
    if (caption) caption.textContent = 'Твоя смена, задачи и обращения — в одном месте.';
    const call = shiftCard.querySelector('.orbit-call');
    if (call) {
      const row = node('div', 'desk-call-actions');
      call.before(row);
      row.append(call);
      const request = $('networkRequestButton');
      if (request) row.append(request);
    }
    const addFive = shiftCard.querySelector('.orbit-addFiveBtn');
    const addOne = shiftCard.querySelector('.orbit-addOneBtn');
    if (addOne && addFive) {
      const row = node('div', 'desk-count-actions');
      addOne.before(row);
      row.append(addOne, addFive);
      const label = addFive.querySelector('span');
      if (label) label.textContent = '+5';
      addFive.title = 'Увеличить счётчик на пять';
    }
  }

  const overtime = $('sendOvertimeBtn')?.closest('.card');
  if (overtime) {
    overtime.classList.add('desk-overtime');
    const title = overtime.querySelector('h3');
    title.textContent = 'Овертаймы';
    const heading = node('div', 'desk-overtime-heading');
    title.before(heading);
    heading.append(title, node('p', '', 'Дополнительное время в смене'));
    $('overtimeFrom')?.parentElement?.parentElement?.classList.add('desk-time-fields');
    $('sendOvertimeBtn').textContent = 'Добавить';
  }
  const report = $('resetShiftBtn')?.closest('.card');
  if (report) {
    report.classList.add('desk-shift-report');
    $('resetShiftBtn').textContent = 'Новая смена';
  }

  // There is one real checklist: moving it preserves checkbox handlers and IDs.
  const tasksTab = $('tab-tasks');
  const tasksCard = $('tasksList')?.closest('.card');
  if (tasksTab && tasksCard) {
    tasksCard.classList.add('desk-checklist');
    tasksCard.querySelector('h3').textContent = 'Чек-лист дня';
    const taskIntro = tasksCard.querySelector('p');
    if (taskIntro) taskIntro.textContent = 'Задачи команды на текущий рабочий день';
    const rehomeTasks = () => {
      const target = body.dataset.hubPage === 'tasks' ? tasksTab : shift;
      if (tasksCard.parentElement !== target) target.append(tasksCard);
    };
    new MutationObserver(rehomeTasks).observe(body, {attributes: true, attributeFilter: ['data-hub-page']});
    rehomeTasks();
  }

  const settings = node('dialog', 'desk-settings');
  settings.id = 'personalDeskSettings';
  settings.setAttribute('aria-labelledby', 'personalDeskSettingsTitle');
  const header = node('header');
  const title = node('h2', '', 'Твой личный стол');
  title.id = 'personalDeskSettingsTitle';
  const close = node('button', 'desk-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть настройки стола');
  header.append(title, close);
  settings.append(header, node('p', '', 'Выбери карточки, которые будут видны в «Смене». Остальные разделы останутся в меню.'));
  const options = [['calls', 'Мои коллы', 'Заявки и результаты рассмотрения'], ['feed', 'Лента команды', 'Последние события в команде'], ['checklist', 'Чек-лист дня', 'Твои отметки в задачах команды']];
  const switches = new Map();
  const key = () => 'hub-personal-desk:' + (localStorage.getItem('global_worker_nick') || $('userNick')?.value || 'local').toLowerCase();
  function apply(save) {
    const preferences = {};
    for (const [id, input] of switches) {
      preferences[id] = input.checked;
      shift.classList.toggle('desk-hide-' + id, !input.checked);
    }
    if (save) { try { localStorage.setItem(key(), JSON.stringify(preferences)); } catch {} }
  }
  for (const [id, label, description] of options) {
    const row = node('label', 'desk-setting-row');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.name = id;
    input.addEventListener('change', () => apply(true));
    const text = node('span');
    text.append(node('strong', '', label), node('small', '', description));
    row.append(text, input);
    switches.set(id, input);
    settings.append(row);
  }
  const footer = node('footer');
  const reset = node('button', 'desk-reset', 'Показать все карточки');
  reset.type = 'button';
  reset.onclick = () => { for (const input of switches.values()) input.checked = true; apply(true); };
  const done = node('button', 'desk-done', 'Готово');
  done.type = 'button';
  footer.append(reset, done);
  settings.append(footer);
  body.append(settings);
  const closeSettings = () => settings.close();
  close.onclick = closeSettings;
  done.onclick = closeSettings;
  configure.onclick = () => settings.showModal();
  settings.addEventListener('close', () => configure.focus({preventScroll: true}));

  function loadPreferences() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch {}
    for (const [id, input] of switches) input.checked = saved[id] !== false;
    apply(false);
  }
  loadPreferences();
  document.addEventListener('hub:work-ready', () => {
    loadPreferences();
    arrangeRadio();
    if (typeof window.loadTasks === 'function') window.loadTasks();
  });
});
