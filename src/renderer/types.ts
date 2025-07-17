// Global type definitions for Electron API
declare global {
  interface Window {
    electronAPI: {
      startDiscordAuth: () => Promise<{ success: boolean; user?: any; error?: string }>;
      checkAuthStatus: () => Promise<{ isAuthenticated: boolean; user?: any }>;
      logout: () => Promise<void>;
      getCurrentUser: () => Promise<User | null>;
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
  region: string;
  description?: string;
  recommended_ap?: number;
  recommended_dp?: number;
  created: string;
  updated: string;
}

export interface Item {
  id: number;
  name: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  market_value?: number;
  icon_url?: string;
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
