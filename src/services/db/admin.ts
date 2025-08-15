import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../../config/config';
import { Item, ItemUpdate } from './types/item';

export class AdminDatabase {
  private adminClient: SupabaseClient;
  private isAdminAvailable: boolean;

  constructor() {
    // Check if service role key is available and valid
    this.isAdminAvailable = !!(SUPABASE_CONFIG.serviceRoleKey && 
                              SUPABASE_CONFIG.serviceRoleKey !== 'your_supabase_service_role_key');
    
    if (this.isAdminAvailable) {
      this.adminClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
    } else {
      this.adminClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
  }

  /**
   * Get the admin client for operations requiring elevated permissions
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Check if admin permissions are available
   */
  hasAdminPermissions(): boolean {
    return this.isAdminAvailable;
  }

  /**
   * Update item with admin permissions (bypasses RLS)
   */
  async updateItemAsAdmin(id: number, updates: ItemUpdate): Promise<{ success: boolean; data?: Item; error?: string }> {
    try {
      const { data, error } = await this.adminClient
        .from('items')
        .update({
          ...updates,
          updated: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [ADMIN] Supabase admin update error:', error);
        console.error('❌ [ADMIN] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('❌ [ADMIN] Exception during admin update:', error);
      return { success: false, error: `Failed to update item with admin permissions: ${error}` };
    }
  }
}

// Export singleton instance
export const adminDatabase = new AdminDatabase();
