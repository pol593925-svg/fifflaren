const { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow = null;
let notifyWindow = null;
let tray = null;
let pendingNotification = null; // уведомление, пришедшее до готовности окна

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
    time: payload.time || ''
  });
  notifyWindow.webContents.loadFile('notification.html', { query: Object.fromEntries(q) });
  notifyWindow.show();
  notifyWindow.focus();
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
    return Menu.buildFromTemplate([
      { label: '🔓 Открыть Support Hub', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      {
        label: `🚀 Автозапуск с Windows: ${autoStart ? 'вкл' : 'выкл'}`,
        click: () => {
          app.setLoginItemSettings({ openAtLogin: !autoStart });
          createTrayMenu();
        }
      },
      { type: 'separator' },
      { label: '❌ Выход', click: () => { tray = null; app.isQuiting = true; app.quit(); } }
    ]);
  };

  const createTrayMenu = () => tray.setContextMenu(buildMenu());
  createTrayMenu();

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

ipcMain.on('close-notification', () => {
  if (notifyWindow) notifyWindow.hide();
});

ipcMain.on('restart_to_update', () => {
  autoUpdater.quitAndInstall();
});

// --- ЖИЗНЕННЫЙ ЦИКЛ ---
app.whenReady().then(() => {
  createWindow();
  createNotifyWindow();
  createTray();

  // Автозапуск с Windows включён по умолчанию
  if (!app.getLoginItemSettings().wasOpenedAsHidden) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  // Проверяем обновления через 3 секунды после запуска
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
});

// Когда обновление скачалось — предлагаем перезапустить
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Обновление готово',
    message: 'Скачана новая версия Support Hub. Перезапустить приложение сейчас для обновления?',
    buttons: ['Да', 'Позже']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update_downloaded');
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
