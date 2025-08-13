/**
 * OCR API - IPC handlers for OCR functionality
 */

import { IpcMainInvokeEvent } from 'electron';
import { ocrService, OCRRegion, OCRResult, ItemExtractionResult } from '../../services/ocr/ocrService';

export const ocrAPI = {
  'ocr-extract-text': async (
    event: IpcMainInvokeEvent, 
    imagePath: string, 
    region?: OCRRegion
  ): Promise<OCRResult> => {
    try {
      console.log(`Starting OCR text extraction for: ${imagePath}`);
      const result = await ocrService.extractTextFromImage(imagePath, region);
      console.log(`OCR text extraction completed in ${result.processing_time || 0}ms`);
      return result;
    } catch (error) {
      console.error('OCR text extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error'
      };
    }
  },

  'ocr-extract-items': async (
    event: IpcMainInvokeEvent, 
    imagePath: string, 
    region?: OCRRegion
  ): Promise<ItemExtractionResult> => {
    try {
      console.log(`Starting OCR item extraction for: ${imagePath}`);
      const result = await ocrService.extractItemsFromImage(imagePath, region);
      console.log(`OCR item extraction completed in ${result.processing_time || 0}ms`);
      return result;
    } catch (error) {
      console.error('OCR item extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error'
      };
    }
  },

  'ocr-install-dependencies': async (event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Installing OCR dependencies...');
      const result = await ocrService.installDependencies();
      if (result.success) {
        console.log('OCR dependencies installed successfully');
      } else {
        console.error('Failed to install OCR dependencies:', result.error);
      }
      return result;
    } catch (error) {
      console.error('OCR dependency installation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown installation error'
      };
    }
  },

  'ocr-is-ready': async (event: IpcMainInvokeEvent): Promise<boolean> => {
    try {
      return ocrService.isReady();
    } catch (error) {
      console.error('OCR ready check error:', error);
      return false;
    }
  },

  'ocr-initialize': async (event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
    try {
      await ocrService.initialize();
      return { success: true };
    } catch (error) {
      console.error('OCR initialization error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error'
      };
    }
  }
};
