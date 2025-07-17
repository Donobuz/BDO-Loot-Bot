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
  region: string;
  description?: string;
  recommended_ap?: number;
  recommended_dp?: number;
  monster_type?: string;
  created: string;
  updated: string;
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
