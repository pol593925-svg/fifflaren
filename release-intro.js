/* A bounded startup flourish. It never waits for authentication, assets or network. */
(function (global) {
  'use strict';
  const ID = 'hubReleaseIntro';
  let current = null;

  function stop() {
    const entry = current;
    if (!entry) return;
    current = null;
    clearTimeout(entry.timer); clearTimeout(entry.removeTimer);
    document.removeEventListener('keydown', entry.keydown, true);
    document.removeEventListener('focusin', entry.focusin, true);
    document.removeEventListener('visibilitychange', entry.visibility);
    global.removeEventListener('pagehide', entry.pagehide);
    entry.node.remove();
    // Authentication may have finished underneath the intro. Never focus a hidden screen.
    const target = entry.previousFocus;
    if (target && target.isConnected && target !== document.body && target.getClientRects().length && typeof target.focus === 'function') {
      try { target.focus({preventScroll: true}); } catch (_) {}
    }
  }

  function finish(animate = true) {
    const entry = current;
    if (!entry || entry.finishing) return;
    entry.finishing = true;
    clearTimeout(entry.timer);
    if (!animate || entry.reduced) { stop(); return; }
    entry.node.classList.add('hub-release-leaving');
    entry.node.style.pointerEvents = 'none';
    entry.removeTimer = setTimeout(stop, 180);
  }

  function start(options = {}) {
    stop();
    if (!document.body || document.hidden) return false;
    const version = typeof options.version === 'string' && /^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*$/.test(options.version) ? options.version : '6.1.0';
    let entry;
    try {
      const reduced = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      const node = document.createElement('section');
      node.id = ID;
      node.className = reduced ? 'hub-release-reduced' : '';
      node.setAttribute('role', 'dialog');
      node.setAttribute('aria-modal', 'true');
      node.setAttribute('aria-label', 'Support Hub — обновление ' + version);
      node.innerHTML = `
        <div class="hub-release-grid" aria-hidden="true"></div>
        <div class="hub-release-ring hub-release-ring-one" aria-hidden="true"></div>
        <div class="hub-release-ring hub-release-ring-two" aria-hidden="true"></div>
        <header class="hub-release-top"><span class="hub-release-wordmark"><i aria-hidden="true">S</i> SUPPORT HUB</span>
          <button type="button" class="hub-release-skip">Пропустить <span aria-hidden="true">Esc</span></button></header>
        <div class="hub-release-center">
          <span class="hub-release-kicker">НОВАЯ ГЛАВА ТВОЕГО ПРОСТРАНСТВА</span>
          <svg class="hub-release-logo" width="144" height="144" viewBox="0 0 144 144" aria-hidden="true">
            <rect class="hub-release-logo-base" x="10" y="10" width="124" height="124" rx="32"/>
            <rect class="hub-release-logo-frame" x="10" y="10" width="124" height="124" rx="32" pathLength="100"/>
            <path class="hub-release-logo-stroke" d="M94 45C87 38 62 36 52 47C39 63 58 72 72 75C86 78 104 84 93 100C83 114 57 111 47 101" pathLength="100"/>
            <circle class="hub-release-logo-dot" cx="105" cy="35" r="5"/>
          </svg>
          <div class="hub-release-caption">ОБНОВЛЕНИЕ</div>
          <h1 class="hub-release-version"></h1>
          <p class="hub-release-tagline">Команда. Работа. Время для себя.</p>
          <div class="hub-release-features" aria-label="Что нового">
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v14H3zM8 22h8M12 18v4M3 9h18M9 9v9"/></svg>Единый стиль</span>
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg>Мой профиль</span>
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 22h20"/></svg>Личная статистика</span>
          </div>
        </div>
        <footer class="hub-release-bottom"><span class="hub-release-edition"></span><span>СДЕЛАНО ДЛЯ КОМАНДЫ FIFFLAREN</span></footer>`;
      node.querySelector('.hub-release-version').textContent = version;
      node.querySelector('.hub-release-edition').textContent = 'SUPPORT HUB / ' + version;
      const skip = node.querySelector('.hub-release-skip');
      entry = {node, reduced, previousFocus: document.activeElement, timer: null, removeTimer: null, finishing: false};
      entry.keydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
        else if (event.key === 'Tab' && !entry.finishing) { event.preventDefault(); skip.focus({preventScroll: true}); }
      };
      entry.focusin = event => {
        if (!entry.finishing && current === entry && !node.contains(event.target)) skip.focus({preventScroll: true});
      };
      entry.visibility = () => { if (document.hidden) finish(false); };
      entry.pagehide = stop;
      current = entry;
      skip.addEventListener('click', () => finish(false));
      document.addEventListener('keydown', entry.keydown, true);
      document.addEventListener('focusin', entry.focusin, true);
      document.addEventListener('visibilitychange', entry.visibility);
      global.addEventListener('pagehide', entry.pagehide);
      // The deadline is armed before mounting; a missing stylesheet cannot leave a blocking overlay.
      entry.timer = setTimeout(() => finish(!reduced), reduced ? 200 : 2020);
      document.body.append(node);
      skip.focus({preventScroll: true});
      return true;
    } catch (_) {
      stop();
      if (entry?.node) entry.node.remove();
      return false;
    }
  }
  global.HubReleaseIntro = {start, stop};
})(window);
