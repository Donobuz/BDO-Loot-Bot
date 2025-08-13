import { IpcMainInvokeEvent, BrowserWindow } from 'electron';

interface SessionEventData {
  type: 'session-started' | 'session-stopped' | 'session-updated' | 'item-detected';
  sessionData?: {
    isActive: boolean;
    startTime?: string;
    location?: any;
    itemsDetected: number;
    itemCounts: Record<number, number>;
    items?: any[];
  };
}

export const sessionEventHandlers = {
  'broadcast-session-event': async (event: IpcMainInvokeEvent, eventData: SessionEventData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get all windows
      const allWindows = BrowserWindow.getAllWindows();
      
      // Send event to all windows (including overlay)
      allWindows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('session-event', eventData);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error broadcasting session event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};
