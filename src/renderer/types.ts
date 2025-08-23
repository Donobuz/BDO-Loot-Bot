// Global type definitions for Electron API

// Update interfaces - explicit types instead of Partial<Omit<T, 'fields'>>
export interface LocationUpdate {
  name?: string;
  ap?: number;
  total_ap?: number;
  dp?: number;
  monster_type?: string;
  archived?: string;
}

export interface ItemUpdate {
  name?: string;
  bdo_item_id?: number;
  base_price?: number;
  last_sold_price?: number;
  loot_table_ids?: number[];
  region?: string | null;
  image_url?: string | null;
  archived?: string | null;
  type?: ItemType;
  convertible_to_bdo_item_id?: number | null;
  conversion_ratio?: number;
}

export interface LootTableUpdate {
  location_id?: number;
  item_ids?: number[];
  archived?: string | null;
}

export interface UserUpdate {
  username?: string;
  avatar?: string;
  permissions?: string[];
}

export interface UserPreferencesUpdate {
  preferred_region?: string;
  display_regions?: string[];
  designated_ocr_region?: {
    x: number;
    y: number;
    width: number;
    height: number;
    display?: string;
  } | null;
  tax_calculations?: TaxCalculations | null;
}

declare global {
  interface Window {
    electronAPI: {
      startDiscordAuth: () => Promise<{
        success: boolean;
        user?: User;
        error?: string;
      }>;
      cancelDiscordAuth: () => Promise<{ success: boolean; error?: string }>;
      checkAuthStatus: () => Promise<{ isLoggedIn: boolean; user?: User }>;
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
          updates: LocationUpdate
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
          updates: ItemUpdate
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
          updates: LootTableUpdate
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
          updates: UserUpdate
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
          preferences: UserPreferencesUpdate
        ) => Promise<{
          success: boolean;
          data?: UserPreferences;
          error?: string;
        }>;
        create: (
          userId: string,
          preferences: UserPreferencesUpdate
        ) => Promise<{
          success: boolean;
          data?: UserPreferences;
          error?: string;
        }>;
        getOrCreate: (
          userId: string,
          defaultPreferences?: UserPreferencesUpdate
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
      session: {
        start: (config: { location: string; locationId: number; captureInterval?: number }) => Promise<{
          success: boolean;
          error?: string;
        }>;
        stop: () => Promise<{
          success: boolean;
          sessionSummary?: any;
          error?: string;
        }>;
        status: () => Promise<{
          success: boolean;
          status?: any;
          error?: string;
        }>;
        stats: () => Promise<{
          success: boolean;
          stats?: any;
          error?: string;
        }>;
        summary: () => Promise<{
          success: boolean;
          summary?: any;
          error?: string;
        }>;
        current: () => Promise<{
          success: boolean;
          session?: any;
          error?: string;
        }>;
        updateInterval: (interval: number) => Promise<{
          success: boolean;
          error?: string;
        }>;
        testCapture: () => Promise<{
          success: boolean;
          stats?: {
            captureTime: number;
            regionSize: string;
            bufferSize: number;
          };
          imageData?: string;
          error?: string;
        }>;
        availableLocations: () => Promise<{
          success: boolean;
          locations?: string[];
          error?: string;
        }>;
        isActive: () => Promise<{
          success: boolean;
          isActive?: boolean;
          error?: string;
        }>;
        toggleScreenshots: (config: { enabled: boolean }) => Promise<{
          success: boolean;
          error?: string;
        }>;
      };
      openStreamingOverlay: (data: {
        location?: Location;
        items: Item[];
        itemCounts: Record<number, number>;
        sessionStartTime: string;
      }) => Promise<{ success: boolean; error?: string }>;
      updateStreamingOverlay: (data: {
        location?: Location;
        items: Item[];
        itemCounts: Record<number, number>;
        sessionStartTime?: string;
      }) => Promise<{ success: boolean; error?: string }>;
      closeStreamingOverlay: () => Promise<{ success: boolean; error?: string }>;
      isStreamingOverlayOpen: () => Promise<{ success: boolean; isOpen: boolean; error?: string }>;
      onOverlayData: (callback: (data: StreamingOverlayData) => void) => void;
      onStreamingOverlayOpened: (callback: () => void) => void;
      onStreamingOverlayClosed: (callback: () => void) => void;
      onStreamingOverlayFocused: (callback: () => void) => void;
      onStreamingOverlayBlurred: (callback: () => void) => void;
      onSessionLootDetected: (callback: (event: any, data: { items: any[]; timestamp: number }) => void) => void;
      onSessionStatsUpdate: (callback: (event: any, data: any) => void) => void;
      onSessionSummaryUpdate: (callback: (event: any, data: { summary: any; timestamp: number }) => void) => void;
    };
  }
}

// OCR Region type for region selection
export interface OCRRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  display?: string;
}

// Database types
export interface StreamingOverlayData {
  location?: Location;
  items: Item[];
  itemCounts: Record<number, number>;
  sessionStartTime?: string;
}

export interface User {
  permissions: string[];
  id: string; // Changed to string to match UUID
  discord_id: string;
  username: string;
  avatar?: string;
  created: string;
  updated: string;
}

export interface TaxCalculations {
  value_pack: boolean;
  rich_merchant_ring: boolean;
  family_fame: number;
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
  tax_calculations?: TaxCalculations | null; // Tax calculation settings
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

export { }; // This makes the file a module
