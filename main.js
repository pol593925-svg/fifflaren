const { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage, screen, shell } = require('electron');
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
    color: payload.color === 'blue' ? 'blue' : 'red'
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

ipcMain.on('close-notification', () => {
  if (notifyWindow) notifyWindow.hide();
});

ipcMain.on('show-image', (event, payload) => {
  showImage(payload);
});

ipcMain.on('close-image', () => {
  if (imageWindow) imageWindow.hide();
});

ipcMain.on('restart_to_update', () => {
  forceQuit = true; // обновление должно иметь возможность перезапустить приложение
  autoUpdater.quitAndInstall();
});

// --- ЖИЗНЕННЫЙ ЦИКЛ ---
app.whenReady().then(() => {
  createWindow();
  createNotifyWindow();
  createImageWindow();
  createTray();

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
