import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { authService } from '../services/auth';
import { databaseService } from '../services/db';
import { setupLocationHandlers } from './locationAPI';
import { itemHandlers } from './itemAPI';
import { StorageService } from '../services/db/storage';

// Global storage service instance
let storageService: StorageService;

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

app.whenReady().then(() => {
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
