import { BaseDatabase } from './base';
import { Item } from './types';

export class ItemsService extends BaseDatabase {
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

  async getItemsByCategory(category: string): Promise<Item[]> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .select('*')
        .eq('category', category)
        .order('name');

      if (error) throw error;
      return data as Item[];
    } catch (error) {
      console.error('Error fetching items by category:', error);
      throw error;
    }
  }

  async getItemsByRarity(rarity: Item['rarity']): Promise<Item[]> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .select('*')
        .eq('rarity', rarity)
        .order('name');

      if (error) throw error;
      return data as Item[];
    } catch (error) {
      console.error('Error fetching items by rarity:', error);
      throw error;
    }
  }

  async getItemById(id: number): Promise<Item | null> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as Item | null;
    } catch (error) {
      console.error('Error fetching item:', error);
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

  async updateItem(id: number, updates: Partial<Omit<Item, 'id' | 'created_at' | 'updated_at'>>): Promise<Item> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  }

  async deleteItem(id: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  async searchItems(searchTerm: string): Promise<Item[]> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
        .order('name');

      if (error) throw error;
      return data as Item[];
    } catch (error) {
      console.error('Error searching items:', error);
      throw error;
    }
  }

  async getItemCategories(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('items')
        .select('category')
        .order('category');

      if (error) throw error;
      
      // Remove duplicates and return just the category names
      const categories = [...new Set(data.map(item => item.category))];
      return categories;
    } catch (error) {
      console.error('Error fetching item categories:', error);
      throw error;
    }
  }
}

export const itemsService = new ItemsService();
