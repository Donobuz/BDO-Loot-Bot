import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../../config/config';

export class BaseDatabase {
  protected supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }

  async testConnection(): Promise<void> {
    try {
      console.log('Connecting to Supabase...');
      
      // Test basic connection with a simple health check
      const { count, error } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Users table does not exist. Please create it in your Supabase dashboard.');
        } else if (error.code === 'PGRST301') {
          throw new Error('Invalid Supabase configuration. Please check your URL and API key.');
        } else {
          throw new Error(`Database connection failed: ${error.message}`);
        }
      }

      // Test read permissions
      const { error: readError } = await this.supabase
        .from('users')
        .select('id')
        .limit(1);

      if (readError && readError.code !== 'PGRST116') {
        throw new Error(`Database read permission denied: ${readError.message}`);
      }

      console.log('✅ Supabase connection established successfully');
      console.log('📊 Current user count:', count);
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
    console.log('Supabase connection closed');
  }
}
