const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const { registerStreamProtocol } = require('./utils/streamProtocol');

const { VIDEO_FOLDER, VIDEO_EXTENSIONS, APP_MODE } = require('./config');

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,        // enable video/audio streaming
    bypassCSP: true
  }
}]);

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  if (APP_MODE === 'debug') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerStreamProtocol();
  createWindow();

  // IPC handler to get list of video files from all subdirectories
  ipcMain.handle('get-video-files', () => {
    return [];
    try {
      const subdirectories = fs.readdirSync(VIDEO_FOLDER, { withFileTypes: true });
      const allFolders = [];

      for (const dirent of subdirectories) {
        if (dirent.isDirectory()) {
          const folderPath = path.join(VIDEO_FOLDER, dirent.name);
          const files = fs.readdirSync(folderPath);
          const videoFiles = [];

          for (const file of files) {
            const filePath = path.join(folderPath, file);
            const ext = path.extname(file).toLowerCase();

            if (VIDEO_EXTENSIONS.includes(ext)) {
              try {
                const stats = fs.statSync(filePath);

                if (stats.isFile() && stats.size > 0) {
                  const relativePath = path.join(dirent.name, file);
                  videoFiles.push({
                    name: file,
                    size: stats.size,
                    path: relativePath,
                    url: `app://video/${encodeURIComponent(relativePath)}`,
                  });
                }
              } catch (err) {
                console.error(`Error checking file ${file}:`, err);
              }
            }
          }

          if (videoFiles.length > 0) {
            allFolders.push({ name: dirent.name, videos: videoFiles });
          }
        }
      }

      return allFolders;

    } catch (err) {
      console.error('Error reading video folder:', err);
      return [];
    }
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  //

  const postGpioIn = (id, value) => {
    let window = BrowserWindow.getAllWindows()[0];
    window.webContents.postMessage('gpio-in', { id, value });
  }

  let os = require('os');
  if(os.type() === 'Linux') {
    let { Gpio } = require('onoff');
    const pin = new Gpio(516, 'in', 'both');
    pin.watch((err, value) => {
      console.log(`pin: ${value}`);
      postGpioIn(516, value);
    });
  } else {
    setInterval(() => {
      postGpioIn('heelo', 1);
    }, 5000);
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
