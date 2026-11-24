/* One workspace entry, with existing work screens kept as its subsections. */
(function () {
  'use strict';
  const builtins = [['shift', 'Сегодня'], ['hq', 'Штаб'], ['mycalls', 'Коллы команды'], ['leave', 'Отпроситься'], ['notes', 'Заметки'], ['tasks', 'Задачи'], ['crypto', 'Крипто'], ['exchanges', 'Биржи']];
  const entries = new Map();
  const custom = new Map();
  let ready = false, source, navigation, buttons, workGroup;
  const $ = id => document.getElementById(id);
  const allowed = entry => {
    const button = entry?.original;
    if (!button || button.hidden || button.disabled || button.style.display === 'none') return false;
    try { return entry.canOpen ? entry.canOpen() !== false : true; } catch { return false; }
  };
  const current = () => source?.querySelector('[data-tab].active')?.dataset.tab || document.body.dataset.hubPage;
  function hideCustom() {
    for (const entry of custom.values()) {
      if (entry.element) { entry.element.classList.remove('active'); entry.element.style.display = 'none'; }
      entry.original?.classList.remove('active');
    }
  }
  function sync() {
    if (!ready) return;
    const selected = current(), entry = entries.get(selected), inWorkspace = !!entry;
    navigation.hidden = !inWorkspace;
    if (inWorkspace) document.body.dataset.hubWorkspace = 'work';
    else delete document.body.dataset.hubWorkspace;
    for (const item of entries.values()) {
      item.button.hidden = !allowed(item);
      item.button.classList.toggle('active', item.id === selected);
      item.button.setAttribute('aria-current', item.id === selected ? 'page' : 'false');
    }
    if (inWorkspace) {
      $('hubPageTitle').textContent = 'Смена';
      $('hubPageDescription').textContent = entry.id === 'shift' ? 'Личный стол · рабочие инструменты команды' : 'Личный стол / ' + entry.label;
    }
  }
  function showCustom(entry) {
    if (!allowed(entry)) return false;
    for (const item of document.querySelectorAll('.content')) { item.classList.remove('active'); item.style.display = 'none'; }
    for (const item of source.querySelectorAll('[data-tab].active')) item.classList.remove('active');
    entry.original.classList.add('active');
    entry.element.classList.add('active');
    entry.element.style.display = 'flex';
    document.body.dataset.hubPage = entry.id;
    sync();
    try {
      const result = entry.onOpen?.();
      if (result?.catch) result.catch(error => console.error('Workspace section failed:', entry.id, error));
    } catch (error) { console.error('Workspace section failed:', entry.id, error); }
    return true;
  }
  function open(id) {
    const entry = entries.get(id);
    if (!ready || !allowed(entry)) return false;
    entry.original.click();
    return true;
  }
  function addButton(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'desk-work-tab';
    button.dataset.workTab = entry.id;
    if (window.HubNavIcon) button.append(window.HubNavIcon(entry.id === 'loans' ? 'salary' : entry.id));
    const label = document.createElement('span'); label.textContent = entry.label; button.append(label);
    button.addEventListener('click', () => open(entry.id));
    buttons.append(button);
    entry.button = button;
    entries.set(entry.id, entry);
  }
  function mountCustom(entry) {
    if (entry.original) return;
    if (!(entry.element instanceof HTMLElement)) throw new TypeError('Workspace section needs an element');
    entry.element.id = 'tab-' + entry.id;
    entry.element.classList.add('content');
    entry.element.classList.remove('active');
    entry.element.style.display = 'none';
    if (!entry.element.isConnected) document.body.append(entry.element);
    const original = document.createElement('button');
    original.type = 'button';
    original.className = 'tab-btn desk-work-alias';
    original.dataset.tab = entry.id;
    original.title = entry.label;
    original.textContent = entry.label;
    original.addEventListener('click', () => showCustom(entry));
    workGroup.append(original);
    entry.original = original;
    addButton(entry);
  }
  function register(config) {
    if (!config || !/^[a-z][a-z0-9-]{1,35}$/.test(config.id || '') || builtins.some(([id]) => id === config.id)) throw new TypeError('Invalid workspace section');
    if (custom.has(config.id)) return custom.get(config.id);
    const entry = { ...config, label: String(config.label || config.id) };
    custom.set(entry.id, entry);
    if (ready) { mountCustom(entry); sync(); }
    return entry;
  }
  window.HubWorkspace = { register, open, refresh: sync };
  document.addEventListener('DOMContentLoaded', () => {
    source = document.querySelector('.tabs');
    const shift = source?.querySelector('[data-tab="shift"]');
    if (!shift) return;
    workGroup = shift.closest('.hub-navGroup') || source;
    workGroup.classList.add('desk-work-group');
    navigation = document.createElement('nav');
    navigation.className = 'desk-workspace-nav';
    navigation.setAttribute('aria-label', 'Разделы смены');
    buttons = document.createElement('div'); buttons.className = 'desk-workspace-tabs';
    navigation.append(buttons);
    const deskTools = document.querySelector('#tab-shift .desk-toolbar');
    if (deskTools) navigation.append(deskTools);
    const anchor = $('screenWatchNotice') || document.querySelector('.hub-header');
    anchor.after(navigation);
    for (const [id, label] of builtins) {
      const original = source.querySelector('[data-tab="' + id + '"]');
      if (!original) continue;
      if (id !== 'shift') original.classList.add('desk-work-alias');
      addButton({id, label, original});
    }
    source.querySelector('[data-tab="cols"]')?.classList.add('desk-work-alias');
    source.addEventListener('click', event => {
      const id = event.target.closest('[data-tab]')?.dataset.tab;
      if (id && !custom.has(id)) hideCustom();
    }, true);
    ready = true;
    for (const entry of custom.values()) mountCustom(entry);
    new MutationObserver(sync).observe(source, {subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'disabled']});
    document.addEventListener('hub:work-ready', sync);
    buttons.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const items = [...buttons.querySelectorAll('button')].filter(button => !button.hidden && !button.disabled);
      const index = items.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    sync();
  });
})();
