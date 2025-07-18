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
