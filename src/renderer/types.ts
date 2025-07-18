// Global type definitions for Electron API
declare global {
  interface Window {
    electronAPI: {
      startDiscordAuth: () => Promise<{ success: boolean; user?: any; error?: string }>;
      cancelDiscordAuth: () => Promise<{ success: boolean; error?: string }>;
      checkAuthStatus: () => Promise<{ isLoggedIn: boolean; user?: any }>;
      logout: () => Promise<void>;
      getCurrentUser: () => Promise<User | null>;
      locations: {
        getActive: () => Promise<{ success: boolean; data?: Location[]; error?: string }>;
        getArchived: () => Promise<{ success: boolean; data?: Location[]; error?: string }>;
        getAll: () => Promise<{ success: boolean; data?: Location[]; error?: string }>;
        getById: (id: number) => Promise<{ success: boolean; data?: Location; error?: string }>;
        create: (location: Omit<Location, 'id' | 'created' | 'updated'>) => Promise<{ success: boolean; data?: Location; error?: string; skipped?: boolean; unarchived?: boolean; message?: string }>;
        update: (id: number, updates: Partial<Omit<Location, 'id' | 'created' | 'updated'>>) => Promise<{ success: boolean; data?: Location; error?: string }>;
        archive: (id: number) => Promise<{ success: boolean; data?: Location; error?: string }>;
        unarchive: (id: number) => Promise<{ success: boolean; data?: Location; error?: string }>;
        search: (term: string) => Promise<{ success: boolean; data?: Location[]; error?: string }>;
      };
      items: {
        getActive: () => Promise<{ success: boolean; data?: Item[]; error?: string }>;
        getArchived: () => Promise<{ success: boolean; data?: Item[]; error?: string }>;
        getAll: () => Promise<{ success: boolean; data?: Item[]; error?: string }>;
        getById: (id: number) => Promise<{ success: boolean; data?: Item; error?: string }>;
        create: (item: Omit<Item, 'id' | 'created' | 'updated'>) => Promise<{ success: boolean; data?: Item; error?: string }>;
        createFromAPI: (bdoItemId: number, region: string) => Promise<{ success: boolean; data?: Item; error?: string; skipped?: boolean; unarchived?: boolean; message?: string }>;
        update: (id: number, updates: Partial<Omit<Item, 'id' | 'created' | 'updated'>>) => Promise<{ success: boolean; data?: Item; error?: string }>;
        archive: (id: number) => Promise<{ success: boolean; data?: Item; error?: string }>;
        unarchive: (id: number) => Promise<{ success: boolean; data?: Item; error?: string }>;
        syncPrices: (region: string) => Promise<{ success: boolean; updated?: number; error?: string }>;
        uploadImage: (itemId: number, imageBuffer: Uint8Array, originalName: string) => Promise<{ success: boolean; data?: Item; error?: string }>;
        removeImage: (itemId: number) => Promise<{ success: boolean; data?: Item; error?: string }>;
        uploadImageForBdoItem: (bdoItemId: number, imageBuffer: Uint8Array, originalName: string) => Promise<{ success: boolean; data?: { imageUrl: string; fileName: string; updatedItems: number }; error?: string }>;
        getByBdoItemId: (bdoItemId: number) => Promise<{ success: boolean; data?: Item[]; error?: string }>;
      };
    };
  }
}

// Database types
export interface User {
  permissions: any;
  id: number;
  discord_id: string;
  username: string;
  avatar?: string;
  created: string;
  updated: string;
}

export interface Location {
  id: number;
  name: string;
  ap: number;
  total_ap: number;
  dp: number;
  monster_type: string;
  created: string;
  updated: string;
  archived?: string | null;
}

export interface Item {
  id: number;
  name: string;
  bdo_item_id: number;
  base_price: number;
  last_sold_price: number;
  loot_table_ids: number[];
  region: string;
  image_url?: string;
  created: string;
  updated: string;
  archived?: string | null;
}

export interface GrindSession {
  id: number;
  user_id: number;
  location_id: number;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  total_value?: number;
  notes?: string;
  created: string;
  updated: string;
}

export interface SessionLoot {
  id: number;
  session_id: number;
  item_id: number;
  quantity: number;
  estimated_value?: number;
  timestamp: string;
}

export {}; // This makes the file a module
