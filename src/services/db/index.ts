// Database services exports
export { BaseDatabase } from './base';
export { usersService, UsersService } from './users';
export { aclsService, AclsService } from './acls';
export { locationService, LocationService } from './locations';
export { itemsService, ItemsService } from './items';
export { StorageService } from './storage';

export * from './types/user';
export * from './types/location';
export * from './types/item';
export * from './types/lootTable';
export * from './types/auth';
export * from './types/ocr';

// Main database service aggregator class
import { BaseDatabase } from './base';
import { UsersService } from './users';
import { AclsService } from './acls';
import { LocationService } from './locations';
import { ItemsService } from './items';

export class DatabaseService extends BaseDatabase {
  public users: UsersService;
  public acls: AclsService;
  public locations: LocationService;
  public items: ItemsService;

  constructor() {
    super();
    this.users = new UsersService();
    this.acls = new AclsService();
    this.locations = new LocationService();
    this.items = new ItemsService();
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
