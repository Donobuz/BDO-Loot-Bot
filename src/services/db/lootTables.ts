import { BaseDatabase } from './base';
import { LootTable, LootTableUpdate } from './types/lootTable';

export class LootTableService extends BaseDatabase {
  // Get all loot tables
  async getAll(): Promise<{ success: boolean; data?: LootTable[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('loot_tables')
        .select('id, location_id, item_ids, created, updated')
        .order('created', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get active loot tables (from non-archived locations)
  async getActive(): Promise<{ success: boolean; data?: LootTable[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('loot_tables')
        .select(`
          id,
          location_id,
          item_ids,
          created,
          updated,
          locations!loot_tables_location_id_fkey (
            id,
            name,
            archived
          )
        `)
        .is('locations.archived', null)
        .order('created', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get loot table by ID
  async getById(id: number): Promise<{ success: boolean; data?: LootTable; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('loot_tables')
        .select('id, location_id, item_ids, created, updated')
        .eq('id', id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get loot table by location ID
  async getByLocationId(locationId: number): Promise<{ success: boolean; data?: LootTable; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('loot_tables')
        .select('id, location_id, item_ids, created, updated')
        .eq('location_id', locationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return { success: true, data: undefined };
        }
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Create new loot table
  async create(lootTable: Omit<LootTable, 'id' | 'created' | 'updated'>): Promise<{ success: boolean; data?: LootTable; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('loot_tables')
        .insert({
          ...lootTable,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Update loot table
  async update(id: number, updates: LootTableUpdate): Promise<{ success: boolean; data?: LootTable; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('loot_tables')
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
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Add item to loot table
  async addItem(lootTableId: number, itemId: number): Promise<{ success: boolean; data?: LootTable; error?: string }> {
    try {
      // First get the current loot table
      const getCurrentResult = await this.getById(lootTableId);
      if (!getCurrentResult.success || !getCurrentResult.data) {
        return { success: false, error: 'Loot table not found' };
      }

      const currentItemIds = getCurrentResult.data.item_ids || [];
      
      // Check if item is already in the loot table
      if (currentItemIds.includes(itemId)) {
        return { success: false, error: 'Item already exists in this loot table' };
      }

      // Add the item to the array
      const updatedItemIds = [...currentItemIds, itemId];

      // Update the loot table
      const updateResult = await this.update(lootTableId, { item_ids: updatedItemIds });
      if (!updateResult.success) {
        return updateResult;
      }

      // Also update the item's loot_table_ids
      await this.updateItemLootTableIds(itemId, lootTableId, 'add');

      return updateResult;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Remove item from loot table
  async removeItem(lootTableId: number, itemId: number): Promise<{ success: boolean; data?: LootTable; error?: string }> {
    try {
      // First get the current loot table
      const getCurrentResult = await this.getById(lootTableId);
      if (!getCurrentResult.success || !getCurrentResult.data) {
        return { success: false, error: 'Loot table not found' };
      }

      const currentItemIds = getCurrentResult.data.item_ids || [];
      
      // Remove the item from the array
      const updatedItemIds = currentItemIds.filter(id => id !== itemId);

      // Update the loot table
      const updateResult = await this.update(lootTableId, { item_ids: updatedItemIds });
      if (!updateResult.success) {
        return updateResult;
      }

      // Also update the item's loot_table_ids
      await this.updateItemLootTableIds(itemId, lootTableId, 'remove');

      return updateResult;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Helper method to update item's loot_table_ids
  private async updateItemLootTableIds(itemId: number, lootTableId: number, operation: 'add' | 'remove'): Promise<void> {
    try {
      // Get current item
      const { data: item, error: getError } = await this.supabase
        .from('items')
        .select('loot_table_ids')
        .eq('id', itemId)
        .single();

      if (getError) {
        console.warn(`Failed to get item ${itemId} for loot table update:`, getError);
        return;
      }

      const currentLootTableIds = item.loot_table_ids || [];
      let updatedLootTableIds: number[];

      if (operation === 'add') {
        // Add loot table ID if not already present
        if (!currentLootTableIds.includes(lootTableId)) {
          updatedLootTableIds = [...currentLootTableIds, lootTableId];
        } else {
          return; // Already exists, no update needed
        }
      } else {
        // Remove loot table ID
        updatedLootTableIds = currentLootTableIds.filter(id => id !== lootTableId);
      }

      // Update the item
      const { error: updateError } = await this.supabase
        .from('items')
        .update({ 
          loot_table_ids: updatedLootTableIds,
          updated: new Date().toISOString()
        })
        .eq('id', itemId);

      if (updateError) {
        console.warn(`Failed to update item ${itemId} loot_table_ids:`, updateError);
      }
    } catch (error) {
      console.warn(`Error updating item ${itemId} loot_table_ids:`, error);
    }
  }
}

// Export singleton instance
export const lootTableService = new LootTableService();
