import { TemplateOCR, LootMatch } from './templateOCR';
import { UserPreferences } from '../db/types';

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

    constructor() {
        this.ocr = new TemplateOCR();
        this.isInitialized = false;
        this.userPreferences = null;
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

    public setUserPreferences(preferences: UserPreferences): void {
        this.userPreferences = preferences;
        if (this.ocr) {
            this.ocr.setUserPreferences(preferences);
        }
    }

    public async setGrindLocation(locationName: string): Promise<{ success: boolean; error?: string }> {
        if (!this.isInitialized) {
            return { success: false, error: 'Bot not initialized' };
        }

        const success = this.ocr.setLocation(locationName);
        if (success) {
            this.currentSession.location = locationName;
            console.log(`Grind location set to: ${locationName}`);
            return { success: true };
        }
        
        return { 
            success: false, 
            error: `Unknown location: ${locationName}. Available locations: ${this.getAvailableLocations().join(', ')}` 
        };
    }

    public getAvailableLocations(): string[] {
        return this.ocr ? this.ocr.getAllLocations() : [];
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
}
