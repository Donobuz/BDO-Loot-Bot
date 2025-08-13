import { contextBridge, ipcRenderer } from 'electron';

// Minimal, secure preload for streaming overlay
// Only expose the specific functionality needed for the overlay
contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for overlay data updates
  onOverlayData: (callback: (data: any) => void) => {
    ipcRenderer.on('overlay-data', (event, data) => callback(data));
  }
});
