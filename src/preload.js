// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	getVideoFiles: () => ipcRenderer.invoke('get-video-files')
});

contextBridge.exposeInMainWorld('electron', {
  onGpioIn: (handler) => {
    ipcRenderer.addListener('gpio-in', (...args) => {
      handler(...args);
    });
  },
});
