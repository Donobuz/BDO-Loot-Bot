// === DATABASE TYPES ===

export interface User {
  id: number;
  discord_id: string;
  username: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  name: string;
  region: string;
  description?: string;
  recommended_ap?: number;
  recommended_dp?: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: number;
  name: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  market_value?: number;
  icon_url?: string;
  created_at: string;
  updated_at: string;
}

export interface LocationLootTable {
  id: number;
  location_id: number;
  item_id: number;
  drop_rate?: number; // percentage as decimal (0.01 = 1%)
  min_quantity: number;
  max_quantity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface SessionLoot {
  id: number;
  session_id: number;
  item_id: number;
  quantity: number;
  estimated_value?: number;
  timestamp: string;
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
