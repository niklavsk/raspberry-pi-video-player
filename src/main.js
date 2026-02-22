const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('node:path');
const { registerStreamProtocol } = require('./utils/streamProtocol');

const fs = require('node:fs').promises;
const { createReadStream } = require('node:fs');
const { VIDEO_FOLDER, VIDEO_EXTENSIONS, APP_MODE } = require('./config');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

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

// Verify video file by checking magic bytes
async function verifyVideoFile(filePath, ext) {
	return new Promise((resolve) => {
		const stream = createReadStream(filePath, { start: 0, end: 11 });
		const chunks = [];
		
		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('end', () => {
		const buffer = Buffer.concat(chunks);
		
		// Check magic bytes for common video formats
		const hex = buffer.toString('hex');
		
		// MP4/M4V: starts with ftyp
		if (hex.includes('66747970')) {
			resolve(true);
			return;
		}
		
		// WebM: starts with 1a45dfa3
		if (hex.startsWith('1a45dfa3')) {
			resolve(true);
			return;
		}
		
		// AVI: starts with RIFF and contains AVI
		if (hex.startsWith('52494646') && hex.includes('415649')) {
			resolve(true);
			return;
		}
		
		// MOV: similar to MP4, contains ftyp
		if (hex.includes('66747970')) {
			resolve(true);
			return;
		}
		
		// MKV: starts with 1a45dfa3
		if (hex.startsWith('1a45dfa3')) {
			resolve(true);
			return;
		}
		
		// If we can't verify by magic bytes, trust the extension
		resolve(true);
		});
		
		stream.on('error', () => resolve(false));
	});
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	registerStreamProtocol();
	createWindow();

	// IPC handler to get list of video files
	ipcMain.handle('get-video-files', async () => {
		try {
			const files = await fs.readdir(VIDEO_FOLDER);
			const videoFiles = [];
			
			for (const file of files) {
				const filePath = path.join(VIDEO_FOLDER, file);
				const ext = path.extname(file).toLowerCase();
				
				// Check if file has video extension
				if (VIDEO_EXTENSIONS.includes(ext)) {
					try {
					const stats = await fs.stat(filePath);
					
					// Verify it's a file and has content
					if (stats.isFile() && stats.size > 0) {
						// Read first few bytes to verify it's likely a video file
						const isValid = await verifyVideoFile(filePath, ext);
						
						if (isValid) {
							videoFiles.push({
								name: file,
								size: stats.size,
								path: file, // relative path for the protocol
								url: `app://video/${encodeURIComponent(file)}`
							});
						}
					}
					} catch (err) {
					console.error(`Error checking file ${file}:`, err);
					}
				}
			}
			
			return videoFiles;
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
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
