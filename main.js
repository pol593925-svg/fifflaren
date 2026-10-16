const { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage, screen, shell, session, desktopCapturer, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let mainWindow = null;
let notifyWindow = null;
let tray = null;
let pendingNotification = null; // уведомление, пришедшее до готовности окна
let muted = false; // глобальное отключение звука (🔊/🔇 в приложении)
let allowQuit = true;  // может ли пользователь закрыть приложение (админы/ТЛ)
let forceQuit = false; // служебное принудительное закрытие (обновление и т.п.)
let rebuildTrayMenuFn = null; // перестроить меню трея (скрыть/показать «Выход»)

// --- ГЛАВНОЕ ОКНО ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.maximize();

  mainWindow.on('close', (e) => {
    // Сворачиваем в трей вместо закрытия
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
      // Мягкий намёк сотруднику, что закрыть приложение нельзя
      if (!allowQuit && tray && !mainWindow.__hintShown) {
        mainWindow.__hintShown = true;
        tray.displayBalloon({
          title: 'Support Hub',
          content: 'Приложение работает в фоне. Закрыть его может только админ/ТЛ через меню в трее.'
        });
        setTimeout(() => { if (mainWindow) mainWindow.__hintShown = false; }, 10000);
      }
    }
  });
}

// --- ОКНО УВЕДОМЛЕНИЯ (поверх всех окон) ---
function createNotifyWindow() {
  notifyWindow = new BrowserWindow({
    width: 460,
    height: 240,
    frame: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Уровень «screen-saver» — поверх почти всего, включая другие always-on-top окна
  notifyWindow.setAlwaysOnTop(true, 'screen-saver');
  notifyWindow.setVisibleOnAllWorkspaces(true);

  notifyWindow.loadFile('notification.html');
  notifyWindow.once('ready-to-show', () => {
    if (pendingNotification) {
      showNotification(pendingNotification);
      pendingNotification = null;
    }
  });
}

function positionNotifyWindow() {
  if (!notifyWindow) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const [winWidth, winHeight] = notifyWindow.getSize();
  // Правый нижний угол экрана
  notifyWindow.setPosition(width - winWidth - 16, height - winHeight - 16);
}

function showNotification(payload) {
  if (!notifyWindow || !notifyWindow.webContents) {
    pendingNotification = payload;
    return;
  }
  positionNotifyWindow();
  const q = new URLSearchParams({
    text: payload.text || '',
    from: payload.from || 'Fifflaren',
    time: payload.time || '',
    muted: muted ? '1' : '0',
    color: payload.color === 'blue' ? 'blue' : 'red',
    sound: ['default', 'fart', 'moan'].includes(payload.sound) ? payload.sound : 'default'
  });
  notifyWindow.webContents.loadFile('notification.html', { query: Object.fromEntries(q) });
  notifyWindow.show();
  notifyWindow.focus();
}

// --- ОКНО С ФОТО (отдельное, поверх всех окон) ---
let imageWindow = null;
let pendingImage = null;

function createImageWindow() {
  imageWindow = new BrowserWindow({
    width: 520,
    height: 640,
    frame: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  imageWindow.setAlwaysOnTop(true, 'screen-saver');
  imageWindow.setVisibleOnAllWorkspaces(true);

  imageWindow.loadFile('image.html');
  imageWindow.once('ready-to-show', () => {
    if (pendingImage) {
      sendImageToWindow(pendingImage);
      pendingImage = null;
    }
  });
}

function positionImageWindow() {
  if (!imageWindow) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const [winWidth, winHeight] = imageWindow.getSize();
  imageWindow.setPosition(width - winWidth - 16, height - winHeight - 16);
}

// Фото передаём через IPC, а не query — base64 слишком длинный для URL
function sendImageToWindow(payload) {
  payload.muted = muted;
  positionImageWindow();
  imageWindow.webContents.send('image-data', payload);
  imageWindow.show();
  imageWindow.focus();
}

function showImage(payload) {
  if (!imageWindow || imageWindow.isDestroyed()) {
    pendingImage = payload;
    createImageWindow();
    return;
  }
  sendImageToWindow(payload);
}

// --- ТРЕЙ ---
function createTray() {
  const iconPath = path.join(__dirname, 'tray.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Support Hub');

  const buildMenu = () => {
    const autoStart = app.getLoginItemSettings().openAtLogin;
    const items = [
      { label: '🔓 Открыть Support Hub', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      {
        label: `🚀 Автозапуск с Windows: ${autoStart ? 'вкл' : 'выкл'}`,
        click: () => {
          app.setLoginItemSettings({ openAtLogin: !autoStart });
          createTrayMenu();
        }
      }
    ];
    // Закрыть приложение могут только админы и ТЛ
    if (allowQuit) {
      items.push({ type: 'separator' });
      items.push({ label: '❌ Выход', click: () => { tray = null; app.isQuiting = true; app.quit(); } });
    }
    return Menu.buildFromTemplate(items);
  };

  const createTrayMenu = () => tray.setContextMenu(buildMenu());
  createTrayMenu();
  rebuildTrayMenuFn = createTrayMenu;

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });
}

// --- IPC ---
ipcMain.on('show-notification', (event, payload) => {
  showNotification(payload);
});

ipcMain.on('set-muted', (event, m) => {
  muted = !!m;
});

// Разрешение на закрытие приложения: true — админ/ТЛ, false — сотрудник
ipcMain.on('set-can-quit', (event, can) => {
  allowQuit = !!can;
  if (rebuildTrayMenuFn) rebuildTrayMenuFn();
});

// --- ОТКРЫТИЕ ССЫЛКИ В БРАУЗЕРЕ (3.3.0): default / brave / chrome ---
const BROWSER_PATHS = {
  brave: [
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    (process.env.LOCALAPPDATA || '') + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
  ],
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe'
  ]
};

ipcMain.on('open-url', (event, payload) => {
  try {
    const url = payload && payload.url;
    if (!url || !/^https?:\/\//i.test(url)) return;
    const browser = payload.browser || 'default';
    if (browser !== 'default' && BROWSER_PATHS[browser]) {
      const exe = BROWSER_PATHS[browser].find(p => p && fs.existsSync(p));
      if (exe) { execFile(exe, [url], () => {}); return; }
    }
    // Браузер по умолчанию (или не нашли нужный — открываем как получится)
    shell.openExternal(url).catch(() => {});
  } catch (e) { /* тихо */ }
});

// ==================== «ВРУБИТЬ ДЕМКУ»: демонстрация экрана в звонке через Brave (3.14.0) ====================
// Схема: Brave запущен с --remote-debugging-port=9222 (если нет — перезапускаем с флагами).
// Через CDP находим вкладку/iframe со звонком (Element/Jitsi), жмём кнопку «Начать трансляцию с экрана».
// Окно выбора источника не появляется — Brave запущен с --auto-select-desktop-capture-source="Экран 1".

const CDP_PORT = 9222;

async function cdpTargets() {
  try {
    const r = await fetch(`http://localhost:${CDP_PORT}/json`);
    return await r.json();
  } catch { return null; }
}

function cdpEval(wsUrl, expression) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; try { ws.close(); } catch {} resolve(v); } };
    try {
      const ws = new WebSocket(wsUrl);
      const to = setTimeout(() => done(undefined), 8000);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
      });
      ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id === 1) { clearTimeout(to); done(m.result && m.result.result ? m.result.result.value : undefined); }
      });
      ws.addEventListener('error', () => { clearTimeout(to); done(undefined); });
    } catch { done(undefined); }
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function restartBraveWithCdp() {
  const exe = BROWSER_PATHS.brave.find(p => p && fs.existsSync(p));
  if (!exe) return false;
  try { execFile('taskkill', ['/IM', 'brave.exe', '/F'], () => {}); } catch {}
  await sleep(2500);
  try {
    const { spawn } = require('child_process');
    spawn(exe, [
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-first-run',
      '--auto-select-desktop-capture-source=Экран 1'
    ], { detached: true, stdio: 'ignore' }).unref();
  } catch { return false; }
  for (let i = 0; i < 6; i++) {
    await sleep(2000);
    const t = await cdpTargets();
    if (t && t.length) return true;
  }
  return false;
}

// JS: нажать кнопку демонстрации экрана в Jitsi/Element
const CLICK_PRESENT_JS = `(() => {
  const needles = ['трансляц', 'демонстрац', 'present now', 'share your screen', 'start presenting', 'screen share'];
  const els = [...document.querySelectorAll('button,[role="button"]')];
  for (const el of els) {
    const txt = ((el.getAttribute('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.textContent || '')).toLowerCase();
    if (needles.some(n => txt.includes(n))) { el.click(); return 'clicked'; }
  }
  return 'not_found';
})()`;

// JS: проверить, идёт ли демонстрация экрана (видеотрек экрана в странице)
const CHECK_SHARING_JS = `(() => {
  const vids = [...document.querySelectorAll('video')];
  for (const v of vids) {
    if (v.srcObject) {
      const t = (v.srcObject.getVideoTracks() || [])[0];
      if (t && /screen|desktop|экран|window|окно/i.test(t.label || '')) return 'sharing';
    }
  }
  return vids.length ? 'videos_no_share' : 'no_videos';
})()`;

async function forcePresentScreen() {
  // 1) CDP доступен?
  let targets = await cdpTargets();
  let weRestarted = false;
  if (!targets || !targets.length) {
    if (!await restartBraveWithCdp()) return { ok: false, error: 'Brave не удалось запустить с управлением (CDP)' };
    weRestarted = true;
    targets = await cdpTargets();
  }
  if (!targets || !targets.length) return { ok: false, error: 'Brave не отвечает на управление' };

  // 2) ищем цели звонка: сначала iframe (Jitsi внутри Element), потом обычные вкладки
  const callTargets = targets.filter(t => (t.type === 'page' || t.type === 'iframe') &&
    /meet\\.|jitsi|element\\.|wcomp|call|conf/i.test(t.url || ''));
  const ordered = [...callTargets.filter(t => t.type === 'iframe'), ...callTargets.filter(t => t.type === 'page')];
  if (!ordered.length) return { ok: false, error: 'Вкладка со звонком не найдена (пусть сотрудник откроет общалку)' };

  // 3) жмём кнопку трансляции
  let clickedTarget = null;
  for (const t of ordered) {
    const r = await cdpEval(t.webSocketDebuggerUrl, CLICK_PRESENT_JS);
    if (r === 'clicked') { clickedTarget = t; break; }
  }
  if (!clickedTarget) return { ok: false, error: 'Кнопка демонстрации в звонке не найдена' };

  // 4) если Brave запущен не нами (без флага автовыбора) — подтверждаем окно выбора через Enter
  if (!weRestarted) {
    await sleep(1500);
    execFile('powershell', ['-NoProfile', '-Command', '(New-Object -ComObject WScript.Shell).SendKeys("{ENTER}")'], () => {});
  }

  // 5) проверяем результат
  await sleep(3500);
  const check = await cdpEval(clickedTarget.webSocketDebuggerUrl, CHECK_SHARING_JS);
  if (check === 'sharing') return { ok: true, verified: true };
  return { ok: true, verified: false };
}

ipcMain.on('force-present', async (event, payload) => {
  try {
    const res = await forcePresentScreen();
    if (event.sender && !event.sender.isDestroyed()) event.sender.send('present-result', { ...res, by: payload && payload.by });
  } catch (err) {
    if (event.sender && !event.sender.isDestroyed()) event.sender.send('present-result', { ok: false, error: String(err.message || err), by: payload && payload.by });
  }
});

ipcMain.on('close-notification', () => {
  if (notifyWindow) notifyWindow.hide();
});

ipcMain.on('show-image', (event, payload) => {
  showImage(payload);
});

ipcMain.on('close-image', () => {
  if (imageWindow) imageWindow.hide();
});

// --- СКРИМЕР НА ВЕСЬ ЭКРАН (3.13.2): фото от админа + стоны ---
let scareWindow = null;
ipcMain.on('show-scare', (event, payload) => {
  if (scareWindow && !scareWindow.isDestroyed()) scareWindow.destroy();
  const display = screen.getPrimaryDisplay();
  scareWindow = new BrowserWindow({
    width: display.size.width,
    height: display.size.height,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  scareWindow.setAlwaysOnTop(true, 'screen-saver');
  scareWindow.setVisibleOnAllWorkspaces(true);
  const q = new URLSearchParams({ muted: muted ? '1' : '0' });
  scareWindow.loadFile('scare.html', { query: Object.fromEntries(q) });
  scareWindow.webContents.on('did-finish-load', () => {
    if (scareWindow && !scareWindow.isDestroyed()) {
      scareWindow.webContents.send('scare-data', payload || {});
    }
  });
  scareWindow.once('ready-to-show', () => {
    if (scareWindow && !scareWindow.isDestroyed()) {
      scareWindow.show();
      scareWindow.focus();
    }
  });
});

ipcMain.on('close-scare', () => {
  if (scareWindow && !scareWindow.isDestroyed()) scareWindow.destroy();
  scareWindow = null;
});

// --- ПИТОМЕЦ-ПАНЕЛЬ БЫСТРОГО ДОСТУПА (3.14.0): всегда поверх окон ---
let toolbarWindow = null;
let quickWindow = null;
let toolbarCollapsed = false;

function createToolbarWindow() {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  toolbarWindow = new BrowserWindow({
    width: 224, height: 224,
    x: display.workArea.x + display.workArea.width - 232,
    y: display.workArea.y + Math.round(display.workArea.height / 2 - 112),
    frame: false, resizable: false, maximizable: false, minimizable: false,
    alwaysOnTop: true, skipTaskbar: true, transparent: true, backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  toolbarWindow.setAlwaysOnTop(true, 'screen-saver');
  toolbarWindow.setVisibleOnAllWorkspaces(true);
  toolbarWindow.loadFile('toolbar.html');
  toolbarWindow.on('closed', () => { toolbarWindow = null; });
}

function createQuickWindow(mode) {
  if (!quickWindow || quickWindow.isDestroyed()) {
    quickWindow = new BrowserWindow({
      width: 460, height: 580, frame: false, resizable: false, maximizable: false,
      alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#16181d',
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    quickWindow.setAlwaysOnTop(true, 'screen-saver');
    quickWindow.on('closed', () => { quickWindow = null; });
  }
  const display = screen.getPrimaryDisplay();
  quickWindow.setBounds({
    x: display.workArea.x + Math.round(display.workArea.width / 2 - 230),
    y: display.workArea.y + Math.round(display.workArea.height / 2 - 290),
    width: 460, height: 580
  });
  const q = new URLSearchParams({ mode: mode || '' });
  quickWindow.loadFile('quick.html', { query: Object.fromEntries(q) });
  quickWindow.once('ready-to-show', () => { if (quickWindow) { quickWindow.show(); quickWindow.focus(); } });
}

ipcMain.on('show-toolbar', () => createToolbarWindow());
ipcMain.on('open-quick', (e, mode) => createQuickWindow(mode));
// 3.14.3: кнопка казино из меню питомца — открываем вкладку казино в главном окне
ipcMain.on('open-casino', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('open-casino');
  }
});
ipcMain.on('close-quick', () => { if (quickWindow) quickWindow.close(); });
ipcMain.on('toggle-toolbar', () => {
  // 3.14.2: сворачивание убрано — меню открывается кругом по клику на морду; оставлено как пустышка для совместимости
});
// Формы питомца отправляем в главное окно (там сокет и авторизация)
ipcMain.on('quick-submit', (e, data) => { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('quick-submit', data); });
ipcMain.on('quick-result', (e, r) => { if (quickWindow && !quickWindow.isDestroyed()) quickWindow.webContents.send('quick-result', r); });

ipcMain.on('restart_to_update', () => {
  forceQuit = true; // обновление должно иметь возможность перезапустить приложение
  autoUpdater.quitAndInstall();
});

// Принудительный перезапуск по команде админа (3.13.1)
let updateReady = false;
autoUpdater.on('update-downloaded', () => { updateReady = true; });
ipcMain.on('force-restart', () => {
  forceQuit = true; // before-quit не должен отменить выход у сотрудников
  if (updateReady) { autoUpdater.quitAndInstall(); return; } // если обновление скачано — ставим его
  app.relaunch();
  app.exit(0);
});

// --- СКРИНШОТ ЭКРАНА СОТРУДНИКА (3.6.0) ---
ipcMain.handle('take-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1600, height: 1000 } });
    if (!sources.length) return null;
    const img = sources[0].thumbnail;
    if (!img || img.isEmpty()) return null;
    return 'data:image/jpeg;base64,' + img.toJPEG(72).toString('base64');
  } catch (e) {
    return null;
  }
});

// --- ЖИЗНЕННЫЙ ЦИКЛ ---
app.whenReady().then(() => {
  createWindow();
  createNotifyWindow();
  createImageWindow();
  createTray();

  // 3.14.3: Ctrl+5 — показать/скрыть питомца Ебобию поверх всех окон
  globalShortcut.register('Control+5', () => {
    if (!toolbarWindow || toolbarWindow.isDestroyed()) {
      createToolbarWindow();
    } else if (toolbarWindow.isVisible()) {
      toolbarWindow.hide();
    } else {
      toolbarWindow.show();
      toolbarWindow.focus();
    }
  });

  // Разрешаем микрофон (голосовые в ЛС) и медиа
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'audioCapture', 'speaker-selection'].includes(permission));
  });

  // Автозапуск с Windows включён по умолчанию
  if (!app.getLoginItemSettings().wasOpenedAsHidden) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  // Журнал обновлений — чтобы понимать, почему не обновляется
  const fs = require('fs');
  const updaterLogPath = path.join(app.getPath('userData'), 'updater.log');
  const ulog = (msg) => {
    try { fs.appendFileSync(updaterLogPath, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
  };
  autoUpdater.logger = {
    info: m => ulog('INFO ' + m),
    warn: m => ulog('WARN ' + m),
    error: m => ulog('ERROR ' + m)
  };

  ulog(`=== запуск приложения, версия ${app.getVersion()} ===`);
  autoUpdater.on('update-available', (info) => ulog('update-available: ' + (info && info.version)));
  autoUpdater.on('update-not-available', () => ulog('update-not-available'));
  autoUpdater.on('error', (err) => ulog('ERROR event: ' + ((err && (err.stack || err.message)) || String(err))));

  // Проверяем обновления через 3 секунды после запуска и далее каждые 20 минут
  // (приложение висит в трее днями — разового запуска мало)
  const checkUpdates = () => {
    ulog('проверка обновлений...');
    autoUpdater.checkForUpdatesAndNotify().catch(e => ulog('checkForUpdates failed: ' + ((e && e.message) || e)));
  };
  setTimeout(checkUpdates, 3000);
  setInterval(checkUpdates, 20 * 60 * 1000);
});

// Когда обновление скачалось — предлагаем перезапустить
autoUpdater.on('update-downloaded', () => {
  // Диалог НЕ привязываем к главному окну: оно обычно свёрнуто в трей,
  // и сообщение с кнопкой «Да» просто не показывалось
  dialog.showMessageBox({
    type: 'info',
    title: 'Обновление готово',
    message: 'Скачана новая версия Support Hub. Перезапустить приложение сейчас для обновления?',
    buttons: ['Да', 'Позже'],
    noLink: true
  }).then((result) => {
    if (result.response === 0) {
      forceQuit = true; // обновление должно иметь возможность перезапустить приложение
      autoUpdater.quitAndInstall();
    }
  });

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update_downloaded');
  }
});

app.on('before-quit', (e) => {
  // Сотрудники не могут закрыть приложение — отменяем выход
  if (!allowQuit && !forceQuit) {
    e.preventDefault();
    return;
  }
  app.isQuiting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
