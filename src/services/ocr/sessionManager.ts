import { ScreenCapture, CaptureRegion, CaptureResult } from './screenCapture';
import { BDOLootBot } from './bdoLootBot';
import { fastOCRService, FastOCRService } from './fastOCR';
import { UserPreferences } from '../db/types/user';
import * as fs from 'fs';
import * as path from 'path';
import { app, BrowserWindow } from 'electron';

export interface SessionConfig {
    captureInterval: number; // milliseconds between captures
    ocrRegion: CaptureRegion;
    location: string;
    saveScreenshots: boolean; // Whether to save screenshots during session
}

export interface SessionStats {
    capturesPerformed: number;
    successfulCaptures: number;
    failedCaptures: number;
    itemsDetected: number;
    lastCaptureTime: number | null;
    sessionStartTime: number;
    averageProcessingTime: number;
}

interface QueuedOCRTask {
    region: CaptureRegion;
    captureStartTime: number;
    taskId: number;
}

export class SessionManager {
    private static instance: SessionManager;
    private screenCapture: ScreenCapture;
    private lootBot: BDOLootBot;
    private fastOCR: FastOCRService;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private config: SessionConfig | null = null;
    private stats: SessionStats = this.createInitialStats();
    private processingTimes: number[] = [];
    private ocrQueue: QueuedOCRTask[] = [];
    private isProcessingQueue: boolean = false;
    private taskIdCounter: number = 0;
    private sessionScreenshotDir: string | null = null;

    // Session State Synchronization
    private lastKnownSessionState: Map<string, number> = new Map();
    private stateCheckInterval: NodeJS.Timeout | null = null;
    private readonly STATE_SYNC_INTERVAL_MS = 500; // Check state every 500ms
    private totalOCRItemsDetected: number = 0;
    private totalTemplateMatches: number = 0;
    private totalSessionUpdates: number = 0;
    private recentOCRResults: Array<{text: string, timestamp: number, y: number, confidence: number, bbox?: number[][]}> = [];
    // Extended deduplication window for longer grinding sessions
    private readonly OCR_DEDUPLICATION_WINDOW_MS = 6000; // Increased from 4000ms to 6 seconds
    private readonly MIN_CONFIDENCE_THRESHOLD = 0.50; // Further lowered from 0.60 - catch even more marginal detections
    private readonly MAX_DEDUPLICATION_HISTORY = 100; // Reduced from 200 - more aggressive cleanup for long sessions

    // Normalize text for quantity-aware deduplication - BDO specific format
    private normalizeTextForDeduplication(text: string): string {
        // BDO loot format is always "Item Name x [number]"
        // Remove the "x [number]" part to normalize for deduplication
        return text
            .replace(/\s+x\s+\d+\s*$/i, '') // Remove " x 3", " x 15", etc. at end of string
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .toLowerCase();
    }

    private emitToRenderer(event: string, data: any): void {
        const mainWindow = BrowserWindow.getAllWindows().find(window => !window.isDestroyed());
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send(event, data);
        }
    }

    private constructor() {
        this.screenCapture = new ScreenCapture();
        this.lootBot = new BDOLootBot();
        this.fastOCR = fastOCRService;
    }

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    private createInitialStats(): SessionStats {
        return {
            capturesPerformed: 0,
            successfulCaptures: 0,
            failedCaptures: 0,
            itemsDetected: 0,
            lastCaptureTime: null,
            sessionStartTime: Date.now(),
            averageProcessingTime: 0
        };
    }

    public async initialize(): Promise<boolean> {
        try {
            console.log('Initializing session manager...');
            
            // Initialize FastOCR engine
            console.log('Initializing FastOCR (DXCam + PaddleOCR) - this may take a few seconds...');
            const fastOcrInitialized = await this.fastOCR.initialize();
            
            if (!fastOcrInitialized) {
                console.error('Failed to initialize FastOCR engine');
                return false;
            }
            
            // Initialize BDOLootBot for template matching (no OCR needed)
            console.log('Initializing BDOLootBot for session tracking...');
            const lootBotInitialized = this.lootBot.initializeTemplateMatchingOnly();
            
            if (!lootBotInitialized) {
                console.error('Failed to initialize BDOLootBot for session tracking');
                return false;
            }
            
            console.log('BDOLootBot initialized successfully for session tracking');
            console.log('Session Manager initialized successfully with FastOCR');
            return true;
        } catch (error) {
            console.error('Error initializing session manager:', error);
            return false;
        }
    }

    // Process OCR queue using FastOCR direct screen capture
    private async processOCRQueue(): Promise<void> {
        if (this.isProcessingQueue || this.ocrQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        console.log(`Starting FastOCR queue processing. Queue length: ${this.ocrQueue.length}`);

        while (this.ocrQueue.length > 0 && this.isRunning) { // Stop immediately if session is stopped
            const task = this.ocrQueue.shift();
            if (!task) continue;

            // Check if session was stopped while processing
            if (!this.isRunning) {
                console.log(`Session stopped - aborting queue processing with ${this.ocrQueue.length} remaining tasks`);
                break;
            }

            console.log(`Processing FastOCR task ${task.taskId} (${this.ocrQueue.length} remaining in queue)`);
            
            const processStartTime = Date.now();
            try {
                // Use FastOCR to process the region with integrated loot detection
                const lootResult = await this.fastOCR.processLootRegion(task.region);
                const processTime = Date.now() - processStartTime;
                console.log(`FastOCR task ${task.taskId} took: ${processTime}ms`);

                if (!lootResult.success) {
                    throw new Error(lootResult.error || 'FastOCR loot processing failed');
                }

                const processedItems = lootResult.items || [];

                // Screenshot saving disabled for performance

                if (processedItems.length > 0) {
                    console.log(`FastOCR task ${task.taskId} successful. Items found: ${processedItems.length}`);
                    console.log(`📝 FAST OCR RAW RESULTS (Task ${task.taskId}):`);
                    processedItems.forEach((item, i) => {
                        console.log(`  ${i + 1}. "${item.originalText}" (confidence: ${(item.confidence * 100).toFixed(1)}%) [${item.bbox ? 'has bbox' : 'no bbox'}]`);
                    });
                    
                    // Update running totals
                    this.totalOCRItemsDetected += processedItems.length;
                    console.log(`📊 RUNNING TOTALS: OCR detected ${this.totalOCRItemsDetected} items so far`);
                    
                    console.log(`🎯 PROCESSING ITEMS THROUGH BDOLOOTBOT TEMPLATE MATCHING:`);
                    
                    // Convert FastOCR results to format expected by BDOLootBot
                    const ocrResults = processedItems.map(item => ({
                        text: item.originalText,
                        confidence: item.confidence,
                        bbox: item.bbox || [[0, 0], [0, 0], [0, 0], [0, 0]]
                    }));
                    
                    console.log(`  - Raw OCR results: ${ocrResults.length} items`);
                    console.log(`  - Raw OCR text: [${ocrResults.map(r => `"${r.text}"`).join(', ')}]`);
                    
                    // Apply deduplication BEFORE sending to BDOLootBot
                    const uniqueOcrResults = this.deduplicateOCRResults(ocrResults);
                    
                    console.log(`  - After deduplication: ${uniqueOcrResults.length} unique items`);
                    console.log(`  - Unique OCR text: [${uniqueOcrResults.map(r => `"${r.text}"`).join(', ')}]`);
                    
                    if (uniqueOcrResults.length > 0) {
                        console.log(`  - Processing ${uniqueOcrResults.length} unique OCR results through BDOLootBot template matching...`);
                        
                        // Get session state BEFORE processing
                        const sessionBefore = this.lootBot.getCurrentSession();
                        const lootBefore = Object.fromEntries(sessionBefore.loot);
                        const totalBefore = Array.from(sessionBefore.loot.values()).reduce((sum, count) => sum + count, 0);
                        console.log(`  - Session state BEFORE template matching: ${JSON.stringify(lootBefore)} (total: ${totalBefore})`);
                        
                        // Use BDOLootBot's proper template matching with deduplicated results
                        const templateMatchResult = await this.lootBot.processOCRResults(uniqueOcrResults);
                        
                        console.log(`🔍 TEMPLATE MATCHING DEBUG:`);
                        console.log(`  - Unique OCR Results: ${JSON.stringify(uniqueOcrResults.map(r => r.text))}`);
                        console.log(`  - Template Match Success: ${templateMatchResult.success}`);
                        console.log(`  - Template Matched Items: ${JSON.stringify(templateMatchResult.items?.map(i => ({item: i.item, quantity: i.quantity})))}`);
                        
                        // Get session state AFTER processing
                        const sessionAfter = this.lootBot.getCurrentSession();
                        const lootAfter = Object.fromEntries(sessionAfter.loot);
                        const totalAfter = Array.from(sessionAfter.loot.values()).reduce((sum, count) => sum + count, 0);
                        console.log(`  - Session state AFTER template matching: ${JSON.stringify(lootAfter)} (total: ${totalAfter})`);
                        console.log(`  - Items added to session: ${totalAfter - totalBefore}`);
                        
                        if (templateMatchResult.success && templateMatchResult.items && templateMatchResult.items.length > 0) {
                            console.log(`✅ BDOLootBot template matching found ${templateMatchResult.items.length} valid loot items`);
                            
                            // Update running totals
                            const templateMatchCount = templateMatchResult.items.reduce((sum, item) => sum + item.quantity, 0);
                            this.totalTemplateMatches += templateMatchCount;
                            console.log(`📊 RUNNING TOTALS: Template matches ${this.totalTemplateMatches} items so far`);
                            
                            // Don't emit here - let state sync handle it
                            console.log(`⏸️  NOT emitting items directly - letting state sync detect and emit changes`);
                            
                        } else {
                            console.log(`❌ BDOLootBot template matching found no valid loot items`);
                            
                            // Check if OCR found text but template matching failed
                            if (uniqueOcrResults.length > 0) {
                                console.warn(`⚠️  POTENTIAL ISSUE: OCR found ${uniqueOcrResults.length} text results but template matching found 0 items`);
                                console.warn(`  - OCR Results that failed template matching:`, uniqueOcrResults.map(r => r.text));
                                console.warn(`  - This could indicate missing templates or OCR text not matching expected formats`);
                            }
                        }
                    } else {
                        console.log(`  - All OCR results were duplicates, skipping BDOLootBot processing`);
                        this.stats.successfulCaptures++;
                    }
                } else {
                    console.log(`FastOCR task ${task.taskId}: No loot items detected (processed ${lootResult.itemsFound || 0} text regions)`);
                    this.stats.successfulCaptures++;
                }

                // Update processing times
                this.processingTimes.push(processTime);
                if (this.processingTimes.length > 100) {
                    this.processingTimes = this.processingTimes.slice(-50);
                }
                this.stats.averageProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
                
                const totalTime = Date.now() - task.captureStartTime;
                console.log(`Total time for FastOCR task ${task.taskId}: ${totalTime}ms`);

            } catch (error) {
                const processTime = Date.now() - processStartTime;
                console.log(`FastOCR task ${task.taskId} took: ${processTime}ms`);
                console.error(`FastOCR task ${task.taskId} failed:`, error);
                this.stats.failedCaptures++;
                
                // Screenshot saving disabled for performance
            }

            // Emit stats update
            this.emitToRenderer('session:stats-update', this.getSessionStats());
        }

        this.isProcessingQueue = false;
        console.log('FastOCR queue processing completed');
    }

    private async saveDebugScreenshot(imageData: string, taskId: number, itemCount: number): Promise<void> {
        if (!this.sessionScreenshotDir) return;

        try {
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-');
            const filename = `${String(taskId).padStart(6, '0')}_${timestamp}_${itemCount}items.png`;
            const filepath = path.join(this.sessionScreenshotDir, filename);
            
            // Convert base64 to buffer
            const buffer = Buffer.from(imageData, 'base64');
            await fs.promises.writeFile(filepath, buffer);
            console.log(`Debug screenshot saved: ${filename}`);
        } catch (error) {
            console.error('Failed to save debug screenshot:', error);
        }
    }

    private async saveErrorScreenshot(region: CaptureRegion, taskId: number): Promise<void> {
        if (!this.sessionScreenshotDir) return;

        try {
            // Take a manual screenshot for debugging
            const captureResult = await this.screenCapture.captureRegion(region);
            if (captureResult.success && captureResult.buffer) {
                const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-');
                const filename = `${String(taskId).padStart(6, '0')}_${timestamp}_ERROR.png`;
                const filepath = path.join(this.sessionScreenshotDir, filename);
                
                await fs.promises.writeFile(filepath, captureResult.buffer);
                console.log(`Error screenshot saved: ${filename}`);
            }
        } catch (error) {
            console.error('Failed to save error screenshot:', error);
        }
    }

    private createSessionScreenshotDir(location: string): string {
        const appPath = app ? app.getAppPath() : process.cwd();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds
        const dirName = `${location}_${timestamp}`;
        const dirPath = path.join(appPath, 'resources', 'session-screenshots', dirName);
        
        try {
            fs.mkdirSync(dirPath, { recursive: true });
            return dirPath;
        } catch (error) {
            console.error('Failed to create screenshot directory:', error);
            return '';
        }
    }

    public async startSession(userPreferences: UserPreferences, location: string, locationId: number): Promise<{ success: boolean; error?: string }> {
        try {
            if (this.isRunning) {
                return { success: false, error: 'Session is already running' };
            }

            console.log(`Starting FastOCR session for location: ${location}`);

            // Set the grind location on the FastOCR service for template matching
            console.log(`Setting grind location on FastOCR service: ${location} (ID: ${locationId})`);
            const locationResult = await this.fastOCR.setGrindLocation(location, locationId);
            if (!locationResult.success) {
                console.error(`Failed to set grind location: ${locationResult.error}`);
                return { success: false, error: `Failed to set grind location: ${locationResult.error}` };
            }
            console.log('Grind location set successfully on FastOCR service');

            // Set grind location on BDOLootBot for session tracking
            console.log(`Setting grind location on BDOLootBot: ${location} (ID: ${locationId})`);
            const lootBotLocationResult = await this.lootBot.setGrindLocation(location, locationId);
            if (!lootBotLocationResult.success) {
                console.error(`Failed to set BDOLootBot grind location: ${lootBotLocationResult.error}`);
                return { success: false, error: `Failed to set BDOLootBot grind location: ${lootBotLocationResult.error}` };
            }
            
            // Start BDOLootBot session
            console.log('Starting BDOLootBot session...');
            const sessionResult = this.lootBot.startSession();
            if (!sessionResult.success) {
                console.error(`Failed to start BDOLootBot session: ${sessionResult.error}`);
                return { success: false, error: `Failed to start BDOLootBot session: ${sessionResult.error}` };
            }
            console.log('BDOLootBot session started successfully');

            // Get OCR region from user preferences
            let ocrRegion: CaptureRegion;
            if (userPreferences.designated_ocr_region) {
                ocrRegion = userPreferences.designated_ocr_region;
            } else {
                console.warn('No OCR region specified, using default');
                ocrRegion = { x: 427, y: 1136, width: 394, height: 261 };
            }

            // Screenshots completely disabled for performance
            const saveScreenshots = false;

            this.config = {
                captureInterval: 50, // Maximum burst captures (20 FPS) - back to original speed for complete coverage
                ocrRegion,
                location: location,
                saveScreenshots: false // Screenshots completely disabled
            };

            this.stats = this.createInitialStats();
            this.ocrQueue = [];
            this.isProcessingQueue = false;
            this.taskIdCounter = 0;

            // Reset state sync counters for new session
            this.totalOCRItemsDetected = 0;
            this.totalTemplateMatches = 0;
            this.totalSessionUpdates = 0;
            this.recentOCRResults = [];
            this.lastKnownSessionState.clear();

            console.log(`FastOCR Session started for ${this.config.location} with ${this.config.captureInterval}ms interval`);
            console.log(`OCR Region: ${ocrRegion.x}, ${ocrRegion.y}, ${ocrRegion.width}x${ocrRegion.height}`);
            console.log(`🔄 Session state sync enabled (${this.STATE_SYNC_INTERVAL_MS}ms interval, ${this.OCR_DEDUPLICATION_WINDOW_MS}ms dedup window)`);
            console.log(`🎯 Conservative deduplication: 2.0s OR 100px OR 15% confidence difference (proven settings)`);

            this.startCapture();
            return { success: true };

        } catch (error) {
            console.error('Failed to start session:', error);
            return { success: false, error: `Failed to start session: ${error}` };
        }
    }

    private startCapture(): void {
        this.isRunning = true;
        
        // Start state synchronization
        this.startStateSync();
        
        this.intervalId = setInterval(async () => {
            try {
                if (!this.config) return;
                
                this.stats.capturesPerformed++;
                const captureStartTime = Date.now();
                
                console.log(`Queuing FastOCR task for region: ${this.config.ocrRegion.x}, ${this.config.ocrRegion.y}, ${this.config.ocrRegion.width}x${this.config.ocrRegion.height}`);
                
                // Add region to queue instead of capturing buffer
                this.taskIdCounter++;
                this.ocrQueue.push({
                    region: this.config.ocrRegion,
                    captureStartTime,
                    taskId: this.taskIdCounter
                });

                // Start processing queue if not already processing
                if (!this.isProcessingQueue) {
                    this.processOCRQueue();
                }
                
                this.stats.lastCaptureTime = Date.now();
                
            } catch (error) {
                console.error('Error during capture:', error);
                this.stats.failedCaptures++;
            }
        }, this.config!.captureInterval);
    }

    public async stopSession(): Promise<{ success: boolean; sessionSummary: any }> {
        console.log('Stopping OCR Session...');
        
        // IMMEDIATELY stop new captures
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Capture interval cleared');
        }

        // IMMEDIATELY stop state synchronization
        this.stopStateSync();

        // IMMEDIATELY set running to false to prevent new queue processing
        this.isRunning = false;

        // Clear the OCR queue instead of waiting - with 50ms captures, queue gets huge
        const queueLength = this.ocrQueue.length;
        this.ocrQueue = []; // Clear the queue immediately
        console.log(`OCR queue cleared (was ${queueLength} items)`);

        // Give current processing task a moment to finish, but don't wait long
        const maxWaitTime = 5000; // Only 5 seconds max wait instead of 30
        const startWait = Date.now();
        
        if (this.isProcessingQueue) {
            console.log('Waiting briefly for current OCR task to finish...');
            while (this.isProcessingQueue && (Date.now() - startWait < maxWaitTime)) {
                console.log(`Still processing current task... Waited: ${Math.round((Date.now() - startWait) / 1000)}s`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Check more frequently
            }
        }

        if (this.isProcessingQueue) {
            console.log(`Force stopping - current task still processing after ${maxWaitTime}ms timeout`);
        }

        // End BDOLootBot session and get the final summary
        console.log('Ending BDOLootBot session...');
        const bdoSessionSummary = this.lootBot.endSession();
        console.log('BDOLootBot session ended:', bdoSessionSummary);

        const sessionSummary = this.getSessionSummary();
        console.log('Session ended:', sessionSummary);

        if (this.sessionScreenshotDir) {
            console.log(`Session screenshots saved in: ${this.sessionScreenshotDir}`);
        }

        console.log('OCR Session stopped');
        
        // Emit final stats
        this.emitToRenderer('session:stopped', {
            summary: sessionSummary,
            stats: this.getSessionStats()
        });

        console.log('Session Stats:', this.getSessionStats());

        return { 
            success: true, 
            sessionSummary 
        };
    }

    public getStatus(): { isRunning: boolean; queueLength: number; config: SessionConfig | null } {
        return {
            isRunning: this.isRunning,
            queueLength: this.ocrQueue.length,
            config: this.config
        };
    }

    public getSessionStats(): SessionStats {
        return { ...this.stats };
    }

    public getSessionSummary(): any {
        const duration = Date.now() - this.stats.sessionStartTime;
        
        // Get actual loot data from BDOLootBot session
        const currentSession = this.lootBot.getCurrentSession();
        const lootObject = Object.fromEntries(currentSession.loot);
        const actualItemCount = Array.from(currentSession.loot.values()).reduce((sum, count) => sum + count, 0);
        
        console.log(`📊 SESSION SUMMARY DEBUG:`);
        console.log(`  - OCR Detections: ${this.totalOCRItemsDetected}`);
        console.log(`  - Template Matches: ${this.totalTemplateMatches}`);
        console.log(`  - Session Updates: ${this.totalSessionUpdates}`);
        console.log(`  - Actual Session Items: ${actualItemCount}`);
        console.log(`  - Stats Item Count: ${this.stats.itemsDetected}`);
        
        return {
            location: this.config?.location || 'Unknown',
            duration,
            loot: lootObject,
            silver: currentSession.silver,
            totalValue: 0, // TODO: Calculate actual value based on item prices
            itemCount: actualItemCount, // Use session state as authoritative
            debug: {
                ocrDetections: this.totalOCRItemsDetected,
                templateMatches: this.totalTemplateMatches,
                sessionUpdates: this.totalSessionUpdates,
                statsItemCount: this.stats.itemsDetected
            }
        };
    }

    public getCurrentSession(): any {
        return {
            isActive: this.isRunning,
            config: this.config,
            stats: this.getSessionStats(),
            queueLength: this.ocrQueue.length
        };
    }

    public updateCaptureInterval(interval: number): void {
        if (this.config) {
            this.config.captureInterval = interval;
            
            // Restart capture if running
            if (this.isRunning && this.intervalId) {
                clearInterval(this.intervalId);
                this.startCapture();
            }
        }
    }

    public setUserPreferences(preferences: UserPreferences): void {
        // Update config if session is running
        if (this.config && preferences.designated_ocr_region) {
            this.config.ocrRegion = preferences.designated_ocr_region;
        }
    }

    public async testOCREngine(): Promise<{ success: boolean; error?: string; ocrResults?: any }> {
        try {
            console.log('🔄 Testing FastOCR engine...');
            const testResult = await this.fastOCR.test();
            
            if (testResult) {
                return { 
                    success: true, 
                    ocrResults: { message: 'FastOCR engine is working properly' } 
                };
            } else {
                return { 
                    success: false, 
                    error: 'FastOCR engine test failed' 
                };
            }
        } catch (error) {
            return { success: false, error: `FastOCR engine test failed: ${error}` };
        }
    }

    public async restartFastOCR(): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('🔄 Restarting FastOCR service...');
            const restartResult = await this.fastOCR.restart();
            
            if (restartResult) {
                return { 
                    success: true 
                };
            } else {
                return { 
                    success: false, 
                    error: 'FastOCR restart failed' 
                };
            }
        } catch (error) {
            return { success: false, error: `FastOCR restart failed: ${error}` };
        }
    }

    public async testCaptureWithPreview(userPreferences: UserPreferences): Promise<{ success: boolean; error?: string; stats?: any; imageData?: string }> {
        try {
            // Get OCR region from user preferences
            let ocrRegion: CaptureRegion;
            if (userPreferences.designated_ocr_region) {
                ocrRegion = userPreferences.designated_ocr_region;
            } else {
                console.warn('No OCR region specified, using default');
                ocrRegion = { x: 427, y: 1136, width: 394, height: 261 };
            }

            console.log(`Testing capture with region: ${ocrRegion.x}, ${ocrRegion.y}, ${ocrRegion.width}x${ocrRegion.height}`);

            const captureStartTime = Date.now();
            const captureResult = await this.screenCapture.captureRegion(ocrRegion);
            const captureTime = Date.now() - captureStartTime;

            if (!captureResult.success || !captureResult.buffer) {
                return { success: false, error: captureResult.error || 'Capture failed' };
            }

            const imageData = `data:image/png;base64,${captureResult.buffer.toString('base64')}`;

            return {
                success: true,
                stats: {
                    captureTime,
                    bufferSize: captureResult.buffer.length
                },
                imageData
            };
        } catch (error) {
            console.error('Test capture failed:', error);
            return { success: false, error: `Test capture failed: ${error}` };
        }
    }

    public getAvailableLocations(): string[] {
        // This would normally fetch from database or config
        return ['Swamp Nagas [Elvia]', 'Polly Forest', 'Hystria Ruins'];
    }

    public isSessionActive(): boolean {
        return this.isRunning;
    }

    public toggleScreenshotSaving(): void {
        if (this.config) {
            this.config.saveScreenshots = !this.config.saveScreenshots;
        }
    }

    // Session State Synchronization Methods
    private startStateSync(): void {
        console.log(`🔄 Starting session state synchronization (${this.STATE_SYNC_INTERVAL_MS}ms interval)`);
        
        // Initialize the baseline state
        const currentSession = this.lootBot.getCurrentSession();
        this.lastKnownSessionState = new Map(currentSession.loot);
        
        const initialTotal = Array.from(this.lastKnownSessionState.values()).reduce((sum, count) => sum + count, 0);
        console.log(`📊 Initial session state: ${initialTotal} items - ${JSON.stringify(Object.fromEntries(this.lastKnownSessionState))}`);
        
        this.stateCheckInterval = setInterval(() => {
            this.syncWithSessionState();
        }, this.STATE_SYNC_INTERVAL_MS);
    }

    private stopStateSync(): void {
        if (this.stateCheckInterval) {
            clearInterval(this.stateCheckInterval);
            this.stateCheckInterval = null;
            console.log('🛑 Session state synchronization stopped');
        }
    }

    private syncWithSessionState(): void {
        try {
            const currentSession = this.lootBot.getCurrentSession();
            const currentState = new Map(currentSession.loot);
            
            const currentTotal = Array.from(currentState.values()).reduce((sum, count) => sum + count, 0);
            const lastTotal = Array.from(this.lastKnownSessionState.values()).reduce((sum, count) => sum + count, 0);
            
            if (currentTotal > lastTotal) {
                console.log(`📈 SESSION STATE CHANGE DETECTED:`);
                console.log(`  - Previous total: ${lastTotal} items`);
                console.log(`  - Current total: ${currentTotal} items`);
                console.log(`  - New items detected: ${currentTotal - lastTotal}`);
                
                // Find what items were added
                const newItems: Array<{name: string, quantity: number}> = [];
                
                currentState.forEach((currentCount, itemName) => {
                    const lastCount = this.lastKnownSessionState.get(itemName) || 0;
                    if (currentCount > lastCount) {
                        const addedQuantity = currentCount - lastCount;
                        newItems.push({name: itemName, quantity: addedQuantity});
                        console.log(`  - ${itemName}: +${addedQuantity} (${lastCount} → ${currentCount})`);
                    }
                });
                
                if (newItems.length > 0) {
                    console.log(`📤 EMITTING ${newItems.length} new items from session state sync`);
                    
                    // Update stats
                    const totalNewItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
                    this.stats.itemsDetected += totalNewItems;
                    this.totalSessionUpdates += totalNewItems;
                    
                    // Emit to UI
                    this.emitToRenderer('session:loot-detected', {
                        items: newItems,
                        timestamp: Date.now(),
                        source: 'state-sync'
                    });
                    
                    // Emit session summary update
                    const currentSessionSummary = this.getSessionSummary();
                    this.emitToRenderer('session:summary-update', {
                        summary: currentSessionSummary,
                        timestamp: Date.now()
                    });
                    
                    console.log(`📊 RUNNING TOTALS: OCR detected ${this.totalOCRItemsDetected}, Template matches ${this.totalTemplateMatches}, Session updates ${this.totalSessionUpdates}`);
                }
                
                // Update our known state
                this.lastKnownSessionState = new Map(currentState);
            }
        } catch (error) {
            console.error('Error during session state sync:', error);
        }
    }

    // OCR Precision Deduplication - Enhanced multi-factor approach for 100% accuracy
    private deduplicateOCRResults(ocrResults: Array<{text: string, confidence: number, bbox: number[][]}>): Array<{text: string, confidence: number, bbox: number[][]}> {
        const now = Date.now();
        
        console.log(`🔍 ENHANCED DEDUPLICATION: Processing ${ocrResults.length} OCR results`);
        
        // Clean old entries from recent results
        this.recentOCRResults = this.recentOCRResults.filter(entry => 
            now - entry.timestamp < this.OCR_DEDUPLICATION_WINDOW_MS
        );
        
        // Step 1: Filter by confidence threshold
        const highConfidenceResults = ocrResults.filter(result => {
            if (result.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
                console.log(`🔄 LOW CONFIDENCE FILTER: "${result.text}" (${(result.confidence * 100).toFixed(1)}% < ${(this.MIN_CONFIDENCE_THRESHOLD * 100)}%)`);
                return false;
            }
            return true;
        });
        
        console.log(`📊 Confidence Filter: ${ocrResults.length} → ${highConfidenceResults.length} (filtered ${ocrResults.length - highConfidenceResults.length} low confidence)`);
        
        
        // Step 2: Quantity-aware spatial-temporal deduplication
        const uniqueResults = highConfidenceResults.filter(result => {
            // Get Y position from bounding box (top-left corner)
            const resultY = result.bbox && result.bbox.length > 0 ? result.bbox[0][1] : 0;
            
            // Normalize text for comparison (removes quantity variations)
            const normalizedText = this.normalizeTextForDeduplication(result.text);
            console.log(`🔍 NORMALIZE: "${result.text}" → "${normalizedText}"`);
            
            // Check if we've seen this normalized text recently
            const isDuplicate = this.recentOCRResults.some(recent => {
                const normalizedRecent = this.normalizeTextForDeduplication(recent.text);
                if (normalizedRecent !== normalizedText) {
                    return false; // Different item, not a duplicate
                }
                
                const timeDelta = now - recent.timestamp;
                const confidenceDelta = Math.abs(result.confidence - recent.confidence);
                
                // Multi-factor deduplication - tightened to reduce over-counting:
                if (timeDelta <= this.OCR_DEDUPLICATION_WINDOW_MS) {
                    
                    // Factor 1: Time-based filtering - 2.2s window for same normalized text
                    if (timeDelta < 2200) {
                        console.log(`🔄 TIME FILTER: "${result.text}" → "${normalizedText}" (${timeDelta}ms < 2200ms)`);
                        return true; // Filter as duplicate
                    }
                    
                    // Factor 2: Position-based filtering - 5px radius with 1200ms window
                    const positionCheck = Math.abs(resultY - recent.y) < 5 && timeDelta < 1200;
                    if (positionCheck) {
                        console.log(`🔄 POSITION FILTER: "${result.text}" → "${normalizedText}" (Y: ${resultY} vs ${recent.y} - within 5px, ${timeDelta}ms < 1200ms)`);
                        return true; // Filter as duplicate - same position
                    }
                    
                    // Factor 3: Confidence similarity check - 3.2% confidence diff within 950ms
                    if (timeDelta < 950 && confidenceDelta < 0.032) {
                        console.log(`🔄 CONFIDENCE FILTER: "${result.text}" → "${normalizedText}" (confidence diff: ${(confidenceDelta * 100).toFixed(1)}% < 3.2%, ${timeDelta}ms < 950ms)`);
                        return true; // Filter as duplicate - same confidence signature
                    }
                    
                    // Factor 4: Skip exact text match - legitimate rapid drops can have identical text
                    // (e.g., "loot x 1" appearing multiple times in succession is valid)
                    
                    // Factor 4: Bounding box overlap check - 11x6px overlap within 1100ms
                    if (result.bbox && recent.bbox && timeDelta < 1100) {
                        const currentBox = result.bbox[0];
                        const recentBox = recent.bbox[0];
                        
                        if (currentBox && recentBox) {
                            const xOverlap = Math.abs(currentBox[0] - recentBox[0]) < 11;
                            const yOverlap = Math.abs(currentBox[1] - recentBox[1]) < 6;
                            
                            if (xOverlap && yOverlap) {
                                console.log(`🔄 BBOX OVERLAP FILTER: "${result.text}" → "${normalizedText}" (overlap within 11x6px, ${timeDelta}ms < 1100ms)`);
                                return true; // Filter as duplicate - same screen region
                            }
                        }
                    }
                    
                    console.log(`✅ MULTI-FACTOR NEW PICKUP: "${result.text}" → "${normalizedText}" (passed all duplicate checks)`);
                    return false; // Allow through - different timing and position
                }
                
                return false; // Outside 5-second window - definitely new pickup
            });
            
            if (!isDuplicate) {
                // Store this result with its position and confidence for future comparison
                this.recentOCRResults.push({
                    text: result.text,
                    timestamp: now,
                    y: resultY,
                    confidence: result.confidence,
                    bbox: result.bbox
                });
                
                // Cleanup old entries to prevent memory issues during long sessions
                const currentTime = Date.now();
                
                // First: Remove entries older than our deduplication window
                const oldLength = this.recentOCRResults.length;
                this.recentOCRResults = this.recentOCRResults.filter(entry => 
                    (currentTime - entry.timestamp) <= (this.OCR_DEDUPLICATION_WINDOW_MS * 2) // Keep 2x window for safety
                );
                
                // Second: If still too many entries, keep only the most recent ones
                if (this.recentOCRResults.length > this.MAX_DEDUPLICATION_HISTORY) {
                    const removed = this.recentOCRResults.splice(0, this.recentOCRResults.length - this.MAX_DEDUPLICATION_HISTORY);
                    console.log(`🧹 Count-based cleanup: removed ${removed.length} old entries`);
                }
                
                // Log cleanup activity
                const totalRemoved = oldLength - this.recentOCRResults.length;
                if (totalRemoved > 0) {
                    console.log(`🧹 Total cleanup: removed ${totalRemoved} entries (${this.recentOCRResults.length} remaining)`);
                }
                
                console.log(`📍 STORING ENHANCED: "${result.text}" at Y=${resultY}, conf=${(result.confidence * 100).toFixed(1)}%, time=${now}`);
                return true;
            } else {
                return false;
            }
        });
        
        if (uniqueResults.length !== highConfidenceResults.length) {
            console.log(`🔍 Multi-Factor Robust Deduplication (4 checks): ${highConfidenceResults.length} → ${uniqueResults.length} (filtered ${highConfidenceResults.length - uniqueResults.length} duplicates)`);
            
            // Log what was filtered for debugging
            const filteredItems = highConfidenceResults.filter(item => !uniqueResults.includes(item));
            console.log(`🗑️  CONSERVATIVE FILTERED: [${filteredItems.map(r => `"${r.text}" (${(r.confidence * 100).toFixed(1)}%)`).join(', ')}]`);
            
            // Show the deduplication state for debugging
            console.log(`📋 CONSERVATIVE DEDUP STATE (${this.recentOCRResults.length} items tracked):`);
            this.recentOCRResults.forEach((item, i) => {
                const age = now - item.timestamp;
                console.log(`  ${i + 1}. "${item.text}" (Y: ${item.y}, conf: ${(item.confidence * 100).toFixed(1)}%, age: ${age}ms)`);
            });
        }
        
        console.log(`🎯 FINAL ENHANCED RESULT: ${ocrResults.length} → ${uniqueResults.length} (${ocrResults.length - uniqueResults.length} total filtered)`);
        
        return uniqueResults;
    }
}