import { BaseDatabase } from './base';
import { Location, LocationUpdate } from './types/location';
import { lootTableService } from './lootTables';

export class LocationService extends BaseDatabase {
  
  // === LOCATION MANAGEMENT ===
  
  async getAllLocations(): Promise<Location[]> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  async getLocationById(id: number): Promise<Location | null> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return data;
  }

  async getLocationByNameIncludingArchived(name: string): Promise<Location | null> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .eq('name', name)
      .order('created', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return data;
  }

  async createLocation(location: Omit<Location, 'id' | 'created' | 'updated'>): Promise<Location> {
    const { data, error } = await this.supabase
      .from('locations')
      .insert([{
        ...location,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;

    // Automatically create a loot table for this location
    try {
      const lootTableResult = await lootTableService.create({
        location_id: data.id,
        item_ids: [] // Start with empty item list
      });
      
      if (!lootTableResult.success) {
        console.warn(`Failed to create loot table for location ${data.id}:`, lootTableResult.error);
      } else {
        console.log(`✅ Created loot table for location "${data.name}" (ID: ${data.id})`);
      }
    } catch (lootTableError) {
      console.warn(`Error creating loot table for location ${data.id}:`, lootTableError);
    }

    return data;
  }

  async updateLocation(id: number, updates: LocationUpdate): Promise<Location> {
    const { data, error } = await this.supabase
      .from('locations')
      .update({ ...updates, updated: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteLocation(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('locations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  async archiveLocation(id: number): Promise<Location> {
    const { data, error } = await this.supabase
      .from('locations')
      .update({ 
        archived: new Date().toISOString(),
        updated: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async unarchiveLocation(id: number): Promise<Location> {
    const { data, error } = await this.supabase
      .from('locations')
      .update({ 
        archived: null,
        updated: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;

    // Check if a loot table exists for this location, create one if it doesn't
    try {
      const lootTableResult = await lootTableService.getByLocationId(data.id);
      
      if (!lootTableResult.success) {
        console.warn(`Error checking loot table for location ${data.id}:`, lootTableResult.error);
      } else if (!lootTableResult.data) {
        // No loot table exists, create one
        const createResult = await lootTableService.create({
          location_id: data.id,
          item_ids: [] // Start with empty item list
        });
        
        if (!createResult.success) {
          console.warn(`Failed to create loot table for unarchived location ${data.id}:`, createResult.error);
        } else {
          console.log(`✅ Created loot table for unarchived location "${data.name}" (ID: ${data.id})`);
        }
      }
    } catch (lootTableError) {
      console.warn(`Error handling loot table for unarchived location ${data.id}:`, lootTableError);
    }

    return data;
  }

  async getActiveLocations(): Promise<Location[]> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .is('archived', null)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  async getArchivedLocations(): Promise<Location[]> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .not('archived', 'is', null)
      .order('archived', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async searchLocationsByName(searchTerm: string): Promise<Location[]> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }
}

// Export singleton instance
export const locationService = new LocationService();