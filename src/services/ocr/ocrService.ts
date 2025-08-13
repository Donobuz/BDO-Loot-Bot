/**
 * OCR Service Manager for BDO Loot Bot
 * Fast bundleable OCR solution using Node.js
 */

import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

export interface OCRRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRResult {
  success: boolean;
  results?: Array<{
    text: string;
    confidence: number;
    bbox: number[][];
  }>;
  processing_time?: number;
  total_text?: string;
  error?: string;
}

export interface ItemExtractionResult {
  success: boolean;
  items?: Array<{
    name: string;
    confidence: number;
    bbox: number[][];
  }>;
  processing_time?: number;
  raw_results?: Array<{
    text: string;
    confidence: number;
    bbox: number[][];
  }>;
  error?: string;
}

export class OCRService {
  private isInitialized: boolean = false;
  private ocrWorker: any = null;

  constructor() {
    // No external dependencies needed - everything is bundled
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize the OCR engine - using a lightweight approach
      // This could be expanded to use TensorFlow.js models or other bundled solutions
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize OCR service: ${error}`);
    }
  }

  private async preprocessImage(imagePath: string, region?: OCRRegion): Promise<Buffer> {
    try {
      let image = sharp(imagePath);
      
      // Crop to region if specified
      if (region) {
        image = image.extract({
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height
        });
      }

      // Optimize for text recognition
      const processedBuffer = await image
        .grayscale()
        .normalize()
        .sharpen()
        .threshold(128) // Convert to black and white for better text recognition
        .png()
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      throw new Error(`Image preprocessing failed: ${error}`);
    }
  }

  private async performFastOCR(imageBuffer: Buffer): Promise<Array<{text: string, confidence: number, bbox: number[][]}>> {
    try {
      // Use our custom fast text recognition
      const { FastTextRecognition } = await import('./fastTextRecognition');
      const textRegions = await FastTextRecognition.extractText(imageBuffer);
      
      // Convert to the expected format
      const results = textRegions.map(region => ({
        text: region.text,
        confidence: region.confidence,
        bbox: [
          [region.bbox.x, region.bbox.y],
          [region.bbox.x + region.bbox.width, region.bbox.y],
          [region.bbox.x + region.bbox.width, region.bbox.y + region.bbox.height],
          [region.bbox.x, region.bbox.y + region.bbox.height]
        ]
      }));

      return results;
    } catch (error) {
      console.error('Fast OCR failed:', error);
      return [];
    }
  }

  private filterItems(results: Array<{text: string, confidence: number, bbox: number[][]}>): Array<{name: string, confidence: number, bbox: number[][]}> {
    const items: Array<{name: string, confidence: number, bbox: number[][]}> = [];
    
    for (const result of results) {
      const text = result.text.trim();
      
      // Filter out obvious UI elements and short/meaningless text
      if (result.confidence >= 0.6 && text.length >= 3) {
        // Check if it's not a common UI element
        const uiFilters = [
          /^hp$/i, /^mp$/i, /^lv$/i, /^level$/i, /^silver$/i, /^weight$/i,
          /^durability$/i, /^energy$/i, /^contribution$/i, /^close$/i,
          /^cancel$/i, /^ok$/i, /^yes$/i, /^no$/i, /^confirm$/i, /^system$/i,
          /^you have obtained$/i, /^obtained$/i, /^\d+$/
        ];
        
        const isUIElement = uiFilters.some(pattern => pattern.test(text));
        if (!isUIElement) {
          items.push({
            name: text,
            confidence: result.confidence,
            bbox: result.bbox
          });
        }
      }
    }

    return items;
  }

  async extractTextFromImage(imagePath: string, region?: OCRRegion): Promise<OCRResult> {
    await this.initialize();

    try {
      const startTime = Date.now();
      
      // Preprocess the image
      const processedBuffer = await this.preprocessImage(imagePath, region);
      
      // Perform OCR
      const results = await this.performFastOCR(processedBuffer);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        results: results,
        processing_time: processingTime,
        total_text: results.map(r => r.text).join(' ')
      };
    } catch (err) {
      return {
        success: false,
        error: `OCR processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
    }
  }

  async extractItemsFromImage(imagePath: string, region?: OCRRegion): Promise<ItemExtractionResult> {
    await this.initialize();

    try {
      const startTime = Date.now();
      
      // Preprocess the image
      const processedBuffer = await this.preprocessImage(imagePath, region);
      
      // Perform OCR
      const rawResults = await this.performFastOCR(processedBuffer);
      
      // Filter for BDO items
      const items = this.filterItems(rawResults);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        items: items,
        processing_time: processingTime,
        raw_results: rawResults
      };
    } catch (err) {
      return {
        success: false,
        error: `Item extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
    }
  }

  async installDependencies(): Promise<{ success: boolean; error?: string }> {
    // No external dependencies to install - everything is bundled!
    return { success: true };
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const ocrService = new OCRService();
