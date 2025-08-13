import { IpcMainInvokeEvent, BrowserWindow, screen, desktopCapturer } from 'electron';
import * as path from 'path';

interface OCRRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  display?: string;
}

let regionSelectorWindow: BrowserWindow | null = null;

export const regionSelectorHandlers = {
  'select-ocr-region': async (event: IpcMainInvokeEvent): Promise<{ success: boolean; region?: OCRRegion; error?: string }> => {
    try {
      // Close existing selector window if open
      if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
        regionSelectorWindow.close();
      }

      // Get all displays
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();

      // Create overlay window for region selection
      regionSelectorWindow = new BrowserWindow({
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height,
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: true,
        focusable: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../../core/preload.js'),
        },
      });

      // Load the region selector HTML
      await regionSelectorWindow.loadFile(path.join(__dirname, 'regionSelector.html'));

      // Return a promise that resolves when region is selected
      return new Promise((resolve) => {
        if (!regionSelectorWindow) {
          resolve({ success: false, error: 'Failed to create selector window' });
          return;
        }

        // Handle region selection
        regionSelectorWindow.webContents.once('ipc-message', (event, channel, data) => {
          if (channel === 'region-selected') {
            const region: OCRRegion = {
              x: Math.round(data.x),
              y: Math.round(data.y),
              width: Math.round(data.width),
              height: Math.round(data.height),
              display: data.display || primaryDisplay.label
            };

            resolve({ success: true, region });
            
            // Close the selector window
            if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
              regionSelectorWindow.close();
            }
          } else if (channel === 'region-cancelled') {
            resolve({ success: false, error: 'Region selection cancelled' });
            
            // Close the selector window
            if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
              regionSelectorWindow.close();
            }
          }
        });

        // Handle window close
        regionSelectorWindow.on('closed', () => {
          regionSelectorWindow = null;
          resolve({ success: false, error: 'Region selection cancelled' });
        });

        // Send display info to renderer
        regionSelectorWindow.webContents.once('dom-ready', () => {
          if (regionSelectorWindow) {
            regionSelectorWindow.webContents.send('display-info', {
              displays: displays.map(d => ({
                id: d.id,
                label: d.label,
                bounds: d.bounds,
                workArea: d.workArea,
                scaleFactor: d.scaleFactor
              })),
              primary: primaryDisplay.id
            });
          }
        });
      });

    } catch (error) {
      console.error('Error in OCR region selection:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

// Clean up function
export const cleanupRegionSelector = () => {
  if (regionSelectorWindow && !regionSelectorWindow.isDestroyed()) {
    regionSelectorWindow.close();
    regionSelectorWindow = null;
  }
};
