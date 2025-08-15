import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as path from 'path';
import { Location } from '../../../services/db/types/location';
import { Item } from '../../../services/db/types/item';

export interface StreamingOverlayData {
  location?: Location;
  items: Item[];
  itemCounts: Record<number, number>;
  sessionStartTime?: string;
}

let streamingOverlayWindow: BrowserWindow | null = null;

export const streamingOverlayHandlers = {
  'is-streaming-overlay-open': async (event: IpcMainInvokeEvent): Promise<{ success: boolean; isOpen: boolean; error?: string }> => {
    try {
      const isOpen = streamingOverlayWindow && !streamingOverlayWindow.isDestroyed();
      return { success: true, isOpen: !!isOpen };
    } catch (error) {
      console.error('Error checking streaming overlay status:', error);
      return { success: false, isOpen: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  'open-streaming-overlay': async (event: IpcMainInvokeEvent, data: StreamingOverlayData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check if overlay is already open
      if (streamingOverlayWindow && !streamingOverlayWindow.isDestroyed()) {
        return { success: false, error: 'Streaming overlay is already open' };
      }

      // Create streaming overlay window
      streamingOverlayWindow = new BrowserWindow({
        width: 400,
        height: 600,
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
          webSecurity: true, // Re-enable web security
          sandbox: false, // Keep false to allow preload script
          preload: path.join(__dirname, 'overlayPreload.js'),
        },
      });
      
      // Add focus/blur event listeners to track overlay window focus
      streamingOverlayWindow.on('focus', () => {
        // Send focus event to main window
        const allWindows = BrowserWindow.getAllWindows();
        const mainWindow = allWindows.find(win => win !== streamingOverlayWindow && !win.isDestroyed());
        if (mainWindow) {
          mainWindow.webContents.send('streaming-overlay-focused');
        }
      });

      streamingOverlayWindow.on('blur', () => {
        // Send blur event to main window
        const allWindows = BrowserWindow.getAllWindows();
        const mainWindow = allWindows.find(win => win !== streamingOverlayWindow && !win.isDestroyed());
        if (mainWindow) {
          mainWindow.webContents.send('streaming-overlay-blurred');
        }
      });
      
      // Load the streaming overlay HTML
      await streamingOverlayWindow.loadFile(path.join(__dirname, 'streamingOverlay.html'));

      // Wait for both DOM ready and a short delay to ensure the listener is set up
      let domReadyFired = false;
      let dataSent = false;

      const sendDataSafely = () => {
        if (dataSent) return;
        dataSent = true;
        
        if (streamingOverlayWindow && !streamingOverlayWindow.isDestroyed()) {
          streamingOverlayWindow.webContents.send('overlay-data', data);
          
          // Notify main window that overlay is now open
          // Get the main window (the one that's not the overlay window)
          const allWindows = BrowserWindow.getAllWindows();
          const mainWindow = allWindows.find(win => win !== streamingOverlayWindow && !win.isDestroyed());
          if (mainWindow) {
            mainWindow.webContents.send('streaming-overlay-opened');
          }
        }
      };

      // Send data immediately and also set up event listeners as fallback
      setTimeout(() => {
        sendDataSafely();
      }, 50);

      // Listen for DOM ready event
      streamingOverlayWindow.webContents.once('dom-ready', () => {
        domReadyFired = true;
        
        // Add a small delay to ensure JavaScript has executed and listener is set up
        setTimeout(() => {
          sendDataSafely();
        }, 100);
      });

      // Fallback: also listen for did-finish-load in case dom-ready doesn't work as expected
      streamingOverlayWindow.webContents.once('did-finish-load', () => {
        // If DOM ready already fired, send immediately with a small delay
        // Otherwise, wait a bit longer to ensure everything is ready
        const delay = domReadyFired ? 50 : 200;
        setTimeout(() => {
          sendDataSafely();
        }, delay);
      });

      streamingOverlayWindow.webContents.on('did-stop-loading', () => {
        // Optional: could add loading completion logic here
      });

      // Handle window close
      streamingOverlayWindow.on('closed', () => {
        streamingOverlayWindow = null;
        
        // Notify main window that overlay was closed
        // Get the main window (the one that's not the overlay window)
        const allWindows = BrowserWindow.getAllWindows();
        const mainWindow = allWindows.find(win => win !== streamingOverlayWindow && !win.isDestroyed());
        if (mainWindow) {
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
  },

  'close-streaming-overlay': async (event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
    try {
      if (streamingOverlayWindow && !streamingOverlayWindow.isDestroyed()) {
        streamingOverlayWindow.close();
        streamingOverlayWindow = null;
        return { success: true };
      } else {
        return { success: false, error: 'Streaming overlay window not open' };
      }
    } catch (error) {
      console.error('Error closing streaming overlay:', error);
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
