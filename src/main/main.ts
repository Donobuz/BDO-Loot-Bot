import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { authService } from '../services/auth';
import { databaseService } from '../services/db';

async function createWindow() {
  // Initialize database
  try {
    await databaseService.testConnection();
    console.log('Database initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
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
    console.log('Starting Discord authentication...');
    console.log('Discord Client ID:', process.env.DISCORD_CLIENT_ID);
    console.log('Supabase URL:', process.env.SUPABASE_URL);
    
    const result = await authService.startAuthFlow();
    console.log('Auth result:', result);
    return result;
  } catch (error) {
    console.error('Auth error details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Authentication failed: ${errorMessage}` };
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
  return authService.getCurrentUser();
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
