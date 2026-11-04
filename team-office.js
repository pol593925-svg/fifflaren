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
    if (!session?.token) throw Error('Войди в аккаунт команды.');
    const response = await fetch(session.server + '/api/office/' + path, {
      method, headers:{Authorization:'Bearer ' + session.token,'Content-Type':'application/json'},
      body:body && JSON.stringify(body), signal:AbortSignal.timeout(12000)
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw Error(data.message || 'Не удалось выполнить запрос.');
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
  function start(options) {
    session = options;
    clearInterval(timer); ++seq;
    timer = setInterval(refresh, 15000);
    refresh();
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
    new MutationObserver(refresh).observe(hq,{attributes:true,attributeFilter:['style','class']});
    document.addEventListener('visibilitychange', refresh);
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
