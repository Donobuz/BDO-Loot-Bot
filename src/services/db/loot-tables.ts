import { BaseDatabase } from './base';
import { LocationLootTable } from './types';

export class LootTablesService extends BaseDatabase {
  async addItemToLootTable(locationId: number, itemId: number, dropRate?: number, minQuantity: number = 1, maxQuantity: number = 1): Promise<LocationLootTable> {
    try {
      const lootTableData = {
        location_id: locationId,
        item_id: itemId,
        drop_rate: dropRate || null,
        min_quantity: minQuantity,
        max_quantity: maxQuantity
      };

      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .insert([lootTableData])
        .select()
        .single();

      if (error) throw error;
      return data as LocationLootTable;
    } catch (error) {
      console.error('Error adding item to loot table:', error);
      throw error;
    }
  }

  async updateLootTableEntry(entryId: number, updates: Partial<Omit<LocationLootTable, 'id' | 'location_id' | 'item_id' | 'created_at' | 'updated_at'>>): Promise<LocationLootTable> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data as LocationLootTable;
    } catch (error) {
      console.error('Error updating loot table entry:', error);
      throw error;
    }
  }

  async removeItemFromLootTable(entryId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('location_loot_tables')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing item from loot table:', error);
      throw error;
    }
  }

  async getLocationLootTable(locationId: number): Promise<LocationLootTable[]> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .select(`
          *,
          items (name, category, rarity, icon_url, estimated_value)
        `)
        .eq('location_id', locationId)
        .order('drop_rate', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error fetching location loot table:', error);
      throw error;
    }
  }

  async getItemLocations(itemId: number): Promise<LocationLootTable[]> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .select(`
          *,
          locations (name, region, description)
        `)
        .eq('item_id', itemId)
        .order('drop_rate', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error fetching item locations:', error);
      throw error;
    }
  }

  async bulkAddToLootTable(locationId: number, items: Array<{
    itemId: number;
    dropRate?: number;
    minQuantity?: number;
    maxQuantity?: number;
  }>): Promise<LocationLootTable[]> {
    try {
      const lootTableData = items.map(item => ({
        location_id: locationId,
        item_id: item.itemId,
        drop_rate: item.dropRate || null,
        min_quantity: item.minQuantity || 1,
        max_quantity: item.maxQuantity || 1
      }));

      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .insert(lootTableData)
        .select();

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error bulk adding to loot table:', error);
      throw error;
    }
  }

  async getLootTableByCategory(locationId: number, category: string): Promise<LocationLootTable[]> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .select(`
          *,
          items!inner (name, category, rarity, icon_url, estimated_value)
        `)
        .eq('location_id', locationId)
        .eq('items.category', category)
        .order('drop_rate', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error fetching loot table by category:', error);
      throw error;
    }
  }

  async getLootTableByRarity(locationId: number, rarity: string): Promise<LocationLootTable[]> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .select(`
          *,
          items!inner (name, category, rarity, icon_url, estimated_value)
        `)
        .eq('location_id', locationId)
        .eq('items.rarity', rarity)
        .order('drop_rate', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error fetching loot table by rarity:', error);
      throw error;
    }
  }

  async searchLootTable(locationId: number, searchTerm: string): Promise<LocationLootTable[]> {
    try {
      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .select(`
          *,
          items!inner (name, category, rarity, icon_url, estimated_value)
        `)
        .eq('location_id', locationId)
        .ilike('items.name', `%${searchTerm}%`)
        .order('drop_rate', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error searching loot table:', error);
      throw error;
    }
  }

  async getLootTableStats(locationId: number): Promise<{
    totalItems: number;
    categoryCounts: { [category: string]: number };
    rarityCounts: { [rarity: string]: number };
    averageDropRate: number;
    highestValueItems: LocationLootTable[];
  }> {
    try {
      const lootTable = await this.getLocationLootTable(locationId);
      
      const totalItems = lootTable.length;
      
      // Count by category and rarity
      const categoryCounts: { [category: string]: number } = {};
      const rarityCounts: { [rarity: string]: number } = {};
      let totalDropRate = 0;
      let dropRateCount = 0;

      lootTable.forEach(entry => {
        const item = (entry as any).items;
        const category = item?.category || 'Unknown';
        const rarity = item?.rarity || 'Unknown';

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;

        if (entry.drop_rate !== null && entry.drop_rate !== undefined) {
          totalDropRate += entry.drop_rate;
          dropRateCount++;
        }
      });

      const averageDropRate = dropRateCount > 0 ? totalDropRate / dropRateCount : 0;

      // Get top 10 highest value items
      const highestValueItems = [...lootTable]
        .sort((a, b) => {
          const aValue = ((a as any).items?.estimated_value || 0);
          const bValue = ((b as any).items?.estimated_value || 0);
          return bValue - aValue;
        })
        .slice(0, 10);

      return {
        totalItems,
        categoryCounts,
        rarityCounts,
        averageDropRate,
        highestValueItems
      };
    } catch (error) {
      console.error('Error getting loot table stats:', error);
      throw error;
    }
  }

  async copyLootTable(fromLocationId: number, toLocationId: number): Promise<LocationLootTable[]> {
    try {
      // First get the source loot table
      const sourceLootTable = await this.getLocationLootTable(fromLocationId);
      
      if (sourceLootTable.length === 0) {
        return [];
      }

      // Create new entries for the target location
      const newEntries = sourceLootTable.map(entry => ({
        location_id: toLocationId,
        item_id: entry.item_id,
        drop_rate: entry.drop_rate,
        min_quantity: entry.min_quantity,
        max_quantity: entry.max_quantity
      }));

      const { data, error } = await this.supabase
        .from('location_loot_tables')
        .insert(newEntries)
        .select();

      if (error) throw error;
      return data as LocationLootTable[];
    } catch (error) {
      console.error('Error copying loot table:', error);
      throw error;
    }
  }

  async clearLootTable(locationId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('location_loot_tables')
        .delete()
        .eq('location_id', locationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing loot table:', error);
      throw error;
    }
  }
}

export const lootTablesService = new LootTablesService();
