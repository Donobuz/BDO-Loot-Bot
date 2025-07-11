// Database services exports
export { BaseDatabase } from './base';
export { usersService, UsersService } from './users';
export { locationsService, LocationsService } from './locations';
export { itemsService, ItemsService } from './items';
export { grindSessionsService, GrindSessionsService } from './grind-sessions';
export { sessionLootService, SessionLootService } from './session-loot';
export { lootTablesService, LootTablesService } from './loot-tables';

// Type exports
export * from './types';

// Main database service aggregator class
import { BaseDatabase } from './base';
import { UsersService } from './users';
import { LocationsService } from './locations';
import { ItemsService } from './items';
import { GrindSessionsService } from './grind-sessions';
import { SessionLootService } from './session-loot';
import { LootTablesService } from './loot-tables';

export class DatabaseService extends BaseDatabase {
  public users: UsersService;
  public locations: LocationsService;
  public items: ItemsService;
  public grindSessions: GrindSessionsService;
  public sessionLoot: SessionLootService;
  public lootTables: LootTablesService;

  constructor() {
    super();
    this.users = new UsersService();
    this.locations = new LocationsService();
    this.items = new ItemsService();
    this.grindSessions = new GrindSessionsService();
    this.sessionLoot = new SessionLootService();
    this.lootTables = new LootTablesService();
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
          lootTables: true
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
          lootTables: false
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Default database service instance
export const databaseService = new DatabaseService();
