// OCR Service Exports
export { TemplateManager, LocationTemplate } from './templateManager';
export { PortableOCR, type OCRResult } from './portableOCR';
export { TemplateOCR, type LootMatch, type ProcessResult, type QuantityMatch } from './templateOCR';
export { BDOLootBot, type LootSession, type SessionSummary, type BotStatus } from './bdoLootBot';

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

// Main OCR service instance
import { BDOLootBot } from './bdoLootBot';

// Create a singleton instance
let ocrServiceInstance: BDOLootBot | null = null;

export function getOCRService(): BDOLootBot {
    if (!ocrServiceInstance) {
        ocrServiceInstance = new BDOLootBot();
    }
    return ocrServiceInstance;
}

export function resetOCRService(): void {
    ocrServiceInstance = null;
}
