// === LOOT TABLE TYPES ===

export interface LootTable {
  id: number;
  location_id: number;
  item_ids: number[];
  created: string;
  updated: string;
  archived?: string | null;
}

// === LOOT TABLE UPDATE INTERFACES ===

export interface LootTableUpdate {
  location_id?: number;
  item_ids?: number[];
  archived?: string | null;
}
