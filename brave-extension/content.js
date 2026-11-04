(() => {
  'use strict';
  const route = /^\/computers\/[^/]+\/?$/;
  const controls = 'button, [role="button"], a';
  let host, anchor, toggle, menu, scheduled = false;

  function isChatButton(button) {
    return [button.getAttribute('aria-label'), button.title, button.textContent]
      .some(label => label?.trim().replace(/\s+/g, ' ').toLowerCase() === 'ai chat');
  }

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  function buildMenu() {
    host = document.createElement('span');
    host.dataset.supportHubCalls = '';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {display:inline-flex;align-items:center;align-self:center;position:relative;font:500 13px/1.4 system-ui,sans-serif}
      button {font:inherit;cursor:pointer;background:#f4f1ff;color:#5137ab;border:1px solid #d9cff5;border-radius:6px;padding:5px 10px;white-space:nowrap}
      button:hover,button[aria-expanded=true]{background:#e6dfff}
      button:focus-visible,a:focus-visible{outline:2px solid #7359cc;outline-offset:2px}
      nav {position:fixed;z-index:2147483646;width:min(220px, calc(100vw - 12px));box-sizing:border-box;padding:8px;border:1px solid #ddd9eb;border-radius:10px;background:#fff;color:#202238;box-shadow:0 8px 26px #18163830}
      [hidden]{display:none}
      small {display:block;margin:3px 7px 6px;color:#665a80;font:600 10px/1.4 system-ui;letter-spacing:1px}
      a {display:block;padding:8px;border-radius:5px;color:inherit;text-decoration:none;font:500 14px/1.3 system-ui}
      a:hover,a:focus-visible {background:#f2effb}
    `;
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Заколить';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'hub-call-actions');
    menu = document.createElement('nav');
    menu.id = 'hub-call-actions';
    menu.hidden = true;
    menu.setAttribute('aria-label', 'Коллы Support Hub');
    const label = document.createElement('small');
    label.textContent = 'SUPPORT HUB';
    menu.append(label);
    for (const [title, action] of [['Колл на биржу', 'call-exchange'], ['Колл на почту', 'call-email']]) {
      const link = document.createElement('a');
      link.href = 'supporthub://work/' + action;
      link.textContent = title;
      link.addEventListener('click', () => { closeMenu(); toggle.focus(); });
      menu.append(link);
    }
    root.append(style, toggle, menu);
    toggle.addEventListener('click', () => {
      if (!menu.hidden) return closeMenu();
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      placeMenu();
      menu.querySelector('a').focus();
    });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) {
        e.preventDefault(); e.stopPropagation(); closeMenu(); toggle.focus();
      }
    });
    root.addEventListener('focusout', e => {
      if (!root.contains(e.relatedTarget)) closeMenu();
    });
  }

  function placeMenu() {
    if (!menu || menu.hidden || !host.isConnected) return;
    const rect = toggle.getBoundingClientRect();
    const top = rect.bottom + 5;
    menu.style.left = Math.max(6, Math.min(rect.left, innerWidth - menu.offsetWidth - 6)) + 'px';
    menu.style.top = (top + menu.offsetHeight <= innerHeight ? top : Math.max(6, rect.top - menu.offsetHeight - 5)) + 'px';
  }

  function mount() {
    scheduled = false;
    if (!route.test(location.pathname)) {
      closeMenu();
      host?.remove();
      anchor = null;
      return;
    }
    if (!anchor?.isConnected || !isChatButton(anchor)) {
      anchor = Array.from(document.querySelectorAll(controls)).find(isChatButton);
    }
    if (!anchor) {
      closeMenu(); host?.remove(); return;
    }
    if (!host) buildMenu();
    if (anchor.nextElementSibling !== host) {
      closeMenu(); anchor.after(host);
    }
  }

  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(mount); }
  }
  document.addEventListener('pointerdown', e => {
    if (host && !e.composedPath().includes(host)) closeMenu();
  }, true);
  window.addEventListener('resize', placeMenu);
  window.addEventListener('scroll', placeMenu, true);
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  window.navigation?.addEventListener('currententrychange', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-label','title','role']});
  mount();
})();
