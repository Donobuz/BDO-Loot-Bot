import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startDiscordAuth: () => ipcRenderer.invoke('start-discord-auth'),
  checkAuthStatus: () => ipcRenderer.invoke('check-auth-status'),
  logout: () => ipcRenderer.invoke('logout'),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
});
