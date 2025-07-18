import { BaseDatabase } from './base';
import { Item } from '../../renderer/types';

export class ItemsService extends BaseDatabase {
  private tableName = 'items';

  async getAll(): Promise<{ success: boolean; data?: Item[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .order('created', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: `Failed to fetch items: ${error}` };
    }
  }

  async getActive(): Promise<{ success: boolean; data?: Item[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .is('archived', null)
        .order('created', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: `Failed to fetch active items: ${error}` };
    }
  }

  async getArchived(): Promise<{ success: boolean; data?: Item[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .not('archived', 'is', null)
        .order('archived', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: `Failed to fetch archived items: ${error}` };
    }
  }

  async getById(id: number): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to fetch item: ${error}` };
    }
  }

  async getByBdoIdAndRegion(bdoItemId: number, region: string): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('bdo_item_id', bdoItemId)
        .eq('region', region)
        .single();

      if (error) {
        // If no item found, return success with no data (not an error)
        if (error.code === 'PGRST116') {
          return { success: true, data: undefined };
        }
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to fetch item by BDO ID and region: ${error}` };
    }
  }

  async getByBdoIdAndRegionIncludingArchived(bdoItemId: number, region: string): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('bdo_item_id', bdoItemId)
        .eq('region', region)
        .order('created', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no item found, return success with no data (not an error)
        if (error.code === 'PGRST116') {
          return { success: true, data: undefined };
        }
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to fetch item by BDO ID and region (including archived): ${error}` };
    }
  }

  async getByBdoIdGlobalIncludingArchived(bdoItemId: number): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('bdo_item_id', bdoItemId)
        .is('region', null)
        .order('created', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no item found, return success with no data (not an error)
        if (error.code === 'PGRST116') {
          return { success: true, data: undefined };
        }
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to fetch global item by BDO ID (including archived): ${error}` };
    }
  }

  async create(item: Omit<Item, 'id' | 'created' | 'updated'>): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert([{
          name: item.name,
          bdo_item_id: item.bdo_item_id,
          base_price: item.base_price,
          last_sold_price: item.last_sold_price,
          loot_table_ids: item.loot_table_ids,
          region: item.region,
          type: item.type,
          convertible_to_bdo_item_id: item.convertible_to_bdo_item_id || null,
          conversion_ratio: item.conversion_ratio || 1,
        }])
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to create item: ${error}` };
    }
  }

  async update(id: number, updates: Partial<Omit<Item, 'id' | 'created' | 'updated'>>): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...updates,
          updated: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to update item: ${error}` };
    }
  }

  async archive(id: number): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          archived: new Date().toISOString(),
          updated: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to archive item: ${error}` };
    }
  }

  async unarchive(id: number): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          archived: null,
          updated: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to unarchive item: ${error}` };
    }
  }

  async updatePrices(bdoItemId: number, region: string, basePrice: number, lastSoldPrice: number): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          base_price: basePrice,
          last_sold_price: lastSoldPrice,
          updated: new Date().toISOString()
        })
        .eq('bdo_item_id', bdoItemId)
        .eq('region', region)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: `Failed to update item prices: ${error}` };
    }
  }

  async getByRegion(region: string): Promise<{ success: boolean; data?: Item[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('region', region)
        .is('archived', null)
        .order('created', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: `Failed to fetch items by region: ${error}` };
    }
  }

  /**
   * Update all items with the same bdo_item_id with an image URL
   */
  async updateImageForAllRegions(bdoItemId: number, imageUrl: string): Promise<{ success: boolean; data?: Item[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          image_url: imageUrl,
          updated: new Date().toISOString()
        })
        .eq('bdo_item_id', bdoItemId)
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: `Failed to update items: ${error}` };
    }
  }

  /**
   * Get all items with the same bdo_item_id
   */
  async getByBdoItemId(bdoItemId: number): Promise<{ success: boolean; data?: Item[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('bdo_item_id', bdoItemId)
        .order('region', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: `Failed to fetch items by bdo_item_id: ${error}` };
    }
  }
}

// Export singleton instance
export const itemsService = new ItemsService();
