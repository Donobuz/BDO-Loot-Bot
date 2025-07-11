# BDO Loot Ledger Database Setup Guide

## Database Schema Overview

Here's how the database is structured to track your BDO grinding sessions:

### Core Tables:

1. **`users`** - Discord authenticated users (already exists)
2. **`locations`** - All grind spots in BDO (Polly Forest, Hystria, etc.)
3. **`items`** - All possible loot items (Silver, Black Stones, Accessories, etc.)
4. **`location_loot_tables`** - What items can drop at each location (with drop rates)
5. **`grind_sessions`** - Individual grinding sessions by users
6. **`session_loot`** - Each piece of loot obtained during a session

### Relationships:

```
users (1) ——— (many) grind_sessions (many) ——— (1) locations
                         |
                         | (1)
                         |
                    (many) session_loot (many) ——— (1) items
                         
locations (1) ——— (many) location_loot_tables (many) ——— (1) items
```

## Setup Instructions

### 1. Run the Schema
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the sidebar
3. Copy the entire contents of `database_schema.sql`
4. Paste it into the SQL editor and click "Run"

### 2. Verify Tables Created
Check that these tables were created:
- ✅ users
- ✅ locations  
- ✅ items
- ✅ location_loot_tables
- ✅ grind_sessions
- ✅ session_loot

### 3. Sample Data Included
The schema includes sample data for:
- **6 popular BDO grind locations** (Polly Forest, Hystria, Stars End, etc.)
- **12 common loot items** (Silver, Black Stones, Memory Fragments, rare accessories)
- **Loot table relationships** showing what can drop where

## How It Works

### Starting a Grind Session:
1. User selects a location (e.g., "Polly Forest")
2. App calls `startGrindSession(userId, locationId)`
3. Creates new row in `grind_sessions` with start time

### Adding Loot:
1. User gets a drop (e.g., "5x Black Stone (Weapon)")
2. App calls `addLootToSession(sessionId, itemId, quantity, value)`
3. Creates new row in `session_loot`

### Ending Session:
1. User clicks "End Session"
2. App calls `endGrindSession(sessionId)`
3. Calculates duration and total value
4. Updates the session record

### Viewing History:
- `getUserGrindSessions(userId)` - Get all sessions for a user
- `getSessionLoot(sessionId)` - Get all loot for a specific session
- Use the `session_summaries` view for easy reporting

## Key Features

✅ **User Isolation** - Each user only sees their own data
✅ **Flexible Loot Tables** - Easy to add new locations and items  
✅ **Session Tracking** - Full timeline of grinding activities
✅ **Value Calculation** - Automatic total value calculation per session
✅ **Performance Optimized** - Proper indexes on frequently queried columns
✅ **Data Integrity** - Foreign key constraints prevent orphaned data

## Adding New Content

### New Location:
```sql
INSERT INTO locations (name, region, description, recommended_ap, recommended_dp) 
VALUES ('New Grind Spot', 'Region Name', 'Description', 250, 320);
```

### New Item:
```sql
INSERT INTO items (name, category, rarity, market_value) 
VALUES ('New Item', 'Category', 'rare', 5000000);
```

### New Loot Table Entry:
```sql
INSERT INTO location_loot_tables (location_id, item_id, drop_rate) 
VALUES (
    (SELECT id FROM locations WHERE name = 'Location Name'),
    (SELECT id FROM items WHERE name = 'Item Name'),
    0.05  -- 5% drop rate
);
```

## Next Steps

1. **Run the schema** in your Supabase dashboard
2. **Test the database methods** in your app
3. **Add more locations/items** as needed for your specific use case
4. **Build the UI** to let users start sessions and track loot

The database is now ready to handle all your BDO loot tracking needs! 🎮⚔️
