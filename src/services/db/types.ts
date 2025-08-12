// === DATABASE TYPES ===

export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar?: string;
  created: string;
  updated: string;
  permissions?: string[]; // Include user permissions
}

export interface UserPreferences {
  user_id: number;
  preferred_region: string;
  display_regions: string[];
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

export interface UserAcl {
  id: number;
  discord_id: string;
  permissions: string[]; // Array of permission strings like ["user"], ["admin", "editor"]
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
  archived?: string;
}

// Item type enum
export type ItemType = 'marketplace' | 'trash_loot' | 'conversion';

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
  archived?: string | null;
}

// === DISCORD TYPES ===

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
}

// === AUTH TYPES ===

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface AuthData {
  accessToken: string;
  tokenType: string;
  user: User;
  loginTime: string;
}
