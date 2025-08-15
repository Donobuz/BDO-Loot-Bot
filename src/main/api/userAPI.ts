import { usersService } from '../../services/db/users';
import { UserPreferencesService } from '../../services/db/userPreferences';
import { IpcMainInvokeEvent } from 'electron';
import { UserUpdate, UserPreferencesUpdate } from '../../services/db/types/user';

const userPreferencesService = new UserPreferencesService();

export const userHandlers = {
  'user:update-region': async (event: IpcMainInvokeEvent, discordId: string, region: string) => {
    try {
      const updatedUser = await usersService.updateUserRegion(discordId, region);
      return { success: true, data: updatedUser };
    } catch (error) {
      console.error('Error updating user region:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'user:update': async (event: IpcMainInvokeEvent, id: number, updates: UserUpdate) => {
    try {
      const updatedUser = await usersService.updateUser(id, updates);
      return { success: true, data: updatedUser };
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

export const userPreferencesHandlers = {
  'user-preferences:get': async (event: IpcMainInvokeEvent, userId: string) => {
    try {
      const result = await userPreferencesService.getPreferences(userId);
      return result;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'user-preferences:update': async (event: IpcMainInvokeEvent, userId: string, preferences: UserPreferencesUpdate) => {
    try {
      const result = await userPreferencesService.updatePreferences(userId, preferences);
      return result;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'user-preferences:create': async (event: IpcMainInvokeEvent, userId: string, preferences: UserPreferencesUpdate) => {
    try {
      const result = await userPreferencesService.createPreferences(userId, preferences);
      return result;
    } catch (error) {
      console.error('Error creating user preferences:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'user-preferences:get-or-create': async (event: IpcMainInvokeEvent, userId: string, defaultPreferences?: UserPreferencesUpdate) => {
    try {
      const result = await userPreferencesService.getOrCreatePreferences(userId, defaultPreferences);
      return result;
    } catch (error) {
      console.error('Error getting or creating user preferences:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
