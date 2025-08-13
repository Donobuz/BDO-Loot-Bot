/**
 * Continuous OCR API handlers for main process
 */

import { IpcMainInvokeEvent } from 'electron';
import { continuousOcrService } from '../../services/ocr/continuousOcrService';
import { Item } from '../../renderer/types';
import * as path from 'path';
import * as os from 'os';

export const continuousOCRHandlers = {
  'continuous-ocr-start': async (
    event: IpcMainInvokeEvent, 
    config: { 
      region: { x: number; y: number; width: number; height: number };
      interval?: number;
      outputFileName?: string;
      knownItems?: Item[];
    }
  ): Promise<{ success: boolean; error?: string; outputPath?: string }> => {
    try {
      // Initialize if not already done
      await continuousOcrService.initialize();

      // Set default interval if not provided (200ms for real-time detection)
      const interval = config.interval || 200;

      // Generate output file path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = config.outputFileName || `hybrid-ocr-session-${timestamp}.txt`;
      const outputPath = path.join(os.homedir(), 'Documents', 'BDO-Loot-Bot-OCR', fileName);

      const sessionConfig = {
        region: config.region,
        interval,
        outputPath,
        knownItems: config.knownItems || []
      };

      const result = await continuousOcrService.startSession(sessionConfig);
      
      if (result.success) {
        return { 
          success: true, 
          outputPath 
        };
      } else {
        return result;
      }

    } catch (error) {
      console.error('Error starting continuous OCR:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  'continuous-ocr-stop': async (event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
    try {
      return await continuousOcrService.stopSession();
    } catch (error) {
      console.error('Error stopping continuous OCR:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },

  'continuous-ocr-status': async (event: IpcMainInvokeEvent): Promise<{ 
    success: boolean; 
    isRunning: boolean; 
    stats?: { 
      ocrCount: number; 
      sessionDuration?: number; 
      averageProcessingTime?: number 
    };
    error?: string 
  }> => {
    try {
      const stats = continuousOcrService.getSessionStats();
      return {
        success: true,
        isRunning: stats.isRunning,
        stats: {
          ocrCount: stats.ocrCount,
          sessionDuration: stats.sessionDuration,
          averageProcessingTime: stats.averageProcessingTime
        }
      };
    } catch (error) {
      console.error('Error getting continuous OCR status:', error);
      return { 
        success: false, 
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
};

// Cleanup function for when the app is closing
export const cleanupContinuousOCR = async () => {
  try {
    if (continuousOcrService.isSessionActive()) {
      await continuousOcrService.stopSession();
    }
  } catch (error) {
    console.error('Error during continuous OCR cleanup:', error);
  }
};
