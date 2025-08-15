import { BaseDatabase } from './base';
import { User, DiscordUser, UserUpdate } from './types';
import { aclsService } from './acls';

class UsersService extends BaseDatabase {
  async createOrUpdateUser(discordUser: DiscordUser): Promise<User> {
    try {
      // Try to find existing user first
      const { data: existingUser, error: findError } = await this.supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordUser.id)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      if (existingUser) {
        // Update existing user
        const { data, error } = await this.supabase
          .from('users')
          .update({
            username: discordUser.username,
            avatar: discordUser.avatar,
            updated: new Date().toISOString(),
          })
          .eq('discord_id', discordUser.id)
          .select()
          .single();

        if (error) throw error;
        return data as User;
      } else {
        // Create new user
        const { data, error } = await this.supabase
          .from('users')
          .insert([{
            discord_id: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        // Create default ACL for new user
        try {
          await aclsService.createDefaultAcl(discordUser.id);
        } catch (aclError) {
          console.error('Failed to create default ACL for user:', aclError);
          // Don't throw here - user creation succeeded, ACL creation failed
        }

        return data as User;
      }
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as User | null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }

  async getUserByDiscordId(discordId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as User | null;
    } catch (error) {
      console.error('Error fetching user by Discord ID:', error);
      throw error;
    }
  }

  async updateUser(id: number, updates: UserUpdate): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...updates,
          updated: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as User;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async updateUserRegion(discordId: string, region: string): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          preferred_region: region,
          updated: new Date().toISOString(),
        })
        .eq('discord_id', discordId)
        .select()
        .single();

      if (error) throw error;
      return data as User;
    } catch (error) {
      console.error('Error updating user region:', error);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

const usersService = new UsersService();

// Export both class and instance
export { UsersService, usersService };
