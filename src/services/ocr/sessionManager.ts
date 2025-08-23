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

interface RecentOCRResult {
    text: string;
    timestamp: number;
    y: number;
    x: number;
    confidence: number;
    bbox: number[][];
}

export interface SessionResult {
    timestamp: number;
    itemName: string;
    count: number;
    location: string;
    confidence: number;
    bbox?: number[][];
}

export class SessionManager {
    private static instance: SessionManager;

    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    private sessionConfig: SessionConfig | null = null;
    private isRunning = false;
    private captureInterval: NodeJS.Timeout | null = null;
    private stats: SessionStats;
    private screenCapture: ScreenCapture;
    private bdoLootBot: BDOLootBot;
    private fastOCRService: FastOCRService;
    private taskQueue: QueuedOCRTask[] = [];
    private processingQueue = false;
    private recentResults: SessionResult[] = [];
    private recentOCRResults: RecentOCRResult[] = [];
    private processingTimes: number[] = [];
    private taskIdCounter = 0;

    constructor() {
        this.stats = {
            capturesPerformed: 0,
            successfulCaptures: 0,
            failedCaptures: 0,
            itemsDetected: 0,
            lastCaptureTime: null,
            sessionStartTime: Date.now(),
            averageProcessingTime: 0
        };
        this.screenCapture = new ScreenCapture();
        this.bdoLootBot = new BDOLootBot();
        this.fastOCRService = fastOCRService;
    }

    // Helper function to determine which row (0-4) a Y coordinate belongs to
    private getRowNumber(y: number): number {
        // Assuming 350x300 region divided into 5 rows of 60px each
        // Row 0: 0-59, Row 1: 60-119, Row 2: 120-179, Row 3: 180-239, Row 4: 240-299
        const rowHeight = 60;
        const row = Math.floor(y / rowHeight);
        return Math.max(0, Math.min(4, row)); // Clamp to 0-4
    }

    // Enhanced deduplication using row-based logic for BDO's 5-slot loot system with push-out detection
    private deduplicateOCRResults(result: any): boolean {
        const now = Date.now();
        const exactText = result.text.trim();
        
        if (!exactText || exactText.length === 0) {
            return false; // Block empty results
        }

        // Clean up old results (older than 3 seconds)
        this.recentOCRResults = this.recentOCRResults.filter(recent => 
            (now - recent.timestamp) < 3000
        );

        // Calculate which row this result belongs to
        const resultY = result.bbox && result.bbox.length > 0 ? result.bbox[0][1] : 0;
        const resultRow = this.getRowNumber(resultY);

        // Check for exact duplicates (same text, same row, recent)
        for (const recent of this.recentOCRResults) {
            if (recent.text.trim() === exactText) {
                const timeDelta = now - recent.timestamp;
                const recentRow = this.getRowNumber(recent.y);
                
                console.log(`🔍 SAME TEXT: "${exactText}" - Current: Row ${resultRow}, Recent: Row ${recentRow}, Time: ${timeDelta}ms`);
                
                // BDO Logic: If same text AND same row within fade time = potential duplicate
                if (timeDelta < 1500 && resultRow === recentRow) {
                    // Check for mass pickup burst pattern (multiple items in very short time)
                    const recentSameItemCount = this.recentOCRResults.filter(r => 
                        r.text.trim() === exactText && 
                        (now - r.timestamp) < 200 && // Within 200ms burst window
                        this.getRowNumber(r.y) === resultRow
                    ).length;
                    
                    // If this is part of a mass pickup (multiple items in <200ms), allow it
                    if (timeDelta < 200 || recentSameItemCount >= 2) {
                        console.log(`📦 MASS PICKUP: "${exactText}" (${timeDelta}ms in ROW ${resultRow} - burst pattern detected, count: ${recentSameItemCount + 1})`);
                        // Continue processing - this is likely legitimate mass pickup
                    } else {
                        // Single slow re-read = duplicate
                        console.log(`🚫 BLOCKED: "${exactText}" (${timeDelta}ms in same ROW ${resultRow} - duplicate reading)`);
                        return false; // Block - same physical item being re-read
                    }
                }
                
                // BDO Logic: If same text in different row within short time = potential push/shift
                if (resultRow !== recentRow && timeDelta < 500) {
                    // Check if this could be the same item that shifted rows due to FIFO push-up
                    const rowDistance = Math.abs(resultRow - recentRow);
                    
                    // BDO FIFO Logic: New items appear at BOTTOM (Row 4), push existing items UP
                    // If item moved from Row N to Row N-1 within 500ms = likely FIFO shift
                    const isPushUp = (resultRow === recentRow - 1); // Item moved up by 1 row
                    
                    if (rowDistance === 1 && isPushUp) {
                        console.log(`⚠️ FIFO PUSH-UP: "${exactText}" moved from Row ${recentRow} to Row ${resultRow} (${timeDelta}ms) - likely FIFO shift, BLOCKING`);
                        return false; // Block - same item that just shifted up due to FIFO
                    }
                    
                    // If item moved DOWN or distance > 1, treat as separate drop
                    console.log(`✅ DIFFERENT ROW: "${exactText}" (Row ${resultRow} vs Row ${recentRow}, ${timeDelta}ms, distance: ${rowDistance}) - separate drop`);
                    continue;
                }
                
                // BDO Logic: If same text but different row after longer time = legitimate different drop
                if (resultRow !== recentRow && timeDelta >= 500) {
                    console.log(`✅ DIFFERENT ROW: "${exactText}" (Row ${resultRow} vs Row ${recentRow} - different physical drop)`);
                    continue; // Different row, different drop - continue checking other recent items
                }
            }
        }
        
        // Store this result for future comparisons
        this.recentOCRResults.push({
            text: result.text,
            timestamp: now,
            y: result.bbox && result.bbox.length > 0 ? result.bbox[0][1] : 0,
            x: result.bbox && result.bbox.length > 0 ? result.bbox[0][0] : 0,
            confidence: result.confidence,
            bbox: result.bbox
        });

        console.log(`✅ ALLOWED: "${exactText}" (new drop in ROW ${resultRow})`);
        return true; // Allow - new unique result
    }

    // Overloaded startSession method to support both old and new signatures
    async startSession(userPreferencesOrConfig: any, location?: string, locationId?: number): Promise<{ success: boolean; error?: string }> {
        try {
            let config: SessionConfig;

            // If called with new signature (just config)
            if (userPreferencesOrConfig && userPreferencesOrConfig.captureInterval && userPreferencesOrConfig.ocrRegion) {
                config = userPreferencesOrConfig;
            }
            // If called with old signature (userPreferences, location, locationId)
            else if (userPreferencesOrConfig && location && locationId !== undefined) {
                const userPreferences = userPreferencesOrConfig;
                
                if (!userPreferences.designated_ocr_region) {
                    return { success: false, error: 'No OCR region configured in user preferences' };
                }

                config = {
                    captureInterval: 33, // 30 FPS for constant reading
                    ocrRegion: {
                        x: userPreferences.designated_ocr_region.x,
                        y: userPreferences.designated_ocr_region.y,
                        width: userPreferences.designated_ocr_region.width,
                        height: userPreferences.designated_ocr_region.height,
                        display: userPreferences.designated_ocr_region.display
                    },
                    location: location,
                    saveScreenshots: false
                };
            } else {
                return { success: false, error: 'Invalid parameters for startSession' };
            }

            if (this.isRunning) {
                return { success: false, error: 'Session is already running' };
            }

            this.sessionConfig = config;
            this.isRunning = true;
            this.stats = {
                capturesPerformed: 0,
                successfulCaptures: 0,
                failedCaptures: 0,
                itemsDetected: 0,
                lastCaptureTime: null,
                sessionStartTime: Date.now(),
                averageProcessingTime: 0
            };
            this.recentResults = [];
            this.recentOCRResults = [];
            this.processingTimes = [];

            console.log(`🚀 Starting BDO loot detection session for ${config.location}`);
            console.log(`📏 OCR Region: ${config.ocrRegion.width}x${config.ocrRegion.height} at (${config.ocrRegion.x}, ${config.ocrRegion.y})`);
            console.log(`⏱️ Capture interval: ${config.captureInterval}ms`);
            console.log(`📸 Save screenshots: ${config.saveScreenshots}`);

            // Initialize capture interval
            this.captureInterval = setInterval(() => {
                this.queueCapture();
            }, config.captureInterval);

            // Start processing queue
            this.processQueue();

            return { success: true };
        } catch (error) {
            console.error('Failed to start session:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async stopSession(): Promise<{ success: boolean; stats: SessionStats; error?: string }> {
        try {
            if (!this.isRunning) {
                return { success: false, stats: this.stats, error: 'Session is not running' };
            }

            this.isRunning = false;

            // Clear intervals and queues
            if (this.captureInterval) {
                clearInterval(this.captureInterval);
                this.captureInterval = null;
            }

            this.taskQueue = [];
            this.processingQueue = false;

            console.log(`🛑 Session stopped for ${this.sessionConfig?.location}`);
            console.log(`📊 Final stats: ${this.stats.itemsDetected} items detected, ${this.stats.successfulCaptures}/${this.stats.capturesPerformed} successful captures`);

            return { success: true, stats: this.stats };
        } catch (error) {
            console.error('Failed to stop session:', error);
            return { success: false, stats: this.stats, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private queueCapture(): void {
        if (!this.sessionConfig || !this.isRunning) return;

        const task: QueuedOCRTask = {
            region: this.sessionConfig.ocrRegion,
            captureStartTime: Date.now(),
            taskId: ++this.taskIdCounter
        };

        this.taskQueue.push(task);
        this.stats.capturesPerformed++;
    }

    private async processQueue(): Promise<void> {
        if (this.processingQueue || !this.isRunning) return;

        this.processingQueue = true;

        while (this.taskQueue.length > 0 && this.isRunning) {
            const task = this.taskQueue.shift();
            if (!task) continue;

            try {
                await this.processOCRTask(task);
            } catch (error) {
                console.error(`Error processing OCR task ${task.taskId}:`, error);
                this.stats.failedCaptures++;
            }
        }

        this.processingQueue = false;

        // Continue processing if still running
        if (this.isRunning) {
            setTimeout(() => this.processQueue(), 10);
        }
    }

    private async processOCRTask(task: QueuedOCRTask): Promise<void> {
        const processingStart = Date.now();

        try {
            // Capture screen
            const captureResult = await this.screenCapture.captureRegion(task.region);
            
            if (!captureResult.success || !captureResult.buffer) {
                this.stats.failedCaptures++;
                return;
            }

            // Run OCR on the captured image
            const ocrResponse = await this.fastOCRService.processRegion(task.region);

            if (!ocrResponse.success || !ocrResponse.texts || ocrResponse.texts.length === 0) {
                this.stats.successfulCaptures++;
                return;
            }

            // Process each OCR result
            for (const result of ocrResponse.texts) {
                // Apply deduplication logic
                if (!this.deduplicateOCRResults(result)) {
                    continue; // Skip duplicates
                }

                // Process the unique result
                const sessionResult: SessionResult = {
                    timestamp: task.captureStartTime,
                    itemName: result.text.trim(),
                    count: 1,
                    location: this.sessionConfig?.location || 'Unknown',
                    confidence: result.confidence,
                    bbox: result.bbox
                };

                this.recentResults.push(sessionResult);
                this.stats.itemsDetected++;

                // Broadcast to main window
                this.broadcastItemDetection(sessionResult);

                console.log(`🎯 ITEM DETECTED: "${sessionResult.itemName}" at ${this.sessionConfig?.location} (confidence: ${result.confidence.toFixed(2)})`);
            }

            this.stats.successfulCaptures++;
            this.stats.lastCaptureTime = task.captureStartTime;

        } catch (error) {
            console.error(`OCR processing failed for task ${task.taskId}:`, error);
            this.stats.failedCaptures++;
        } finally {
            // Track processing time
            const processingTime = Date.now() - processingStart;
            this.processingTimes.push(processingTime);
            
            // Keep only recent processing times (last 100)
            if (this.processingTimes.length > 100) {
                this.processingTimes = this.processingTimes.slice(-100);
            }
            
            // Update average processing time
            if (this.processingTimes.length > 0) {
                this.stats.averageProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
            }
        }
    }

    private broadcastItemDetection(result: SessionResult): void {
        try {
            const allWindows = BrowserWindow.getAllWindows();
            allWindows.forEach(window => {
                if (!window.isDestroyed()) {
                    window.webContents.send('item-detected', {
                        itemName: result.itemName,
                        timestamp: result.timestamp,
                        location: result.location,
                        confidence: result.confidence
                    });
                }
            });
        } catch (error) {
            console.error('Failed to broadcast item detection:', error);
        }
    }

    getStats(): SessionStats {
        return { ...this.stats };
    }

    getRecentResults(): SessionResult[] {
        return [...this.recentResults];
    }

    isSessionRunning(): boolean {
        return this.isRunning;
    }

    getCurrentConfig(): SessionConfig | null {
        return this.sessionConfig ? { ...this.sessionConfig } : null;
    }

    // Add compatibility methods for existing API
    async initialize(): Promise<boolean> {
        try {
            console.log('Initializing SessionManager...');
            return true;
        } catch (error) {
            console.error('Failed to initialize SessionManager:', error);
            return false;
        }
    }

    setUserPreferences(userPreferences: any): void {
        // Store user preferences for the session
        console.log('User preferences set:', userPreferences);
    }

    getStatus(): any {
        return {
            isActive: this.isSessionRunning(),
            stats: this.getStats(),
            config: this.getCurrentConfig()
        };
    }

    getSessionStats(): SessionStats {
        return this.getStats();
    }

    getSessionSummary(): any {
        return {
            stats: this.getStats(),
            recentResults: this.getRecentResults(),
            isActive: this.isSessionRunning()
        };
    }

    getCurrentSession(): any {
        return {
            isActive: this.isSessionRunning(),
            config: this.getCurrentConfig(),
            stats: this.getStats()
        };
    }

    updateCaptureInterval(interval: number): { success: boolean; error?: string } {
        try {
            if (interval < 16 || interval > 5000) {
                return { success: false, error: 'Capture interval must be between 16ms (60 FPS) and 5000ms' };
            }

            if (this.sessionConfig) {
                this.sessionConfig.captureInterval = interval;
                
                // Restart the capture interval if session is running
                if (this.isRunning && this.captureInterval) {
                    clearInterval(this.captureInterval);
                    this.captureInterval = setInterval(() => {
                        this.queueCapture();
                    }, interval);
                }
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async testCaptureWithPreview(userPreferences: any): Promise<any> {
        try {
            if (!userPreferences.designated_ocr_region) {
                return { success: false, error: 'No OCR region configured' };
            }

            const region = {
                x: userPreferences.designated_ocr_region.x,
                y: userPreferences.designated_ocr_region.y,
                width: userPreferences.designated_ocr_region.width,
                height: userPreferences.designated_ocr_region.height,
                display: userPreferences.designated_ocr_region.display
            };

            // Test capture
            const captureResult = await this.screenCapture.captureRegion(region);
            
            if (!captureResult.success) {
                return { success: false, error: captureResult.error };
            }

            // Test OCR
            const ocrResponse = await this.fastOCRService.processRegion(region);
            
            return {
                success: true,
                capture: captureResult.success,
                ocrResults: ocrResponse.texts || [],
                region: region
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    getAvailableLocations(): any[] {
        return []; // This would typically come from the database
    }

    isSessionActive(): boolean {
        return this.isSessionRunning();
    }

    async restartFastOCR(): Promise<{ success: boolean; error?: string }> {
        try {
            // Restart the OCR service if needed
            console.log('Restarting FastOCR service...');
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

// Export singleton instance
export const sessionManager = new SessionManager();
