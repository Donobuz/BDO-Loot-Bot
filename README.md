# BDO Loot Ledger

A Discord-authenticated Electron application for tracking Black Desert Online loot.

## Setup Instructions

### 1. Supabase Database Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be set up
3. Go to the SQL Editor in your Supabase dashboard
4. Run this SQL to create the users table:

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  discord_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  avatar VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_users_discord_id ON users(discord_id);
```

5. Go to Settings > API to get your project URL and anon key

### 2. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 section
4. Add redirect URI: `http://localhost:3000/auth/discord/callback`
5. Copy your Client ID and Client Secret

### 3. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your credentials:
   - `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` from Discord
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase

### 4. Installation

```bash
npm install
```

### 5. Development

```bash
# Build and start the application
npm run build
npm start

# Or for development with watch mode
npm run start
```

## Features

- ✅ Discord OAuth Authentication
- ✅ Supabase Database Integration
- ✅ Modern Dark UI
- ✅ User Session Management
- 🚧 Loot Tracking (Coming Soon)

## Tech Stack

- **Frontend**: React + TypeScript
- **Backend**: Electron + Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Discord OAuth 2.0
- **HTTP Client**: Axios
- **Build Tool**: Webpack

## Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── services/       # Business logic
└── config/         # Configuration files
```
