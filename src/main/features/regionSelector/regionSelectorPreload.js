const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('regionSelectorAPI', {
  onDisplayInfo: (callback) => {
    ipcRenderer.on('display-info', (event, data) => callback(data));
  },
  
  selectRegion: (region) => {
    ipcRenderer.send('region-selected', region);
  },
  
  cancelSelection: () => {
    ipcRenderer.send('region-cancelled');
  },
  
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('display-info');
  }
});