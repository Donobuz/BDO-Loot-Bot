// Global type definitions for Electron API
declare global {
  interface Window {
    electronAPI: {
      startDiscordAuth: () => Promise<{
        success: boolean;
        user?: any;
        error?: string;
      }>;
      cancelDiscordAuth: () => Promise<{ success: boolean; error?: string }>;
      checkAuthStatus: () => Promise<{ isLoggedIn: boolean; user?: any }>;
      logout: () => Promise<void>;
      getCurrentUser: () => Promise<User | null>;
      locations: {
        getActive: () => Promise<{
          success: boolean;
          data?: Location[];
          error?: string;
        }>;
        getArchived: () => Promise<{
          success: boolean;
          data?: Location[];
          error?: string;
        }>;
        getAll: () => Promise<{
          success: boolean;
          data?: Location[];
          error?: string;
        }>;
        getById: (
          id: number
        ) => Promise<{ success: boolean; data?: Location; error?: string }>;
        create: (
          location: Omit<Location, "id" | "created" | "updated">
        ) => Promise<{
          success: boolean;
          data?: Location;
          error?: string;
          skipped?: boolean;
          unarchived?: boolean;
          message?: string;
        }>;
        update: (
          id: number,
          updates: Partial<Omit<Location, "id" | "created" | "updated">>
        ) => Promise<{ success: boolean; data?: Location; error?: string }>;
        archive: (
          id: number
        ) => Promise<{ success: boolean; data?: Location; error?: string }>;
        unarchive: (
          id: number
        ) => Promise<{ success: boolean; data?: Location; error?: string }>;
        search: (
          term: string
        ) => Promise<{ success: boolean; data?: Location[]; error?: string }>;
      };
      items: {
        getActive: () => Promise<{
          success: boolean;
          data?: Item[];
          error?: string;
        }>;
        getArchived: () => Promise<{
          success: boolean;
          data?: Item[];
          error?: string;
        }>;
        getAll: () => Promise<{
          success: boolean;
          data?: Item[];
          error?: string;
        }>;
        getById: (
          id: number
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        create: (
          item: Omit<Item, "id" | "created" | "updated">
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        createFromAPI: (
          bdoItemId: number,
          region: string,
          conversionData?: {
            convertible_to_bdo_item_id: number | null;
            conversion_ratio: string;
            type: ItemType;
            base_price: number | null;
          } | null
        ) => Promise<{
          success: boolean;
          data?: Item;
          error?: string;
          skipped?: boolean;
          unarchived?: boolean;
          message?: string;
        }>;
        createManual: (itemData: {
          name: string;
          bdo_item_id: number;
          region?: string | null;
          base_price?: number;
          convertible_to_bdo_item_id?: number;
          conversion_ratio?: number;
          type?: ItemType;
        }) => Promise<{
          success: boolean;
          data?: Item;
          error?: string;
          skipped?: boolean;
          unarchived?: boolean;
          message?: string;
        }>;
        update: (
          id: number,
          updates: Partial<Omit<Item, "id" | "created" | "updated">>
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        archive: (
          id: number
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        unarchive: (
          id: number
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        syncPrices: (
          region: string
        ) => Promise<{ success: boolean; updated?: number; error?: string }>;
        uploadImage: (
          itemId: number,
          imageBuffer: Uint8Array,
          originalName: string
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        removeImage: (
          itemId: number
        ) => Promise<{ success: boolean; data?: Item; error?: string }>;
        uploadImageForBdoItem: (
          bdoItemId: number,
          imageBuffer: Uint8Array,
          originalName: string
        ) => Promise<{
          success: boolean;
          data?: { imageUrl: string; fileName: string; updatedItems: number };
          error?: string;
        }>;
        getByBdoItemId: (
          bdoItemId: number
        ) => Promise<{ success: boolean; data?: Item[]; error?: string }>;
      };
      lootTables: {
        getAll: () => Promise<{
          success: boolean;
          data?: LootTable[];
          error?: string;
        }>;
        getActive: () => Promise<{
          success: boolean;
          data?: LootTable[];
          error?: string;
        }>;
        getById: (
          id: number
        ) => Promise<{ success: boolean; data?: LootTable; error?: string }>;
        getByLocationId: (
          locationId: number
        ) => Promise<{ success: boolean; data?: LootTable; error?: string }>;
        create: (
          lootTable: Omit<LootTable, "id" | "created" | "updated">
        ) => Promise<{ success: boolean; data?: LootTable; error?: string }>;
        update: (
          id: number,
          updates: Partial<Omit<LootTable, "id" | "created" | "updated">>
        ) => Promise<{ success: boolean; data?: LootTable; error?: string }>;
        addItem: (
          lootTableId: number,
          itemId: number
        ) => Promise<{ success: boolean; data?: LootTable; error?: string }>;
        removeItem: (
          lootTableId: number,
          itemId: number
        ) => Promise<{ success: boolean; data?: LootTable; error?: string }>;
      };
      user: {
        updateRegion: (
          discordId: string,
          region: string
        ) => Promise<{ success: boolean; data?: User; error?: string }>;
        update: (
          id: number,
          updates: any
        ) => Promise<{ success: boolean; data?: User; error?: string }>;
      };
      userPreferences: {
        get: (userId: string) => Promise<{
          success: boolean;
          data?: UserPreferences;
          error?: string;
        }>;
        update: (
          userId: string,
          preferences: Partial<UserPreferences>
        ) => Promise<{
          success: boolean;
          data?: UserPreferences;
          error?: string;
        }>;
        create: (
          userId: string,
          preferences: Partial<UserPreferences>
        ) => Promise<{
          success: boolean;
          data?: UserPreferences;
          error?: string;
        }>;
        getOrCreate: (
          userId: string,
          defaultPreferences?: Partial<UserPreferences>
        ) => Promise<{
          success: boolean;
          data?: UserPreferences;
          error?: string;
        }>;
      };
      selectOCRRegion: () => Promise<{
        success: boolean;
        region?: {
          x: number;
          y: number;
          width: number;
          height: number;
          display?: string;
        };
        error?: string;
      }>;
      openStreamingOverlay: (data: {
        location?: Location;
        items: any[];
        itemCounts: Record<number, number>;
        sessionStartTime: string;
      }) => Promise<{ success: boolean; error?: string }>;
      updateStreamingOverlay: (data: {
        location?: Location;
        items: any[];
        itemCounts: Record<number, number>;
        sessionStartTime?: string;
      }) => Promise<{ success: boolean; error?: string }>;
      closeStreamingOverlay: () => Promise<{ success: boolean; error?: string }>;
      isStreamingOverlayOpen: () => Promise<{ success: boolean; isOpen: boolean; error?: string }>;
      onOverlayData: (callback: (data: any) => void) => void;
      onStreamingOverlayOpened: (callback: () => void) => void;
      onStreamingOverlayClosed: (callback: () => void) => void;
      onStreamingOverlayFocused: (callback: () => void) => void;
      onStreamingOverlayBlurred: (callback: () => void) => void;
      onSessionCleanup: (callback: (data: {
        reason: string;
        timestamp: string;
      }) => void) => void;
    };
  }
}

// Database types
export interface User {
  permissions: any;
  id: string; // Changed to string to match UUID
  discord_id: string;
  username: string;
  avatar?: string;
  created: string;
  updated: string;
}

export interface UserPreferences {
  user_id: string;
  preferred_region: string; // Default region for loot tables
  display_regions: string[]; // Array of regions to display (["NA", "EU"] or ["ALL"])
  designated_ocr_region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    display?: string;
  } | null; // OCR region for loot detection
  created: string;
  updated: string;
}

export interface UserWithPreferences extends User {
  preferences?: UserPreferences;
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

// Item type enum
export type ItemType = "marketplace" | "trash_loot" | "conversion";

export interface Item {
  id: number;
  name: string;
  bdo_item_id: number;
  base_price: number;
  last_sold_price: number;
  loot_table_ids: number[];
  region: string | null; // Allow null for global items (trash loot, conversion)
  image_url?: string | null;
  created: string;
  updated: string;
  archived?: string | null;
  // Item type - determines behavior
  type: ItemType;
  // Conversion fields - only used when type is 'conversion'
  convertible_to_bdo_item_id?: number | null;
  conversion_ratio?: number;
}

export interface LootTable {
  id: number;
  location_id: number;
  item_ids: number[];
  created: string;
  updated: string;
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
