import { contextBridge, ipcRenderer } from 'electron';

interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}

interface RegionSelectorData {
  displays: DisplayInfo[];
}

interface SelectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  display?: string;
}

// Expose region selector specific APIs
contextBridge.exposeInMainWorld('regionSelectorAPI', {
  onDisplayInfo: (callback: (data: RegionSelectorData) => void) => {
    ipcRenderer.on('display-info', (event, data) => callback(data));
  },
  
  selectRegion: (region: SelectedRegion) => {
    ipcRenderer.send('region-selected', region);
  },
  
  cancelSelection: () => {
    ipcRenderer.send('region-cancelled');
  },
  
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('display-info');
  }
});
