(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const maps = {dust2:'Dust2', inferno:'Inferno'};
  const node = (tag, text) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  let session, searchTimer, timer, seq = 0, matchId, draftCall;
  let matchTimeOffset = 0;
  async function api(path, method = 'GET', body) {
    if (!session?.token) throw Object.assign(Error('Сессия недействительна. Войди в Support Hub заново.'),{status:401});
    const response = await fetch(session.server + '/api/office/' + path, {
      method, headers:{Authorization:'Bearer ' + session.token,'Content-Type':'application/json'},
      body:body && JSON.stringify(body), signal:AbortSignal.timeout(12000)
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw Object.assign(Error(data.message || 'Не удалось выполнить запрос.'),{status:response.status});
    return data;
  }
  function action(text, fn) {
    const b = node('button', text);
    b.type = 'button';
    b.onclick = async () => {
      b.disabled = true;
      try { await fn(); }
      catch (e) { el('officeStatus').textContent = e.message; }
      finally { b.disabled = false; }
    };
    return b;
  }
  function lobby() {
    el('tab-hq').closest('dialog[open]')?.close();
    document.querySelector('.tabs [data-tab="cs16"]').click();
  }
  function showMatches(matches) {
    const list = el('officeMatches');
    list.replaceChildren();
    const self = session.username.toLowerCase();
    for (const m of matches) {
      const row = node('article'), starts = new Date(m.start);
      row.append(node('strong', maps[m.map] + ' · ' + starts.toLocaleString('ru', {dateStyle:'short',timeStyle:'short'})));
      row.append(node('p', 'Организатор — ' + m.host + '. Состав (' + m.members.length + ') — ' + (m.members.join(', ') || 'пока пусто')));
      const joined = m.members.includes(self);
      row.append(action(joined ? 'Выйти из состава' : 'Я в игре', async () => {
        await api('matches/' + m._id, 'PATCH', {join:!joined}); await refresh();
      }));
      if (Date.now() + matchTimeOffset >= +starts) row.append(action('Открыть лобби КС', lobby));
      if (self === 'fifflaren' || self === m.host) row.append(action('Отменить сбор', async () => {
        await api('matches/' + m._id, 'DELETE'); await refresh();
      }));
      list.append(row);
    }
    if (!matches.length) list.textContent = 'Пока никто не собирается на матч.';
  }
  async function refresh() {
    if (!session || !el('officeSection') || !el('tab-hq').getClientRects().length || document.hidden) return;
    const req = ++seq;
    try {
      const [board, matches] = await Promise.all([
        api('decisions?q=' + encodeURIComponent(el('officeFind').value.trim())), api('matches')
      ]);
      if (req !== seq) return;
      const list = el('officeDecisions');
      list.replaceChildren();
      for (const d of board.items) {
        const row = node('article');
        row.append(node('strong', d.title), node('p', d.situation), node('p', d.solution));
        list.append(row);
      }
      if (!board.items.length) list.textContent = el('officeFind').value ? 'Совпадений нет.' : 'Пока нет опубликованных решений.';
      matchTimeOffset = matches.now - Date.now();
      showMatches(matches.matches);
      el('officeStatus').textContent = '';
    } catch (e) { if (req === seq) el('officeStatus').textContent = e.message; }
  }
  let deviceSeq = 0;
  const busyDevices = new Set();
  const deviceRows = new Map();
  function paintDevice(row,device) {
    const button = row.querySelector('button');
    button.setAttribute('aria-pressed',String(device.inWork));
    button.setAttribute('aria-label','В работе — ' + device.name);
    row.classList.toggle('in-work',device.inWork);
    row.querySelector('strong').textContent = device.name;
    row.querySelector('small').textContent = device.inWork ? 'Отметил: ' + device.markedBy : 'Добавил: ' + device.registeredBy;
  }
  function makeDeviceRow(device) {
    const row = node('article'), button = node('button','В работе');
    row.className = 'office-device'; button.type = 'button';
    row.append(button,node('strong'),node('small'));
    button.onclick = async () => {
      const cfg=session, id=device._id;
      if (busyDevices.has(id)) return;
      busyDevices.add(id); button.disabled = true; ++deviceSeq;
      try {
        const data = await api('devices/'+encodeURIComponent(id),'PATCH',{inWork:button.getAttribute('aria-pressed')!=='true'});
        if (cfg===session) {
          ++deviceSeq; paintDevice(row,data.device);
          el('officeDeviceStatus').textContent = data.device.inWork ? 'Отметка сохранена.' : 'Отметка снята.';
        }
      } catch (e) { if (cfg===session) el('officeDeviceStatus').textContent=e.message; }
      finally { if (cfg===session) busyDevices.delete(id); button.disabled=false; }
    };
    return row;
  }
  async function refreshDevices() {
    if (!session || !el('tab-hq').getClientRects().length || document.hidden) return;
    const seq = ++deviceSeq;
    try {
      const {devices} = await api('devices');
      if (seq!==deviceSeq) return;
      const list = el('officeDevices'), found = new Set();
      for (const [i,device] of devices.entries()) {
        found.add(device._id);
        let row = deviceRows.get(device._id);
        if (!row) { row=makeDeviceRow(device); deviceRows.set(device._id,row); }
        if (!busyDevices.has(device._id)) paintDevice(row,device);
        if (list.children[i]!==row) list.insertBefore(row,list.children[i]||null);
      }
      for (const [id,row] of deviceRows) if (!found.has(id)) { row.remove(); deviceRows.delete(id); }
      el('officeDeviceEmpty').hidden=devices.length>0;
    } catch (e) { if (seq===deviceSeq){if(e.status===401||e.status===403){el('officeStatus').textContent=e.message;el('officeDeviceStatus').textContent='';}else el('officeDeviceStatus').textContent=e.message;} }
  }
  function refreshOffice() { refresh(); refreshDevices(); }
  function start(options) {
    session = options;
    clearInterval(timer); ++seq;
    ++deviceSeq; deviceRows.clear(); busyDevices.clear(); el('officeDevices').replaceChildren();
    el('officeDeviceStatus').textContent=''; el('officeDeviceEmpty').hidden=true;
    timer = setInterval(refreshOffice, 15000);
    refreshOffice();
  }
  function offer(card, row) {
    if (row.status !== 'done' || session?.username.toLowerCase() !== 'fifflaren') return;
    const b = action('На доску решений', () => {
      draftCall = row.id;
      el('officeDecisionForm').reset();
      el('officeDecisionTitle').value = row.service || '';
      el('officeDecisionStatus').textContent = '';
      el('officePublish').showModal();
      el('officeDecisionTitle').focus();
    });
    card.append(b);
  }
  function randomId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2,'0')).join('');
  }
  document.addEventListener('DOMContentLoaded', () => {
    const hq = el('tab-hq');
    new MutationObserver(refreshOffice).observe(hq,{attributes:true,attributeFilter:['style','class']});
    document.addEventListener('visibilitychange', refreshOffice);
    el('adminOpenOfficeDevices').onclick = () => {
      document.querySelector('.tabs [data-tab="hq"]').click();
      el('officeDeviceTitle').focus(); el('officeDeviceTitle').scrollIntoView({block:'nearest'});
    };
    el('officeDeviceForm').onsubmit = async e => {
      e.preventDefault();
      const b=el('officeDeviceAdd'), input=el('officeDeviceName'), cfg=session;
      if (b.disabled || !cfg) return;
      b.disabled=true;
      try {
        let installation = localStorage.getItem('hub-office-installation');
        if (!installation) { installation=randomId(); localStorage.setItem('hub-office-installation',installation); }
        const data=await api('devices','POST',{installation,name:input.value.trim()});
        if (cfg!==session) return;
        input.value=''; el('officeDeviceStatus').textContent='Этот компьютер в списке — '+data.device.name;
        await refreshDevices();
      } catch (err) { if (cfg===session) el('officeDeviceStatus').textContent=err.message; }
      finally { b.disabled=false; }
    };
    el('officeFind').oninput = () => { clearTimeout(searchTimer); ++seq; searchTimer = setTimeout(refresh,220); };
    el('officeGatherForm').onsubmit = async e => {
      e.preventDefault();
      const btn = el('officeGatherSubmit');
      if (btn.disabled) return;
      btn.disabled = true;
      const input = el('officeStart');
      matchId ||= randomId();
      try {
        await api('matches','POST',{id:matchId, map:el('officeMap').value, start:new Date(input.value).getTime()});
        matchId = null; input.value = ''; await refresh();
      } catch (err) { el('officeStatus').textContent = err.message; }
      finally { btn.disabled = false; }
    };
    el('officeGatherForm').oninput = () => { matchId = null; };
    el('officeDecisionForm').onsubmit = async e => {
      e.preventDefault();
      const b = el('officePublishSubmit');
      if (b.disabled) return;
      b.disabled = true;
      try {
        await api('decisions','POST',{callId:draftCall,title:el('officeDecisionTitle').value,
          situation:el('officeSituation').value,solution:el('officeSolution').value});
        el('officePublish').close(); await refresh();
      } catch (err) { el('officeDecisionStatus').textContent = err.message; }
      finally { b.disabled = false; }
    };
    el('officePublishClose').onclick = () => el('officePublish').close();
  });
  window.HubOffice = {start,offer};
})();
