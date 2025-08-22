// OCR Service Exports - FastOCR Pipeline Only
export { BDOLootBot, type LootSession, type SessionSummary, type BotStatus, type LootMatch } from './bdoLootBot';
export { FastOCRService, type FastOCRProcessingResult } from './fastOCR';
export { ScreenCapture, type CaptureRegion, type CaptureResult } from './screenCapture';
export { SessionManager, type SessionConfig, type SessionStats } from './sessionManager';

// Re-export OCR types from the centralized types location
export type { 
    ItemTemplate, 
    CropArea, 
    TextFilters, 
    Pattern, 
    LocationTemplateData, 
    ItemMatcher, 
    MatchResult 
} from '../db/types/ocr';

// Main OCR service instances
import { BDOLootBot } from './bdoLootBot';
import { SessionManager } from './sessionManager';

// Create singleton instances
let ocrServiceInstance: BDOLootBot | null = null;
let sessionManagerInstance: SessionManager | null = null;

export function getOCRService(): BDOLootBot {
    if (!ocrServiceInstance) {
        ocrServiceInstance = new BDOLootBot();
    }
    return ocrServiceInstance;
}

export function getSessionManager(): SessionManager {
    if (!sessionManagerInstance) {
        sessionManagerInstance = SessionManager.getInstance();
    }
    return sessionManagerInstance;
}

export function resetOCRService(): void {
    ocrServiceInstance = null;
    sessionManagerInstance = null;
}
