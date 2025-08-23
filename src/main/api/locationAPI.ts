import { ipcMain } from 'electron';
import { locationService } from '../../services/db/locations';

// Setup location IPC handlers
export function setupLocationHandlers() {
  
  // Get all active locations
  ipcMain.handle('locations:get-active', async () => {
    try {
      const locations = await locationService.getActiveLocations();
      return { success: true, data: locations };
    } catch (error) {
      console.error('Failed to get active locations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get all archived locations
  ipcMain.handle('locations:get-archived', async () => {
    try {
      const locations = await locationService.getArchivedLocations();
      return { success: true, data: locations };
    } catch (error) {
      console.error('Failed to get archived locations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get all locations (active and archived)
  ipcMain.handle('locations:get-all', async () => {
    try {
      const locations = await locationService.getAllLocations();
      return { success: true, data: locations };
    } catch (error) {
      console.error('Failed to get all locations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get location by ID
  ipcMain.handle('locations:get-by-id', async (_, id: number) => {
    try {
      const location = await locationService.getLocationById(id);
      return { success: true, data: location };
    } catch (error) {
      console.error('Failed to get location by ID:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Create new location
  ipcMain.handle('locations:create', async (_, locationData) => {
    try {
      // Check if location already exists by name (including archived)
      const existingLocation = await locationService.getLocationByNameIncludingArchived(locationData.name);
      
      if (existingLocation) {
        // If location is archived, unarchive it
        if (existingLocation.archived) {
          console.log(`Location "${locationData.name}" found archived, unarchiving...`);
          const unarchiveResult = await locationService.unarchiveLocation(existingLocation.id);
          return { 
            success: true, 
            unarchived: true, 
            data: unarchiveResult,
            message: `Location "${locationData.name}" unarchived` 
          };
        } else {
          // Location exists and is active
          console.log(`Location "${locationData.name}" already exists and is active`);
          return { 
            success: true, 
            skipped: true, 
            data: existingLocation,
            message: `Location "${locationData.name}" already exists` 
          };
        }
      }

      // Location doesn't exist, create new one
      const location = await locationService.createLocation(locationData);
      return { success: true, data: location };
    } catch (error) {
      console.error('Failed to create location:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Update location
  ipcMain.handle('locations:update', async (_, id: number, updates) => {
    try {
      const location = await locationService.updateLocation(id, updates);
      return { success: true, data: location };
    } catch (error) {
      console.error('Failed to update location:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Archive location (this is what "delete" button will call)
  ipcMain.handle('locations:archive', async (_, id: number) => {
    try {
      const location = await locationService.archiveLocation(id);
      return { success: true, data: location };
    } catch (error) {
      console.error('Failed to archive location:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Unarchive location
  ipcMain.handle('locations:unarchive', async (_, id: number) => {
    try {
      const location = await locationService.unarchiveLocation(id);
      return { success: true, data: location };
    } catch (error) {
      console.error('Failed to unarchive location:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Search locations
  ipcMain.handle('locations:search', async (_, searchTerm: string) => {
    try {
      const locations = await locationService.searchLocationsByName(searchTerm);
      return { success: true, data: locations };
    } catch (error) {
      console.error('Failed to search locations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
