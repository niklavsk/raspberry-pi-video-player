const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { registerVideoProtocol, protocolName } = require('./customProtocol');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      webSecurity: false
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerVideoProtocol();
  createWindow();

  ipcMain.handle('get-videos', async (event) => {
    // const videosPath = path.join(app.getAppPath(), 'videos');
    const videosPath = '/Users/niklavs/Documents/videos/';
    
	try {
      const files = await fs.promises.readdir(videosPath);
      const videoFiles = files
        .filter(file => /\.(mp4|webm|ogv|mov)$/i.test(file))
        .map(file => ({
          src: `${protocolName}://${path.join(videosPath, file)}`,
          type: `video/${path.extname(file).substring(1) === 'mov' ? 'quicktime' : path.extname(file).substring(1)}`,
        }));
      return videoFiles;
    } catch (error) {
      console.error('Failed to get videos:', error);
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
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
