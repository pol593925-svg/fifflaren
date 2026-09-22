const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Разворачиваем окно на весь экран при запуске
  mainWindow.maximize();
}

app.whenReady().then(() => {
  createWindow();

  // Проверяем обновления через 3 секунды после запуска программы
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
});

// Когда обновление найдено и полностью скачалось в фоне:
autoUpdater.on('update-downloaded', () => {
  // 1. Показываем системное окошко с выбором
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

  // 2. А также отправляем сигнал в ваш index.html, чтобы появилась зеленая кнопка сверху
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update_downloaded');
  }
});

// Слушаем нажатие на кнопку «Скачать и обновить» из интерфейса
ipcMain.on('restart_to_update', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});