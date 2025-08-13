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
  private knownItems: any[] = [];
  private templateCache: Map<string, any> = new Map();

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

  initializeWithKnownItems(knownItems: any[]): void {
    console.log(`🎯 Initializing OCR with ${knownItems.length} known items for template matching...`);
    
    // Log the first few items to verify we're getting the right data
    console.log(`📋 Sample known items:`, knownItems.slice(0, 3).map(item => item.name || item));
    
    // Store known items and build template cache
    this.knownItems = knownItems;
    this.buildTemplateCache();
    
    console.log(`📊 Template matching ready for ${knownItems.length} items with ${this.templateCache.size} templates`);
  }

  private buildTemplateCache(): void {
    this.templateCache.clear();
    
    this.knownItems.forEach(item => {
      if (item && item.name) {
        const itemName = item.name.toLowerCase().trim();
        
        // Store multiple variations for matching
        const variations = [
          itemName,
          itemName.replace(/[^a-z0-9\s]/gi, ''), // Remove special chars
          itemName.replace(/\s+/g, ''), // Remove spaces
          itemName.replace(/\s+/g, '_'), // Spaces to underscores
        ];
        
        variations.forEach(variation => {
          this.templateCache.set(variation, {
            id: item.id,
            originalName: item.name,
            confidence: 0.9
          });
        });
      }
    });
    
    console.log(`� Built template cache with ${this.templateCache.size} searchable patterns`);
  }

  private performTemplateMatching(extractedText: string): Array<{
    text: string;
    confidence: number;
    bbox: number[][];
  }> {
    console.log(`🔍 Template matching: Checking "${extractedText}" against ${this.templateCache.size} patterns`);
    
    if (!extractedText || this.templateCache.size === 0) {
      console.log(`❌ Template matching skipped: no text (${!extractedText}) or no cache (${this.templateCache.size === 0})`);
      return [];
    }

    const matches: Array<{
      text: string;
      confidence: number;
      bbox: number[][];
    }> = [];
    const text = extractedText.toLowerCase();
    
    console.log(`🔎 Searching for patterns in: "${text}"`);
    
    // Look for known items in the extracted text
    for (const [pattern, itemData] of this.templateCache.entries()) {
      if (text.includes(pattern)) {
        // Extract quantity if present
        const quantityMatch = text.match(/x(\d+)|×(\d+)|\*(\d+)|(\d+)x/i);
        const quantity = quantityMatch ? 
          parseInt(quantityMatch[1] || quantityMatch[2] || quantityMatch[3] || quantityMatch[4]) : 1;
        
        const itemText = quantity > 1 ? `${itemData.originalName} x${quantity}` : itemData.originalName;
        
        matches.push({
          text: itemText,
          confidence: itemData.confidence,
          bbox: [[0, 0], [100, 0], [100, 20], [0, 20]] // Mock bbox for template matches
        });
        
        console.log(`✅ Template match: "${itemData.originalName}" x${quantity} (pattern: "${pattern}")`);
        break; // Found a match, don't check other patterns for this item
      }
    }
    
    if (matches.length === 0) {
      console.log(`❌ No template matches found for "${extractedText}"`);
    }
    
    return matches;
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
      
      // Get combined text for template matching
      const totalText = results.map(r => r.text).join(' ');
      
      // Try template matching first if we have known items
      let finalResults = results;
      if (this.templateCache.size > 0) {
        const templateMatches = this.performTemplateMatching(totalText);
        if (templateMatches.length > 0) {
          console.log(`🎯 Using template matching results: ${templateMatches.length} matches`);
          finalResults = templateMatches;
        } else {
          console.log(`🔍 No template matches found, using OCR results`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        results: finalResults,
        processing_time: processingTime,
        total_text: totalText
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
      
      // Get combined text for template matching
      const totalText = rawResults.map(r => r.text).join(' ');
      
      // Try template matching first if we have known items
      let items = this.filterItems(rawResults);
      if (this.templateCache.size > 0) {
        const templateMatches = this.performTemplateMatching(totalText);
        if (templateMatches.length > 0) {
          console.log(`🎯 Using template matching for item extraction: ${templateMatches.length} matches`);
          // Convert template matches to item format
          items = templateMatches.map(match => ({
            name: match.text,
            confidence: match.confidence,
            bbox: match.bbox
          }));
        } else {
          console.log(`🔍 No template matches found, using filtered OCR results`);
        }
      }
      
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
