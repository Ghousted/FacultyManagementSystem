const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any electron-specific APIs here if needed
  platform: process.platform,
  versions: process.versions,

  // Example: Send message to main process
  sendMessage: (message) => ipcRenderer.send('message', message),

  // Example: Receive message from main process
  onMessage: (callback) => ipcRenderer.on('message', callback),

  // Remove listener
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel)
}); 