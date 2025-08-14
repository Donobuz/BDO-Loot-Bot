import { contextBridge, ipcRenderer } from 'electron';

// Expose region selector specific APIs
contextBridge.exposeInMainWorld('regionSelectorAPI', {
  onDisplayInfo: (callback: (data: any) => void) => {
    ipcRenderer.on('display-info', (event, data) => callback(data));
  },
  
  selectRegion: (region: any) => {
    ipcRenderer.send('region-selected', region);
  },
  
  cancelSelection: () => {
    ipcRenderer.send('region-cancelled');
  },
  
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('display-info');
  }
});
