// Database services exports
export { BaseDatabase } from './base';
export { usersService, UsersService } from './users';
export { aclsService, AclsService } from './acls';

// Type exports
export * from './types';

// Main database service aggregator class
import { BaseDatabase } from './base';
import { UsersService } from './users';
import { AclsService } from './acls';

export class DatabaseService extends BaseDatabase {
  public users: UsersService;
  public acls: AclsService;

  constructor() {
    super();
    this.users = new UsersService();
    this.acls = new AclsService();
  }

  // Health check method that tests all service connections
  async healthCheck(): Promise<{
    isHealthy: boolean;
    services: { [key: string]: boolean };
    error?: string;
  }> {
    try {
      await this.testConnection();
      
      return {
        isHealthy: true,
        services: {
          database: true,
          users: true,
          locations: true,
          items: true,
          grindSessions: true,
          sessionLoot: true,
          lootTables: true,
          acls: true
        }
      };
    } catch (error) {
      return {
        isHealthy: false,
        services: {
          database: false,
          users: false,
          locations: false,
          items: false,
          grindSessions: false,
          sessionLoot: false,
          lootTables: false,
          acls: false
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Default database service instance
export const databaseService = new DatabaseService();
