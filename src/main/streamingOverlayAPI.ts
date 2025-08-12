import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as path from 'path';

interface StreamingOverlayData {
  location?: any;
  items: any[];
  itemCounts: Record<number, number>;
}

let streamingOverlayWindow: BrowserWindow | null = null;

export const streamingOverlayHandlers = {
  'open-streaming-overlay': async (event: IpcMainInvokeEvent, data: StreamingOverlayData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Close existing overlay window if open
      if (streamingOverlayWindow && !streamingOverlayWindow.isDestroyed()) {
        streamingOverlayWindow.close();
      }

      // Create streaming overlay window
      streamingOverlayWindow = new BrowserWindow({
        width: 450,
        height: 650,
        frame: true,
        transparent: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        movable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
        focusable: true,
        title: 'BDO Loot Tracker - Streaming Overlay',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js'),
        },
      });

      // Load the streaming overlay HTML
      await streamingOverlayWindow.loadFile(path.join(__dirname, 'streamingOverlay.html'));

      // Send initial data to the overlay
      streamingOverlayWindow.webContents.once('dom-ready', () => {
        if (streamingOverlayWindow) {
          streamingOverlayWindow.webContents.send('overlay-data', data);
        }
      });

      // Handle window close
      streamingOverlayWindow.on('closed', () => {
        console.log('Streaming overlay window closed');
        streamingOverlayWindow = null;
        // Notify main window that overlay was closed
        const mainWindow = BrowserWindow.getAllWindows().find(win => win.getTitle().includes('BDO Loot Ledger'));
        if (mainWindow) {
          console.log('Sending overlay closed event to main window');
          mainWindow.webContents.send('streaming-overlay-closed');
        }
      });

      return { success: true };

    } catch (error) {
      console.error('Error opening streaming overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'update-streaming-overlay': async (event: IpcMainInvokeEvent, data: StreamingOverlayData): Promise<{ success: boolean; error?: string }> => {
    try {
      if (streamingOverlayWindow && !streamingOverlayWindow.isDestroyed()) {
        streamingOverlayWindow.webContents.send('overlay-data', data);
        return { success: true };
      } else {
        return { success: false, error: 'Streaming overlay window not open' };
      }
    } catch (error) {
      console.error('Error updating streaming overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

// Clean up function
export const cleanupStreamingOverlay = () => {
  if (streamingOverlayWindow && !streamingOverlayWindow.isDestroyed()) {
    streamingOverlayWindow.close();
    streamingOverlayWindow = null;
  }
};