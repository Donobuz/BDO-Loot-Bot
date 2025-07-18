import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../../config/config';

export class AdminDatabase {
  private adminClient: SupabaseClient;
  private isAdminAvailable: boolean;

  constructor() {
    // Check if service role key is available and valid
    this.isAdminAvailable = !!(SUPABASE_CONFIG.serviceRoleKey && 
                              SUPABASE_CONFIG.serviceRoleKey !== 'your_supabase_service_role_key');
    
    if (this.isAdminAvailable) {
      console.log('🔑 Creating admin client for elevated database operations');
      this.adminClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceRoleKey);
    } else {
      console.log('⚠️ Service role key not configured - admin operations will use regular client');
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
  async updateItemAsAdmin(id: number, updates: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔑 [ADMIN] Updating item with admin permissions');
      console.log('🔑 [ADMIN] Item ID:', id);
      console.log('🔑 [ADMIN] Updates:', JSON.stringify(updates, null, 2));
      console.log('🔑 [ADMIN] Has admin permissions:', this.hasAdminPermissions());
      
      // First check if the item exists
      const { data: existingItem, error: getError } = await this.adminClient
        .from('items')
        .select('id, image_url')
        .eq('id', id)
        .single();
        
      if (getError) {
        console.error('❌ [ADMIN] Failed to fetch existing item:', getError);
        return { success: false, error: `Failed to fetch item: ${getError.message}` };
      }
      
      console.log('📋 [ADMIN] Existing item before update:', JSON.stringify(existingItem, null, 2));
      
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

      console.log('✅ [ADMIN] Admin update successful, returned data:', JSON.stringify(data, null, 2));
      
      // Verify the update worked by fetching the item again
      const { data: verifyItem, error: verifyError } = await this.adminClient
        .from('items')
        .select('id, image_url')
        .eq('id', id)
        .single();
        
      if (!verifyError) {
        console.log('🔍 [ADMIN] Verification - item after update:', JSON.stringify(verifyItem, null, 2));
      } else {
        console.warn('⚠️ [ADMIN] Could not verify update:', verifyError);
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
