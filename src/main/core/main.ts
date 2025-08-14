import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { authService } from '../../services/auth';
import { databaseService } from '../../services/db';
import { setupLocationHandlers } from '../api/locationAPI';
import { itemHandlers } from '../api/itemAPI';
import { lootTableHandlers } from '../api/lootTableAPI';
import { userHandlers, userPreferencesHandlers } from '../api/userAPI';
import { regionSelectorHandlers } from '../features/regionSelector/regionSelectorAPI';
import { streamingOverlayHandlers, cleanupStreamingOverlay } from '../features/streamingOverlay/streamingOverlayAPI';
import { StorageService } from '../../services/db/storage';

// Global storage service instance
let storageService: StorageService;

// Cleanup function for when the main window refreshes or closes
const cleanupSession = async () => {
  console.log('Cleaning up session due to window refresh/close...');
  
  // Close streaming overlay if open
  cleanupStreamingOverlay();
  
  // Stop simple OCR if running (the simple system handles its own cleanup)
  // No additional cleanup needed for Simple OCR system
  
  // Broadcast cleanup event to all windows
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('session-cleanup', {
        reason: 'window-refresh-or-close',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // TODO: In future, stop any active session and prevent saving to database
  // For now, cleanup is handled by the session-cleanup event broadcast above
  
  console.log('Session cleanup completed');
}

async function createWindow() {
  // Initialize database
  try {
    await databaseService.testConnection();
    console.log('Database initialized');
    
    // Initialize storage bucket
    storageService = new StorageService();
    await storageService.initializeBucket();
  } catch (error) {
    console.error('Failed to initialize database or storage:', error);
  }

  const win = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // Handle window events for cleanup
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    // If navigating to the same URL (refresh), cleanup session
    const currentUrl = win.webContents.getURL();
    if (navigationUrl === currentUrl) {
      console.log('Main window refresh detected - cleaning up session');
      cleanupSession();
    }
  });
  
  win.webContents.on('did-start-navigation', () => {
    // This fires on refresh (Cmd+R) - cleanup session
    console.log('Main window navigation started - cleaning up session');
    cleanupSession();
  });
  
  win.on('closed', () => {
    console.log('Main window closed - cleaning up session');
    cleanupSession();
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// Set up IPC handlers
ipcMain.handle('start-discord-auth', async () => {
  try {
    const result = await authService.startAuthFlow();
    return result;
  } catch (error) {
    console.error('Auth error details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Authentication failed: ${errorMessage}` };
  }
});

ipcMain.handle('cancel-discord-auth', async () => {
  try {
    authService.cancelAuthFlow();
    return { success: true };
  } catch (error) {
    console.error('Error cancelling auth:', error);
    return { success: false, error: 'Failed to cancel authentication' };
  }
});

ipcMain.handle('check-auth-status', async () => {
  return {
    isLoggedIn: authService.isLoggedIn(),
    user: authService.getCurrentUser()
  };
});

ipcMain.handle('logout', async () => {
  authService.logout();
  return { success: true };
});

ipcMain.handle('get-current-user', async () => {
  return authService.getCurrentUserWithPermissions();
});

// Setup location handlers
setupLocationHandlers();

// Setup item handlers
Object.entries(itemHandlers).forEach(([event, handler]) => {
  ipcMain.handle(event, handler);
});

// Setup loot table handlers
Object.entries(lootTableHandlers).forEach(([event, handler]) => {
  ipcMain.handle(event, handler);
});

// Setup user handlers
Object.entries(userHandlers).forEach(([event, handler]) => {
  ipcMain.handle(event, handler);
});

// Setup user preferences handlers
Object.entries(userPreferencesHandlers).forEach(([event, handler]) => {
  ipcMain.handle(event, handler);
});

// Setup region selector handlers
Object.entries(regionSelectorHandlers).forEach(([event, handler]) => {
  ipcMain.handle(event, handler);
});

// Setup streaming overlay handlers
Object.entries(streamingOverlayHandlers).forEach(([event, handler]) => {
  ipcMain.handle(event, handler);
});

app.whenReady().then(() => {
  console.log('🚀 Starting BDO Loot Bot...');
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up database connection when app is closing
app.on('before-quit', async () => {
  await databaseService.close();
});
