import { BaseDatabase } from './base';
import { UserPreferences, UserPreferencesUpdate } from './types/user';

export class UserPreferencesService extends BaseDatabase {
  constructor() {
    super();
  }

  /**
   * Get user preferences by user ID
   */
  async getPreferences(userId: string): Promise<{ success: boolean; data?: UserPreferences; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'User preferences not found' };
        }
        return { success: false, error: error.message };
      }

      const preferences: UserPreferences = {
        user_id: data.user_id,
        preferred_region: data.preferred_region,
        display_regions: data.display_regions,
        designated_ocr_region: data.designated_ocr_region,
        tax_calculations: data.tax_calculations,
        created: data.created,
        updated: data.updated
      };

      return { success: true, data: preferences };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return { success: false, error: 'Failed to get user preferences' };
    }
  }

  /**
   * Create user preferences
   */
  async createPreferences(userId: string, preferences: UserPreferencesUpdate): Promise<{ success: boolean; data?: UserPreferences; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          preferred_region: preferences.preferred_region || 'NA',
          display_regions: preferences.display_regions || ['NA'],
          designated_ocr_region: preferences.designated_ocr_region || null,
          tax_calculations: preferences.tax_calculations || null,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const newPreferences: UserPreferences = {
        user_id: data.user_id,
        preferred_region: data.preferred_region,
        display_regions: data.display_regions,
        designated_ocr_region: data.designated_ocr_region,
        tax_calculations: data.tax_calculations,
        created: data.created,
        updated: data.updated
      };

      return { success: true, data: newPreferences };
    } catch (error) {
      console.error('Error creating user preferences:', error);
      return { success: false, error: 'Failed to create user preferences' };
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: UserPreferencesUpdate): Promise<{ success: boolean; data?: UserPreferences; error?: string }> {
    try {
      const updates: UserPreferencesUpdate = {};

      if (preferences.preferred_region !== undefined) {
        updates.preferred_region = preferences.preferred_region;
      }

      if (preferences.display_regions !== undefined) {
        updates.display_regions = preferences.display_regions;
      }

      if (preferences.designated_ocr_region !== undefined) {
        updates.designated_ocr_region = preferences.designated_ocr_region;
      }

      if (preferences.tax_calculations !== undefined) {
        updates.tax_calculations = preferences.tax_calculations;
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: 'No valid updates provided' };
      }

      // Manually set the updated timestamp
      (updates as any).updated = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const updatedPreferences: UserPreferences = {
        user_id: data.user_id,
        preferred_region: data.preferred_region,
        display_regions: data.display_regions,
        designated_ocr_region: data.designated_ocr_region,
        tax_calculations: data.tax_calculations,
        created: data.created,
        updated: data.updated
      };

      return { success: true, data: updatedPreferences };
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return { success: false, error: 'Failed to update user preferences' };
    }
  }

  /**
   * Get or create user preferences (upsert pattern)
   */
  async getOrCreatePreferences(userId: string, defaultPreferences?: UserPreferencesUpdate): Promise<{ success: boolean; data?: UserPreferences; error?: string }> {
    try {
      // Try to get existing preferences
      const existingResult = await this.getPreferences(userId);
      
      if (existingResult.success && existingResult.data) {
        return existingResult;
      }

      // Create new preferences if they don't exist
      const createResult = await this.createPreferences(userId, defaultPreferences || {});
      return createResult;
    } catch (error) {
      console.error('Error getting or creating user preferences:', error);
      return { success: false, error: 'Failed to get or create user preferences' };
    }
  }

  /**
   * Delete user preferences
   */
  async deletePreferences(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting user preferences:', error);
      return { success: false, error: 'Failed to delete user preferences' };
    }
  }

  /**
   * Check if user wants to aggregate all regions
   */
  shouldAggregateAllRegions(preferences: UserPreferences): boolean {
    return preferences.display_regions.includes('ALL');
  }

  /**
   * Get effective regions for display (expand ALL to actual regions)
   */
  getEffectiveDisplayRegions(preferences: UserPreferences): string[] {
    if (this.shouldAggregateAllRegions(preferences)) {
      return ['NA', 'EU', 'SEA', 'MENA', 'KR', 'RU', 'JP', 'TH', 'TW', 'SA'];
    }
    return preferences.display_regions;
  }
}
