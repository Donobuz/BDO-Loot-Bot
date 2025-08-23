// === ITEM TYPES ===

// Item type enum
export type ItemType = 'marketplace' | 'trash_loot' | 'conversion';

export interface Item {
  id: number;
  name: string;
  bdo_item_id: number;
  base_price: number;
  last_sold_price: number;
  loot_table_ids: number[];
  region: string | null; // Allow null for global items (trash loot, conversion)
  image_url?: string | null;
  created: string;
  updated: string;
  archived?: string | null;
  // Item type - determines behavior
  type: ItemType;
  // Conversion fields - only used when type is 'conversion'
  convertible_to_bdo_item_id?: number | null;
  conversion_ratio?: number;
}

// === ITEM UPDATE INTERFACES ===

export interface ItemUpdate {
  name?: string;
  bdo_item_id?: number;
  base_price?: number;
  last_sold_price?: number;
  loot_table_ids?: number[];
  region?: string | null;
  image_url?: string | null;
  archived?: string | null;
  type?: ItemType;
  convertible_to_bdo_item_id?: number | null;
  conversion_ratio?: number;
}
