import { BaseDatabase } from './base';
import { SessionLoot } from './types';

export class SessionLootService extends BaseDatabase {
  async addLootToSession(sessionId: number, itemId: number, quantity: number, estimatedValue?: number): Promise<SessionLoot> {
    try {
      const lootData = {
        session_id: sessionId,
        item_id: itemId,
        quantity,
        estimated_value: estimatedValue || null
      };

      const { data, error } = await this.supabase
        .from('session_loot')
        .insert([lootData])
        .select()
        .single();

      if (error) throw error;
      return data as SessionLoot;
    } catch (error) {
      console.error('Error adding loot to session:', error);
      throw error;
    }
  }

  async updateLootQuantity(lootId: number, quantity: number, estimatedValue?: number): Promise<SessionLoot> {
    try {
      const updateData: any = { quantity };
      if (estimatedValue !== undefined) {
        updateData.estimated_value = estimatedValue;
      }

      const { data, error } = await this.supabase
        .from('session_loot')
        .update(updateData)
        .eq('id', lootId)
        .select()
        .single();

      if (error) throw error;
      return data as SessionLoot;
    } catch (error) {
      console.error('Error updating loot quantity:', error);
      throw error;
    }
  }

  async removeLootFromSession(lootId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('session_loot')
        .delete()
        .eq('id', lootId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing loot from session:', error);
      throw error;
    }
  }

  async getSessionLoot(sessionId: number): Promise<SessionLoot[]> {
    try {
      const { data, error } = await this.supabase
        .from('session_loot')
        .select(`
          *,
          items (name, category, rarity, icon_url)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SessionLoot[];
    } catch (error) {
      console.error('Error fetching session loot:', error);
      throw error;
    }
  }

  async getSessionLootSummary(sessionId: number): Promise<{
    totalItems: number;
    totalValue: number;
    itemsByCategory: { [category: string]: number };
    mostValuableItems: SessionLoot[];
  }> {
    try {
      const loot = await this.getSessionLoot(sessionId);
      
      const totalItems = loot.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = loot.reduce((sum, item) => sum + (item.estimated_value || 0), 0);
      
      // Group by category
      const itemsByCategory: { [category: string]: number } = {};
      loot.forEach(item => {
        const category = (item as any).items?.category || 'Unknown';
        itemsByCategory[category] = (itemsByCategory[category] || 0) + item.quantity;
      });

      // Get top 5 most valuable items
      const mostValuableItems = [...loot]
        .sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0))
        .slice(0, 5);

      return {
        totalItems,
        totalValue,
        itemsByCategory,
        mostValuableItems
      };
    } catch (error) {
      console.error('Error getting session loot summary:', error);
      throw error;
    }
  }

  async bulkAddLoot(sessionId: number, lootItems: Array<{
    itemId: number;
    quantity: number;
    estimatedValue?: number;
  }>): Promise<SessionLoot[]> {
    try {
      const lootData = lootItems.map(item => ({
        session_id: sessionId,
        item_id: item.itemId,
        quantity: item.quantity,
        estimated_value: item.estimatedValue || null
      }));

      const { data, error } = await this.supabase
        .from('session_loot')
        .insert(lootData)
        .select();

      if (error) throw error;
      return data as SessionLoot[];
    } catch (error) {
      console.error('Error bulk adding loot:', error);
      throw error;
    }
  }

  async incrementLootQuantity(sessionId: number, itemId: number, quantity: number = 1): Promise<SessionLoot> {
    try {
      // First check if this item already exists in the session
      const { data: existingLoot, error: fetchError } = await this.supabase
        .from('session_loot')
        .select()
        .eq('session_id', sessionId)
        .eq('item_id', itemId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (existingLoot) {
        // Update existing loot
        return this.updateLootQuantity(existingLoot.id, existingLoot.quantity + quantity, existingLoot.estimated_value);
      } else {
        // Add new loot
        return this.addLootToSession(sessionId, itemId, quantity);
      }
    } catch (error) {
      console.error('Error incrementing loot quantity:', error);
      throw error;
    }
  }

  async getUserLootHistory(userId: number, itemId?: number, limit: number = 100): Promise<SessionLoot[]> {
    try {
      let query = this.supabase
        .from('session_loot')
        .select(`
          *,
          items (name, category, rarity, icon_url),
          grind_sessions!inner (user_id, location_id, start_time, locations (name, region))
        `)
        .eq('grind_sessions.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SessionLoot[];
    } catch (error) {
      console.error('Error fetching user loot history:', error);
      throw error;
    }
  }

  async getLootStatsByItem(userId: number, days: number = 30): Promise<Array<{
    itemId: number;
    itemName: string;
    category: string;
    totalQuantity: number;
    totalValue: number;
    sessionCount: number;
  }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('session_loot')
        .select(`
          item_id,
          quantity,
          estimated_value,
          items (name, category),
          grind_sessions!inner (user_id, created_at)
        `)
        .eq('grind_sessions.user_id', userId)
        .gte('grind_sessions.created_at', cutoffDate.toISOString());

      if (error) throw error;

      // Group and aggregate by item
      const itemStats = new Map();
      
      data.forEach(loot => {
        const itemId = loot.item_id;
        const existing = itemStats.get(itemId) || {
          itemId,
          itemName: (loot as any).items?.name || 'Unknown',
          category: (loot as any).items?.category || 'Unknown',
          totalQuantity: 0,
          totalValue: 0,
          sessionCount: 0,
          sessions: new Set()
        };

        existing.totalQuantity += loot.quantity;
        existing.totalValue += loot.estimated_value || 0;
        existing.sessions.add((loot as any).grind_sessions?.id);
        existing.sessionCount = existing.sessions.size;

        itemStats.set(itemId, existing);
      });

      return Array.from(itemStats.values()).map(({ sessions, ...stats }) => stats);
    } catch (error) {
      console.error('Error getting loot stats by item:', error);
      throw error;
    }
  }
}

export const sessionLootService = new SessionLootService();
