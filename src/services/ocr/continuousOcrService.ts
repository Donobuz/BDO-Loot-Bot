/**
 * Continuous OCR Service for BDO Loot Bot
 * Runs OCR continuously during active sessions
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { screen, desktopCapturer } from 'electron';
import { OCRService, OCRRegion } from './ocrService';
import { Item } from '../../renderer/types';

interface OCRSessionConfig {
  region: OCRRegion;
  interval: number; // milliseconds between OCR attempts
  outputPath: string; // path to save OCR results
  knownItems: Item[]; // Items from the loot table for template matching
}

interface OCRLogEntry {
  timestamp: string;
  text: string;
  confidence: number;
  processingTime: number;
  method: 'template' | 'ocr' | 'hybrid';
  itemId?: number;
  quantity?: number;
}

interface DetectedMessage {
  text: string;
  timestamp: number;
  count: number;
}

export class ContinuousOCRService {
  private isRunning: boolean = false;
  private ocrService: OCRService;
  private sessionConfig: OCRSessionConfig | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private logFileStream: fs.WriteStream | null = null;
  private sessionStartTime: Date | null = null;
  private lastOCRTime: number = 0;
  private ocrCount: number = 0;
  
  // Duplicate detection
  private recentMessages: DetectedMessage[] = [];
  private lastScreenshotHash: string | null = null;
  private readonly DUPLICATE_WINDOW = 3000; // 3 seconds to handle slow transitions

  constructor() {
    this.ocrService = new OCRService();
  }

  async initialize(): Promise<void> {
    await this.ocrService.initialize();
    // Hybrid service will be initialized when starting a session with known items
  }

  async startSession(config: OCRSessionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.isRunning) {
        await this.stopSession();
      }

      // Validate the region before starting
      const normalizedRegion = this.normalizeRegion(config.region);
      if (!normalizedRegion) {
        return { 
          success: false, 
          error: `Invalid OCR region: x=${config.region.x}, y=${config.region.y}, width=${config.region.width}, height=${config.region.height}. Width and height must be positive, minimum 300x100 pixels.` 
        };
      }

      console.log(`Starting OCR with normalized region:`, normalizedRegion);

      // Initialize OCR service with known items for template matching
      this.ocrService.initializeWithKnownItems(config.knownItems);
      console.log(`OCR initialized with ${config.knownItems.length} known items for template matching`);

      this.sessionConfig = {
        ...config,
        region: normalizedRegion // Use the normalized region
      };
      this.sessionStartTime = new Date();
      this.ocrCount = 0;
      
      // Reset duplicate detection for new session
      this.recentMessages = [];
      this.lastScreenshotHash = null;

      // Ensure output directory exists
      const outputDir = path.dirname(config.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Create log file with session header
      this.logFileStream = fs.createWriteStream(config.outputPath, { flags: 'w' });
      this.writeHeader();

      // Start OCR loop
      this.isRunning = true;
      this.startOCRLoop();

      console.log(`Continuous OCR session started. Output: ${config.outputPath}`);
      return { success: true };

    } catch (error) {
      console.error('Failed to start continuous OCR session:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async stopSession(): Promise<{ success: boolean; error?: string }> {
    try {
      this.isRunning = false;

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      if (this.logFileStream) {
        this.writeFooter();
        this.logFileStream.end();
        this.logFileStream = null;
      }

      console.log('Continuous OCR session stopped');
      return { success: true };

    } catch (error) {
      console.error('Failed to stop continuous OCR session:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  isSessionActive(): boolean {
    return this.isRunning;
  }

  getSessionStats(): { 
    isRunning: boolean; 
    ocrCount: number; 
    sessionDuration?: number; 
    averageProcessingTime?: number 
  } {
    const sessionDuration = this.sessionStartTime 
      ? Date.now() - this.sessionStartTime.getTime() 
      : undefined;

    return {
      isRunning: this.isRunning,
      ocrCount: this.ocrCount,
      sessionDuration,
      averageProcessingTime: this.ocrCount > 0 ? this.lastOCRTime / this.ocrCount : undefined
    };
  }

  private isDuplicateMessage(newText: string): boolean {
    const now = Date.now();
    
    // Clean old messages (older than DUPLICATE_WINDOW)
    this.recentMessages = this.recentMessages.filter(
      msg => now - msg.timestamp < this.DUPLICATE_WINDOW
    );
    
    // Check for exact match or progressive update
    const exactMatch = this.recentMessages.find(msg => msg.text === newText);
    if (exactMatch) {
      exactMatch.count++;
      console.log(`Duplicate detected: "${newText}" (seen ${exactMatch.count} times)`);
      return true;
    }
    
    // Check for progressive updates (e.g., "Item" → "Item x5")
    const progressiveMatch = this.recentMessages.find(msg => 
      this.isProgressiveUpdate(newText, msg.text) || this.isProgressiveUpdate(msg.text, newText)
    );
    
    if (progressiveMatch) {
      // Update the message to the longer/more complete version
      if (newText.length > progressiveMatch.text.length) {
        progressiveMatch.text = newText;
        progressiveMatch.timestamp = now; // Reset timestamp for the updated message
      }
      progressiveMatch.count++;
      console.log(`Progressive update detected: "${progressiveMatch.text}" (update ${progressiveMatch.count})`);
      return true;
    }
    
    // New unique message
    this.recentMessages.push({
      text: newText,
      timestamp: now,
      count: 1
    });
    
    console.log(`New unique message: "${newText}"`);
    return false;
  }

  private isProgressiveUpdate(newText: string, oldText: string): boolean {
    // Handle cases like:
    // "Bruised Naga Fin" → "Bruised Naga Fin x5"
    // "You have obtained" → "You have obtained [Item] x3"
    if (oldText.length === 0 || newText.length === 0) return false;
    
    // Check if new text contains the old text as a substring
    return newText.includes(oldText) && newText.length > oldText.length;
  }

  private hasScreenChanged(screenshot: Buffer): boolean {
    // Quick hash to detect if screen content changed
    const hash = crypto.createHash('md5').update(screenshot).digest('hex');
    
    if (hash === this.lastScreenshotHash) {
      return false; // Same screenshot, no need to run OCR
    }
    
    this.lastScreenshotHash = hash;
    return true;
  }

  private startOCRLoop(): void {
    if (!this.sessionConfig) return;

    const performOCR = async () => {
      if (!this.isRunning || !this.sessionConfig) return;

      try {
        const startTime = Date.now();
        
        // Capture screenshot of the specified region
        const screenshot = await this.captureRegion(this.sessionConfig.region);
        if (!screenshot) {
          console.log('Failed to capture screenshot, skipping OCR');
          return;
        }

        // Quick screen change detection - skip OCR if screen hasn't changed
        if (!this.hasScreenChanged(screenshot)) {
          console.log(`OCR #${this.ocrCount + 1}: Screen unchanged, skipping OCR`);
          return;
        }

        // Save screenshot temporarily for OCR
        const tempScreenshotPath = path.join(__dirname, `temp_screenshot_${Date.now()}.png`);
        fs.writeFileSync(tempScreenshotPath, screenshot);

        try {
          // Use unified OCR service
          const ocrResult = await this.ocrService.extractTextFromImage(tempScreenshotPath);
          
          const processingTime = Date.now() - startTime;
          this.lastOCRTime += processingTime;
          this.ocrCount++;

          // Save debug screenshots more frequently for testing (every 10 attempts or when text found)
          const shouldSaveDebug = (this.ocrCount % 10 === 0) || 
            (ocrResult && ocrResult.success && ocrResult.total_text && ocrResult.total_text.trim());
          
          if (shouldSaveDebug) {
            const debugDir = path.join(process.cwd(), 'debug-screenshots');
            if (!fs.existsSync(debugDir)) {
              fs.mkdirSync(debugDir, { recursive: true });
            }
            const debugPath = path.join(debugDir, `ocr-debug-${this.ocrCount}-${Date.now()}.png`);
            fs.copyFileSync(tempScreenshotPath, debugPath);
            console.log(`Debug screenshot saved: ${debugPath}`);
          }

          // Debug logging for OCR results
          const textPreview = ocrResult.total_text ? 
            (ocrResult.total_text.length > 100 ? 
              ocrResult.total_text.substring(0, 100) + "..." : 
              ocrResult.total_text) : 'NONE';
          
          console.log(`OCR #${this.ocrCount}: Success=${ocrResult.success}, Text="${textPreview}", Results count=${ocrResult.results?.length || 0}`);
          
          if (ocrResult.success && ocrResult.total_text && ocrResult.total_text.trim()) {
            const cleanText = ocrResult.total_text.trim();
            
            // Check if this looks like a static list (same text repeated)
            const isLikelyStaticContent = cleanText.length > 200 && 
              (cleanText.includes("Ancient Relic Crystal Shard") || 
               cleanText.includes("Black Stone"));
            
            if (isLikelyStaticContent) {
              console.log(`⚠️  OCR #${this.ocrCount}: Detected static content (inventory/list), not logging as loot`);
            } else {
              // Check for duplicates before logging
              if (!this.isDuplicateMessage(cleanText)) {
                const logEntry: OCRLogEntry = {
                  timestamp: new Date().toISOString(),
                  text: cleanText,
                  confidence: this.calculateAverageConfidence(ocrResult.results || []),
                  processingTime,
                  method: 'ocr' // Default method
                };

                this.logOCRResult(logEntry);
                console.log(`✅ New loot detected: "${cleanText}" via OCR`);
              }
            }
          } else {
            // Log when no text found for debugging
            const errorMsg = ocrResult.error ? ` (Error: ${ocrResult.error})` : '';
            console.log(`OCR #${this.ocrCount}: No text detected (processing time: ${processingTime}ms)${errorMsg}`);
          }

        } finally {
          // Clean up temporary screenshot
          if (fs.existsSync(tempScreenshotPath)) {
            fs.unlinkSync(tempScreenshotPath);
          }
        }

      } catch (error) {
        console.error('OCR processing error:', error);
      }
    };

    // Start immediate OCR, then set interval
    performOCR();
    this.intervalId = setInterval(performOCR, this.sessionConfig.interval);
  }

  private async captureRegion(region: OCRRegion): Promise<Buffer | null> {
    try {
      // Validate and normalize region coordinates
      const normalizedRegion = this.normalizeRegion(region);
      if (!normalizedRegion) {
        console.error('Invalid OCR region:', region);
        return null;
      }

      // Use the primary display
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
      
      console.log(`Screen size: ${screenWidth}x${screenHeight}, OCR region: x=${normalizedRegion.x}, y=${normalizedRegion.y}, w=${normalizedRegion.width}, h=${normalizedRegion.height}`);

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: screenWidth, height: screenHeight } // Use actual screen size
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      const source = sources.find(s => s.display_id === primaryDisplay.id.toString()) || sources[0];

      // Get the full screen capture
      const thumbnail = source.thumbnail;
      const fullScreenBuffer = thumbnail.toPNG();
      const screenSize = thumbnail.getSize();

      console.log(`Thumbnail size: ${screenSize.width}x${screenSize.height}`);

      // Validate coordinates are within screen bounds
      if (normalizedRegion.x >= screenSize.width || normalizedRegion.y >= screenSize.height) {
        console.error(`OCR region is outside screen bounds. Region starts at (${normalizedRegion.x}, ${normalizedRegion.y}) but screen is only ${screenSize.width}x${screenSize.height}`);
        return null;
      }

      // Use Sharp to crop to the specified region with validated coordinates
      const sharp = require('sharp');
      const extractRegion = {
        left: Math.max(0, Math.min(normalizedRegion.x, screenSize.width - 1)),
        top: Math.max(0, Math.min(normalizedRegion.y, screenSize.height - 1)),
        width: Math.max(1, Math.min(normalizedRegion.width, screenSize.width - normalizedRegion.x)),
        height: Math.max(1, Math.min(normalizedRegion.height, screenSize.height - normalizedRegion.y))
      };

      const croppedBuffer = await sharp(fullScreenBuffer)
        .extract(extractRegion)
        .png()
        .toBuffer();

      return croppedBuffer;

    } catch (error) {
      console.error('Failed to capture region:', error);
      return null;
    }
  }

  private normalizeRegion(region: OCRRegion): OCRRegion | null {
    // Ensure we have valid coordinates
    if (typeof region.x !== 'number' || typeof region.y !== 'number' || 
        typeof region.width !== 'number' || typeof region.height !== 'number') {
      return null;
    }

    // If width or height is negative, it means the selection was made backwards
    // We need to adjust the coordinates accordingly
    let normalizedX = region.x;
    let normalizedY = region.y;
    let normalizedWidth = region.width;
    let normalizedHeight = region.height;

    // Fix negative width (drag from right to left)
    if (normalizedWidth < 0) {
      normalizedX = normalizedX + normalizedWidth; // Move x to the left
      normalizedWidth = Math.abs(normalizedWidth); // Make width positive
    }

    // Fix negative height (drag from bottom to top)
    if (normalizedHeight < 0) {
      normalizedY = normalizedY + normalizedHeight; // Move y up
      normalizedHeight = Math.abs(normalizedHeight); // Make height positive
    }

    // Ensure minimum size (enforce the same minimums as the region selector)
    if (normalizedWidth < 300 || normalizedHeight < 100) {
      console.error(`OCR region too small: ${normalizedWidth}x${normalizedHeight}. Minimum required: 300x100`);
      return null;
    }

    // Ensure coordinates are not negative
    normalizedX = Math.max(0, normalizedX);
    normalizedY = Math.max(0, normalizedY);

    return {
      x: Math.round(normalizedX),
      y: Math.round(normalizedY),
      width: Math.round(normalizedWidth),
      height: Math.round(normalizedHeight)
    };
  }

  private calculateAverageConfidence(results: Array<{ confidence: number }>): number {
    if (results.length === 0) return 0;
    const total = results.reduce((sum, result) => sum + result.confidence, 0);
    return Math.round((total / results.length) * 100) / 100;
  }

  private logOCRResult(entry: OCRLogEntry): void {
    if (!this.logFileStream) return;

    const methodStr = entry.method ? ` [${entry.method.toUpperCase()}]` : '';
    const itemIdStr = entry.itemId ? ` (ID: ${entry.itemId})` : '';
    const quantityStr = entry.quantity ? ` Qty: ${entry.quantity}` : '';
    
    const logLine = `[${entry.timestamp}]${methodStr} ${entry.text}${itemIdStr}${quantityStr} (confidence: ${entry.confidence}, processing: ${entry.processingTime}ms)\n`;
    this.logFileStream.write(logLine);

    // Also log to console for debugging
    console.log(`Hybrid OCR #${this.ocrCount}: "${entry.text}" (${entry.confidence} confidence, ${entry.processingTime}ms)${methodStr}`);
  }

  private writeHeader(): void {
    if (!this.logFileStream || !this.sessionConfig || !this.sessionStartTime) return;

    const header = `
================================================================================
BDO Loot Bot - OCR Session Log
================================================================================
Session Started: ${this.sessionStartTime.toISOString()}
OCR Region: x=${this.sessionConfig.region.x}, y=${this.sessionConfig.region.y}, width=${this.sessionConfig.region.width}, height=${this.sessionConfig.region.height}
OCR Interval: ${this.sessionConfig.interval}ms
================================================================================

`;
    this.logFileStream.write(header);
  }

  private writeFooter(): void {
    if (!this.logFileStream || !this.sessionStartTime) return;

    const sessionEnd = new Date();
    const sessionDuration = sessionEnd.getTime() - this.sessionStartTime.getTime();
    const avgProcessingTime = this.ocrCount > 0 ? this.lastOCRTime / this.ocrCount : 0;

    const footer = `

================================================================================
Session Summary
================================================================================
Session Ended: ${sessionEnd.toISOString()}
Total Duration: ${Math.round(sessionDuration / 1000)}s
Total OCR Attempts: ${this.ocrCount}
Average Processing Time: ${Math.round(avgProcessingTime)}ms
================================================================================
`;
    this.logFileStream.write(footer);
  }
}

// Export a singleton instance
export const continuousOcrService = new ContinuousOCRService();
