import { BaseDatabase } from './base';
import { Location } from './types';

export class LocationsService extends BaseDatabase {
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

  async getLocationsByRegion(region: string): Promise<Location[]> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .select('*')
        .eq('region', region)
        .order('name');

      if (error) throw error;
      return data as Location[];
    } catch (error) {
      console.error('Error fetching locations by region:', error);
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

  async updateLocation(id: number, updates: Partial<Omit<Location, 'id' | 'created_at' | 'updated_at'>>): Promise<Location> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Location;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  async deleteLocation(id: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }

  async searchLocations(searchTerm: string): Promise<Location[]> {
    try {
      const { data, error } = await this.supabase
        .from('locations')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,region.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('name');

      if (error) throw error;
      return data as Location[];
    } catch (error) {
      console.error('Error searching locations:', error);
      throw error;
    }
  }
}

export const locationsService = new LocationsService();
