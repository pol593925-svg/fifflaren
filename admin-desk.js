/* Owner desk. Existing administrator controls are moved, never replaced or cloned. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const tabs = [
    ['overview', 'Обзор', 'grid'], ['employees', 'Сотрудники', 'people'],
    ['access', 'Доступы', 'shield'], ['calls', 'Коллы', 'phone'],
    ['loans', 'Долги', 'coin'], ['radio', 'Радио', 'radio'],
    ['cinema', 'Кино', 'film'], ['tools', 'Инструменты', 'sliders'],
    ['reports', 'Отчёты', 'chart']
  ];
  const paths = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0',
    shield: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',
    phone: 'M5 3h5l2 5-3 2c1 3 2 4 5 5l2-3 5 2v5c0 3-6 2-10-1S2 7 3 4z',
    coin: 'M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0 M12 6v12 M16 8H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8',
    radio: 'M4 7a10 10 0 0 0 0 10 M7 9a6 6 0 0 0 0 6 M20 7a10 10 0 0 1 0 10 M17 9a6 6 0 0 1 0 6 M12 3v9 M9 21l3-9 3 9 M10 17h4',
    film: 'M3 4h18v16H3z M3 8h18 M8 4v4 M16 4v4 M8 20v-4 M16 20v-4 M3 16h18',
    sliders: 'M4 7h5 M13 7h7 M4 17h9 M17 17h3 M9 4v6 M13 14v6',
    chart: 'M4 3v18h17 M8 16v-4 M13 16V7 M18 16V4',
    network: 'M8 3h8v5H8z M3 16h6v5H3z M15 16h6v5h-6z M12 8v5 M6 16v-3h12v3',
    arrow: 'M4 12h16 M14 6l6 6-6 6',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 13 3 M18 18a8 8 0 0 1-13-3',
    check: 'M4 12l5 5L20 6',
    monitor: 'M3 4h18v13H3z M12 17v4 M8 21h8',
    clock: 'M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0 M12 6v6l4 2'
  };
  let session = null, root, currentTab = 'overview', owner = false, mounted = false;
  let epoch = 0, sequence = 0, activeFetch = null, refreshTimer = null, timer = null;
  let dashboard = null, state = 'idle', lastUpdated = null, socket = null, socketHandlers = [];
  const panes = new Map(), tabButtons = new Map();

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.65'); svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('ad-icon');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[name] || paths.grid); svg.append(path); return svg;
  }
  function button(label, handler, options = {}) {
    const result = node('button', undefined, 'ad-button' + (options.className ? ' ' + options.className : ''));
    result.type = 'button';
    if (options.id) result.id = options.id;
    if (options.action) result.dataset.adminAction = options.action;
    if (options.icon) result.append(icon(options.icon));
    result.append(node('span', label));
    result.addEventListener('click', handler);
    return result;
  }
  function message(text, isError = false) {
    if (!$('adminDeskStatus')) return;
    $('adminDeskStatus').textContent = text;
    $('adminDeskStatus').classList.toggle('is-error', isError);
  }
  function isVisible(element) {
    return !!element && !element.hidden && !element.disabled && element.style.display !== 'none';
  }
  function originalButton(id) {
    const target = $(id);
    if (!isVisible(target)) return false;
    target.click(); return true;
  }
  function calls(date) {
    if (window.HubCalls?.open && isVisible($('callsTabBtn'))) { window.HubCalls.open(date); return true; }
    message('Коллы команды пока недоступны. Дождись проверки прав и попробуй ещё раз.', true); return false;
  }
  function loans(id) {
    if (window.HubLoans?.open && session) { window.HubLoans.open(id); return true; }
    message('Раздел долгов ещё не загружен. Попробуй снова через несколько секунд.', true); return false;
  }
  async function access() {
    if (!owner) return false;
    message('Проверяем права доступа…');
    try {
      await window.HubTeamCalls?.refreshAccess();
      if (!owner || !session) return false;
      if (!originalButton('teamCallsAccessButton')) throw new Error('Управление доступом пока недоступно. Проверь подключение и повтори.');
      message(''); return true;
    } catch (error) { message(error.message || 'Не удалось открыть управление доступами.', true); return false; }
  }
  function launch(kind) {
    let opened = false;
    if (kind === 'radio') opened = originalButton('radioTabButton');
    else if (kind === 'cinema') opened = originalButton('cinemaButton');
    else if (kind === 'devices') opened = originalButton('adminOpenOfficeDevices');
    if (!opened) message('Этот раздел ещё не готов. Проверь подключение и повтори.', true);
    return opened;
  }
  function panelHead(title, description, action) {
    const head = node('div', undefined, 'ad-panel-head');
    const copy = node('div'); copy.append(node('h2', title), node('p', description)); head.append(copy);
    if (action) head.append(action); return head;
  }
  function empty(text) {
    const element = node('div', undefined, 'ad-empty');
    element.append(icon('clock'), node('p', text)); return element;
  }
  function card(title, description, content, action) {
    const result = node('section', undefined, 'ad-panel'); result.append(panelHead(title, description, action));
    if (content) result.append(content); return result;
  }
  function stat(label, key, symbol, hint, featured = false) {
    const result = node('div', undefined, 'ad-stat' + (featured ? ' ad-stat-featured' : ''));
    const copy = node('div', undefined, 'ad-stat-copy');
    const value = node('strong', '—'); value.dataset.adminStat = key;
    const note = node('span', hint, 'ad-stat-note'); note.dataset.adminStatNote = key;
    copy.append(node('span', label, 'ad-stat-label'), value, note);
    const artwork = node('span', undefined, 'ad-stat-icon'); artwork.append(icon(symbol));
    result.append(copy, artwork); return result;
  }
  function ownerOnly(element) { element.dataset.adminOwner = 'true'; return element; }
  function makeOverview() {
    const pane = panes.get('overview');
    const stats = node('div', undefined, 'ad-stats');
    stats.append(stat('Коллы в ожидании', 'pendingCalls', 'phone', 'Ожидают решения'),
      stat('Заявки по сети', 'pendingNetwork', 'network', 'Ожидают решения'),
      stat('Заявки на трюфели', 'pendingLoans', 'coin', 'Новые заявки на трюфель'),
      stat('Сотрудники онлайн', 'onlineEmployees', 'people', 'Подключены к Support Hub', true));
    const grid = node('div', undefined, 'ad-overview-grid');
    const queue = node('div', undefined, 'ad-requests'); queue.id = 'adminDeskRequests';
    const requestsPanel = card('Требуют решения', 'Коллы, сеть компании и внутренние баллы', queue,
      button('Все коллы', () => calls(), {icon: 'arrow', className: 'ad-link'}));
    const queueFooter = node('div', undefined, 'ad-panel-foot');
    const freshness = node('span', 'Ожидаем данные', 'ad-badge'); freshness.id = 'adminDeskFreshness';
    const queueNote = node('span', 'Список обновляется автоматически'); queueNote.id = 'adminDeskRequestNote';
    queueFooter.append(queueNote, freshness); requestsPanel.append(queueFooter);
    const staff = node('div', undefined, 'ad-staff'); staff.id = 'adminDeskStaff';
    const staffPanel = card('Команда сейчас', 'Подключение и доступ к коллам', staff, button('Все сотрудники', () => open('employees'), {icon: 'arrow', className: 'ad-link'}));
    const staffFooter = node('div', undefined, 'ad-panel-foot');
    const staffNote = node('span', 'Доступ можно выдать каждому отдельно'); staffNote.id = 'adminDeskStaffNote';
    staffFooter.append(staffNote, button('Настроить', access, {icon: 'arrow', action: 'access', className: 'ad-link'}));
    staffPanel.append(staffFooter);
    const main = node('div', undefined, 'ad-overview-main'); main.append(requestsPanel, staffPanel);
    const aside = node('aside', undefined, 'ad-overview-aside');
    function shortcut(title, description, symbol, label, handler, action, featured = false) {
      const box = node('section', undefined, 'ad-shortcut' + (featured ? ' ad-shortcut-featured' : ''));
      const head = node('div', undefined, 'ad-shortcut-head'); head.append(node('h2', title), icon(symbol));
      box.append(head, node('p', description), button(label, handler, {icon: 'arrow', action, className: featured ? 'ad-primary' : ''}));
      return box;
    }
    aside.append(
      shortcut('Доступы под контролем', 'Выбирай, кто может просматривать коллы команды и менять статусы заявок. Остальные права сотрудника сохраняются.', 'shield', 'Управление доступами', access, 'access'),
      shortcut('Трюфели команды', 'Назначай выдающего. Выдачу и возврат подтверждают участники, история остаётся в общем реестре.', 'coin', 'Открыть реестр', () => loans(), 'loans'),
      shortcut('Радио команды', 'Медиатека, очередь сотрудников и управление общим эфиром.', 'radio', 'Открыть радио', () => launch('radio'), 'radio', true)
    );
    grid.append(main, aside);
    pane.append(stats, grid);
  }
  function makeLaunchPane(id, title, description, symbol, label, handler) {
    const hero = node('section', undefined, 'ad-launch');
    const artwork = node('span', undefined, 'ad-launch-icon'); artwork.append(icon(symbol));
    const text = node('div', undefined, 'ad-launch-copy');
    text.append(node('span', 'РАБОЧИЙ РАЗДЕЛ', 'ad-eyebrow'), node('h2', title), node('p', description));
    hero.append(artwork, text, button(label, handler, {action: id, icon: 'arrow', className: 'ad-primary'}));
    panes.get(id).append(hero);
  }
  function sectionGroup(id, title, description) {
    const pane = panes.get(id);
    const existing = pane.querySelector('.ad-section-grid');
    if (existing) return existing;
    const heading = node('div', undefined, 'ad-section-title');
    heading.append(node('h2', title), node('p', description));
    const grid = node('div', undefined, 'ad-section-grid'); pane.append(heading, grid); return grid;
  }
  function mount() {
    if (mounted) return true;
    const host = $('tab-admin'), old = host?.querySelector(':scope > .admin-card');
    if (!host || !old) return false;
    // Preserve the original node identities: several controls have listeners and inline handlers.
    const originalChildren = [...old.children];
    root = node('div', undefined, 'admin-desk'); root.id = 'adminDesk';
    const heading = node('header', undefined, 'ad-heading');
    const copy = node('div');
    copy.append(node('span', 'РАБОЧЕЕ ПРОСТРАНСТВО / УПРАВЛЕНИЕ', 'ad-eyebrow'), node('h1', 'Обзор команды'),
      node('p', 'Обращения, сотрудники и решения — в одном месте.'));
    const actions = node('div', undefined, 'ad-heading-actions');
    const ownerLabel = ownerOnly(node('span', 'Только для владельца', 'ad-owner-label'));
    actions.append(ownerLabel, ownerOnly(button('Обновить', () => refresh(), {id: 'adminDeskRefresh', icon: 'refresh'})),
      ownerOnly(button('Управление доступами', access, {id: 'adminDeskManageAccess', action: 'access', icon: 'shield', className: 'ad-primary'})));
    heading.append(copy, actions);
    const rail = node('aside', undefined, 'ad-rail');
    const monogram = node('span', 'fi', 'ad-rail-brand'); monogram.setAttribute('aria-hidden', 'true');
    const nav = node('div', undefined, 'ad-tabs'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Администрирование'); nav.setAttribute('aria-orientation', 'vertical');
    rail.append(monogram, nav);
    for (const [id, label, symbol] of tabs) {
      const target = node('section', undefined, 'ad-pane');
      target.id = 'adminDeskPane-' + id; target.dataset.adminPanel = id;
      target.setAttribute('role', 'tabpanel'); target.setAttribute('aria-labelledby', 'adminDeskTab-' + id);
      target.hidden = true; panes.set(id, target);
      const tab = button(label, () => open(id), {icon: symbol, className: 'ad-tab'});
      tab.id = 'adminDeskTab-' + id; tab.dataset.adminPane = id;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', target.id);
      tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
      tabButtons.set(id, tab); nav.append(tab);
    }
    nav.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const items = [...tabButtons.values()].filter(item => !item.hidden);
      const at = items.indexOf(document.activeElement); if (at < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + items.length) % items.length;
      open(items[next].dataset.adminPane); items[next].focus();
    });
    const status = node('p', '', 'ad-status'); status.id = 'adminDeskStatus'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    root.append(rail, heading, status, ...panes.values());
    makeOverview();
    makeLaunchPane('access', 'Кому доступны коллы команды', 'Выбирай сотрудников, которые могут рассматривать коллы и заявки по сети. Управление аккаунтами находится ниже.', 'shield', 'Настроить доступ', access);
    makeLaunchPane('calls', 'Коллы команды', 'Просматривай заявки за любую дату, меняй статус и возвращай автору с комментарием. Заявки «Скачать пасы» находятся в этой же очереди.', 'phone', 'Открыть очередь', () => calls());
    makeLaunchPane('loans', 'Внутренние баллы · трюфель', 'Назначай сотрудника, у которого берут баллы. Выдачу и возврат подтверждают сами участники; все долги остаются в общем реестре.', 'coin', 'Открыть реестр', () => loans());
    makeLaunchPane('radio', 'Командное радио', 'Общая очередь, медиатека и управление эфиром. Откроется действующий пульт радио с текущими треками.', 'radio', 'Открыть радио', () => launch('radio'));
    makeLaunchPane('cinema', 'Кинотеатр команды', 'Фильмы, расписание и настройки кинозала доступны в существующем пульте. Воспроизведение продолжится с текущего момента.', 'film', 'Открыть кинозал', () => launch('cinema'));
    const callsQueue = node('div', undefined, 'ad-requests'); callsQueue.id = 'adminDeskCallRequests';
    panes.get('calls').append(card('Ожидают решения', 'Последние коллы и заявки по сети', callsQueue));
    const loansQueue = node('div', undefined, 'ad-requests'); loansQueue.id = 'adminDeskLoanRequests';
    panes.get('loans').append(card('Новые заявки', 'Нажми на заявку, чтобы назначить выдающего', loansQueue));
    const employeeGrid = sectionGroup('employees', 'Сотрудники Fifflaren', 'Участники команды и доступная техника.');
    const accessGrid = sectionGroup('access', 'Аккаунты и рабочие браузеры', 'Действия с аккаунтами и запросы сотрудникам.');
    const toolsGrid = sectionGroup('tools', 'Инструменты управления', 'Уведомления, справочник, задачи и игровые начисления.');
    const reportsGrid = sectionGroup('reports', 'Отчёты и события', 'Показатели сотрудников, история и результаты запросов.');
    for (const child of originalChildren) {
      if (child.tagName === 'H3') { child.hidden = true; old.append(child); continue; }
      if (child.id === 'adminOpenOfficeDevices') {
        const deviceCard = node('section', undefined, 'ad-device-card');
        deviceCard.append(icon('monitor'), node('h3', 'Техника команды'), node('p', 'Компьютеры сотрудников и их состояние.'), child);
        child.dataset.adminAction = 'devices'; child.classList.add('ad-original-button'); employeeGrid.append(deviceCard); continue;
      }
      if (child.id === 'ownerAccess') { accessGrid.append(child); continue; }
      if (child.querySelector('#adminTeamName, #adminTeamAddBtn')) { child.hidden = true; old.append(child); continue; }
      if (child.querySelector('#adminUsersList')) { employeeGrid.append(child); continue; }
      if (child.querySelector('#adminStatsBox, #adminEventsBox, #adminDnoBox, #adminShotsBox')) { reportsGrid.append(child); continue; }
      toolsGrid.append(child);
    }
    // Retain the old wrapper for compatibility with any code that references it.
    old.classList.add('ad-legacy-wrapper'); old.hidden = true;
    host.prepend(root);
    $('adminTabBtn')?.addEventListener('click', () => { if (owner) refresh(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && isActive() && owner) refresh(); });
    mounted = true; return true;
  }
  function setOwnerUI() {
    if (!root) return;
    root.querySelectorAll('[data-admin-owner]').forEach(item => { item.hidden = !owner; });
    for (const id of ['overview', 'access']) tabButtons.get(id).hidden = !owner;
    root.dataset.owner = owner ? 'true' : 'false';
    if (!owner) { panes.get('calls').querySelector('.ad-panel').hidden = true; panes.get('loans').querySelector('.ad-panel').hidden = true; }
    else { panes.get('calls').querySelector('.ad-panel').hidden = false; panes.get('loans').querySelector('.ad-panel').hidden = false; }
  }
  function open(id = 'overview') {
    if (!session || session.role !== 'admin' || !mount()) return false;
    if (!panes.has(id) || ((!owner) && ['overview', 'access'].includes(id))) id = 'employees';
    currentTab = id;
    for (const [key, pane] of panes) pane.hidden = key !== id;
    for (const [key, tab] of tabButtons) {
      tab.classList.toggle('active', key === id); tab.setAttribute('aria-selected', key === id ? 'true' : 'false'); tab.tabIndex = key === id ? 0 : -1;
    }
    if (owner && ['overview', 'calls', 'loans'].includes(id) && (!lastUpdated || Date.now() - lastUpdated > 15000)) refresh();
    return true;
  }
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const count = value => finite(value) ? value.toLocaleString('ru-RU') : '—';
  function stamp(value) {
    const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) return '';
    return parsed.toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
  }
  function avatar(username, number = 0) {
    return node('span', String(username || '?').trim().slice(0, 1).toUpperCase() || '?', 'ad-avatar ad-tone-' + (number % 4));
  }
  function requestRow(request, index) {
    const kind = request.kind === 'loan' ? 'loan' : request.kind === 'network' ? 'network' : 'call';
    const details = {loan: ['Внутренние баллы', 'coin', 'ad-badge-purple'], network: ['Сеть компании', 'network', 'ad-badge-amber'], call: ['Колл', 'phone', 'ad-badge-blue']}[kind];
    const row = node('article', undefined, 'ad-request'); row.dataset.adminRequest = String(request.id || '');
    const artwork = node('span', undefined, 'ad-request-icon'); artwork.append(icon(details[1]));
    const text = node('div', undefined, 'ad-request-body');
    const title = request.title || (kind === 'loan' ? 'Заявка на ' + count(request.quantity) + ' баллов' : 'Заявка сотрудника');
    const byline = node('div', undefined, 'ad-byline');
    byline.append(avatar(request.username, index), node('span', request.username || 'Сотрудник'));
    const createdAt = stamp(request.createdAt); if (createdAt) byline.append(node('span', '·'), node('time', createdAt));
    text.append(node('span', details[0], 'ad-badge ' + details[2]), node('h3', title), byline);
    const action = button(kind === 'loan' ? 'Рассмотреть' : 'Открыть', () => kind === 'loan' ? loans(request.id) : calls(request.date), {className: 'ad-request-action'});
    action.dataset.requestKind = kind; row.append(artwork, text, action); return row;
  }
  function renderQueue(id, filter = () => true) {
    const list = $(id); if (!list) return; list.replaceChildren();
    if (state === 'loading' && !dashboard) { list.append(empty('Загружаем заявки…')); return; }
    if (state === 'error' || !dashboard) { list.append(empty('Заявки недоступны. Нажми «Обновить», чтобы повторить.')); return; }
    if (!Array.isArray(dashboard.requests)) { list.append(empty('Сервер не вернул список заявок.')); return; }
    const source = dashboard.requests.filter(filter), requests = id === 'adminDeskRequests' ? source.slice(0, 3) : source;
    if (!requests.length) {
      const stats = dashboard.stats || {}, expected = id === 'adminDeskLoanRequests' ? stats.pendingLoans : id === 'adminDeskCallRequests' ? (stats.pendingCalls || 0) + (stats.pendingNetwork || 0) : 0;
      list.append(empty(expected > 0 ? 'Эти заявки не попали в последние записи сводки. Открой полный список выше.' : 'Заявок, ожидающих решения, нет.')); return;
    }
    requests.forEach((request, index) => list.append(requestRow(request, index)));
  }
  function render() {
    if (!root) return;
    const data = dashboard?.stats || {};
    for (const element of root.querySelectorAll('[data-admin-stat]')) element.textContent = state === 'error' ? '—' : count(data[element.dataset.adminStat]);
    const loanNote = root.querySelector('[data-admin-stat-note="pendingLoans"]');
    loanNote.textContent = state !== 'error' && finite(data.requestedPoints) ? count(data.requestedPoints) + ' баллов запрошено' : 'Новые заявки на трюфель';
    const onlineNote = root.querySelector('[data-admin-stat-note="onlineEmployees"]');
    onlineNote.textContent = state !== 'error' && finite(data.totalEmployees) ? 'Из ' + count(data.totalEmployees) + ' сотрудников' : 'Подключены к Support Hub';
    renderQueue('adminDeskRequests'); renderQueue('adminDeskCallRequests', row => row.kind !== 'loan'); renderQueue('adminDeskLoanRequests', row => row.kind === 'loan');
    const staff = $('adminDeskStaff'); staff.replaceChildren();
    if (state === 'loading' && !dashboard) staff.append(empty('Загружаем сотрудников…'));
    else if (state === 'error' || !dashboard) staff.append(empty('Статусы сотрудников недоступны.'));
    else if (!Array.isArray(dashboard.employees)) staff.append(empty('Сервер не вернул список сотрудников.'));
    else if (!dashboard.employees.length) staff.append(empty('Сотрудники пока не добавлены.'));
    else dashboard.employees.slice(0, 4).forEach((employee, index) => {
      const row = node('div', undefined, 'ad-staff-row'); row.append(avatar(employee.username, index));
      const person = node('div', undefined, 'ad-person');
      person.append(node('b', employee.username || 'Сотрудник'), node('small', typeof employee.canReview !== 'boolean' ? 'Доступ не определён' : employee.canReview ? 'Коллы команды' : 'Базовый доступ'));
      const online = employee.online === true;
      row.append(person, node('span', typeof employee.online !== 'boolean' ? 'Статус неизвестен' : online ? 'В сети' : 'Не в сети', 'ad-badge' + (online ? ' ad-badge-green' : ''))); staff.append(row);
    });
    const shownStaff = state === 'ready' && Array.isArray(dashboard?.employees) ? Math.min(4, dashboard.employees.length) : 0;
    $('adminDeskStaffNote').textContent = shownStaff && finite(data.totalEmployees) ? 'Показаны ' + shownStaff + ' из ' + count(data.totalEmployees) + ' сотрудников' : 'Доступ можно выдать каждому отдельно';
    const shownRequests = state === 'ready' && Array.isArray(dashboard?.requests) ? Math.min(3, dashboard.requests.length) : 0;
    const pendingKeys = ['pendingCalls', 'pendingNetwork', 'pendingLoans'];
    const totalRequests = pendingKeys.every(key => finite(data[key])) ? pendingKeys.reduce((sum, key) => sum + data[key], 0) : null;
    $('adminDeskRequestNote').textContent = shownRequests && totalRequests > shownRequests ? 'Последние ' + shownRequests + ' из ' + count(totalRequests) + ' заявок' : 'Список обновляется автоматически';
    const fresh = $('adminDeskFreshness'); fresh.classList.toggle('ad-badge-green', state === 'ready');
    fresh.textContent = state === 'loading' ? 'Обновляем…' : state === 'error' ? 'Нет данных' : state === 'ready' ? 'Обновлено в ' + new Date(lastUpdated).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : 'Ожидаем данные';
    $('adminDeskRefresh').disabled = state === 'loading';
  }
  function isActive() { return $('tab-admin')?.classList.contains('active') || $('tab-admin')?.style.display === 'flex'; }
  async function refresh() {
    if (!owner || !session || !mounted || document.hidden) return false;
    if (activeFetch) return activeFetch.promise;
    const captured = session, identity = epoch, seq = ++sequence, controller = new AbortController();
    state = 'loading'; render(); message('');
    const promise = (async () => {
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(String(captured.server || '').replace(/\/$/, '') + '/api/owner/dashboard', {headers: {Authorization: 'Bearer ' + captured.token}, cache: 'no-store', signal: controller.signal});
        const body = await response.json();
        if (!response.ok || body.success !== true) throw new Error(body.error || body.message || 'Не удалось загрузить панель. Попробуй обновить.');
        if (body.isOwner !== true) throw new Error('Панель владельца недоступна для этого аккаунта.');
        if (identity !== epoch || captured !== session || seq !== sequence) return false;
        dashboard = body; state = 'ready'; lastUpdated = Date.now(); render(); return true;
      } catch (error) {
        if (identity !== epoch || captured !== session || seq !== sequence) return false;
        dashboard = null; lastUpdated = null; state = 'error'; render();
        message(error.name === 'AbortError' ? 'Сервер не ответил вовремя. Проверь подключение и нажми «Обновить».' : error.message || 'Не удалось загрузить данные.', true);
        return false;
      } finally {
        clearTimeout(timeout); if (identity === epoch && seq === sequence) activeFetch = null;
      }
    })();
    activeFetch = {promise, controller}; return promise;
  }
  function scheduleRefresh() {
    if (!owner) return; clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (isActive() && !document.hidden) refresh(); }, 400);
  }
  function subscribe(next) {
    if (socket && typeof socket.off === 'function') socketHandlers.forEach(([event, handler]) => socket.off(event, handler));
    socketHandlers = []; socket = next;
    if (!socket?.on) return;
    for (const event of ['connect', 'call_updated', 'fifflaren_call', 'my_call', 'loan_changed', 'calls_access_changed', 'update_chat_users']) {
      const handler = scheduleRefresh; socket.on(event, handler); socketHandlers.push([event, handler]);
    }
  }
  function stop() {
    epoch++; sequence++; clearInterval(timer); clearTimeout(refreshTimer); activeFetch?.controller.abort(); activeFetch = null;
    session = null; owner = false; dashboard = null; lastUpdated = null; state = 'idle'; subscribe(null);
    if (mounted) { setOwnerUI(); render(); root.hidden = true; }
  }
  function start(config) {
    stop();
    if (!config || config.role !== 'admin' || !config.username || !config.token) return false;
    session = config; owner = String(config.username).trim().toLowerCase() === 'fifflaren';
    if (!mount()) return false;
    root.hidden = false; setOwnerUI(); open(owner ? 'overview' : 'employees');
    if (owner) {
      refresh(); timer = setInterval(() => { if (isActive() && !document.hidden) refresh(); }, 30000);
    }
    return true;
  }
  window.HubAdminDesk = {start, stop, open, refresh, subscribe};
})();
