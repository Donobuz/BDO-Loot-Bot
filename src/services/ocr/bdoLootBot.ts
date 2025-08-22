import { TemplateOCR, LootMatch } from './templateOCR';
import { UserPreferences } from '../db/types/user';
import { databaseService } from '../db';
import { Item } from '../db/types/item';

export interface LootSession {
    location: string | null;
    loot: Map<string, number>;
    silver: number;
    startTime: number | null;
    endTime: number | null;
}

export interface SessionSummary {
    location: string | null;
    duration: number;
    loot: Record<string, number>;
    silver: number;
    totalValue: number;
    itemCount: number;
}

export interface BotStatus {
    initialized: boolean;
    ocrReady: boolean;
    currentLocation: string | null;
    sessionActive: boolean;
    lastProcessTime: number | null;
}

export class BDOLootBot {
    private ocr: TemplateOCR;
    private currentSession: LootSession;
    private isInitialized: boolean;
    private userPreferences: UserPreferences | null;
    private currentLocationId: number | null;
    private lootTableItems: Item[];

    constructor() {
        this.ocr = new TemplateOCR();
        this.isInitialized = false;
        this.userPreferences = null;
        this.currentLocationId = null;
        this.lootTableItems = [];
        this.currentSession = {
            location: null,
            loot: new Map(),
            silver: 0,
            startTime: null,
            endTime: null
        };
    }

    public async initialize(): Promise<boolean> {
        try {
            const ocrReady = await this.ocr.initialize();
            this.isInitialized = ocrReady;
            
            if (this.isInitialized) {
                console.log('BDO Loot Bot initialized successfully');
            } else {
                console.error('Failed to initialize BDO Loot Bot - OCR engine not ready');
            }
            
            return this.isInitialized;
        } catch (error) {
            console.error('Failed to initialize BDO Loot Bot:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Initialize BDOLootBot for template matching only (no OCR required)
     * This is used when BDOLootBot is only needed for database lookups and template matching
     */
    public initializeTemplateMatchingOnly(): boolean {
        try {
            console.log('BDO Loot Bot: Initializing template matching only mode (no OCR)');
            this.isInitialized = true;
            console.log('BDO Loot Bot: Template matching mode initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize BDO Loot Bot template matching mode:', error);
            this.isInitialized = false;
            return false;
        }
    }

    public setUserPreferences(preferences: UserPreferences): void {
        this.userPreferences = preferences;
        if (this.ocr) {
            this.ocr.setUserPreferences(preferences);
        }
    }

    public async setGrindLocation(locationName: string, locationId?: number): Promise<{ success: boolean; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, error: 'Bot not initialized' };
        }

        this.currentSession.location = locationName;
        
        // If locationId is provided, load the loot table items
        if (locationId) {
            this.currentLocationId = locationId;
            await this.loadLootTableItems(locationId);
        }
        
        console.log(`Grind location set to: ${locationName} (${this.lootTableItems.length} items in loot table)`);
        return { success: true };
    }

    private async loadLootTableItems(locationId: number): Promise<void> {
        try {
            // Get items for this location's loot table (efficient query)
            const itemsResult = await databaseService.lootTables.getItemsForLocation(locationId);
            if (!itemsResult.success) {
                console.error('Failed to load loot table items for location:', locationId, itemsResult.error);
                this.lootTableItems = [];
                return;
            }

            this.lootTableItems = itemsResult.data || [];

            if (this.lootTableItems.length === 0) {
                console.log('❌ No items in loot table for this location');
            } else {
                console.log(`✅ Loaded ${this.lootTableItems.length} items for loot matching:`);
                this.lootTableItems.forEach((item, index) => {
                    console.log(`  ${(index + 1).toString().padStart(3, ' ')}. "${item.name}" (ID: ${item.id})`);
                });
            }
            
        } catch (error) {
            console.error('Error loading loot table items:', error);
            this.lootTableItems = [];
        }
    }

    public getAvailableLocations(): string[] {
        // This should return locations from the database, not OCR templates
        // For now, return empty array since locations come from the database
        return [];
    }

    public startSession(): { success: boolean; error?: string } {
        if (!this.currentSession.location) {
            return { success: false, error: 'No grind location set' };
        }

        this.currentSession.startTime = Date.now();
        this.currentSession.endTime = null;
        this.currentSession.loot.clear();
        this.currentSession.silver = 0;

        console.log(`Started loot tracking session at ${this.currentSession.location}`);
        return { success: true };
    }

    public endSession(): SessionSummary {
        this.currentSession.endTime = Date.now();
        const summary = this.getSessionSummary();
        
        console.log('Session ended:', summary);
        return summary;
    }

    public async processLootDrop(imageBuffer: Buffer): Promise<{ success: boolean; itemsFound: number; items?: LootMatch[]; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, itemsFound: 0, error: 'Bot not initialized' };
        }

        if (!this.isSessionActive()) {
            return { success: false, itemsFound: 0, error: 'No active session. Start a session first.' };
        }

        try {
            const results = await this.ocr.processLootArea(imageBuffer);

            if (results.success && results.matches) {
                for (const match of results.matches) {
                    this.addToSession(match);
                }

                return {
                    success: true,
                    itemsFound: results.matches.length,
                    items: results.matches
                };
            }

            return {
                success: false,
                itemsFound: 0,
                error: results.error || 'Unknown OCR error'
            };
        } catch (error) {
            return { 
                success: false, 
                itemsFound: 0, 
                error: `Failed to process loot drop: ${error}` 
            };
        }
    }

    public async processLootImage(imagePath: string): Promise<{ success: boolean; itemsFound: number; items?: LootMatch[]; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, itemsFound: 0, error: 'Bot not initialized' };
        }

        try {
            const results = await this.ocr.processLootImage(imagePath);

            if (results.success && results.matches) {
                if (this.isSessionActive()) {
                    for (const match of results.matches) {
                        this.addToSession(match);
                    }
                }

                return {
                    success: true,
                    itemsFound: results.matches.length,
                    items: results.matches
                };
            }

            return {
                success: false,
                itemsFound: 0,
                error: results.error || 'Unknown OCR error'
            };
        } catch (error) {
            return { 
                success: false, 
                itemsFound: 0, 
                error: `Failed to process loot image: ${error}` 
            };
        }
    }

    private addToSession(match: LootMatch): void {
        const itemName = match.item;
        const currentCount = this.currentSession.loot.get(itemName) || 0;
        this.currentSession.loot.set(itemName, currentCount + match.quantity);

        console.log(`+${match.quantity}x ${itemName} (Total: ${currentCount + match.quantity}) [${match.method}, ${(match.confidence * 100).toFixed(1)}%]`);
    }

    public addSilver(amount: number): void {
        this.currentSession.silver += amount;
        console.log(`+${amount} silver (Total: ${this.currentSession.silver})`);
    }

    public getSessionSummary(): SessionSummary {
        const duration = this.currentSession.endTime 
            ? this.currentSession.endTime - (this.currentSession.startTime || 0)
            : this.currentSession.startTime 
                ? Date.now() - this.currentSession.startTime
                : 0;

        const lootObject = Object.fromEntries(this.currentSession.loot);
        const itemCount = Array.from(this.currentSession.loot.values()).reduce((sum, count) => sum + count, 0);

        // TODO: Calculate total value based on item values from templates
        const totalValue = this.calculateTotalValue();

        return {
            location: this.currentSession.location,
            duration,
            loot: lootObject,
            silver: this.currentSession.silver,
            totalValue,
            itemCount
        };
    }

    private calculateTotalValue(): number {
        // TODO: Implement value calculation based on template item values
        // For now, just return silver
        return this.currentSession.silver;
    }

    public getCurrentSession(): LootSession {
        return { ...this.currentSession };
    }

    public isSessionActive(): boolean {
        return this.currentSession.startTime !== null && this.currentSession.endTime === null;
    }

    public getStatus(): BotStatus {
        return {
            initialized: this.isInitialized,
            ocrReady: this.ocr ? this.ocr.isReady() : false,
            currentLocation: this.currentSession.location,
            sessionActive: this.isSessionActive(),
            lastProcessTime: null // TODO: Track last process time
        };
    }

    public reloadTemplates(): void {
        if (this.ocr) {
            this.ocr.reloadTemplates();
            console.log('Templates reloaded');
        }
    }

    public resetSession(): void {
        this.currentSession = {
            location: this.currentSession.location, // Keep location
            loot: new Map(),
            silver: 0,
            startTime: null,
            endTime: null
        };
        console.log('Session reset');
    }

    // New method for processing OCR results directly (for FastOCR integration)
    public async processOCRResults(ocrResults: Array<{ text: string; confidence: number; bbox: number[][] }>): Promise<{ success: boolean; itemsFound: number; items?: LootMatch[]; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, itemsFound: 0, error: 'Bot not initialized' };
        }

        if (!this.isSessionActive()) {
            return { success: false, itemsFound: 0, error: 'No active session. Start a session first.' };
        }

        try {
            console.log(`\n🔍 PROCESSING ${ocrResults.length} OCR RESULTS FROM FASTOCR:`);
            ocrResults.forEach((result, index) => {
                console.log(`  ${index + 1}. "${result.text}" (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
            });
            
            // Match against loot table items using the same logic as processLootDrop
            const matches = this.matchItemsFromOCR(ocrResults);
            
            if (matches.length > 0) {
                console.log(`\n✅ FOUND ${matches.length} LOOT MATCHES!`);
                // Add matches to session
                for (const match of matches) {
                    this.addToSession(match);
                }
                
                return {
                    success: true,
                    itemsFound: matches.length,
                    items: matches
                };
            } else {
                console.log('\n❌ No loot items matched from FastOCR results');
                return {
                    success: true,
                    itemsFound: 0,
                    items: []
                };
            }
        } catch (error) {
            return { 
                success: false, 
                itemsFound: 0, 
                error: `Failed to process OCR results: ${error}` 
            };
        }
    }

    public matchItemsFromOCR(ocrResults: Array<{ text: string; confidence: number; bbox: number[][] }>): LootMatch[] {
        const matches: LootMatch[] = [];
        
        console.log(`=== TEMPLATE MATCHING ===`);
        console.log(`Loot table items loaded: ${this.lootTableItems.length}`);
        
        if (this.lootTableItems.length === 0) {
            console.log('❌ No loot table items loaded for matching');
            return matches;
        }

        console.log(`OCR Results to match: ${ocrResults.length}`);
        
        for (const ocrResult of ocrResults) {
            const detectedText = ocrResult.text.trim().toLowerCase();
            
            console.log(`\n--- Processing OCR text: "${ocrResult.text}" ---`);
            console.log(`Cleaned text: "${detectedText}"`);
            console.log(`Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
            
            // Skip very short or low confidence text
            if (detectedText.length < 2) {
                console.log(`❌ Skipped: too short (${detectedText.length} chars)`);
                continue;
            }
            
            if (ocrResult.confidence < 0.3) { // Lower threshold for testing
                console.log(`❌ Skipped: low confidence (${(ocrResult.confidence * 100).toFixed(1)}%)`);
                continue;
            }

            let foundMatch = false;
            
            // Try to match against loot table items
            for (const item of this.lootTableItems) {
                const itemName = item.name.toLowerCase();
                
                // Exact match
                if (detectedText.includes(itemName)) {
                    console.log(`✅ EXACT MATCH FOUND: "${item.name}"`);
                    matches.push({
                        item: item.name,
                        quantity: this.extractQuantity(detectedText) || 1,
                        confidence: ocrResult.confidence,
                        method: 'exact',
                        originalText: ocrResult.text,
                        bbox: ocrResult.bbox
                    });
                    foundMatch = true;
                    break;
                }
                
                // Fuzzy match (partial match)
                else if (this.fuzzyMatch(detectedText, itemName)) {
                    console.log(`🔍 FUZZY MATCH FOUND: "${item.name}" for text "${detectedText}"`);
                    matches.push({
                        item: item.name,
                        quantity: this.extractQuantity(detectedText) || 1,
                        confidence: ocrResult.confidence * 0.8,
                        method: 'fuzzy',
                        originalText: ocrResult.text,
                        bbox: ocrResult.bbox
                    });
                    foundMatch = true;
                    break;
                }
            }
            
            if (!foundMatch) {
                console.log(`❌ No match found for: "${detectedText}"`);
            }
        }

        console.log(`=== MATCHING COMPLETE: ${matches.length} matches found ===\n`);
        return matches;
    }

    private extractQuantity(text: string): number | null {
        // Look for patterns like "x5", "5x", "5 ", " 5"
        const quantityMatch = text.match(/(?:x\s*)?(\d+)(?:\s*x)?/i);
        if (quantityMatch) {
            const quantity = parseInt(quantityMatch[1]);
            return quantity > 0 ? quantity : null;
        }
        return null;
    }

    private fuzzyMatch(text: string, itemName: string): boolean {
        // Simple fuzzy matching - check if item name appears in detected text
        return text.includes(itemName) || itemName.includes(text);
    }
}
