import { contextBridge, ipcRenderer } from 'electron';
import { StreamingOverlayData } from '../features/streamingOverlay/streamingOverlayAPI';
import { Location, LocationUpdate } from '../../services/db/types/location';
import { Item, ItemUpdate } from '../../services/db/types/item';
import { LootTable, LootTableUpdate } from '../../services/db/types/lootTable';
import { UserUpdate, UserPreferencesUpdate } from '../../services/db/types/user';

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
    create: (location: Omit<Location, 'id' | 'created' | 'updated'>) => ipcRenderer.invoke('locations:create', location),
    update: (id: number, updates: LocationUpdate) => ipcRenderer.invoke('locations:update', id, updates),
    archive: (id: number) => ipcRenderer.invoke('locations:archive', id),
    unarchive: (id: number) => ipcRenderer.invoke('locations:unarchive', id),
    search: (term: string) => ipcRenderer.invoke('locations:search', term),
  },
  
  items: {
    getActive: () => ipcRenderer.invoke('items:get-active'),
    getArchived: () => ipcRenderer.invoke('items:get-archived'),
    getAll: () => ipcRenderer.invoke('items:get-all'),
    getById: (id: number) => ipcRenderer.invoke('items:get-by-id', id),
    create: (item: Omit<Item, 'id' | 'created' | 'updated'>) => ipcRenderer.invoke('items:create', item),
    createFromAPI: (bdoItemId: number, region: string) => ipcRenderer.invoke('items:create-from-api', bdoItemId, region),
    createManual: (itemData: Omit<Item, 'id' | 'created' | 'updated'>) => ipcRenderer.invoke('items:create-manual', itemData),
    update: (id: number, updates: ItemUpdate) => ipcRenderer.invoke('items:update', id, updates),
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
  },

  lootTables: {
    getAll: () => ipcRenderer.invoke('loot-tables:get-all'),
    getActive: () => ipcRenderer.invoke('loot-tables:get-active'),
    getById: (id: number) => ipcRenderer.invoke('loot-tables:get-by-id', id),
    getByLocationId: (locationId: number) => ipcRenderer.invoke('loot-tables:get-by-location-id', locationId),
    create: (lootTable: Omit<LootTable, 'id' | 'created' | 'updated'>) => ipcRenderer.invoke('loot-tables:create', lootTable),
    update: (id: number, updates: LootTableUpdate) => ipcRenderer.invoke('loot-tables:update', id, updates),
    addItem: (lootTableId: number, itemId: number) => ipcRenderer.invoke('loot-tables:add-item', lootTableId, itemId),
    removeItem: (lootTableId: number, itemId: number) => ipcRenderer.invoke('loot-tables:remove-item', lootTableId, itemId),
  },

  user: {
    updateRegion: (discordId: string, region: string) => ipcRenderer.invoke('user:update-region', discordId, region),
    update: (id: number, updates: UserUpdate) => ipcRenderer.invoke('user:update', id, updates),
  },

  userPreferences: {
    get: (userId: string) => ipcRenderer.invoke('user-preferences:get', userId),
    update: (userId: string, preferences: UserPreferencesUpdate) => ipcRenderer.invoke('user-preferences:update', userId, preferences),
    create: (userId: string, preferences: UserPreferencesUpdate) => ipcRenderer.invoke('user-preferences:create', userId, preferences),
    getOrCreate: (userId: string, defaultPreferences?: UserPreferencesUpdate) => ipcRenderer.invoke('user-preferences:get-or-create', userId, defaultPreferences),
  },

  selectOCRRegion: () => ipcRenderer.invoke('select-ocr-region'),

  openStreamingOverlay: (data: StreamingOverlayData) => ipcRenderer.invoke('open-streaming-overlay', data),
  updateStreamingOverlay: (data: StreamingOverlayData) => ipcRenderer.invoke('update-streaming-overlay', data),
  closeStreamingOverlay: () => ipcRenderer.invoke('close-streaming-overlay'),
  isStreamingOverlayOpen: () => ipcRenderer.invoke('is-streaming-overlay-open'),

  onOverlayData: (callback: (data: StreamingOverlayData) => void) => {
    ipcRenderer.on('overlay-data', (event, data) => callback(data));
  },

  onStreamingOverlayOpened: (callback: () => void) => {
    ipcRenderer.on('streaming-overlay-opened', () => callback());
  },

  onStreamingOverlayClosed: (callback: () => void) => {
    ipcRenderer.on('streaming-overlay-closed', () => callback());
  },

  onStreamingOverlayFocused: (callback: () => void) => {
    ipcRenderer.on('streaming-overlay-focused', () => callback());
  },

  onStreamingOverlayBlurred: (callback: () => void) => {
    ipcRenderer.on('streaming-overlay-blurred', () => callback());
  }
});
