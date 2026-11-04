(() => {
  'use strict';
  const ipc = require('electron').ipcRenderer;
  const el = id => document.getElementById(id);
  const titles = {exchange:'Колл на биржу', email:'Колл на почту'};
  let ready = false;
  let consuming = false;
  let again = false;

  async function openPending() {
    if (!ready || el('authScreen')?.style.display !== 'none' || !el('shiftCallDialog')) return;
    if (consuming) { again = true; return; }
    consuming = true;
    try {
      do {
        again = false;
        const kind = await ipc.invoke('hub-shortcut:take');
        if (!Object.hasOwn(titles, kind)) continue;
        document.querySelector('.tabs [data-tab="shift"]').click();
        const type = el('callTypeSelect');
        const draft = ['callServiceName','callLinkInput','callNoteInput'].some(id => el(id).value.trim());
        if (draft && type.value !== titles[kind]) {
          el('callStatus').textContent = 'Открыт текущий черновик. Можно изменить тип колла в форме.';
        } else {
          type.value = titles[kind];
          type.dispatchEvent(new Event('change', {bubbles:true}));
        }
        document.querySelector('.orbit-call').click();
      } while (again);
    } catch (error) {
      console.warn('Не удалось открыть форму колла из Brave', error);
    } finally { consuming = false; }
  }

  function offerInstall() {
    const details = el('braveInstall');
    const shift = el('tab-shift');
    if (!shift || !details || el('braveIntro')) return;
    try { if (localStorage.getItem('hub-brave-install-seen')) return; } catch { return; }
    const offer = document.createElement('aside');
    offer.id = 'braveIntro'; offer.className = 'card brave-intro';
    offer.innerHTML = '<strong>Коллы из Brave</strong><span>Добавь «Заколить» рядом с AI chat в рабочей панели.</span><button type="button">Подключить</button><button type="button">Позже</button>';
    const [connect, later] = offer.querySelectorAll('button');
    const finish = () => { offer.remove(); try { localStorage.setItem('hub-brave-install-seen', '1'); } catch {} };
    later.onclick = finish;
    connect.onclick = () => { finish(); document.querySelector('.tabs [data-tab="hq"]').click(); details.open = true; details.scrollIntoView({block:'nearest'}); };
    shift.append(offer);
  }
  ipc.on('hub-shortcut:available', openPending);
  document.addEventListener('hub:work-ready', () => { ready = true; openPending(); offerInstall(); });
  document.addEventListener('DOMContentLoaded', () => {
    openPending();
    const details = el('braveInstall');
    if (!details) return;
    const key = 'hub-brave-install-seen';
    try { details.open = !localStorage.getItem(key); } catch {}
    details.addEventListener('toggle', () => {
      if (!details.open) try { localStorage.setItem(key, '1'); } catch {}
    });
    el('braveInstallLater').onclick = () => { details.open = false; };
    el('braveInstallFolder').onclick = async () => {
      try {
        const error = await ipc.invoke('hub-shortcut:folder');
        el('braveInstallStatus').textContent = error ? 'Не удалось открыть папку расширения.' : 'Папка открыта. Выбери её в Brave.';
      } catch { el('braveInstallStatus').textContent = 'Не удалось открыть папку расширения.'; }
    };
  });
})();
