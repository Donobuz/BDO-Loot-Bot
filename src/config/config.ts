// Discord OAuth Configuration
export const DISCORD_CONFIG = {
  CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'your_discord_client_id',
  CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || 'your_discord_client_secret',
  REDIRECT_URI: 'http://localhost:3000/auth/discord/callback',
  SCOPE: 'identify',
  OAUTH_URL: 'https://discord.com/api/oauth2/authorize',
  TOKEN_URL: 'https://discord.com/api/oauth2/token',
  USER_URL: 'https://discord.com/api/users/@me',
};

// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || 'your_supabase_url',
  anonKey: process.env.SUPABASE_ANON_KEY || 'your_supabase_anon_key',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key',
};
