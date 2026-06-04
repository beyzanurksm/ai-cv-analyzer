const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),

  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),

  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),

  onBackendError: (callback) => {
    ipcRenderer.on('backend-error', (event, message) => {
      callback(message);
    });
  }
});