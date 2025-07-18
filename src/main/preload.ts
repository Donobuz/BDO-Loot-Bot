import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startDiscordAuth: () => ipcRenderer.invoke('start-discord-auth'),
  cancelDiscordAuth: () => ipcRenderer.invoke('cancel-discord-auth'),
  checkAuthStatus: () => ipcRenderer.invoke('check-auth-status'),
  logout: () => ipcRenderer.invoke('logout'),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  
  locations: {
    getActive: () => ipcRenderer.invoke('locations:get-active'),
    getArchived: () => ipcRenderer.invoke('locations:get-archived'),
    getAll: () => ipcRenderer.invoke('locations:get-all'),
    getById: (id: number) => ipcRenderer.invoke('locations:get-by-id', id),
    create: (location: any) => ipcRenderer.invoke('locations:create', location),
    update: (id: number, updates: any) => ipcRenderer.invoke('locations:update', id, updates),
    archive: (id: number) => ipcRenderer.invoke('locations:archive', id),
    unarchive: (id: number) => ipcRenderer.invoke('locations:unarchive', id),
    search: (term: string) => ipcRenderer.invoke('locations:search', term),
  },
  
  items: {
    getActive: () => ipcRenderer.invoke('items:get-active'),
    getArchived: () => ipcRenderer.invoke('items:get-archived'),
    getAll: () => ipcRenderer.invoke('items:get-all'),
    getById: (id: number) => ipcRenderer.invoke('items:get-by-id', id),
    create: (item: any) => ipcRenderer.invoke('items:create', item),
    createFromAPI: (bdoItemId: number, region: string) => ipcRenderer.invoke('items:create-from-api', bdoItemId, region),
    update: (id: number, updates: any) => ipcRenderer.invoke('items:update', id, updates),
    archive: (id: number) => ipcRenderer.invoke('items:archive', id),
    unarchive: (id: number) => ipcRenderer.invoke('items:unarchive', id),
    syncPrices: (region: string) => ipcRenderer.invoke('items:sync-prices', region),
    uploadImage: (itemId: number, imageBuffer: Uint8Array, originalName: string) => {
      // Convert Uint8Array to Buffer for IPC transmission
      const buffer = Buffer.from(imageBuffer);
      return ipcRenderer.invoke('items:upload-image', itemId, buffer, originalName);
    },
    removeImage: (itemId: number) => ipcRenderer.invoke('items:remove-image', itemId),
    uploadImageForBdoItem: (bdoItemId: number, imageBuffer: Uint8Array, originalName: string) => {
      // Convert Uint8Array to Buffer for IPC transmission
      const buffer = Buffer.from(imageBuffer);
      return ipcRenderer.invoke('items:upload-image-for-bdo-item', bdoItemId, buffer, originalName);
    },
    getByBdoItemId: (bdoItemId: number) => ipcRenderer.invoke('items:get-by-bdo-item-id', bdoItemId),
  }
});
