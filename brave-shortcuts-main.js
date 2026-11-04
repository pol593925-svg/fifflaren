'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const actions = new Map([
  ['supporthub://work/call-exchange', 'exchange'],
  ['supporthub://work/call-email', 'email'],
  ['supporthub://work/exchanges', 'catalog']
]);

function install({ app, ipcMain, shell, getWindow, argv = process.argv }) {
  let pending = null;
  function showWindow() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (pending) win.webContents.send('hub-shortcut:available');
  }
  function receive(args) {
    const uri = args.find(arg => actions.has(arg));
    if (uri) pending = actions.get(uri);
    return !!uri;
  }
  if (app.isPackaged) {
    if (!app.requestSingleInstanceLock()) {
      app.exit(0);
      return;
    }
    receive(argv);
    app.on('second-instance', (_event, args) => { receive(args); showWindow(); });
    app.on('open-url', (event, url) => {
      if (receive([url])) { event.preventDefault(); showWindow(); }
    });
    app.whenReady().then(() => app.setAsDefaultProtocolClient('supporthub'));
  }
  const indexUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
  function fromHub(event) {
    const win = getWindow();
    return win && !win.isDestroyed() && event.sender === win.webContents &&
      event.senderFrame === win.webContents.mainFrame && event.senderFrame.url.split(/[?#]/)[0] === indexUrl;
  }
  ipcMain.handle('hub-shortcut:take', event => {
    if (!fromHub(event)) return null;
    const result = pending;
    pending = null;
    return result;
  });
  ipcMain.handle('hub-shortcut:folder', event => {
    if (!fromHub(event)) throw Error('Недоступный источник');
    return shell.openPath(path.join(app.isPackaged ? process.resourcesPath : __dirname, 'brave-extension'));
  });
}
module.exports = { install };
