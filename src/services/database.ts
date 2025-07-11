import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/config';

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
  notes?: string;
  created_at: string;
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

class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  async initializeDatabase(): Promise<void> {
    try {
      console.log('Connecting to Supabase...');
      
      // Test basic connection with a simple health check
      const { count, error } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Users table does not exist. Please create it in your Supabase dashboard.');
        } else if (error.code === 'PGRST301') {
          throw new Error('Invalid Supabase configuration. Please check your URL and API key.');
        } else {
          throw new Error(`Database connection failed: ${error.message}`);
        }
      }

      // Test read permissions
      const { error: readError } = await this.supabase
        .from('users')
        .select('id')
        .limit(1);

      if (readError && readError.code !== 'PGRST116') {
        throw new Error(`Database read permission denied: ${readError.message}`);
      }

      // Test write permissions by attempting a dry-run insert (this will fail due to constraints, but confirms permissions)
      const { error: writeError } = await this.supabase
        .from('users')
        .insert([{ discord_id: '__test__', username: '__test__' }])
        .select();

      if (writeError && !writeError.message.includes('duplicate key') && writeError.code !== '23505') {
        console.warn('Database write permissions may be limited:', writeError.message);
      }

      console.log('✅ Supabase connection established successfully');
      console.log(`📊 Current user count: ${count || 0}`);
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createOrUpdateUser(discordUser: any): Promise<User> {
    try {
      const userData = {
        discord_id: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar,
        updated_at: new Date().toISOString(),
      };

      // Try to update first
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordUser.id)
        .single();

      if (existingUser) {
        // Update existing user
        const { data, error } = await this.supabase
          .from('users')
          .update(userData)
          .eq('discord_id', discordUser.id)
          .select()
          .single();

        if (error) throw error;
        return data as User;
      } else {
        // Create new user
        const { data, error } = await this.supabase
          .from('users')
          .insert([userData])
          .select()
          .single();

        if (error) throw error;
        return data as User;
      }
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }

  async getUserByDiscordId(discordId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data as User;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  // === LOCATION METHODS ===
  async createLocation(locationData: Omit<Location, 'id' | 'created_at' | 'updated_at'>): Promise<Location> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .insert([locationData])
        .select()
        .single();

      if (error) throw error;
      return data as Location;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  }

  async getAllLocations(): Promise<Location[]> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Location[];
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  }

  async getLocationById(id: number): Promise<Location | null> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Location | null;
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  }

  // === ITEM METHODS ===
  async createItem(itemData: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<Item> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  }

  async getAllItems(): Promise<Item[]> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Item[];
    } catch (error) {
      console.error('Error fetching items:', error);
      throw error;
    }
  }

  async getItemsByLocation(locationId: number): Promise<Item[]> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .select(`
          items (*)
        `)
        .eq('location_id', locationId);

      if (error) throw error;
      return (data as any[]).map(row => row.items) as Item[];
    } catch (error) {
      console.error('Error fetching items for location:', error);
      throw error;
    }
  }

  // === GRIND SESSION METHODS ===
  async startGrindSession(userId: number, locationId: number, notes?: string): Promise<GrindSession> {
    try {
      const sessionData = {
        user_id: userId,
        location_id: locationId,
        start_time: new Date().toISOString(),
        notes: notes || null
      };

      const { data, error } = await this.supabase
        .from('grind_sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) throw error;
      return data as GrindSession;
    } catch (error) {
      console.error('Error starting grind session:', error);
      throw error;
    }
  }

  async endGrindSession(sessionId: number): Promise<GrindSession> {
    try {
      const endTime = new Date().toISOString();
      
      // First get the session to calculate duration
      const { data: session, error: fetchError } = await this.supabase
        .from('grind_sessions')
        .select('start_time')
        .eq('id', sessionId)
        .single();

      if (fetchError) throw fetchError;

      const startTime = new Date(session.start_time);
      const endTimeDate = new Date(endTime);
      const durationMinutes = Math.round((endTimeDate.getTime() - startTime.getTime()) / (1000 * 60));

      // Calculate total session value
      const { data: lootData, error: lootError } = await this.supabase
        .from('session_loot')
        .select('estimated_value')
        .eq('session_id', sessionId);

      if (lootError) throw lootError;

      const totalValue = lootData.reduce((sum, loot) => sum + (loot.estimated_value || 0), 0);

      // Update the session
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .update({
          end_time: endTime,
          duration_minutes: durationMinutes,
          total_value: totalValue
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as GrindSession;
    } catch (error) {
      console.error('Error ending grind session:', error);
      throw error;
    }
  }

  async getUserGrindSessions(userId: number, limit: number = 50): Promise<GrindSession[]> {
    try {
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .select(`
          *,
          locations (name, region)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as GrindSession[];
    } catch (error) {
      console.error('Error fetching user grind sessions:', error);
      throw error;
    }
  }

  async getActiveGrindSession(userId: number): Promise<GrindSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('grind_sessions')
        .select(`
          *,
          locations (name, region)
        `)
        .eq('user_id', userId)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as GrindSession | null;
    } catch (error) {
      console.error('Error fetching active grind session:', error);
      throw error;
    }
  }

  // === SESSION LOOT METHODS ===
  async addLootToSession(sessionId: number, itemId: number, quantity: number, estimatedValue?: number): Promise<SessionLoot> {
    try {
      const lootData = {
        session_id: sessionId,
        item_id: itemId,
        quantity: quantity,
        estimated_value: estimatedValue || null,
        timestamp: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('session_loot')
        .insert([lootData])
        .select()
        .single();

      if (error) throw error;
      return data as SessionLoot;
    } catch (error) {
      console.error('Error adding loot to session:', error);
      throw error;
    }
  }

  async getSessionLoot(sessionId: number): Promise<SessionLoot[]> {
    try {
      const { data, error } = await this.supabase
        .from('session_loot')
        .select(`
          *,
          items (name, category, rarity, icon_url)
        `)
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as SessionLoot[];
    } catch (error) {
      console.error('Error fetching session loot:', error);
      throw error;
    }
  }

  async deleteLootFromSession(lootId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('session_loot')
        .delete()
        .eq('id', lootId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting loot from session:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
    console.log('Supabase connection closed');
  }
}

export const databaseService = new DatabaseService();
