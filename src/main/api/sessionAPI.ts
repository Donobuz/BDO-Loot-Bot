import { ipcMain } from 'electron';
import { getSessionManager } from '../../services/ocr';
import { databaseService } from '../../services/db';
import { authService } from '../../services/auth';

export const sessionHandlers = {
    'session:start': async (event: any, { location, locationId, captureInterval = 750 }: { location: string; locationId: number; captureInterval?: number }) => {
        try {
            const sessionManager = getSessionManager();
            
            // Initialize if not already done (this may take a few seconds on first run)
            console.log('Initializing session manager...');
            const initialized = await sessionManager.initialize();
            if (!initialized) {
                return { success: false, error: 'Failed to initialize session manager' };
            }
            console.log('Session manager initialized');

            // Get current user and their preferences
            const currentUser = authService.getCurrentUser();
            if (!currentUser) {
                return { success: false, error: 'User not authenticated' };
            }

            const preferencesResult = await databaseService.userPreferences.getOrCreatePreferences(currentUser.id.toString());
            if (!preferencesResult.success || !preferencesResult.data) {
                return { success: false, error: preferencesResult.error || 'Failed to get user preferences' };
            }

            const userPreferences = preferencesResult.data;

            sessionManager.setUserPreferences(userPreferences);
            
            const result = await sessionManager.startSession(userPreferences, location, locationId);
            return result;
        } catch (error) {
            console.error('Error starting session:', error);
            return { 
                success: false, 
                error: `Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:stop': async () => {
        try {
            const sessionManager = getSessionManager();
            const result = await sessionManager.stopSession();
            return result;
        } catch (error) {
            console.error('Error stopping session:', error);
            return { 
                success: false, 
                error: `Failed to stop session: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:status': async () => {
        try {
            const sessionManager = getSessionManager();
            const status = sessionManager.getStatus();
            return { success: true, status };
        } catch (error) {
            console.error('Error getting session status:', error);
            return { 
                success: false, 
                error: `Failed to get session status: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:stats': async () => {
        try {
            const sessionManager = getSessionManager();
            const stats = sessionManager.getSessionStats();
            return { success: true, stats };
        } catch (error) {
            console.error('Error getting session stats:', error);
            return { 
                success: false, 
                error: `Failed to get session stats: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:summary': async () => {
        try {
            const sessionManager = getSessionManager();
            const summary = sessionManager.getSessionSummary();
            return { success: true, summary };
        } catch (error) {
            console.error('Error getting session summary:', error);
            return { 
                success: false, 
                error: `Failed to get session summary: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:current': async () => {
        try {
            const sessionManager = getSessionManager();
            const currentSession = sessionManager.getCurrentSession();
            return { success: true, session: currentSession };
        } catch (error) {
            console.error('Error getting current session:', error);
            return { 
                success: false, 
                error: `Failed to get current session: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:update-interval': async (event: any, { interval }: { interval: number }) => {
        try {
            const sessionManager = getSessionManager();
            const result = sessionManager.updateCaptureInterval(interval);
            return result;
        } catch (error) {
            console.error('Error updating capture interval:', error);
            return { 
                success: false, 
                error: `Failed to update capture interval: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:test-capture': async () => {
        try {
            const sessionManager = getSessionManager();
            
            // Get current user and their preferences for test capture
            const currentUser = authService.getCurrentUser();
            if (!currentUser) {
                return { success: false, error: 'User not authenticated' };
            }

            console.log('Current user for test capture:', { id: currentUser.id, discord_id: currentUser.discord_id });
            const preferencesResult = await databaseService.userPreferences.getOrCreatePreferences(currentUser.id.toString());
            if (!preferencesResult.success || !preferencesResult.data) {
                return { success: false, error: preferencesResult.error || 'Failed to get user preferences' };
            }

            // Check if OCR region is configured
            if (!preferencesResult.data.designated_ocr_region) {
                return { success: false, error: 'No OCR region configured. Please set up your OCR region in settings first.' };
            }

            const result = await sessionManager.testCaptureWithPreview(preferencesResult.data);
            return result;
        } catch (error) {
            console.error('Error testing capture:', error);
            return { 
                success: false, 
                error: `Failed to test capture: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:available-locations': async () => {
        try {
            const sessionManager = getSessionManager();
            const locations = sessionManager.getAvailableLocations();
            return { success: true, locations };
        } catch (error) {
            console.error('Error getting available locations:', error);
            return { 
                success: false, 
                error: `Failed to get available locations: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:is-active': async () => {
        try {
            const sessionManager = getSessionManager();
            const isActive = sessionManager.isSessionActive();
            return { success: true, isActive };
        } catch (error) {
            console.error('Error checking if session is active:', error);
            return { 
                success: false, 
                error: `Failed to check session status: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    },

    'session:restart-fastocr': async () => {
        try {
            const sessionManager = getSessionManager();
            const result = await sessionManager.restartFastOCR();
            return result;
        } catch (error) {
            console.error('Error restarting FastOCR:', error);
            return { 
                success: false, 
                error: `Failed to restart FastOCR: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    }
};

// Handlers are registered in main.ts