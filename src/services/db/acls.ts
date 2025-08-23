import { BaseDatabase } from './base';
import { UserAcl } from './types/user';

class AclsService extends BaseDatabase {
  async createDefaultAcl(discordId: string): Promise<UserAcl> {
    try {
      const aclData = {
        discord_id: discordId,
        permissions: ['user'], // Default permission
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('acls')
        .insert([aclData])
        .select()
        .single();

      if (error) throw error;
      return data as UserAcl;
    } catch (error) {
      console.error('Error creating default ACL:', error);
      throw error;
    }
  }

  async getAclByDiscordId(discordId: string): Promise<UserAcl | null> {
    try {
      const { data, error } = await this.supabase
        .from('acls')
        .select('*')
        .eq('discord_id', discordId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as UserAcl | null;
    } catch (error) {
      console.error('Error fetching ACL:', error);
      throw error;
    }
  }

  async updatePermissions(discordId: string, permissions: string[]): Promise<UserAcl> {
    try {
      const { data, error } = await this.supabase
        .from('acls')
        .update({
          permissions,
          updated: new Date().toISOString(),
        })
        .eq('discord_id', discordId)
        .select()
        .single();

      if (error) throw error;
      return data as UserAcl;
    } catch (error) {
      console.error('Error updating permissions:', error);
      throw error;
    }
  }

  async addPermission(discordId: string, permission: string): Promise<UserAcl> {
    try {
      const currentAcl = await this.getAclByDiscordId(discordId);
      if (!currentAcl) {
        throw new Error('User ACL not found');
      }

      const updatedPermissions = [...new Set([...currentAcl.permissions, permission])];
      return this.updatePermissions(discordId, updatedPermissions);
    } catch (error) {
      console.error('Error adding permission:', error);
      throw error;
    }
  }

  async removePermission(discordId: string, permission: string): Promise<UserAcl> {
    try {
      const currentAcl = await this.getAclByDiscordId(discordId);
      if (!currentAcl) {
        throw new Error('User ACL not found');
      }

      const updatedPermissions = currentAcl.permissions.filter(p => p !== permission);
      // Ensure user always has at least 'user' permission
      if (updatedPermissions.length === 0 || !updatedPermissions.includes('user')) {
        updatedPermissions.push('user');
      }

      return this.updatePermissions(discordId, updatedPermissions);
    } catch (error) {
      console.error('Error removing permission:', error);
      throw error;
    }
  }

  async hasPermission(discordId: string, permission: string): Promise<boolean> {
    try {
      const acl = await this.getAclByDiscordId(discordId);
      return acl?.permissions.includes(permission) || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  async isAdmin(discordId: string): Promise<boolean> {
    return this.hasPermission(discordId, 'admin');
  }

  async getAllAcls(): Promise<UserAcl[]> {
    try {
      const { data, error } = await this.supabase
        .from('acls')
        .select('*')
        .order('created', { ascending: false });

      if (error) throw error;
      return data as UserAcl[];
    } catch (error) {
      console.error('Error fetching all ACLs:', error);
      throw error;
    }
  }

  async deleteAcl(discordId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('acls')
        .delete()
        .eq('discord_id', discordId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting ACL:', error);
      throw error;
    }
  }
}

const aclsService = new AclsService();

// Export both class and instance
export { AclsService, aclsService };