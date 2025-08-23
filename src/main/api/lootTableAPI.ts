import { IpcMainInvokeEvent } from 'electron';
import { lootTableService } from '../../services/db/lootTables';
import { LootTable, LootTableUpdate } from '../../services/db/types/lootTable';

export const lootTableHandlers = {
  'loot-tables:get-all': async (event: IpcMainInvokeEvent) => {
    try {
      return await lootTableService.getAll();
    } catch (error) {
      console.error('Error getting all loot tables:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:get-active': async (event: IpcMainInvokeEvent) => {
    try {
      return await lootTableService.getActive();
    } catch (error) {
      console.error('Error getting active loot tables:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:get-by-id': async (event: IpcMainInvokeEvent, id: number) => {
    try {
      return await lootTableService.getById(id);
    } catch (error) {
      console.error('Error getting loot table by ID:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:get-by-location-id': async (event: IpcMainInvokeEvent, locationId: number) => {
    try {
      return await lootTableService.getByLocationId(locationId);
    } catch (error) {
      console.error('Error getting loot table by location ID:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:create': async (event: IpcMainInvokeEvent, lootTable: Omit<LootTable, 'id' | 'created' | 'updated'>) => {
    try {
      return await lootTableService.create(lootTable);
    } catch (error) {
      console.error('Error creating loot table:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:update': async (event: IpcMainInvokeEvent, id: number, updates: LootTableUpdate) => {
    try {
      return await lootTableService.update(id, updates);
    } catch (error) {
      console.error('Error updating loot table:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:add-item': async (event: IpcMainInvokeEvent, lootTableId: number, itemId: number) => {
    try {
      return await lootTableService.addItem(lootTableId, itemId);
    } catch (error) {
      console.error('Error adding item to loot table:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'loot-tables:remove-item': async (event: IpcMainInvokeEvent, lootTableId: number, itemId: number) => {
    try {
      return await lootTableService.removeItem(lootTableId, itemId);
    } catch (error) {
      console.error('Error removing item from loot table:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
