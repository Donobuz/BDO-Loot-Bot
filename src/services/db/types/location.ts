// === LOCATION TYPES ===

export interface Location {
  id: number;
  name: string;
  ap: number;
  total_ap: number;
  dp: number;
  monster_type: string;
  created: string;
  updated: string;
  archived?: string;
}

// === LOCATION UPDATE INTERFACES ===

export interface LocationUpdate {
  name?: string;
  ap?: number;
  total_ap?: number;
  dp?: number;
  monster_type?: string;
  archived?: string;
}
