/**
 * Fast OCR Service using DXCam + PaddleOCR
 * Ultra-fast screen region OCR processing for real-time loot detection
 * Integrated with template-based item matching for BDO Loot Bot
 */
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { OCRRegion } from '../../renderer/types';
import { BDOLootBot } from './bdoLootBot';

interface OCRResult {
  text: string;
  confidence: number;
  bbox: number[][];
}

interface OCRResponse {
  success: boolean;
  texts?: OCRResult[];
  error?: string;
  stats?: {
    total_time: number;
    capture_time: number;
    preprocess_time: number;
    ocr_time: number;
    region: OCRRegion;
  };
  debug_image?: string;
}

export interface FastOCRProcessingResult {
  success: boolean;
  itemsFound?: number;
  items?: Array<{
    item: string;
    quantity: number;
    confidence: number;
    method: 'exact' | 'fuzzy';
    originalText: string;
    bbox: number[][];
  }>;
  stats?: {
    total_time: number;
    capture_time: number;
    preprocess_time: number;
    ocr_time: number;
    region: OCRRegion;
  };
  error?: string;
  debug_image?: string;
}

export class FastOCRService {
  private ocrProcess: ChildProcess | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<boolean> | null = null;
  private lootBot: BDOLootBot | null = null;
  private currentRegion: OCRRegion | null = null;
  private isProcessingActive: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('[FastOCR] Creating new FastOCR service instance');
    // Initialize BDOLootBot for template matching
    this.lootBot = new BDOLootBot();
  }

  /**
   * Initialize the OCR worker process
   */
  public async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<boolean> {
    try {
      console.log('[FastOCR] Initializing DXCam + PaddleOCR worker...');
      
      // Initialize BDOLootBot for template matching only (no OCR required)
      console.log('[FastOCR] Initializing BDOLootBot for template matching only...');
      const lootBotInitialized = this.lootBot!.initializeTemplateMatchingOnly();
      if (!lootBotInitialized) {
        console.error('[FastOCR] Failed to initialize BDOLootBot template matching');
        // Continue anyway since we might be able to work without it
      } else {
        console.log('[FastOCR] BDOLootBot template matching initialized successfully');
      }
      
      // Path to the Python worker script - use process.cwd() as base
      const projectRoot = process.cwd();
      const scriptPath = path.join(projectRoot, 'resources', 'scripts', 'fast_ocr_worker.py');
      const pythonPath = path.join(projectRoot, 'resources', 'python', 'python.exe');

      console.log('[FastOCR] Project root:', projectRoot);
      console.log('[FastOCR] Script path:', scriptPath);
      console.log('[FastOCR] Python path:', pythonPath);

      // Verify files exist
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`FastOCR worker script not found at: ${scriptPath}`);
      }
      if (!fs.existsSync(pythonPath)) {
        throw new Error(`Python executable not found at: ${pythonPath}`);
      }

      // Spawn the OCR worker process
      this.ocrProcess = spawn(pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      // Set up error handling
      this.ocrProcess.on('error', (error) => {
        console.error('[FastOCR] Process error:', error);
        this.isInitialized = false;
      });

      this.ocrProcess.on('exit', (code) => {
        console.log('[FastOCR] Process exited with code:', code);
        this.isInitialized = false;
      });

      // Handle stderr for debugging
      if (this.ocrProcess.stderr) {
        this.ocrProcess.stderr.on('data', (data) => {
          console.log('[FastOCR Debug]', data.toString().trim());
        });
      }

      // Send initialization command
      const initCommand = JSON.stringify({ action: 'initialize' }) + '\n';
      this.ocrProcess.stdin?.write(initCommand);

      // Wait for initialization response with longer timeout for PaddleOCR model download
      const response = await this.readResponse(60000); // 60 second timeout for initialization
      
      if (response.success) {
        this.isInitialized = true;
        console.log('[FastOCR] Successfully initialized DXCam + PaddleOCR');
        console.log('[FastOCR] - DXCam screen capture: Ready');
        console.log('[FastOCR] - PaddleOCR engine: Ready');
        return true;
      } else {
        console.error('[FastOCR] Initialization failed:', response.error);
        this.cleanup();
        return false;
      }

    } catch (error) {
      console.error('[FastOCR] Initialization error:', error);
      this.cleanup();
      return false;
    }
  }

  /**
   * Process a screen region using DXCam capture + PaddleOCR
   */
  public async processRegion(region: OCRRegion): Promise<OCRResponse> {
    if (!this.isInitialized || !this.ocrProcess) {
      return { success: false, error: 'OCR service not initialized' };
    }

    try {
      // Send OCR request
      const request = {
        action: 'process',
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height
      };

      const requestLine = JSON.stringify(request) + '\n';
      this.ocrProcess.stdin?.write(requestLine);

      // Get response
      const response = await this.readResponse();
      
      // Log performance stats
      if (response.success && response.stats) {
        console.log(`[FastOCR] Processed region in ${response.stats.total_time}ms ` +
                   `(capture: ${response.stats.capture_time}ms, OCR: ${response.stats.ocr_time}ms) ` +
                   `- Found ${response.texts?.length || 0} text regions`);
      }

      return response;

    } catch (error) {
      console.error('[FastOCR] Process region error:', error);
      return { success: false, error: `Processing failed: ${error}` };
    }
  }

  /**
   * Test if the OCR service is working
   */
  public async test(): Promise<boolean> {
    if (!this.isInitialized || !this.ocrProcess) {
      return false;
    }

    try {
      const testCommand = JSON.stringify({ action: 'test' }) + '\n';
      this.ocrProcess.stdin?.write(testCommand);

      const response = await this.readResponse();
      return response.success;

    } catch (error) {
      console.error('[FastOCR] Test failed:', error);
      return false;
    }
  }

  /**
   * Set the grind location for BDOLootBot template matching
   */
  public async setGrindLocation(locationName: string, locationId: number): Promise<{ success: boolean; error?: string }> {
    if (!this.lootBot) {
      return { success: false, error: 'BDOLootBot not initialized' };
    }

    console.log(`[FastOCR] Setting grind location: ${locationName} (ID: ${locationId})`);
    return await this.lootBot.setGrindLocation(locationName, locationId);
  }

  /**
   * Process screen region and match against BDO loot table items
   * Combines ultra-fast DXCam + PaddleOCR with template-based matching
   */
  public async processLootRegion(region: OCRRegion): Promise<FastOCRProcessingResult> {
    if (!this.isInitialized || !this.ocrProcess) {
      return { 
        success: false, 
        error: 'FastOCR service not initialized' 
      };
    }

    try {
      // Set current region for reference
      this.currentRegion = region;

      // Use ultra-fast DXCam + PaddleOCR to extract text from screen region
      const ocrResult = await this.processRegion(region);
      
      if (!ocrResult.success || !ocrResult.texts) {
        return {
          success: false,
          error: ocrResult.error || 'OCR processing failed',
          stats: ocrResult.stats
        };
      }

      console.log(`[FastOCR] OCR extracted ${ocrResult.texts.length} text regions`);

      // Use BDOLootBot to match against loot table items
      if (this.lootBot && ocrResult.texts.length > 0) {
        // Convert FastOCR results to format expected by BDOLootBot
        const ocrResults = ocrResult.texts.map(text => ({
          text: text.text,
          confidence: text.confidence,
          bbox: text.bbox
        }));

        // Use the public matchItemsFromOCR method
        const lootMatches = this.lootBot.matchItemsFromOCR(ocrResults);
        
        if (lootMatches.length > 0) {
          console.log(`[FastOCR] ✅ FOUND ${lootMatches.length} LOOT MATCHES!`);
          lootMatches.forEach((match: any, index: number) => {
            console.log(`  ${index + 1}. "${match.item}" x${match.quantity} (${Math.round(match.confidence * 100)}% confidence, ${match.method})`);
          });

          const items = lootMatches.map((match: any) => ({
            item: match.item,
            quantity: match.quantity,
            confidence: match.confidence,
            method: match.method,
            originalText: match.originalText,
            bbox: match.bbox || []
          }));

          return {
            success: true,
            itemsFound: items.length,
            items: items,
            stats: ocrResult.stats,
            debug_image: ocrResult.debug_image
          };
        } else {
          console.log(`[FastOCR] ❌ No loot items matched from ${ocrResult.texts.length} OCR text results`);
          // Still return the OCR text results for debugging
          const items = ocrResult.texts.map(text => ({
            item: text.text,
            quantity: 1,
            confidence: text.confidence,
            method: 'exact' as 'exact' | 'fuzzy',
            originalText: text.text,
            bbox: text.bbox || []
          }));

          return {
            success: true,
            itemsFound: 0, // No actual loot matches
            items: items, // Raw OCR results for debugging
            stats: ocrResult.stats,
            debug_image: ocrResult.debug_image
          };
        }
      }

      // Fallback: return OCR results directly if no BDOLootBot available
      const items = ocrResult.texts.map(text => ({
        item: text.text,
        quantity: 1, // Default quantity
        confidence: text.confidence,
        method: 'exact' as 'exact' | 'fuzzy',
        originalText: text.text,
        bbox: text.bbox || []
      }));

      console.log(`[FastOCR] Found ${items.length} text regions (no loot matching available)`);

      return {
        success: true,
        itemsFound: items.length,
        items: items,
        stats: ocrResult.stats,
        debug_image: ocrResult.debug_image
      };

    } catch (error) {
      console.error('[FastOCR] Loot region processing error:', error);
      return { 
        success: false, 
        error: `Loot processing failed: ${error}`,
        stats: this.currentRegion ? {
          total_time: 0,
          capture_time: 0,
          preprocess_time: 0,
          ocr_time: 0,
          region: this.currentRegion
        } : undefined
      };
    }
  }

  /**
   * Start continuous loot monitoring on the designated OCR region
   * Processes loot drops in real-time with sub-second latency
   */
  public async startLootMonitoring(region: OCRRegion, intervalMs: number = 250): Promise<boolean> {
    if (this.isProcessingActive) {
      console.log('[FastOCR] Loot monitoring already active');
      return false;
    }

    if (!this.isInitialized) {
      console.error('[FastOCR] Service not properly initialized for monitoring');
      return false;
    }

    console.log(`[FastOCR] Starting continuous loot monitoring on region ${region.x},${region.y} ${region.width}x${region.height} every ${intervalMs}ms`);
    
    this.currentRegion = region;
    this.isProcessingActive = true;

    // Start the monitoring interval
    this.processingInterval = setInterval(async () => {
      try {
        const result = await this.processLootRegion(region);
        
        if (result.success && result.items && result.items.length > 0) {
          console.log(`[FastOCR] Detected ${result.items.length} text items in ${result.stats?.total_time}ms:`);
          result.items.forEach((item, index) => {
            console.log(`  ${index + 1}. "${item.originalText}" (${Math.round(item.confidence * 100)}% confidence)`);
          });
        }
        
      } catch (error) {
        console.error('[FastOCR] Error during continuous monitoring:', error);
      }
    }, intervalMs);

    return true;
  }

  /**
   * Stop continuous loot monitoring
   */
  public stopLootMonitoring(): void {
    if (!this.isProcessingActive) {
      console.log('[FastOCR] No active monitoring to stop');
      return;
    }

    console.log('[FastOCR] Stopping continuous loot monitoring');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.isProcessingActive = false;
    this.currentRegion = null;
  }

  /**
   * Get current monitoring status
   */
  public getMonitoringStatus(): { active: boolean; region?: OCRRegion; interval?: number } {
    return {
      active: this.isProcessingActive,
      region: this.currentRegion || undefined
    };
  }

  /**
   * Clean up the OCR process
   */
  public cleanup(): void {
    console.log('[FastOCR] Cleaning up OCR process...');
    
    // Stop any active monitoring
    this.stopLootMonitoring();

    if (this.ocrProcess) {
      try {
        this.ocrProcess.kill();
      } catch (error) {
        console.error('[FastOCR] Error killing process:', error);
      }
      this.ocrProcess = null;
    }

    this.isInitialized = false;
    this.initializationPromise = null;
    console.log('[FastOCR] Cleanup completed');
  }

  /**
   * Restart the FastOCR service (cleanup and reinitialize)
   */
  public async restart(): Promise<boolean> {
    console.log('[FastOCR] Restarting FastOCR service...');
    this.cleanup();
    return await this.initialize();
  }

  /**
   * Read a JSON response from the OCR process
   */
  private async readResponse(timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ocrProcess?.stdout) {
        reject(new Error('No stdout available'));
        return;
      }

      let buffer = '';
      
      const onData = (data: Buffer) => {
        buffer += data.toString();
        
        // Look for complete JSON line
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);
              this.ocrProcess!.stdout!.removeListener('data', onData);
              resolve(response);
              return;
            } catch (error) {
              // Continue looking for valid JSON
            }
          }
        }
        // Keep the incomplete line for next data chunk
        buffer = lines[lines.length - 1];
      };

      this.ocrProcess.stdout.on('data', onData);

      // Set timeout to prevent hanging
      setTimeout(() => {
        this.ocrProcess!.stdout!.removeListener('data', onData);
        reject(new Error('OCR response timeout'));
      }, timeoutMs);
    });
  }

  /**
   * Check if the service is ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.ocrProcess !== null;
  }

  /**
   * Convert OCR results to the format expected by BDO loot bot
   */
  public static convertToBDOFormat(ocrResults: OCRResult[]): any[] {
    return ocrResults.map(result => ({
      text: result.text,
      confidence: result.confidence,
      bbox: result.bbox
    }));
  }
}

// Export a singleton instance
export const fastOCRService = new FastOCRService();
