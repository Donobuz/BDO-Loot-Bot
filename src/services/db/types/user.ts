// === USER TYPES ===

export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar?: string;
  created: string;
  updated: string;
  permissions?: string[]; // Include user permissions
}

export interface TaxCalculations {
  value_pack: boolean;
  rich_merchant_ring: boolean;
  family_fame: number;
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
  tax_calculations?: TaxCalculations | null; // Tax calculation settings
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

// === USER UPDATE INTERFACES ===

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
