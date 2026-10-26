/* Shared across tabs. Remote chat stays outside the Node-enabled renderer. */
(() => {
  if (document.getElementById('support-chat-toggle')) return;
  const style = document.createElement('style');
  style.textContent = `
    #support-chat-toggle{position:fixed;right:22px;bottom:22px;z-index:2147483646;border:1px solid #ffffff40;border-radius:30px;padding:15px 21px;background:linear-gradient(135deg,#18a897,#08786f);color:white;box-shadow:0 8px 30px #0005;font:600 14px system-ui;cursor:pointer}
    #support-chat-panel{position:fixed;right:22px;bottom:86px;width:min(390px,calc(100vw - 32px));height:min(580px,calc(100vh - 110px));z-index:2147483646;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 70px #0008}
    #support-chat-panel[hidden]{display:none}
    #support-chat-panel iframe{width:100%;height:calc(100% - 42px);border:0;background:#fff}
    #support-chat-panel footer{height:42px;display:flex;align-items:center;justify-content:center;gap:8px;background:#eef4f5;color:#41545c;font:12px system-ui}
    #support-chat-panel footer button{border:0;background:none;color:#08786f;text-decoration:underline;cursor:pointer}
    #support-chat-toggle:focus-visible{outline:3px solid #7ee7d8;outline-offset:3px}
  `;
  document.head.append(style);
  const button = document.createElement('button');
  button.id = 'support-chat-toggle';
  button.textContent = '💬 Чат поддержки';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'support-chat-panel');
  const panel = document.createElement('section');
  panel.id = 'support-chat-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Чат поддержки Tawk.to');
  let frame;
  function close() {
    panel.hidden = true;
    button.textContent = '💬 Чат поддержки';
    button.setAttribute('aria-expanded', 'false');
  }
  button.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    if (document.pointerLockElement) document.exitPointerLock();
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = 'Tawk.to — чат поддержки';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      frame.referrerPolicy = 'no-referrer';
      // Official direct-chat endpoint, using the exact property/widget IDs supplied.
      frame.src = 'https://tawk.to/chat/6aaac31a0be5c3344706f5f0/1k2lgk7sp';
      panel.append(frame);
      const footer = document.createElement('footer');
      footer.append('Чат не загрузился?');
      const retry = document.createElement('button');
      retry.textContent = 'Повторить';
      retry.addEventListener('click', () => { frame.src = frame.src.split('?')[0] + '?reload=' + Date.now(); });
      footer.append(retry);
      panel.append(footer);
    }
    panel.hidden = false;
    button.textContent = '✕ Свернуть чат';
    button.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { close(); button.focus(); } });
  document.body.append(panel, button);
})();
