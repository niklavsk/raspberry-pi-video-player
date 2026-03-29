const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, protocol, ipcMain, dialog } = require('electron');
const { registerStreamProtocol } = require('./utils/streamProtocol');

const { VIDEO_FOLDER, VIDEO_EXTENSIONS, APP_MODE } = require('./config');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
	app.quit();
}

app.commandLine.appendSwitch('disable-features', 'GlobalMediaControlsCastStartStop');

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
			webSecurity: false,
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
	let videoBaseFolder = VIDEO_FOLDER;
	registerStreamProtocol(() => videoBaseFolder);
	createWindow();

	// IPC handler to get list of video files from all subdirectories
	ipcMain.handle('get-video-files', async () => {
		let targetFolder = VIDEO_FOLDER;

		try {
			// Check if the directory exists and is empty
			const stats = fs.statSync(VIDEO_FOLDER);
			if (stats.isDirectory()) {
				const filesInVideoFolder = fs.readdirSync(VIDEO_FOLDER);
				if (filesInVideoFolder.length === 0) {
					const { canceled, filePaths } = await dialog.showOpenDialog({
						properties: ['openDirectory']
					});

					if (canceled || filePaths.length === 0) {
						return [];
					}
					targetFolder = filePaths[0];
				}
			}
		} catch (err) {
			// This can happen if VIDEO_FOLDER doesn't exist.
			const { canceled, filePaths } = await dialog.showOpenDialog({
				properties: ['openDirectory']
			});

			if (canceled || filePaths.length === 0) {
				return [];
			}
			targetFolder = filePaths[0];
		}

		videoBaseFolder = targetFolder; // Update the base folder

		try {
			const subdirectories = fs.readdirSync(targetFolder, { withFileTypes: true });
			const allFolders = [];

			for (const dirent of subdirectories) {
				if (dirent.isDirectory()) {
					const folderPath = path.join(targetFolder, dirent.name);
					const files = fs.readdirSync(folderPath);
					const videoFiles = [];

					for (const file of files) {
						const filePath = path.join(folderPath, file);
						const ext = path.extname(file).toLowerCase();

						if (VIDEO_EXTENSIONS.includes(ext)) {
							try {
								const stats = fs.statSync(filePath);

								if (stats.isFile() && stats.size > 0) {
									const relativePath = path.relative(targetFolder, filePath);
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

	const postGpioIn = (id, value) => {
		let window = BrowserWindow.getAllWindows()[0];
		window.webContents.postMessage('gpio-in', { id, value });
	}

	let os = require('os');
	if (os.type() === 'Linux') {
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
